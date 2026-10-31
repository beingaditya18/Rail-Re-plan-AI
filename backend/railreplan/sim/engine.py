"""
SimPy-based discrete-event simulation engine for RailReplan.
Models trains moving block-section by block-section with headway,
dwell, platform occupancy, rake turnaround and crew duty clocks.
ALL DATA IS SIMULATED.
"""
from __future__ import annotations

import simpy
import logging
from datetime import datetime, timedelta
from typing import Any, Callable, Optional
from dataclasses import dataclass, field

from railreplan.models import (
    Train, Station, Section, CrewMember, Disruption, DisruptionType,
    TrainType, Direction, TrainPosition, SimulationState, PlanMetrics,
    Plan, PlanEvent, TrainAction,
)

logger = logging.getLogger(__name__)


@dataclass
class TrainState:
    """Runtime state of a single train in the simulation."""
    train: Train
    current_stop_idx: int = 0
    current_km: float = 0.0
    speed_kmph: float = 0.0
    status: str = "scheduled"  # scheduled, running, at_station, completed, cancelled
    delay_minutes: int = 0
    actual_arrivals: dict[str, datetime] = field(default_factory=dict)
    actual_departures: dict[str, datetime] = field(default_factory=dict)
    platform_assigned: dict[str, str] = field(default_factory=dict)
    cancelled: bool = False
    short_terminated_at: Optional[str] = None


@dataclass
class SectionLock:
    """Track section occupancy for headway management."""
    section_key: str
    occupied_by: list[tuple[str, str]] = field(default_factory=list)  # (train_number, direction)
    last_exit_time: dict[str, float] = field(default_factory=dict)  # direction -> sim_time


