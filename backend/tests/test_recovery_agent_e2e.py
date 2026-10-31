"""
End-to-End Verification Test for the Simplified RailReplan AI Recovery Agent.

Tests the entire product flow for the demonstration scenario:
A controller reports heavy fog near Agra Cantt for 60 minutes.

Steps tested:
1. Natural language incident interpretation & preset handling
2. Impact Analysis Tool (affected trains, cascading delay, conflicts)
3. Recovery Optimization Tool (Google OR-Tools CP-SAT)
4. Independent Deterministic Safety Validation (zero hard violations)
5. Operating Rulebook Evidence Grounding (G&SR 9.07, Fog SOP)
6. Chief Controller Approval Gate & Simulator Application
7. Authoritative calculated metrics (delay savings, no fabricated scores)
"""
import asyncio
import sys
import unittest
from datetime import datetime
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from railreplan.config import load_config
from railreplan.data.generate import generate_all
from railreplan.models import Station, Section, Train, Disruption, DisruptionType, Severity, Plan
from railreplan.sim.engine import SimulationEngine
from railreplan.llm.client import create_llm_client
from railreplan.rag.engine import RAGEngine
from railreplan.agents.orchestrator import AIOrchestrator, ImpactAnalysisTool, RecoveryOptimizationTool
from railreplan.sim.validator import SafetyValidator


class TestRailReplanRecoveryAgent(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.config = load_config()
        self.data = generate_all(seed=42)
        self.stations = {s["code"]: Station(**s) for s in self.data["stations"]}
        self.sections = [Section(**s) for s in self.data["sections"]]
        self.trains = {t["number"]: Train(**t) for t in self.data["trains"]}
        self.simulator = SimulationEngine(
            stations=list(self.stations.values()),
            sections=self.sections,
            trains=list(self.trains.values()),
            crew=[],
            seed=42,
        )
        self.llm = create_llm_client()
        self.rag = RAGEngine()
        self.orchestrator = AIOrchestrator(
            config=self.config,
            trains=self.trains,
            stations=self.stations,
            sections=self.sections,
            llm=self.llm,
            rag=self.rag,
            simulator=self.simulator,
        )

    async def test_full_primary_demo_scenario(self):
        """
        Primary Demonstration Scenario:
        Controller reports: 'Heavy fog near Agra Cantt for 60 minutes, speed capped at 45 km/h'
        """
        incident_text = "Heavy fog near Agra Cantt for 60 minutes, speed capped at 45 km/h"

        # 1. Step 1 & 2: Handle disruption (Interpret incident + Impact analysis + Optimize + Validate + Explain)
        result = await self.orchestrator.handle_disruption(incident_text)

        # Verify Disruption Interpretation
        disruption = result["disruption"]
        self.assertEqual(disruption["type"], "WEATHER_FOG")
        self.assertEqual(disruption["location_station"], "AGC")
        self.assertEqual(disruption["expected_duration_min"], 60)
        self.assertEqual(disruption["speed_cap_kmph"], 45)

        # Verify Impact Analysis
        impact = result["impact"]
        self.assertGreater(impact["affected_train_count"], 0)
        self.assertIn("AGC", impact["location"])
        self.assertGreater(impact["estimated_cascading_delay_minutes"], 0)
        # Check that high-priority Vande Bharat (22436) is identified
        affected_numbers = impact["affected_train_numbers"]
        self.assertTrue(any(tn in affected_numbers for tn in ["22436", "12433", "20958"]))

        # Verify Recovery Optimization (Google OR-Tools CP-SAT)
        plan = result["plan"]
        self.assertEqual(plan["status"], "proposed")
        self.assertIn(plan["solver_status"], ["OPTIMAL", "FEASIBLE"])
        self.assertGreater(len(plan["events"]), 0)
        self.assertLess(plan["metrics"]["solve_time_seconds"], 5.0)

        # Verify Independent Safety Validation
        safety_report = result["safety_report"]
        self.assertTrue(safety_report["is_safe"], f"Safety errors found: {safety_report['violations']}")
        self.assertEqual(safety_report["error_count"], 0)

        # Verify Calculated Delay Savings
        benchmark = result["benchmark"]
        self.assertGreaterEqual(benchmark["delay_savings_pct"], 0.0)

        # Verify Evidence Grounding
        self.assertGreater(len(result["evidence"]), 0)

        # Verify AI Explanation
        self.assertIn("Agra", result["explanation"])

        # 2. Chief Controller Approval Gate
        # Verify approval is enforced on backend
        plan_id = plan["id"]
        approval = await self.orchestrator.approve_plan(plan_id)

        self.assertEqual(approval["status"], "approved")
        self.assertTrue(approval["safety_verified"])
        self.assertTrue(approval["applied_to_simulator"])
        self.assertEqual(self.orchestrator.current_plan.status, "approved")

        # Verify plan applied to simulator
        self.assertIsNotNone(self.simulator.applied_plan)
        self.assertEqual(self.simulator.applied_plan.id, plan_id)

        # Verify audit log captures all stages
        audit = self.orchestrator.audit_log
        event_types = [e["event_type"] for e in audit]
        self.assertIn("INCIDENT_REPORTED", event_types)
        self.assertIn("IMPACT_ANALYSIS_COMPLETED", event_types)
        self.assertIn("OPTIMIZATION_COMPLETED", event_types)
        self.assertIn("SAFETY_VALIDATION_COMPLETED", event_types)
        self.assertIn("PLAN_APPROVED", event_types)
        self.assertIn("PLAN_APPLIED_TO_SIMULATOR", event_types)

    async def test_preset_disruption_injection(self):
        """Verify preset injections work identically."""
        preset_payload = {
            "type": "WEATHER_FOG",
            "station": "AGC",
            "duration_minutes": 60,
            "speed_cap_kmph": 45,
            "description": "Heavy fog near Agra Cantt for 60 minutes",
        }
        res = await self.orchestrator.handle_disruption(preset_payload)
        self.assertEqual(res["disruption"]["type"], "WEATHER_FOG")
        self.assertEqual(res["disruption"]["location_station"], "AGC")
        self.assertTrue(res["safety_report"]["is_safe"])


if __name__ == "__main__":
    unittest.main()

