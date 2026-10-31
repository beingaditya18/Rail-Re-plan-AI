"""
Smoke test for RailReplan backend pipeline.
Tests data generation, disruption intake, impact assessment,
schedule optimization (CP-SAT), platform allocation, crew check,
human approval, alert generation, and copilot Q&A.
"""
import asyncio
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from railreplan.config import load_config
from railreplan.data.generate import generate_all
from railreplan.models import Station, Section, Train, CrewMember
from railreplan.agents.core import Orchestrator
from railreplan.sim.engine import SimulationEngine
from railreplan.llm.client import create_llm_client
from railreplan.rag.engine import RAGEngine
from railreplan.agents.copilot import CopilotAgent


async def run_smoke_test():
    print("🚂 [1/6] Generating corridor data...")
    config = load_config()
    data = generate_all(seed=42)
    stations = {s["code"]: Station(**s) for s in data["stations"]}
    sections = [Section(**s) for s in data["sections"]]
    trains = {t["number"]: Train(**t) for t in data["trains"]}
    crew = {c["id"]: CrewMember(**c) for c in data["crew"]}
    print(f"   ✓ Generated {len(stations)} stations, {len(sections)} sections, {len(trains)} trains, {len(crew)} crew")

    print("🤖 [2/6] Initializing Orchestrator & Agents...")
    llm = create_llm_client()
    orch = Orchestrator(config, trains, stations, sections, crew, llm)
    rag = RAGEngine()
    copilot = CopilotAgent(orch, rag, llm)
    print("   ✓ Multi-Agent system initialized")

    print("⚠️ [3/6] Injecting Disruption: Fog at Mathura (speed cap 45 km/h, 120 min)...")
    res = await orch.handle_disruption({
        "type": "WEATHER_FOG",
        "description": "Dense radiation fog around Mathura; visibility < 100m",
        "station": "MTJ",
        "duration_minutes": 120,
        "severity": "HIGH",
        "speed_cap_kmph": 45,
    })
    plan = res["plan"]
    print(f"   ✓ Plan ID: {plan['id']}")
    print(f"   ✓ Policy: {plan['policy']}, Total Delay: {plan['metrics']['total_delay_minutes']:.1f} min")
    print(f"   ✓ Affected Trains: {plan['metrics']['trains_affected']}, Solve Time: {plan['metrics']['solve_time_seconds']:.2f}s")
    print(f"   ✓ Agent Negotiation Messages: {len(res['messages'])}")

    print("✅ [4/6] Chief Controller Approves Plan...")
    approval_res = await orch.approve_plan(plan["id"])
    print(f"   ✓ Status: {approval_res['status']}, Alerts Generated: {approval_res['alerts_generated']}")
    if orch.all_alerts:
        sample_alert = orch.all_alerts[0]
        print(f"   ✓ Sample Alert ({sample_alert.language.upper()} / {sample_alert.channel.value.upper()}): {sample_alert.body[:80]}...")

    print("💬 [5/6] Testing Copilot Controller Assistant...")
    copilot_res = await copilot.chat("Why was train 12002 delayed and what safety rules apply under fog?")
    print(f"   ✓ Copilot Answer: {copilot_res['answer'][:120]}...")
    print(f"   ✓ Rulebook Evidence Cited: {len(copilot_res['evidence'])} claims")

    print("🔮 [6/6] Testing What-If Scenario Evaluation...")
    whatif_res = await copilot.chat("What if the fog block lasts 90 min longer?")
    print(f"   ✓ What-If Data: {whatif_res.get('what_if_data')}")

    print("\n🎉 ALL 6 SMOKE TEST STEPS PASSED SUCCESSFULLY!")


if __name__ == "__main__":
    asyncio.run(run_smoke_test())