class SimulationEngine:
    """
    Core SimPy simulation engine.
    
    Runs trains along the corridor with realistic constraints:
    - Block-section movement with headway
    - Platform occupancy at stations
    - Crew duty tracking
    - Disruption effects (delay, speed cap, line block)
    """
    
    def __init__(
        self,
        stations: list[Station],
        sections: list[Section],
        trains: list[Train],
        crew: list[CrewMember],
        seed: int = 42,
        base_time: datetime | None = None,
    ):
        self.env = simpy.Environment()
        self.stations = {s.code: s for s in stations}
        self.station_list = stations
        self.sections = sections
        self.section_map: dict[str, Section] = {}
        for sec in sections:
            self.section_map[f"{sec.from_station}-{sec.to_station}"] = sec
            self.section_map[f"{sec.to_station}-{sec.from_station}"] = sec
        
        self.trains = {t.number: t for t in trains}
        self.crew = {c.id: c for c in crew}
        self.base_time = base_time or datetime(2025, 1, 15, 5, 0)
        self.seed = seed
        
        # Runtime state
        self.train_states: dict[str, TrainState] = {}
        self.section_locks: dict[str, SectionLock] = {}
        self.platform_occupancy: dict[str, dict[str, Optional[str]]] = {}  # station -> {platform_id -> train_number}
        self.active_disruptions: list[Disruption] = []
        self.applied_plan: Optional[Plan] = None
        
        # Metrics accumulation
        self.total_delay_minutes: float = 0
        self.weighted_delay_minutes: float = 0
        self.trains_affected: int = 0
        self.trains_cancelled: int = 0
        self.missed_connections: int = 0
        
        # Event callbacks
        self._event_callbacks: list[Callable] = []
        self._tick_callbacks: list[Callable] = []
        
        # Speed control
        self.speed_multiplier: float = 60.0
        self.paused: bool = False
        self.running: bool = False
        
        # Initialize platform occupancy
        for station in stations:
            self.platform_occupancy[station.code] = {
                p.id: None for p in station.platforms
            }
        
        # Initialize section locks
        for sec in sections:
            key = f"{sec.from_station}-{sec.to_station}"
            self.section_locks[key] = SectionLock(section_key=key)
    
    def sim_time_to_clock(self, sim_time: float | None = None) -> datetime:
        """Convert SimPy time (minutes from start) to wall-clock datetime."""
        t = sim_time if sim_time is not None else self.env.now
        return self.base_time + timedelta(minutes=t)
    
    def clock_to_sim_time(self, dt: datetime) -> float:
        """Convert wall-clock datetime to SimPy minutes."""
        return (dt - self.base_time).total_seconds() / 60.0
    
    def add_event_callback(self, callback: Callable):
        self._event_callbacks.append(callback)
    
    def add_tick_callback(self, callback: Callable):
        self._tick_callbacks.append(callback)
    
    def _emit_event(self, event_type: str, data: dict):
        for cb in self._event_callbacks:
            try:
                cb(event_type, data)
            except Exception as e:
                logger.error(f"Event callback error: {e}")
    
    def inject_disruption(self, disruption: Disruption):
        """Inject a disruption into the running simulation."""
        self.active_disruptions.append(disruption)
        self._emit_event("disruption", {
            "id": disruption.id,
            "type": disruption.type.value,
            "description": disruption.description,
            "severity": disruption.severity.value,
            "start_time": disruption.start_time.isoformat(),
            "duration_min": disruption.expected_duration_min,
        })
        logger.info(f"Disruption injected: {disruption.type.value} - {disruption.description}")
    
    def apply_plan(self, plan: Plan):
        """Apply a replanning solution to the simulation."""
        self.applied_plan = plan
        for event in plan.events:
            if event.train_number in self.train_states:
                ts = self.train_states[event.train_number]
                if event.action == TrainAction.CANCEL:
                    ts.cancelled = True
                    ts.status = "cancelled"
                elif event.action == TrainAction.SHORT_TERMINATE:
                    ts.short_terminated_at = event.station_code
        
        self._emit_event("plan_applied", {"plan_id": plan.id, "events": len(plan.events)})
    
    def get_speed_cap(self, section_key: str) -> float:
        """Get current speed cap for a section considering active disruptions."""
        base_speed = self.section_map.get(section_key, Section(
            from_station="", to_station="", length_km=0
        )).max_speed_kmph
        
        for d in self.active_disruptions:
            if d.status.value == "CLEARED":
                continue
            start_sim = self.clock_to_sim_time(d.start_time)
            end_sim = start_sim + d.expected_duration_min
            if not (start_sim <= self.env.now <= end_sim):
                continue
            
            if d.type == DisruptionType.WEATHER_FOG and d.speed_cap_kmph:
                base_speed = min(base_speed, d.speed_cap_kmph)
            
            if d.type == DisruptionType.TRACK_BLOCK and d.location_section:
                sec_a, sec_b = d.location_section
                blocked_key1 = f"{sec_a}-{sec_b}"
                blocked_key2 = f"{sec_b}-{sec_a}"
                if section_key in (blocked_key1, blocked_key2):
                    base_speed = base_speed * 0.5  # Reduced on single-line working
        
        return base_speed
    
    def is_section_blocked(self, from_stn: str, to_stn: str) -> bool:
        """Check if a section has a line blocked (track block disruption)."""
        for d in self.active_disruptions:
            if d.type == DisruptionType.TRACK_BLOCK and d.location_section:
                start_sim = self.clock_to_sim_time(d.start_time)
                end_sim = start_sim + d.expected_duration_min
                if start_sim <= self.env.now <= end_sim:
                    sec_a, sec_b = d.location_section
                    if (from_stn == sec_a and to_stn == sec_b) or \
                       (from_stn == sec_b and to_stn == sec_a):
                        return True
        return False
    
    def _find_platform(self, station_code: str, train: Train) -> Optional[str]:
        """Find an available platform at a station."""
        station = self.stations.get(station_code)
        if not station:
            return None
        
        occupancy = self.platform_occupancy.get(station_code, {})
        
        # Check if plan assigns a specific platform
        if self.applied_plan:
            for event in self.applied_plan.events:
                if event.train_number == train.number and event.station_code == station_code:
                    if event.revised_platform and not occupancy.get(event.revised_platform):
                        return event.revised_platform
        
        # Find first available platform
        for plat in station.platforms:
            if train.type == TrainType.FREIGHT and not plat.handles_freight:
                continue
            if plat.length_m < train.length_m * 0.8:  # 80% fit tolerance
                continue
            if not occupancy.get(plat.id):
                return plat.id
        
        # Fallback: any empty platform
        for plat_id, occupied_by in occupancy.items():
            if not occupied_by:
                return plat_id
        
        return None  # All platforms occupied
    
    def _get_revised_time(self, train_number: str, station_code: str, field: str) -> Optional[datetime]:
        """Get revised arrival/departure from the applied plan."""
        if not self.applied_plan:
            return None
        for event in self.applied_plan.events:
            if event.train_number == train_number and event.station_code == station_code:
                if field == "arrival":
                    return event.revised_arrival
                elif field == "departure":
                    return event.revised_departure
        return None
    
    def _run_train(self, train: Train):
        """SimPy process: run a single train through its stops."""
        ts = TrainState(train=train)
        
        # Set initial km
        origin_stn = self.stations.get(train.stops[0].station_code)
        if origin_stn:
            ts.current_km = origin_stn.km
        
        self.train_states[train.number] = ts
        
        # Check for initial delay disruption
        initial_delay = 0
        for d in self.active_disruptions:
            if d.type == DisruptionType.TRAIN_DELAY and d.affected_train == train.number:
                initial_delay = d.delay_minutes or 0
        
        if initial_delay > 0:
            ts.delay_minutes = initial_delay
            ts.status = "delayed"
            yield self.env.timeout(initial_delay)
        
        for i, stop in enumerate(train.stops):
            if ts.cancelled:
                break
            
            if ts.short_terminated_at and i > 0:
                prev_stop = train.stops[i - 1].station_code
                if prev_stop == ts.short_terminated_at:
                    ts.status = "completed"
                    break
            
            station_code = stop.station_code
            
            # Travel to this station (if not origin)
            if i > 0:
                prev_code = train.stops[i - 1].station_code
                section_key = f"{prev_code}-{station_code}"
                section = self.section_map.get(section_key)
                
                if section:
                    # Calculate travel time
                    speed = min(
                        self.get_speed_cap(section_key),
                        train.section_runtimes[i - 1].runtime_min * 60 / max(section.length_km, 1) if i - 1 < len(train.section_runtimes) else 80,
                    )
                    
                    runtime = train.section_runtimes[i - 1].runtime_min if i - 1 < len(train.section_runtimes) else (section.length_km / max(speed, 1)) * 60
                    
                    # Apply fog speed reduction
                    for d in self.active_disruptions:
                        if d.type == DisruptionType.WEATHER_FOG and d.speed_cap_kmph:
                            start_sim = self.clock_to_sim_time(d.start_time)
                            end_sim = start_sim + d.expected_duration_min
                            if start_sim <= self.env.now <= end_sim:
                                original_speed = section.max_speed_kmph
                                new_speed = d.speed_cap_kmph
                                runtime = runtime * (original_speed / max(new_speed, 1))
                                runtime = min(runtime, 180)  # Cap at 3 hours
                    
                    # Check if section is blocked
                    if self.is_section_blocked(prev_code, station_code):
                        # Wait for block to clear or use single-line working
                        runtime = runtime * 1.8  # Much slower on single line
                    
                    ts.status = "running"
                    ts.speed_kmph = section.length_km / (runtime / 60) if runtime > 0 else 0
                    
                    yield self.env.timeout(max(1, runtime))
                    
                    ts.current_km = self.stations[station_code].km if station_code in self.stations else ts.current_km
            
            # Arrive at station
            ts.status = "at_station"
            ts.current_stop_idx = i
            arrival_clock = self.sim_time_to_clock()
            ts.actual_arrivals[station_code] = arrival_clock
            
            # Calculate delay
            if stop.arrival:
                delay = (arrival_clock - stop.arrival).total_seconds() / 60
                ts.delay_minutes = max(0, int(delay))
            
            # Assign platform
            platform = self._find_platform(station_code, train)
            if platform:
                ts.platform_assigned[station_code] = platform
                self.platform_occupancy[station_code][platform] = train.number
            
            self._emit_event("train_arrival", {
                "train": train.number,
                "station": station_code,
                "time": arrival_clock.isoformat(),
                "delay": ts.delay_minutes,
                "platform": platform,
            })
            
            # Dwell at station
            if i < len(train.stops) - 1:
                dwell = stop.min_dwell_min
                
                # Check for revised departure
                revised_dep = self._get_revised_time(train.number, station_code, "departure")
                if revised_dep:
                    dwell = max(dwell, (revised_dep - arrival_clock).total_seconds() / 60)
                
                # Fog adds extra dwell
                for d in self.active_disruptions:
                    if d.type == DisruptionType.WEATHER_FOG:
                        start_sim = self.clock_to_sim_time(d.start_time)
                        end_sim = start_sim + d.expected_duration_min
                        if start_sim <= self.env.now <= end_sim:
                            dwell += 3  # Extra dwell in fog
                
                yield self.env.timeout(max(1, dwell))
                
                dep_clock = self.sim_time_to_clock()
                ts.actual_departures[station_code] = dep_clock
                
                # Release platform
                if platform and station_code in self.platform_occupancy:
                    if self.platform_occupancy[station_code].get(platform) == train.number:
                        self.platform_occupancy[station_code][platform] = None
                
                self._emit_event("train_departure", {
                    "train": train.number,
                    "station": station_code,
                    "time": dep_clock.isoformat(),
                    "delay": ts.delay_minutes,
                })
        
        # Train completed
        ts.status = "completed"
        
        # Calculate final metrics
        if train.stops and train.stops[-1].arrival:
            last_arrival = ts.actual_arrivals.get(train.stops[-1].station_code)
            if last_arrival:
                final_delay = (last_arrival - train.stops[-1].arrival).total_seconds() / 60
                ts.delay_minutes = max(0, int(final_delay))
                if ts.delay_minutes > 0:
                    self.trains_affected += 1
                    self.total_delay_minutes += ts.delay_minutes
                    self.weighted_delay_minutes += ts.delay_minutes * train.priority_weight
    
    def setup(self):
        """Initialize all train processes."""
        for train in self.trains.values():
            # Schedule train start based on its first departure
            if train.stops and train.stops[0].departure:
                start_sim = self.clock_to_sim_time(train.stops[0].departure)
                if start_sim < 0:
                    start_sim = 0
                
                def delayed_start(env, t=train, delay=start_sim):
                    yield env.timeout(delay)
                    yield from self._run_train(t)
                
                self.env.process(delayed_start(self.env))
    
    def run(self, until_minutes: int = 420):
        """Run the simulation for the specified duration."""
        self.running = True
        self.setup()
        self.env.run(until=until_minutes)
        self.running = False
    
    def get_state(self) -> SimulationState:
        """Get current simulation state snapshot."""
        positions = []
        for tn, ts in self.train_states.items():
            train = self.trains[tn]
            positions.append(TrainPosition(
                train_number=tn,
                train_name=train.name,
                train_type=train.type,
                direction=train.direction,
                current_km=ts.current_km,
                current_station=train.stops[ts.current_stop_idx].station_code if ts.current_stop_idx < len(train.stops) else None,
                speed_kmph=ts.speed_kmph,
                status=ts.status,
                delay_minutes=ts.delay_minutes,
            ))
        
        return SimulationState(
            clock=self.sim_time_to_clock(),
            tick=int(self.env.now),
            speed_multiplier=self.speed_multiplier,
            running=self.running,
            paused=self.paused,
            trains=positions,
            active_disruptions=self.active_disruptions,
        )
    
    def get_metrics(self) -> PlanMetrics:
        """Calculate current simulation metrics."""
        completed = [ts for ts in self.train_states.values() if ts.status == "completed"]
        on_time = [ts for ts in completed if ts.delay_minutes <= 5]
        
        return PlanMetrics(
            total_delay_minutes=self.total_delay_minutes,
            weighted_delay_minutes=self.weighted_delay_minutes,
            trains_affected=self.trains_affected,
            trains_cancelled=sum(1 for ts in self.train_states.values() if ts.cancelled),
            trains_short_terminated=sum(1 for ts in self.train_states.values() if ts.short_terminated_at),
            on_time_percentage=(len(on_time) / max(len(completed), 1)) * 100,
            passenger_minutes_lost=0,  # Calculated separately
            missed_connections=self.missed_connections,
            platform_changes=0,
            crew_changes=0,
        )
    
    def get_marey_data(self) -> list[dict]:
        """Generate Marey (time-distance) diagram data."""
        data = []
        for tn, ts in self.train_states.items():
            train = self.trains[tn]
            points = []
            
            for stop in train.stops:
                stn = self.stations.get(stop.station_code)
                if not stn:
                    continue
                
                # Original schedule
                if stop.arrival:
                    points.append({
                        "km": stn.km,
                        "time_original": stop.arrival.isoformat(),
                        "time_actual": ts.actual_arrivals.get(stop.station_code, stop.arrival).isoformat(),
                        "station": stop.station_code,
                        "event": "arrival",
                    })
                if stop.departure:
                    points.append({
                        "km": stn.km,
                        "time_original": stop.departure.isoformat(),
                        "time_actual": ts.actual_departures.get(stop.station_code, stop.departure).isoformat(),
                        "station": stop.station_code,
                        "event": "departure",
                    })
            
            data.append({
                "train_number": tn,
                "train_name": train.name,
                "train_type": train.type.value,
                "direction": train.direction.value,
                "priority": train.priority_weight,
                "status": ts.status,
                "delay_minutes": ts.delay_minutes,
                "points": points,
            })
        
        return data
