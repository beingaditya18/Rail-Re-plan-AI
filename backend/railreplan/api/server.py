"""
RailReplan FastAPI Server.
Full REST API and WebSocket event streaming for the Railway Disruption Replanning System.
"""
from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
import json
import logging
from typing import Any, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from railreplan.config import load_config, is_llm_available, is_search_available
from railreplan.models import (
    Disruption, DisruptionType, Severity, Train, Station, Section, CrewMember,
    Plan, TrainPosition, SimulationState, WSEvent, PassengerAlert, AlertChannel,
    TrainType, Direction, ScheduledStop, Platform
)
from railreplan.data.generate import generate_all, BASELINE_DELAYS
from railreplan.sim.engine import SimulationEngine
from railreplan.llm.client import create_llm_client
from railreplan.agents.core import Orchestrator
from railreplan.rag.engine import RAGEngine
from railreplan.agents.copilot import CopilotAgent

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")


# ── Preset Disruption Scenarios ──────────────────────────────
PRESETS = {
    "fog_agra": {
        "type": "WEATHER_FOG",
        "description": "Heavy fog near Agra Cantt for 60 minutes; speed capped at 45 km/h",
        "severity": "HIGH",
        "station": "AGC",
        "duration_minutes": 60,
        "speed_cap_kmph": 45,
    },
    "track_block_mtj_agc": {
        "type": "TRACK_BLOCK",
        "description": "Emergency track block between Mathura Jn and Agra Cantt (single-line working)",
        "severity": "CRITICAL",
        "section": ["MTJ", "AGC"],
        "duration_minutes": 90,
    },
    "delay_mathura": {
        "type": "TRAIN_DELAY",
        "description": "Signal interlocking failure near Mathura Jn outer (45 min delay)",
        "severity": "MEDIUM",
        "station": "MTJ",
        "duration_minutes": 45,
        "delay_minutes": 45,
    },
    # Backwards-compatible aliases
    "fog_tundla": {
        "type": "WEATHER_FOG",
        "description": "Heavy fog near Agra Cantt for 60 minutes; speed capped at 45 km/h",
        "severity": "HIGH",
        "station": "AGC",
        "duration_minutes": 60,
        "speed_cap_kmph": 45,
    },
    "track_block_mathura": {
        "type": "TRACK_BLOCK",
        "description": "Emergency track block between Mathura Jn and Agra Cantt",
        "severity": "CRITICAL",
        "section": ["MTJ", "AGC"],
        "duration_minutes": 90,
    },
    "loco_failure_bhopal": {
        "type": "LOCO_FAILURE",
        "description": "Loco traction motor failure on 12002 Bhopal Shatabdi at Gwalior outer",
        "severity": "CRITICAL",
        "station": "GWL",
        "affected_train": "12002",
        "delay_minutes": 90,
        "duration_minutes": 90,
    },
}


# ── Global State Container ──────────────────────────────────
class AppState:
    def __init__(self):
        self.config: dict = {}
        self.raw_data: dict = {}
        self.stations: dict[str, Station] = {}
        self.sections: list[Section] = []
        self.trains: dict[str, Train] = {}
        self.crew: dict[str, CrewMember] = {}
        self.simulation: Optional[SimulationEngine] = None
        self.orchestrator: Optional[Orchestrator] = None
        self.rag: Optional[RAGEngine] = None
        self.copilot: Optional[CopilotAgent] = None
        self.llm = None
        self.sim_task: Optional[asyncio.Task] = None
        self.active_websockets: list[WebSocket] = []
        self.sim_speed: float = 30.0  # default 30x
        self.sim_running: bool = True
        self.sim_time_minutes: float = 0.0
        self.base_time = datetime(2025, 1, 15, 8, 30)
        self.sim_clock = datetime(2025, 1, 15, 8, 30)
        self.baseline_metrics: dict = {}
        self.heuristic_metrics: dict = {}

state = AppState()


# ── WebSocket Manager ───────────────────────────────────────
async def broadcast_ws(event_type: str, data: dict):
    """Broadcast an event to all connected WebSocket clients."""
    if not state.active_websockets:
        return
    message = json.dumps({
        "type": event_type,
        "timestamp": datetime.now().isoformat(),
        "data": data,
    }, default=str)
    
    dead_sockets = []
    for ws in state.active_websockets:
        try:
            await ws.send_text(message)
        except Exception:
            dead_sockets.append(ws)
    
    for ws in dead_sockets:
        if ws in state.active_websockets:
            state.active_websockets.remove(ws)


