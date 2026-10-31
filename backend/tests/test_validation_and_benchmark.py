"""
Unit and integration tests for RailReplan domain validation, safety checks,
CP-SAT optimization, agent negotiation, approval gating, and benchmark calculation.
"""
import sys
import unittest
from datetime import datetime, timedelta
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from railreplan.config import load_config
from railreplan.data.generate import generate_all, generate_stations, generate_trains
from railreplan.models import (
    Station, Section, Train, CrewMember, Platform, Plan, PlanEvent, PlanMetrics,
    Disruption, DisruptionType, Severity, TrainType, Direction, SolverStatus
)
from railreplan.sim.validator import SafetyValidator
from railreplan.sim.benchmark import BenchmarkRunner
from railreplan.agents.core import Orchestrator, ScheduleOptimizer
from railreplan.rag.engine import RAGEngine
from railreplan.llm.client import create_llm_client


class TestDomainDataValidation(unittest.TestCase):
    def setUp(self):
        self.data = generate_all(seed=101)
        self.stations = {s["code"]: Station(**s) for s in self.data["stations"]}
        self.sections = [Section(**s) for s in self.data["sections"]]
        self.trains = {t["number"]: Train(**t) for t in self.data["trains"]}
        self.crew = {c["id"]: CrewMember(**c) for c in self.data["crew"]}

    def test_corridor_cumulative_distances(self):
        """Stations must have strictly increasing cumulative km along corridor NDLS->BPL."""
        km_list = [s.km for s in self.stations.values()]
        self.assertEqual(km_list, sorted(km_list))
        self.assertEqual(self.stations["NDLS"].km, 0.0)
        self.assertEqual(self.stations["BPL"].km, 702.0)

    def test_train_rake_configurations(self):
        """Train coaches and physical lengths must match authentic rolling stock models."""
        for tr in self.trains.values():
            self.assertGreater(tr.length_m, 0)
            self.assertGreater(tr.coaches, 0)
            if tr.type == TrainType.VANDE_BHARAT:
                self.assertEqual(tr.coaches, 16)
                self.assertAlmostEqual(tr.length_m, 384.0, delta=1.0)
            elif tr.type == TrainType.FREIGHT:
                self.assertEqual(tr.coaches, 58)
                self.assertAlmostEqual(tr.length_m, 685.0, delta=5.0)

    def test_platform_and_loop_resources(self):
        """Each station must have passenger platforms and dedicated loop lines."""
        for stn in self.stations.values():
            self.assertGreaterEqual(len(stn.platforms), 2)
            self.assertGreaterEqual(stn.loops, 1)
            self.assertGreaterEqual(len(stn.loop_lines), 1)
            for plat in stn.platforms:
                self.assertGreaterEqual(plat.usable_length_m, 400.0)
                self.assertEqual(plat.clearance_margin_m, 25.0)
            for loop in stn.loop_lines:
                self.assertEqual(loop.resource_type, "loop_line")
                self.assertTrue(loop.handles_freight)


