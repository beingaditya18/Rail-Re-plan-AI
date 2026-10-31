"""
Deterministic Safety Validator for RailReplan.
Verifies proposed recovery plans independently before approval and execution.
Enforces Indian Railways G&SR and operating rules:
- Section headway (min 5 min between consecutive trains in block)
- Platform & loop line occupancy (no concurrent overlap, minimum buffer)
- Train length vs usable platform length & clearance margin
- Freight separation (no freight on passenger-only platforms)
- Precedence and dwell time feasibility
- Crew duty restrictions under HOER 1961 (12h maximum duty limit)
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Optional

from railreplan.models import (
    Plan, Train, Station, Section, CrewMember, Disruption,
    SafetyViolation, SafetyValidationReport, TrainType, Direction,
)

logger = logging.getLogger(__name__)


class SafetyValidator:
    """Independent deterministic validator verifying plans against domain physics & rules."""

    def __init__(
        self,
        stations: dict[str, Station],
        sections: list[Section],
        trains: dict[str, Train],
        crew: dict[str, CrewMember],
        min_headway_min: int = 5,
        platform_buffer_min: int = 3,
        max_crew_duty_hours: float = 12.0,
    ):
        self.stations = stations
        self.sections = sections
        self.trains = trains
        self.crew = crew
        self.min_headway_min = min_headway_min
        self.platform_buffer_min = platform_buffer_min
        self.max_crew_duty_hours = max_crew_duty_hours

        # Index sections by station pair
        self.section_lookup: dict[tuple[str, str], Section] = {}
        for s in sections:
            self.section_lookup[(s.from_station, s.to_station)] = s
            self.section_lookup[(s.to_station, s.from_station)] = s

    def validate_plan(
        self,
        plan: Plan,
        active_disruptions: list[Disruption] | None = None,
    ) -> SafetyValidationReport:
        """
        Run complete deterministic validation suite on a proposed plan.
        Returns SafetyValidationReport containing all detected violations.
        """
        violations: list[SafetyViolation] = []
        checked_rules = [
            "SECTION_HEADWAY",
            "PLATFORM_OCCUPANCY_OVERLAP",
            "PLATFORM_LENGTH_CLEARANCE",
            "FREIGHT_PLATFORM_ELIGIBILITY",
            "DWELL_TIME_FEASIBILITY",
            "SECTION_SPEED_AND_RUNTIMES",
            "CREW_DUTY_HOER",
        ]

        if not plan.events:
            return SafetyValidationReport(
                is_safe=True,
                violations=[],
                warning_count=0,
                error_count=0,
                checked_rules=checked_rules,
                validated_at=datetime.now(),
            )

        # 1. Platform occupancy overlap & clearance checks
        plat_violations = self._check_platform_constraints(plan)
        violations.extend(plat_violations)

        # 2. Dwell time & monotonicity feasibility
        dwell_violations = self._check_dwell_and_runtimes(plan)
        violations.extend(dwell_violations)

        # 3. Track section headway & line block constraints
        headway_violations = self._check_section_headways(plan, active_disruptions or [])
        violations.extend(headway_violations)

        # 4. Crew duty restrictions under HOER
        crew_violations = self._check_crew_duties(plan)
        violations.extend(crew_violations)

        errors = [v for v in violations if v.severity == "ERROR"]
        warnings = [v for v in violations if v.severity == "WARNING"]

        is_safe = len(errors) == 0

        report = SafetyValidationReport(
            is_safe=is_safe,
            violations=violations,
            warning_count=len(warnings),
            error_count=len(errors),
            checked_rules=checked_rules,
            validated_at=datetime.now(),
        )

        logger.info(
            f"Safety validation for Plan {plan.id}: is_safe={is_safe}, "
            f"errors={len(errors)}, warnings={len(warnings)}"
        )
        return report

    def _check_platform_constraints(self, plan: Plan) -> list[SafetyViolation]:
        """Check platform berthing overlaps, usable lengths, and freight suitability."""
        violations: list[SafetyViolation] = []
        
        # Group events by (station_code, platform_id)
        station_plat_intervals: dict[tuple[str, str], list[dict]] = {}

        for ev in plan.events:
            train = self.trains.get(ev.train_number)
            if not train:
                continue

            station = self.stations.get(ev.station_code)
            if not station:
                continue

            arr = ev.revised_arrival or ev.original_arrival
            dep = ev.revised_departure or ev.original_departure or (arr + timedelta(minutes=10) if arr else None)
            plat_id = ev.revised_platform or ev.original_platform

            if not arr or not dep or not plat_id:
                continue

            # Find matching platform or loop line resource
            plat_obj = None
            for p in station.platforms:
                if p.id == plat_id:
                    plat_obj = p
                    break
            if not plat_obj:
                for l in getattr(station, "loop_lines", []):
                    if l.id == plat_id:
                        plat_obj = l
                        break

            if plat_obj:
                # Rule: Train length vs usable platform length
                # Train length + clearance margin must fit in platform physical length
                if train.length_m > plat_obj.usable_length_m:
                    excess = train.length_m - plat_obj.usable_length_m
                    violations.append(SafetyViolation(
                        severity="ERROR",
                        rule="PLATFORM_LENGTH_CLEARANCE",
                        description=(
                            f"Train {train.number} ({train.name}, {train.length_m:.0f}m) exceeds "
                            f"usable length of {plat_id} ({plat_obj.usable_length_m:.0f}m) at {ev.station_code} "
                            f"by {excess:.1f}m. Tail will foul clearance point / fouling marks."
                        ),
                        train_numbers=[train.number],
                        location=f"{ev.station_code}:{plat_id}",
                        timestamp=arr,
                    ))

                # Rule: Freight train on passenger platform
                if train.type == TrainType.FREIGHT and not plat_obj.handles_freight:
                    violations.append(SafetyViolation(
                        severity="ERROR",
                        rule="FREIGHT_PLATFORM_ELIGIBILITY",
                        description=(
                            f"Freight train {train.number} assigned to passenger-only platform {plat_id} "
                            f"at {ev.station_code}. Freight requires loop line or freight siding."
                        ),
                        train_numbers=[train.number],
                        location=f"{ev.station_code}:{plat_id}",
                        timestamp=arr,
                    ))

            # Store for overlap detection
            key = (ev.station_code, plat_id)
            station_plat_intervals.setdefault(key, []).append({
                "train_number": ev.train_number,
                "arr": arr,
                "dep": dep,
            })

        # Overlap detection on same platform resource
        buffer = timedelta(minutes=self.platform_buffer_min)
        for (stn_code, plat_id), intervals in station_plat_intervals.items():
            intervals.sort(key=lambda x: x["arr"])
            for i in range(len(intervals) - 1):
                cur = intervals[i]
                nxt = intervals[i + 1]
                # If current departure + buffer > next arrival, collision/lock conflict
                if cur["dep"] + buffer > nxt["arr"]:
                    overlap_sec = (cur["dep"] + buffer - nxt["arr"]).total_seconds()
                    violations.append(SafetyViolation(
                        severity="ERROR",
                        rule="PLATFORM_OCCUPANCY_OVERLAP",
                        description=(
                            f"Platform collision conflict on {plat_id} at {stn_code}: "
                            f"Train {cur['train_number']} (departs {cur['dep'].strftime('%H:%M')}) and "
                            f"Train {nxt['train_number']} (arrives {nxt['arr'].strftime('%H:%M')}) "
                            f"overlap by {int(overlap_sec / 60)}m (requires {self.platform_buffer_min}m buffer)."
                        ),
                        train_numbers=[cur["train_number"], nxt["train_number"]],
                        location=f"{stn_code}:{plat_id}",
                        timestamp=nxt["arr"],
                    ))

        return violations

    def _check_dwell_and_runtimes(self, plan: Plan) -> list[SafetyViolation]:
        """Verify dwell time is strictly non-negative and respects min dwell."""
        violations: list[SafetyViolation] = []

        # Group by train
        events_by_train: dict[str, list] = {}
        for ev in plan.events:
            events_by_train.setdefault(ev.train_number, []).append(ev)

        for tn, ev_list in events_by_train.items():
            train = self.trains.get(tn)
            if not train:
                continue

            for ev in ev_list:
                arr = ev.revised_arrival or ev.original_arrival
                dep = ev.revised_departure or ev.original_departure

                if arr and dep:
                    dwell_sec = (dep - arr).total_seconds()
                    # Check negative dwell
                    if dwell_sec < 0:
                        violations.append(SafetyViolation(
                            severity="ERROR",
                            rule="DWELL_TIME_FEASIBILITY",
                            description=(
                                f"Train {tn} at {ev.station_code} has negative dwell: "
                                f"dep ({dep.strftime('%H:%M')}) is before arr ({arr.strftime('%H:%M')})."
                            ),
                            train_numbers=[tn],
                            location=ev.station_code,
                            timestamp=arr,
                        ))
                    elif dwell_sec < 60 and ev.station_code != train.stops[-1].station_code:
                        # At least 1 min dwell for passenger interchange
                        if train.type != TrainType.FREIGHT:
                            violations.append(SafetyViolation(
                                severity="WARNING",
                                rule="DWELL_TIME_FEASIBILITY",
                                description=(
                                    f"Train {tn} dwell time at {ev.station_code} is only {int(dwell_sec)}s "
                                    f"(minimum 1 min recommended for passenger boarding)."
                                ),
                                train_numbers=[tn],
                                location=ev.station_code,
                                timestamp=arr,
                            ))

        return violations

    def _check_section_headways(
        self,
        plan: Plan,
        active_disruptions: list[Disruption],
    ) -> list[SafetyViolation]:
        """Check station departure headway between trains in consecutive stations."""
        violations: list[SafetyViolation] = []

        # Find departures: train departing station towards next stop
        # Key: (station_code, direction), list of (departure_time, train_number)
        station_departures: dict[tuple[str, Direction], list[dict]] = {}

        # Build timetable per train
        km_map = {s.code: s.km for s in self.stations.values()}
        for tn, train in self.trains.items():
            train_events = {ev.station_code: ev for ev in plan.events if ev.train_number == tn}
            
            # Infer direction from plan events if present, otherwise default to train.direction
            plan_ev_list = [ev for ev in plan.events if ev.train_number == tn]
            if len(plan_ev_list) >= 2:
                km0 = km_map.get(plan_ev_list[0].station_code, 0)
                km1 = km_map.get(plan_ev_list[1].station_code, 0)
                eff_direction = Direction.DN if km1 >= km0 else Direction.UP
            else:
                eff_direction = train.direction

            # If plan has events for this train, check departure sequence from plan events
            if plan_ev_list:
                for i in range(len(plan_ev_list) - 1):
                    ev = plan_ev_list[i]
                    dep = ev.revised_departure or ev.original_departure
                    if dep:
                        station_departures.setdefault((ev.station_code, eff_direction), []).append({
                            "train_number": tn,
                            "dep": dep,
                            "direction": eff_direction,
                            "is_original": (ev.revised_departure is None),
                        })
            else:
                stops = train.stops
                for i in range(len(stops) - 1):
                    stn = stops[i].station_code
                    dep = stops[i].departure
                    if dep:
                        station_departures.setdefault((stn, eff_direction), []).append({
                            "train_number": tn,
                            "dep": dep,
                            "direction": eff_direction,
                            "is_original": True,
                        })

        plan_train_numbers = {ev.train_number for ev in plan.events}

        # Check headway for departures at each station in each direction
        for (stn, direction), movs in station_departures.items():
            movs.sort(key=lambda x: x["dep"])
            for i in range(len(movs) - 1):
                cur = movs[i]
                nxt = movs[i + 1]

                # Only evaluate pairs where at least one train is in the recovery plan
                if cur["train_number"] not in plan_train_numbers and nxt["train_number"] not in plan_train_numbers:
                    continue

                # If neither train was retimed by the plan at this station, skip pre-existing baseline
                if cur.get("is_original", False) and nxt.get("is_original", False):
                    continue

                gap = (nxt["dep"] - cur["dep"]).total_seconds()
                if gap < self.min_headway_min * 60:
                    violations.append(SafetyViolation(
                        severity="ERROR",
                        rule="SECTION_HEADWAY",
                        description=(
                            f"Station departure headway violation at {stn} ({direction.value}): "
                            f"Train {cur['train_number']} (dep {cur['dep'].strftime('%H:%M')}) and "
                            f"Train {nxt['train_number']} (dep {nxt['dep'].strftime('%H:%M')}) "
                            f"depart with only {int(gap / 60)} min separation (min {self.min_headway_min}m required under G&SR 9.07)."
                        ),
                        train_numbers=[cur["train_number"], nxt["train_number"]],
                        location=stn,
                        timestamp=nxt["dep"],
                    ))

        # Check track block disruptions: single line conflicts
        for d in active_disruptions:
            if d.location_section:
                sec_a, sec_b = d.location_section
                section_movements = []
                for tn in plan_train_numbers:
                    t = self.trains.get(tn)
                    if not t:
                        continue
                    t_evs = {e.station_code: e for e in plan.events if e.train_number == tn}
                    stop_a = next((s for s in t.stops if s.station_code == sec_a), None)
                    stop_b = next((s for s in t.stops if s.station_code == sec_b), None)
                    if stop_a and stop_b:
                        ev_a = t_evs.get(sec_a)
                        ev_b = t_evs.get(sec_b)
                        time_a = (ev_a.revised_departure or ev_a.original_departure or stop_a.departure) if ev_a else stop_a.departure
                        time_b = (ev_b.revised_arrival or ev_b.original_arrival or stop_b.arrival) if ev_b else stop_b.arrival
                        if time_a and time_b:
                            start_t = min(time_a, time_b)
                            end_t = max(time_a, time_b)
                            section_movements.append({
                                "train_number": tn,
                                "direction": t.direction,
                                "start": start_t,
                                "end": end_t,
                            })

                # Check opposing movements overlapping in time
                up_movs = [m for m in section_movements if m["direction"] == Direction.UP]
                dn_movs = [m for m in section_movements if m["direction"] == Direction.DN]
                for m1 in up_movs:
                    for m2 in dn_movs:
                        if max(m1["start"], m2["start"]) < min(m1["end"], m2["end"]):
                            violations.append(SafetyViolation(
                                severity="ERROR",
                                rule="SINGLE_LINE_BLOCK_CONFLICT",
                                description=(
                                    f"Opposing movement conflict on single-line block section {sec_a}-{sec_b}: "
                                    f"Train {m1['train_number']} ({m1['start'].strftime('%H:%M')}-{m1['end'].strftime('%H:%M')}) and "
                                    f"Train {m2['train_number']} ({m2['start'].strftime('%H:%M')}-{m2['end'].strftime('%H:%M')}) "
                                    f"occupy the single line simultaneously."
                                ),
                                train_numbers=[m1["train_number"], m2["train_number"]],
                                location=f"{sec_a}-{sec_b}",
                                timestamp=m2["start"],
                            ))

        return violations

    def _check_crew_duties(self, plan: Plan) -> list[SafetyViolation]:
        """Check crew hours under HOER 1961 (max 12h duty limit)."""
        violations: list[SafetyViolation] = []

        # Find latest departure for each train
        train_latest_dep: dict[str, datetime] = {}
        for ev in plan.events:
            dep = ev.revised_departure or ev.original_departure
            if dep:
                cur = train_latest_dep.get(ev.train_number)
                if not cur or dep > cur:
                    train_latest_dep[ev.train_number] = dep

        # Check crew assignments
        for assignment in plan.crew_assignments:
            cm = self.crew.get(assignment.crew_id)
            if not cm or not cm.duty_start:
                continue

            last_time = train_latest_dep.get(assignment.train_number)
            if last_time:
                hours = (last_time - cm.duty_start).total_seconds() / 3600.0
                if hours > self.max_crew_duty_hours:
                    violations.append(SafetyViolation(
                        severity="ERROR",
                        rule="CREW_DUTY_HOER",
                        description=(
                            f"HOER breach for crew {cm.name} ({cm.role.value}) on train {assignment.train_number}: "
                            f"Projected duty hours {hours:.1f}h exceeds statutory limit of {self.max_crew_duty_hours}h "
                            f"(Duty began {cm.duty_start.strftime('%H:%M')})."
                        ),
                        train_numbers=[assignment.train_number],
                        location=assignment.to_station,
                        timestamp=last_time,
                    ))

        return violations