def sync_broadcast_callback(event_type: str, data: dict):
    """Synchronous callback adapter to schedule broadcast in event loop."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.create_task(broadcast_ws(event_type, data))
    except Exception as e:
        logger.debug(f"Broadcast callback schedule error: {e}")


# ── Background Simulation Loop ─────────────────────────────
async def simulation_background_loop():
    """Advances simulation clock and broadcasts state ticks."""
    logger.info("Background simulation loop started")
    while True:
        try:
            if state.sim_running:
                # 1 real second advances sim_speed / 10 minutes in 100ms intervals
                step_minutes = (state.sim_speed / 60.0) * 0.5
                state.sim_time_minutes += step_minutes
                state.sim_clock = state.base_time + timedelta(minutes=state.sim_time_minutes)
                
                # Update train positions
                train_positions = calculate_live_train_positions(state.sim_clock)
                
                # Broadcast simulation tick every ~500ms
                await broadcast_ws("sim_tick", {
                    "clock": state.sim_clock.isoformat(),
                    "sim_minutes": state.sim_time_minutes,
                    "speed": state.sim_speed,
                    "running": state.sim_running,
                    "train_positions": train_positions,
                    "active_disruptions_count": len(state.orchestrator.disruptions) if state.orchestrator else 0,
                })
            
            await asyncio.sleep(0.5)
        except asyncio.CancelledError:
            logger.info("Simulation background loop cancelled")
            break
        except Exception as e:
            logger.error(f"Error in simulation loop: {e}")
            await asyncio.sleep(1.0)


def calculate_live_train_positions(current_time: datetime) -> list[dict]:
    """Calculate interpolated positions and realistic delays for all 60+ trains along the corridor."""
    positions = []
    applied_plan = (
        state.orchestrator.current_plan
        if state.orchestrator
        and state.orchestrator.current_plan
        and state.orchestrator.current_plan.status == "approved"
        else None
    )
    plan_events_by_train = {}
    if applied_plan:
        for ev in applied_plan.events:
            plan_events_by_train.setdefault(ev.train_number, {})[ev.station_code] = ev

    station_map = state.stations
    for tn, train in state.trains.items():
        stops = train.stops
        if not stops:
            continue
        
        # Baseline simulated delay for this train (or small 0-4 min on-time jitter)
        base_d = BASELINE_DELAYS.get(tn, (int(tn[-2:]) % 4) if tn[-2:].isdigit() else 2)

        # Check start and end times
        first_dep = stops[0].departure or stops[0].arrival
        last_arr = stops[-1].arrival or stops[-1].departure
        
        # Apply planned delays if any
        train_events = plan_events_by_train.get(tn, {})
        first_event = train_events.get(stops[0].station_code)
        if first_event and first_event.revised_departure:
            first_dep = first_event.revised_departure
        last_event = train_events.get(stops[-1].station_code)
        if last_event and last_event.revised_arrival:
            last_arr = last_event.revised_arrival
        
        if not first_dep or not last_arr:
            continue
        
        if current_time < first_dep:
            # Scheduled to depart soon from origin
            stn = station_map.get(stops[0].station_code)
            status = "emergency" if base_d > 30 else ("delayed" if base_d > 5 else "scheduled")
            positions.append({
                "train_number": tn,
                "train_name": train.name,
                "train_type": train.type.value,
                "direction": train.direction.value,
                "priority": train.priority_weight,
                "status": status,
                "current_km": stn.km if stn else 0,
                "current_station": stops[0].station_code,
                "current_section": None,
                "speed_kmph": 0,
                "delay_minutes": base_d,
            })
            continue
        
        if current_time > last_arr:
            # Completed corridor trip at destination terminal
            stn = station_map.get(stops[-1].station_code)
            completed_delay = max(base_d, int((current_time - (stops[-1].arrival or current_time)).total_seconds() / 60))
            status = "emergency" if completed_delay > 30 else ("delayed" if completed_delay > 5 else "completed")
            positions.append({
                "train_number": tn,
                "train_name": train.name,
                "train_type": train.type.value,
                "direction": train.direction.value,
                "priority": train.priority_weight,
                "status": status,
                "current_km": stn.km if stn else 702,
                "current_station": stops[-1].station_code,
                "current_section": None,
                "speed_kmph": 0,
                "delay_minutes": completed_delay,
            })
            continue
        
        # Train is en-route: find segment
        found_pos = False
        for i in range(len(stops) - 1):
            s_curr = stops[i]
            s_next = stops[i + 1]
            
            dep_curr = s_curr.departure or s_curr.arrival
            arr_next = s_next.arrival or s_next.departure
            
            # Use revised times if available
            ev_curr = train_events.get(s_curr.station_code)
            if ev_curr and ev_curr.revised_departure:
                dep_curr = ev_curr.revised_departure
            ev_next = train_events.get(s_next.station_code)
            if ev_next and ev_next.revised_arrival:
                arr_next = ev_next.revised_arrival
            
            if not dep_curr or not arr_next:
                continue
            
            # Check if dwelling at current station platform
            arr_curr = s_curr.arrival or s_curr.departure
            if ev_curr and ev_curr.revised_arrival:
                arr_curr = ev_curr.revised_arrival
            
            if arr_curr and arr_curr <= current_time <= dep_curr:
                stn = station_map.get(s_curr.station_code)
                rev_delay = max(0, int((dep_curr - (s_curr.departure or dep_curr)).total_seconds() / 60))
                eff_delay = max(rev_delay, base_d)
                status = "emergency" if eff_delay > 30 else ("delayed" if eff_delay > 5 else "at_station")
                positions.append({
                    "train_number": tn,
                    "train_name": train.name,
                    "train_type": train.type.value,
                    "direction": train.direction.value,
                    "priority": train.priority_weight,
                    "status": status,
                    "current_km": stn.km if stn else 0,
                    "current_station": s_curr.station_code,
                    "current_section": None,
                    "speed_kmph": 0,
                    "delay_minutes": eff_delay,
                })
                found_pos = True
                break
            
            # Check if running in section between s_curr and s_next
            if dep_curr <= current_time <= arr_next:
                total_duration = max(1.0, (arr_next - dep_curr).total_seconds())
                elapsed = (current_time - dep_curr).total_seconds()
                ratio = min(1.0, max(0.0, elapsed / total_duration))
                
                stn_a = station_map.get(s_curr.station_code)
                stn_b = station_map.get(s_next.station_code)
                km_a = stn_a.km if stn_a else 0
                km_b = stn_b.km if stn_b else 0
                curr_km = km_a + (km_b - km_a) * ratio
                
                # Check for delay
                rev_delay = max(0, int((dep_curr - s_curr.departure).total_seconds() / 60)) if s_curr.departure else 0
                eff_delay = max(rev_delay, base_d)
                
                status = "emergency" if eff_delay > 30 else ("delayed" if eff_delay > 5 else "running")
                speed = 0 if eff_delay > 60 else (45 if eff_delay > 20 else 90)
                
                positions.append({
                    "train_number": tn,
                    "train_name": train.name,
                    "train_type": train.type.value,
                    "direction": train.direction.value,
                    "priority": train.priority_weight,
                    "status": status,
                    "current_km": round(curr_km, 1),
                    "current_station": None,
                    "current_section": [s_curr.station_code, s_next.station_code],
                    "speed_kmph": speed,
                    "delay_minutes": eff_delay,
                })
                found_pos = True
                break
        
        if not found_pos:
            stn = station_map.get(stops[0].station_code)
            status = "emergency" if base_d > 30 else ("delayed" if base_d > 5 else "running")
            positions.append({
                "train_number": tn,
                "train_name": train.name,
                "train_type": train.type.value,
                "direction": train.direction.value,
                "priority": train.priority_weight,
                "status": status,
                "current_km": stn.km if stn else 0,
                "current_station": stops[0].station_code,
                "current_section": None,
                "speed_kmph": 0,
                "delay_minutes": base_d,
            })
            
    return positions


def init_state():
    """Synchronous initialization of domain data and agent subsystems."""
    if state.orchestrator is not None:
        return
    logger.info("Initializing RailReplan Domain State & AI Orchestrator...")
    state.config = load_config()
    data = generate_all(seed=42)
    state.raw_data = data
    state.stations = {s["code"]: Station(**s) for s in data["stations"]}
    state.sections = [Section(**s) for s in data["sections"]]
    state.trains = {t["number"]: Train(**t) for t in data["trains"]}
    state.crew = {c["id"]: CrewMember(**c) for c in data["crew"]}
    state.llm = create_llm_client()
    state.simulation = SimulationEngine(
        stations=list(state.stations.values()),
        sections=state.sections,
        trains=list(state.trains.values()),
        crew=list(state.crew.values()),
        seed=42,
        base_time=state.base_time,
    )
    state.simulation.add_event_callback(sync_broadcast_callback)
    state.orchestrator = Orchestrator(
        config=state.config,
        trains=state.trains,
        stations=state.stations,
        sections=state.sections,
        crew=state.crew,
        llm=state.llm,
    )
    state.orchestrator.add_event_callback(sync_broadcast_callback)
    state.rag = RAGEngine()
    state.copilot = CopilotAgent(state.orchestrator, state.rag, state.llm)
    
    # Pre-seed initial verified bilingual passenger notifications
    if not state.orchestrator.all_alerts:
        state.orchestrator.all_alerts = [
            PassengerAlert(
                train_number="12002",
                train_name="New Delhi - Bhopal Shatabdi Express",
                channel=AlertChannel.SMS,
                language="en",
                subject="Schedule Information",
                body="⚠️ INDIAN RAILWAYS: 12002 Bhopal Shatabdi is on schedule approaching Mathura Jn (PF 1). Automated NTES tracking active.",
                recipients_count=1240,
                station_code="MTJ",
                delay_minutes=0,
                new_platform="PF 1",
                verified=True,
            ),
            PassengerAlert(
                train_number="12002",
                train_name="New Delhi - Bhopal Shatabdi Express",
                channel=AlertChannel.SMS,
                language="hi",
                subject="समय सारणी सूचना",
                body="⚠️ भारतीय रेल: 12002 भोपाल शताब्दी एक्सप्रेस मथुरा जं. (प्लेटफ़ॉर्म 1) पर निर्धारित समयानुसार अग्रसर है। एनटीईएस लाइव ट्रैकिंग सक्रिय।",
                recipients_count=1240,
                station_code="MTJ",
                delay_minutes=0,
                new_platform="PF 1",
                verified=True,
            ),
            PassengerAlert(
                train_number="22436",
                train_name="Vande Bharat Express",
                channel=AlertChannel.APP_PUSH,
                language="en",
                subject="Priority Clearance",
                body="⚡ IRCTC ALERT: 22436 Vande Bharat running with absolute Green Signal priority. Estimated arrival at Agra Cantt on-time (PF 1).",
                recipients_count=980,
                station_code="AGC",
                delay_minutes=0,
                new_platform="PF 1",
                verified=True,
            ),
            PassengerAlert(
                train_number="22436",
                train_name="Vande Bharat Express",
                channel=AlertChannel.APP_PUSH,
                language="hi",
                subject="प्राथमिकता निकासी",
                body="⚡ आईआरसीटीसी सूचना: 22436 वंदे भारत एक्सप्रेस सर्वोच्च प्राथमिकता के साथ अग्रसर है। आगरा कैंट (प्लेटफ़ॉर्म 1) पर समय पर आगमन अपेक्षित।",
                recipients_count=980,
                station_code="AGC",
                delay_minutes=0,
                new_platform="PF 1",
                verified=True,
            ),
            PassengerAlert(
                train_number="12628",
                train_name="Karnataka Express",
                channel=AlertChannel.WHATSAPP,
                language="en",
                subject="Berthing Notice",
                body="ℹ️ PASSENGER UPDATE: 12628 Karnataka Express scheduled berthing at Gwalior Jn on Platform 2 with 24-coach clearance.",
                recipients_count=1850,
                station_code="GWL",
                delay_minutes=5,
                new_platform="PF 2",
                verified=True,
            ),
            PassengerAlert(
                train_number="12628",
                train_name="Karnataka Express",
                channel=AlertChannel.WHATSAPP,
                language="hi",
                subject="प्लेटफ़ॉर्म सूचना",
                body="ℹ️ यात्री सूचना: 12628 कर्नाटक एक्सप्रेस ग्वालियर जंक्शन पर प्लेटफ़ॉर्म 2 पर 24 कोच क्लियरेंस के साथ प्रवेश करेगी।",
                recipients_count=1850,
                station_code="GWL",
                delay_minutes=5,
                new_platform="PF 2",
                verified=True,
            ),
        ]
        
    logger.info("Domain State & Agents ready.")

# Initialize domain state on load
init_state()

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_state()
    # Start Background Simulation Loop
    state.sim_task = asyncio.create_task(simulation_background_loop())
    logger.info("RailReplan Server fully initialized and running.")
    yield
    
    # Shutdown
    if state.sim_task:
        state.sim_task.cancel()
        try:
            await state.sim_task
        except asyncio.CancelledError:
            pass
    logger.info("RailReplan Server stopped.")


# ── FastAPI App Instance ───────────────────────────────────
app = FastAPI(
    title="RailReplan API",
    description="Railway Disruption Replanning Agent Backend for Indian Railways",
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS for frontend applications
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── REST Endpoints ─────────────────────────────────────────

@app.get("/api/health")
async def health_check():
    """Health and status overview."""
    return {
        "status": "operational",
        "service": "RailReplan",
        "corridor": "NDLS-BPL (North-Central India)",
        "stations_count": len(state.stations),
        "trains_count": len(state.trains),
        "crew_count": len(state.crew),
        "llm_client": state.llm.get_name() if state.llm else "None",
        "groq_available": is_llm_available(),
        "serper_available": is_search_available(),
        "sim_clock": state.sim_clock.isoformat(),
        "sim_speed": f"{state.sim_speed}x",
        "sim_running": state.sim_running,
    }


@app.get("/api/corridor/overview")
async def get_corridor_overview():
    """Returns static and dynamic corridor network data."""
    train_positions = calculate_live_train_positions(state.sim_clock)
    return {
        "stations": [s.model_dump() for s in state.stations.values()],
        "sections": [s.model_dump() for s in state.sections],
        "trains_count": len(state.trains),
        "sim_clock": state.sim_clock.isoformat(),
        "train_positions": train_positions,
        "active_disruptions": [d.model_dump(mode="json") for d in state.orchestrator.disruptions],
    }


class DisruptionInjectRequest(BaseModel):
    preset: Optional[str] = None
    free_text: Optional[str] = None
    type: Optional[str] = "WEATHER_FOG"
    description: Optional[str] = None
    station: Optional[str] = None
    section: Optional[list[str]] = None
    duration_minutes: Optional[int] = 60
    severity: Optional[str] = "HIGH"
    speed_cap_kmph: Optional[int] = None
    affected_train: Optional[str] = None
    delay_minutes: Optional[int] = None


@app.post("/api/disruptions/inject")
async def inject_disruption(payload: DisruptionInjectRequest):
    """
    Inject a disruption via preset, free text, or structured form.
    Triggers multi-agent replanning pipeline: INTAKE → IMPACT → OPTIMIZE ⇄ PLATFORM/CREW.
    """
    input_data: dict | str
    
    if payload.preset and payload.preset in PRESETS:
        input_data = PRESETS[payload.preset].copy()
    elif payload.free_text:
        input_data = payload.free_text
    else:
        input_data = {
            "type": payload.type,
            "description": payload.description or f"{payload.type} incident",
            "station": payload.station,
            "section": payload.section,
            "duration_minutes": payload.duration_minutes or 60,
            "severity": payload.severity or "HIGH",
            "speed_cap_kmph": payload.speed_cap_kmph,
            "affected_train": payload.affected_train,
            "delay_minutes": payload.delay_minutes,
        }
    
    # Broadcast injection start
    await broadcast_ws("disruption_injected", {"input": input_data})
    
    # Run Orchestrator Pipeline
    result = await state.orchestrator.handle_disruption(input_data)
    
    # Inject into simulation engine as well
    disruption_obj = state.orchestrator.disruptions[-1]
    state.simulation.inject_disruption(disruption_obj)
    
    # Broadcast plan proposal
    await broadcast_ws("plan_proposal", result["plan"])
    
    return result


@app.get("/api/disruptions")
async def list_disruptions():
    """List all injected disruptions."""
    return [d.model_dump(mode="json") for d in state.orchestrator.disruptions]


@app.get("/api/plans/proposed")
async def get_proposed_plan():
    """Get the currently proposed recovery plan awaiting human approval."""
    if not state.orchestrator.current_plan:
        raise HTTPException(status_code=404, detail="No active plan proposed yet.")
    return state.orchestrator.current_plan.model_dump(mode="json")


@app.get("/api/plans/{plan_id}")
async def get_plan_by_id(plan_id: str):
    """Get plan details by ID."""
    plan = next((p for p in state.orchestrator.all_plans if p.id == plan_id), None)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    return plan.model_dump(mode="json")


@app.post("/api/plans/{plan_id}/approve")
async def approve_plan(plan_id: str):
    """Chief Controller approves the plan, verifying deterministic safety before simulation application."""
    res = await state.orchestrator.approve_plan(plan_id)
    if res.get("status") == "safety_rejected" or "error" in res:
        raise HTTPException(status_code=422, detail=res)
    
    # Apply to simulation engine
    plan = next((p for p in state.orchestrator.all_plans if p.id == plan_id), None)
    if plan:
        state.simulation.apply_plan(plan)
    
    # Broadcast approval & alerts
    await broadcast_ws("plan_approved", {"plan_id": plan_id, "safety_verified": True})
    await broadcast_ws("alert_broadcast", {
        "count": len(state.orchestrator.all_alerts),
        "recent_alerts": [a.model_dump(mode="json") for a in state.orchestrator.all_alerts[-10:]],
    })
    
    return res


@app.post("/api/plans/{plan_id}/reject")
async def reject_plan(plan_id: str):
    """Chief Controller rejects the plan."""
    res = await state.orchestrator.reject_plan(plan_id)
    if "error" in res:
        raise HTTPException(status_code=400, detail=res["error"])
    await broadcast_ws("plan_rejected", {"plan_id": plan_id})
    return res


@app.get("/api/marey")
@app.get("/api/plans/marey")
@app.get("/api/plans//marey")
@app.get("/api/plans/{plan_id}/marey")
async def get_marey_diagram_data(plan_id: str = ""):
    """Returns coordinates for the Marey time-distance graph."""
    plan = next((p for p in state.orchestrator.all_plans if p.id == plan_id), state.orchestrator.current_plan)
    station_map = state.stations
    
    plan_events_by_train = {}
    if plan:
        for ev in plan.events:
            plan_events_by_train.setdefault(ev.train_number, {})[ev.station_code] = ev

    all_dts = []
    for train in state.trains.values():
        for stop in train.stops:
            if stop.arrival:
                all_dts.append(stop.arrival)
            if stop.departure:
                all_dts.append(stop.departure)
    
    start_window = min(all_dts) if all_dts else state.base_time
    end_window = max(all_dts) if all_dts else state.base_time + timedelta(hours=8)

    trajectories = []
    for tn, train in state.trains.items():
        original_points = []
        replanned_points = []
        train_events = plan_events_by_train.get(tn, {})
        
        for stop in train.stops:
            stn = station_map.get(stop.station_code)
            if not stn:
                continue
            
            # Scheduled points
            if stop.arrival:
                original_points.append({"time": stop.arrival.isoformat(), "km": stn.km, "stn": stn.code, "type": "arr"})
            if stop.departure:
                original_points.append({"time": stop.departure.isoformat(), "km": stn.km, "stn": stn.code, "type": "dep"})
            
            # Replanned points
            ev = train_events.get(stop.station_code)
            rev_arr = ev.revised_arrival if ev and ev.revised_arrival else stop.arrival
            rev_dep = ev.revised_departure if ev and ev.revised_departure else stop.departure
            
            if rev_arr:
                replanned_points.append({"time": rev_arr.isoformat(), "km": stn.km, "stn": stn.code, "type": "arr"})
            if rev_dep:
                replanned_points.append({"time": rev_dep.isoformat(), "km": stn.km, "stn": stn.code, "type": "dep"})
        
        trajectories.append({
            "train_number": tn,
            "train_name": train.name,
            "train_type": train.type.value,
            "direction": train.direction.value,
            "priority": train.priority_weight,
            "coaches": getattr(train, "coaches", 24),
            "length_m": getattr(train, "length_m", 550.0),
            "original_path": original_points,
            "replanned_path": replanned_points,
            "is_affected": tn in plan_events_by_train if plan else False,
        })
    
    return {
        "corridor_km": 702.0,
        "time_window": {
            "start_time": start_window.isoformat(),
            "end_time": end_window.isoformat(),
            "timezone": "IST",
        },
        "stations": [{"code": s.code, "name": s.name, "km": s.km} for s in state.stations.values()],
        "trajectories": trajectories,
        "active_disruptions": [d.model_dump(mode="json") for d in state.orchestrator.disruptions],
    }


@app.get("/api/kpi/comparison")
async def get_kpi_comparison():
    """Compare key metrics across policies using real benchmark simulation measurements."""
    return state.orchestrator.get_kpi_comparison()


@app.get("/api/alerts")
async def get_alerts(
    train: Optional[str] = None,
    language: Optional[str] = None,
    channel: Optional[str] = None,
):
    """List passenger alerts with filtering."""
    alerts = state.orchestrator.all_alerts
    if train:
        alerts = [a for a in alerts if a.train_number == train]
    if language:
        alerts = [a for a in alerts if a.language == language]
    if channel:
        alerts = [a for a in alerts if a.channel.value == channel]
    
    return [a.model_dump(mode="json") for a in alerts]


@app.get("/api/crew/status")
async def get_crew_status():
    """List crew status, duty hours, and spare pool."""
    active_plan = state.orchestrator.current_plan
    assignments = active_plan.crew_assignments if active_plan else []
    
    crew_list = []
    for c in state.crew.values():
        crew_list.append({
            "id": c.id,
            "name": c.name,
            "role": c.role.value,
            "base_station": c.base_station,
            "is_spare": c.is_spare,
            "hours_on_duty": c.hours_on_duty,
            "duty_start": c.duty_start.isoformat() if c.duty_start else None,
            "assigned_train": c.assigned_train,
        })
    
    return {
        "crew": crew_list,
        "reassignments": [a.model_dump(mode="json") for a in assignments],
        "spare_count": sum(1 for c in state.crew.values() if c.is_spare),
    }


@app.get("/api/platforms/status")
@app.get("/api/platforms/gantt")
async def get_platforms_status():
    """Returns platform and loop line layout per station with verified occupancy intervals and length checks."""
    stations_data = []
    active_plan = state.orchestrator.current_plan
    
    for stn_code, stn in state.stations.items():
        events_at_station = []
        all_resources = list(stn.platforms) + list(getattr(stn, "loop_lines", []))
        res_map = {r.id: r for r in all_resources}

        if active_plan and active_plan.events:
            for ev in active_plan.events:
                if ev.station_code == stn_code:
                    ev_dict = ev.model_dump(mode="json")
                    train = state.trains.get(ev.train_number)
                    plat_id = ev.revised_platform or ev.original_platform
                    plat_obj = res_map.get(plat_id)

                    train_len = train.length_m if train else 550.0
                    usable_len = plat_obj.usable_length_m if plat_obj else 580.0
                    
                    arr_dt = ev.revised_arrival or ev.original_arrival
                    dep_dt = ev.revised_departure or ev.original_departure
                    dur_min = max(1.0, round((dep_dt - arr_dt).total_seconds() / 60.0, 1)) if arr_dt and dep_dt else 5.0

                    ev_dict["train_name"] = train.name if train else ""
                    ev_dict["train_type"] = train.type.value if train else "MAIL_EXPRESS"
                    ev_dict["train_length_m"] = train_len
                    ev_dict["usable_platform_length_m"] = usable_len
                    ev_dict["fits_length"] = train_len <= usable_len
                    ev_dict["duration_minutes"] = dur_min
                    ev_dict["resource_type"] = getattr(plat_obj, "resource_type", "platform") if plat_obj else "platform"
                    ev_dict["handles_freight"] = getattr(plat_obj, "handles_freight", False) if plat_obj else False
                    events_at_station.append(ev_dict)
        else:
            # Scheduled berthing for trains stopping at this station
            for train in state.trains.values():
                for stop in train.stops:
                    if stop.station_code == stn_code and (stop.arrival or stop.departure):
                        # Find suitable platform by length and train type
                        suitable_plat = None
                        for p in all_resources:
                            if train.type == TrainType.FREIGHT and not p.handles_freight:
                                continue
                            if train.length_m <= p.usable_length_m:
                                suitable_plat = p
                                break
                        if not suitable_plat:
                            suitable_plat = all_resources[0] if all_resources else None

                        plat_id = suitable_plat.id if suitable_plat else f"{stn_code}-P1"
                        usable_len = suitable_plat.usable_length_m if suitable_plat else 580.0

                        arr_dt = stop.arrival
                        dep_dt = stop.departure or (arr_dt + timedelta(minutes=stop.min_dwell_min) if arr_dt else None)
                        dur_min = max(1.0, round((dep_dt - arr_dt).total_seconds() / 60.0, 1)) if arr_dt and dep_dt else 5.0

                        events_at_station.append({
                            "train_number": train.number,
                            "train_name": train.name,
                            "train_type": train.type.value,
                            "station_code": stn_code,
                            "original_arrival": arr_dt.isoformat() if arr_dt else None,
                            "original_departure": dep_dt.isoformat() if dep_dt else None,
                            "revised_arrival": arr_dt.isoformat() if arr_dt else None,
                            "revised_departure": dep_dt.isoformat() if dep_dt else None,
                            "original_platform": plat_id,
                            "revised_platform": plat_id,
                            "train_length_m": train.length_m,
                            "usable_platform_length_m": usable_len,
                            "fits_length": train.length_m <= usable_len,
                            "duration_minutes": dur_min,
                            "resource_type": getattr(suitable_plat, "resource_type", "platform") if suitable_plat else "platform",
                            "handles_freight": getattr(suitable_plat, "handles_freight", False) if suitable_plat else False,
                            "delay_minutes": 0,
                            "action": "RUN",
                        })

        # Overlap and conflict detection on each platform
        plat_intervals: dict[str, list] = {}
        for ev in events_at_station:
            pid = ev.get("revised_platform") or ev.get("original_platform")
            arr_str = ev.get("revised_arrival") or ev.get("original_arrival")
            dep_str = ev.get("revised_departure") or ev.get("original_departure")
            if pid and arr_str and dep_str:
                plat_intervals.setdefault(pid, []).append((arr_str, dep_str, ev["train_number"]))

        # Mark overlap flag on conflicting events
        overlapping_trains = set()
        for pid, ivs in plat_intervals.items():
            ivs.sort(key=lambda x: x[0])
            for i in range(len(ivs) - 1):
                if ivs[i][1] > ivs[i + 1][0]:
                    overlapping_trains.add(ivs[i][2])
                    overlapping_trains.add(ivs[i + 1][2])

        for ev in events_at_station:
            ev["is_overlapping"] = ev["train_number"] in overlapping_trains

        stations_data.append({
            "station_code": stn.code,
            "station_name": stn.name,
            "km": stn.km,
            "platforms": [p.model_dump() for p in stn.platforms],
            "loop_lines": [l.model_dump() for l in getattr(stn, "loop_lines", [])],
            "loops": stn.loops,
            "scheduled_events": events_at_station,
        })
    
    return stations_data


@app.get("/api/audit-log")
async def get_audit_log():
    """Full decision log across all agents and inter-agent message trajectory."""
    audit_entries = getattr(state.orchestrator, "audit_log", [])
    logs = audit_entries if audit_entries else []
    if not logs and state.orchestrator.current_plan:
        logs = [d.model_dump(mode="json") for d in state.orchestrator.current_plan.decision_log]
    
    messages = [m.model_dump(mode="json") for m in getattr(state.orchestrator, "all_messages", [])]
    
    return {
        "decisions": logs,
        "messages": messages,
    }


class CopilotChatRequest(BaseModel):
    query: str


@app.post("/api/copilot/chat")
async def copilot_chat(payload: CopilotChatRequest):
    """Copilot Q&A with RAG rulebook citations and decision explanations."""
    if not state.copilot:
        raise HTTPException(status_code=500, detail="Copilot not initialized")
    
    response = await state.copilot.chat(payload.query)
    return response


@app.get("/api/sim/state")
async def get_simulation_state():
    """Returns current clock, speed, and train positions."""
    train_positions = calculate_live_train_positions(state.sim_clock)
    return {
        "clock": state.sim_clock.isoformat(),
        "sim_minutes": state.sim_time_minutes,
        "speed": state.sim_speed,
        "running": state.sim_running,
        "train_positions": train_positions,
        "active_disruptions": [d.model_dump(mode="json") for d in state.orchestrator.disruptions],
    }


class SimControlRequest(BaseModel):
    action: Optional[str] = None  # "play", "pause", "step"
    speed: Optional[float] = None  # 1.0, 5.0, 15.0, 30.0, 60.0, 120.0


@app.post("/api/sim/control")
async def control_simulation(payload: SimControlRequest):
    """Play, pause, step, or adjust playback speed."""
    if payload.action == "play":
        state.sim_running = True
    elif payload.action == "pause":
        state.sim_running = False
    elif payload.action == "step":
        state.sim_time_minutes += 5.0  # step by 5 sim minutes
        state.sim_clock = state.base_time + timedelta(minutes=state.sim_time_minutes)
    
    if payload.speed is not None and payload.speed > 0:
        state.sim_speed = payload.speed
    
    await broadcast_ws("sim_control", {
        "running": state.sim_running,
        "speed": state.sim_speed,
        "clock": state.sim_clock.isoformat(),
    })
    
    return {
        "running": state.sim_running,
        "speed": state.sim_speed,
        "clock": state.sim_clock.isoformat(),
    }


@app.post("/api/sim/reset")
async def reset_simulation():
    """Reset simulation back to initial 05:00 state."""
    state.sim_time_minutes = 0.0
    state.sim_clock = state.base_time
    state.orchestrator.disruptions.clear()
    state.orchestrator.all_plans.clear()
    state.orchestrator.current_plan = None
    state.orchestrator.current_disruption = None
    state.orchestrator.latest_impact = None
    state.orchestrator.latest_benchmark = None
    if hasattr(state.orchestrator, "audit_log"):
        state.orchestrator.audit_log.clear()
    if hasattr(state.orchestrator, "all_alerts"):
        state.orchestrator.all_alerts.clear()
    if hasattr(state.orchestrator, "all_messages"):
        state.orchestrator.all_messages.clear()
    
    await broadcast_ws("sim_reset", {"clock": state.sim_clock.isoformat()})
    return {"status": "reset", "clock": state.sim_clock.isoformat()}


# ── Proactive Agentic AI Recommendations ────────────────────
PROACTIVE_RECOMMENDATIONS = [
    {
        "id": "REC-SCHED-01",
        "agent": "Schedule Agent",
        "role_badge": "SCHEDULE",
        "urgency": "CRITICAL",
        "title": "Dynamic Precedence: Loop Freight FGHT02 for 20172 Vande Bharat",
        "train_number": "FGHT02",
        "train_name": "Coal Hopper Freight",
        "affected_train": "20172",
        "location": "Dholpur Jn (DAA) Loop 1",
        "description": "Heavy Coal Freight FGHT02 (+62m delay) is operating at 50 km/h on UP Track. High-speed 20172 Vande Bharat (130 km/h) is trailing by 14 km and facing imminent yellow-aspect brake penalty.",
        "action_detail": "Divert FGHT02 into Dholpur Jn Loop Track 1 (Length: 750m) at 08:42. Lock Green aspect for 20172 Vande Bharat on Up Main Line.",
        "delay_saved_min": 28,
        "rule_ref": "Indian Railways G&SR Rule 4.14 (Priority Precedence) & Operating Manual Sec 7",
        "status": "pending",
        "action_label": "Execute Loop Precedence",
        "timestamp": datetime.now().isoformat(),
    },
    {
        "id": "REC-PLAT-02",
        "agent": "Platform Agent",
        "role_badge": "PLATFORM",
        "urgency": "HIGH",
        "title": "Platform 1 Berthing Conflict Resolution at Agra Cantt (AGC)",
        "train_number": "12156",
        "train_name": "Bhopal Express",
        "affected_train": "64182",
        "location": "Agra Cantt (AGC) Platform 1 → Platform 3",
        "description": "Delayed 64182 MEMU (+85m delay) is occupying Platform 1 at AGC. Incoming 12156 Bhopal Express (24 coaches) will be held at AGC outer home signal in 12 minutes.",
        "action_detail": "Reassign 12156 Bhopal Express to Platform 3 (Length: 650m, 24-coach clearance, passenger overbridge access). Auto-update CVIS and station master PA.",
        "delay_saved_min": 18,
        "rule_ref": "Station Working Rules (SWR) AGC Para 11 & Safe Clearance",
        "status": "pending",
        "action_label": "Reassign to Platform 3",
        "timestamp": datetime.now().isoformat(),
    },
    {
        "id": "REC-CREW-03",
        "agent": "Crew Agent",
        "role_badge": "CREW",
        "urgency": "CRITICAL",
        "title": "HOER 9h Continuous Duty Relief for 12920 Malwa Express",
        "train_number": "12920",
        "train_name": "Malwa Express",
        "affected_train": "12920",
        "location": "Gwalior Jn (GWL) Crew Lobby",
        "description": "Crew for 12920 (+45m delay) has logged 8h 25m continuous duty. Will breach 9h statutory limit under HOER 1961 before reaching Jhansi Jn.",
        "action_detail": "Call out reserve crew team GWL-C3 (LP Rajesh Sharma, Guard Amit Verma) from Gwalior Running Room for scheduled driver swap during 8-minute platform halt.",
        "delay_saved_min": 35,
        "rule_ref": "HOER Rules 1961, Section 104 (Running Staff Rest & Hours)",
        "status": "pending",
        "action_label": "Dispatch GWL Relief Crew",
        "timestamp": datetime.now().isoformat(),
    },
    {
        "id": "REC-COMMS-04",
        "agent": "Comms Agent",
        "role_badge": "COMMS",
        "urgency": "MEDIUM",
        "title": "Proactive Bilingual Broadcast for 8 Critical Delay Trains",
        "train_number": "ALL-8",
        "train_name": "Delayed Fleet (8 Rakes)",
        "affected_train": "11,450 Booked Passengers",
        "location": "Delhi-Bhopal Corridor (NDLS-BPL)",
        "description": "8 trains currently exceed the 30 min delay threshold across the section. 11,450 booked passengers are awaiting verified platform & departure updates.",
        "action_detail": "Transmit automated bilingual SMS/WhatsApp in Hindi and English with live platform numbers, expected departure times, and IRCTC catering advisory.",
        "delay_saved_min": 0,
        "rule_ref": "Citizen Charter & IRCTC Passenger Notification Protocol 2024",
        "status": "pending",
        "action_label": "Transmit Bilingual Alerts",
        "timestamp": datetime.now().isoformat(),
    },
]


@app.get("/api/agentic/recommendations")
async def get_agentic_recommendations():
    """Returns active proactive agentic AI recommendations."""
    return PROACTIVE_RECOMMENDATIONS


@app.post("/api/agentic/recommendations/{rec_id}/execute")
async def execute_agentic_recommendation(rec_id: str):
    """Executes a proactive agent recommendation with single-click human controller authorization."""
    rec = next((r for r in PROACTIVE_RECOMMENDATIONS if r["id"] == rec_id), None)
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    
    rec["status"] = "approved"
    rec["approved_at"] = datetime.now().isoformat()
    
    # Log into domain audit decision log
    from railreplan.models import DecisionLogItem, AgentRole
    role_map = {
        "Schedule Agent": AgentRole.SCHEDULE,
        "Platform Agent": AgentRole.PLATFORM,
        "Crew Agent": AgentRole.CREW,
        "Comms Agent": AgentRole.COMMS,
    }
    log_item = DecisionLogItem(
        timestamp=datetime.now(),
        agent=role_map.get(rec["agent"], AgentRole.SCHEDULE),
        action=rec["action_label"],
        rationale=f"Chief Controller executed 1-click Agentic AI Action: {rec['title']}. {rec['description']}",
        constraints_checked=[rec["rule_ref"]],
    )
    state.orchestrator.decision_log.append(log_item)
    
    # Broadcast execution event
    await broadcast_ws("agentic_action_executed", rec)
    
    return {
        "status": "success",
        "message": f"Successfully executed agentic recommendation {rec_id}",
        "recommendation": rec,
    }


@app.post("/api/agentic/recommendations/reset")
async def reset_agentic_recommendations():
    """Resets all recommendations to pending."""
    for r in PROACTIVE_RECOMMENDATIONS:
        r["status"] = "pending"
        r.pop("approved_at", None)
    await broadcast_ws("agentic_recommendations_reset", {})
    return {"status": "reset", "recommendations": PROACTIVE_RECOMMENDATIONS}


@app.get("/api/trains/fleet")
async def get_full_fleet():
    """Returns all 60+ trains with comprehensive operational status, delay, and AI context."""
    live_positions = {p["train_number"]: p for p in calculate_live_train_positions(state.sim_clock)}
    fleet = []
    
    for tn, train in state.trains.items():
        pos = live_positions.get(tn, {})
        delay = pos.get("delay_minutes", BASELINE_DELAYS.get(tn, 0))
        status = pos.get("status", "running")
        
        # Determine recommended AI action
        ai_recommendation = "Maintain regular timetable dispatch"
        if delay > 30:
            if "FGHT" in tn:
                ai_recommendation = "Loop train at nearest junction siding to clear mainline"
            elif "54" in tn or "64" in tn:
                ai_recommendation = "Platform reassignment & passenger connection protection"
            else:
                ai_recommendation = "HOER relief crew dispatch & priority track clearance"
        elif delay > 5:
            ai_recommendation = "Speed recovery up to +10 km/h where permissible by track sectional limits"
            
        fleet.append({
            "number": train.number,
            "name": train.name,
            "type": train.type.value,
            "priority": train.priority_weight,
            "direction": train.direction.value,
            "origin": train.stops[0].station_code if train.stops else "NDLS",
            "destination": train.stops[-1].station_code if train.stops else "BPL",
            "stops_count": len(train.stops),
            "delay_minutes": delay,
            "status": status,
            "current_km": pos.get("current_km", 0),
            "speed_kmph": pos.get("speed_kmph", 0),
            "current_station": pos.get("current_station"),
            "current_section": pos.get("current_section"),
            "ai_recommendation": ai_recommendation,
        })
        
    return {
        "total_trains": len(fleet),
        "on_time_count": sum(1 for t in fleet if t["delay_minutes"] <= 5),
        "delayed_count": sum(1 for t in fleet if 5 < t["delay_minutes"] <= 30),
        "emergency_count": sum(1 for t in fleet if t["delay_minutes"] > 30),
        "fleet": fleet,
    }


# ── WebSocket Endpoint ─────────────────────────────────────

@app.websocket("/ws/events")
async def websocket_events_endpoint(websocket: WebSocket):
    """Real-time event streaming for UI dashboard."""
    await websocket.accept()
    state.active_websockets.append(websocket)
    logger.info(f"WebSocket client connected. Total clients: {len(state.active_websockets)}")
    
    # Send initial welcome state
    try:
        await websocket.send_text(json.dumps({
            "type": "welcome",
            "timestamp": datetime.now().isoformat(),
            "data": {
                "clock": state.sim_clock.isoformat(),
                "speed": state.sim_speed,
                "running": state.sim_running,
                "corridor": "NDLS-BPL",
            }
        }))
        
        while True:
            # Keep socket alive and handle incoming client commands
            text = await websocket.receive_text()
            try:
                cmd = json.loads(text)
                if cmd.get("action") == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
            except Exception:
                pass
                
    except WebSocketDisconnect:
        if websocket in state.active_websockets:
            state.active_websockets.remove(websocket)
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.warning(f"WebSocket error: {e}")
        if websocket in state.active_websockets:
            state.active_websockets.remove(websocket)
