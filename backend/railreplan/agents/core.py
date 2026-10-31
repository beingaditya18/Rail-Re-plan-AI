"""
RailReplan Core Agents & Orchestration Module.
Streamlined single AI Orchestrator with genuine CP-SAT optimization,
independent safety validation, and human-in-the-loop approval.
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from railreplan.models import (
    Disruption, Plan, Station, Section, Train, CrewMember, PassengerAlert
)
from railreplan.sim.validator import SafetyValidator
from railreplan.sim.benchmark import BenchmarkRunner
from railreplan.sim.engine import SimulationEngine
from railreplan.llm.client import LLMClient
from railreplan.rag.engine import RAGEngine
from railreplan.agents.orchestrator import (
    AIOrchestrator,
    ImpactAnalysisTool,
    RecoveryOptimizationTool,
)

logger = logging.getLogger(__name__)


class BaseAgent:
    """Base class for agent logging."""
    def __init__(self):
        self.decision_log = []
        self.messages = []

    def log_decision(self, decision: str, reason: str, details: dict = None):
        logger.info(f"[{decision}] {reason}")


# ── Adapters for Backward Compatibility ──────────────────────

class ImpactAgent(ImpactAnalysisTool):
    """Backward-compatible adapter for ImpactAnalysisTool."""
    def assess(self, disruption: Disruption) -> dict[str, Any]:
        return self.analyze(disruption)


class ScheduleOptimizer(RecoveryOptimizationTool):
    """Backward-compatible adapter for RecoveryOptimizationTool."""
    def __init__(self, trains: dict[str, Train], stations: dict[str, Station], sections: list[Section], config: dict = None):
        super().__init__(trains, stations, sections, time_limit_seconds=float(config.get("optimization", {}).get("time_limit_seconds", 10.0) if config else 10.0))

    def optimize(self, disruption: Disruption, affected_trains: list[str], constraints: list = None) -> Plan:
        return super().optimize(disruption, affected_trains)


class Orchestrator(AIOrchestrator):
    """
    Primary AI Orchestrator implementing the full recovery lifecycle.
    Keeps backwards compatibility with existing test suites and server endpoints.
    """
    def __init__(
        self,
        config: dict,
        trains: dict[str, Train],
        stations: dict[str, Station],
        sections: list[Section],
        crew: dict[str, CrewMember] | None = None,
        llm: LLMClient | None = None,
        simulator: Optional[SimulationEngine] = None,
        rag: Optional[RAGEngine] = None,
    ):
        if simulator is None:
            simulator = SimulationEngine(
                stations=list(stations.values()),
                sections=sections,
                trains=list(trains.values()),
                crew=list(crew.values()) if crew else [],
                seed=42,
            )
        if rag is None:
            rag = RAGEngine()

        super().__init__(
            config=config,
            trains=trains,
            stations=stations,
            sections=sections,
            llm=llm,
            rag=rag,
            simulator=simulator,
        )
        self.crew = crew or {}
        self.all_alerts: list[PassengerAlert] = []
        self.benchmark_runner = BenchmarkRunner(stations, sections, trains, self.crew, config)

    async def handle_disruption(self, disruption_input: dict | str) -> dict[str, Any]:
        """Run the single AI Orchestrator pipeline."""
        res = await super().handle_disruption(disruption_input)
        
        # Format messages for UI deliberation feed
        plan = self.current_plan
        impact = res["impact"]
        disruption = self.current_disruption

        ui_messages = [
            {
                "agent": "INTAKE",
                "status": "complete",
                "message": f"Incident interpreted: {disruption.description} (Duration: {disruption.expected_duration_min}m, Speed Cap: {disruption.speed_cap_kmph or 45} km/h).",
            },
            {
                "agent": "IMPACT",
                "status": "complete",
                "message": f"Identified {impact['affected_train_count']} affected trains. Projected delay cascade: {impact['estimated_cascading_delay_minutes']} minutes.",
            },
            {
                "agent": "SCHEDULE",
                "status": "complete",
                "message": f"OR-Tools CP-SAT solver generated {plan.solver_status} recovery plan in {plan.metrics.solve_time_seconds}s.",
            },
            {
                "agent": "SAFETY",
                "status": "complete",
                "message": f"Independent safety validation: {'ALL CHECKS PASSED' if plan.safety_report.is_safe else 'FAILED'} (G&SR 9.07 headway & platform clearances verified).",
            },
            {
                "agent": "ORCHESTRATOR",
                "status": "complete",
                "message": f"Recommendation ready: saves {res['benchmark']['delay_saved_minutes']}m ({res['benchmark']['delay_savings_pct']}% delay reduction). Awaiting Controller Approval.",
            },
        ]
        res["messages"] = ui_messages
        return res