class TestSafetyValidator(unittest.TestCase):
    def setUp(self):
        data = generate_all(seed=42)
        self.stations = {s["code"]: Station(**s) for s in data["stations"]}
        self.sections = [Section(**s) for s in data["sections"]]
        self.trains = {t["number"]: Train(**t) for t in data["trains"]}
        self.crew = {c["id"]: CrewMember(**c) for c in data["crew"]}
        self.validator = SafetyValidator(self.stations, self.sections, self.trains, self.crew)

    def test_platform_length_clearance_violation(self):
        """Validator must catch a train that exceeds usable platform length."""
        now = datetime(2026, 10, 28, 8, 0, 0)
        # Create freight train (685m) assigned to short platform (450m)
        short_plat = Platform(
            id="AGC-P1", station_code="AGC", platform_number=1,
            length_m=450.0, usable_length_m=450.0, clearance_margin_m=25.0,
            handles_freight=True, resource_type="platform"
        )
        self.stations["AGC"].platforms = [short_plat]
        validator = SafetyValidator(self.stations, self.sections, self.trains, self.crew)

        # Event with freight train FGHT01 (685m) at AGC-P1
        events = [
            PlanEvent(
                train_number="FGHT01",
                station_code="AGC",
                original_arrival=now,
                original_departure=now + timedelta(minutes=15),
                revised_arrival=now,
                revised_departure=now + timedelta(minutes=15),
                revised_platform="AGC-P1",
            )
        ]
        plan = Plan(
            events=events,
            metrics=PlanMetrics(total_delay_minutes=0, trains_affected=1),
            disruption_id="DISR-TEST",
        )

        report = validator.validate_plan(plan)
        self.assertFalse(report.is_safe)
        self.assertTrue(any(v.rule == "PLATFORM_LENGTH_CLEARANCE" for v in report.violations))

    def test_headway_violation_detection(self):
        """Validator must detect headways under 5 minutes on the same section."""
        now = datetime(2026, 10, 28, 8, 0, 0)
        events = [
            PlanEvent(
                train_number="12002",
                station_code="MTJ",
                revised_arrival=now,
                revised_departure=now + timedelta(minutes=2),
            ),
            PlanEvent(
                train_number="12002",
                station_code="AGC",
                revised_arrival=now + timedelta(minutes=35),
                revised_departure=now + timedelta(minutes=40),
            ),
            PlanEvent(
                train_number="22436",
                station_code="MTJ",
                revised_arrival=now + timedelta(minutes=1),
                revised_departure=now + timedelta(minutes=4),  # Only 2 min headway after 12002 dep
            ),
            PlanEvent(
                train_number="22436",
                station_code="AGC",
                revised_arrival=now + timedelta(minutes=37),
                revised_departure=now + timedelta(minutes=42),
            ),
        ]
        plan = Plan(
            events=events,
            metrics=PlanMetrics(total_delay_minutes=5, trains_affected=2),
            disruption_id="DISR-TEST",
        )

        report = self.validator.validate_plan(plan)
        self.assertFalse(report.is_safe)
        self.assertTrue(any(v.rule == "SECTION_HEADWAY" for v in report.violations))


class TestBenchmarkRunner(unittest.TestCase):
    def setUp(self):
        config = load_config()
        data = generate_all(seed=77)
        self.stations = {s["code"]: Station(**s) for s in data["stations"]}
        self.sections = [Section(**s) for s in data["sections"]]
        self.trains = {t["number"]: Train(**t) for t in data["trains"]}
        self.crew = {c["id"]: CrewMember(**c) for c in data["crew"]}
        self.runner = BenchmarkRunner(self.stations, self.sections, self.trains, self.crew, config)
        self.optimizer = ScheduleOptimizer(self.trains, self.stations, self.sections, config)

    def test_benchmark_delay_reduction_formula(self):
        """Benchmark must compute delay reduction percentage using exact formula."""
        disruption = Disruption(
            type=DisruptionType.WEATHER_FOG,
            location_station="MTJ",
            start_time=datetime(2026, 10, 28, 6, 0, 0),
            expected_duration_min=90,
            speed_cap_kmph=45,
            severity=Severity.HIGH,
        )

        affected = list(self.trains.keys())[:4]
        result = self.runner.run_full_benchmark(self.optimizer, disruption, affected)
        self.assertIn("do_nothing", result)
        self.assertIn("heuristic", result)
        self.assertIn("agent", result)
        self.assertIn("delay_savings_pct", result)

        base = result["do_nothing"]["total_delay_minutes"]
        agent = result["agent"]["total_delay_minutes"]
        if base > 0:
            expected_pct = round(((base - agent) / base) * 100.0, 1)
            self.assertEqual(result["delay_savings_pct"], expected_pct)
            self.assertGreaterEqual(result["delay_savings_pct"], 0.0)


class TestRAGEngineGrounding(unittest.TestCase):
    def setUp(self):
        self.rag = RAGEngine()

    def test_local_rulebook_retrieval(self):
        """RAG Engine must retrieve grounded rulebook evidence for G&SR and HOER queries."""
        claims = self.rag.retrieve("G&SR 9.07 automatic block signaling headway", top_k=2)
        self.assertGreater(len(claims), 0)
        self.assertTrue(any("gsr" in c.source_url.lower() or "headway" in c.claim.lower() for c in claims))
        self.assertTrue(claims[0].confidence > 0.6)

    def test_crew_hoer_rulebook_retrieval(self):
        """RAG Engine must cite HOER duty limits when queried."""
        claims = self.rag.retrieve("HOER maximum loco pilot duty hours", top_k=2)
        self.assertGreater(len(claims), 0)
        self.assertTrue(any("hoer" in c.source_url.lower() or "crew" in c.claim.lower() for c in claims))


if __name__ == "__main__":
    unittest.main()
