# 🚂 RailReplan AI — Focused Railway Disruption Recovery Agent

> **An AI Railway Disruption Recovery Agent that turns natural-language incident reports into mathematically optimized, safety-validated, and controller-approved recovery timetables in seconds.**

---

## 🎯 Product Objective

When a railway controller reports an operational disruption in natural language, RailReplan AI:

1. **Understands the Incident**: Parses natural language incident reports into structured incident parameters.
2. **Identifies Affected Trains**: Filters trains traversing the disruption zone during the disruption window.
3. **Calculates Disruption Impact**: Computes unmitigated cascading delays, track headway conflicts, and platform conflicts.
4. **Generates an Optimized Recovery Schedule**: Solves a Google OR-Tools CP-SAT model to minimize delay costs subject to dwell, running, headway, and platform constraints.
5. **Independently Validates the Schedule**: Checks section headways (≥ 5 min), platform berthing non-overlap (3 min buffer), and usable platform length physical fit.
6. **Explains the Recommendation**: Generates a transparent decision rationale grounded in Indian Railways operating rules (G&SR 9.07 & Fog SOP).
7. **Requests Human Controller Approval**: Enforces an explicit human-in-the-loop gate before any change is made.
8. **Applies Recovery Plan to Simulator**: Commits the approved recovery timetable to the authoritative simulation state.

---

## 🧩 The 5 Core Components

```
                                 [ Railway Controller ]
                                           │
                              Natural-Language Incident
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           1. AI ORCHESTRATOR                                    │
│   • Groq LLM / Regex Incident Parser    • Rulebook Evidence Retrieval (G&SR)    │
│   • Decision Rationale Generator        • Approval & Execution State Manager    │
└──────────────┬───────────────────────────┬───────────────────────────┬──────────┘
               │                           │                           │
               ▼                           ▼                           ▼
┌─────────────────────────────┐ ┌─────────────────────────────┐ ┌─────────────────┐
│   2. IMPACT ANALYSIS TOOL   │ │  3. RECOVERY OPTIMIZATION   │ │  4. INDEPENDENT │
│                             │ │            TOOL             │ │SAFETY VALIDATION│
│ • Filters affected trains   │ │ • Google OR-Tools CP-SAT    │ │ • Track headways│
│ • Unmitigated delay cascade │ │ • Min delay & penalties     │ │ • Platform fits │
│ • Section headway conflicts │ │ • Hard vs soft constraints  │ │ • Non-overlap   │
│ • Platform berthing clash   │ │ • Optimal in < 0.1s         │ │ • Approval gate │
└─────────────────────────────┘ └─────────────────────────────┘ └────────┬────────┘
                                                                         │
                                                             Valid Plan  │
                                                                         ▼
                                                        ┌─────────────────┐
                                                        │ 5. SIMULATOR    │
                                                        │ • Authoritative │
                                                        │   corridor state│
                                                        │ • Live telemetry│
                                                        └─────────────────┘
```

1. **One AI Orchestrator (`railreplan.agents.orchestrator.AIOrchestrator`)**:
   Coordinates incident parsing, impact evaluation, CP-SAT optimization, rulebook evidence grounding, and human approval workflow. No complex multi-agent negotiations or fake consensus scores.
2. **Impact Analysis Tool (`railreplan.agents.orchestrator.ImpactAnalysisTool`)**:
   Deterministic Python analysis calculating cascading delays under do-nothing conditions, detecting headway clashes (single/double line) and platform overlaps.
3. **Recovery Optimization Tool (`railreplan.agents.orchestrator.RecoveryOptimizationTool`)**:
   Google OR-Tools CP-SAT formulation minimizing priority-weighted delays and station dwell variances. Enforces headway against both affected trains and fixed corridor traffic.
4. **Independent Safety Validation Tool (`railreplan.sim.validator.SafetyValidator`)**:
   Strict independent validator checking section headway (≥ 5 min), platform occupation clearance (3 min buffer), usable platform length fit, and minimum dwells. Rejecting any infeasible or unsafe plan.
5. **Small Railway Simulator (`railreplan.sim.engine.SimulationEngine`)**:
   Demonstrates initial baseline schedule, active disruption delays, recovery plan execution, and updated schedule upon controller approval.

### Optional Supporting Capability
- **Railway Rulebook Copilot (`railreplan.rag.engine.RulebookRAG`)**: Grounded G&SR and Fog SOP retrieval available on-demand when the controller asks operating-rule questions.

---

## 🖥️ Single Primary Workspace UI

The React application is consolidated into **one primary control-room workspace** with 4 dedicated sections:

- **Section A — Disruption Input**: Natural-language report input box, quick scenario presets (e.g. Fog Agra Cantt 60m), and interactive 702 km corridor schematic strip.
- **Section B — Impact Analysis**: Affected train cards with priority badges, unmitigated cascading delay summary, and track/platform conflict logs.
- **Section C — AI Recovery Recommendation**: AI decision explanation with rulebook citations, delay reduction metric card, safety validation banner, and compact original vs. revised timetable.
- **Section D — Controller Approval**: Status badge, safety compliance confirmation, **"Approve Recovery Plan"** and **"Reject"** actions, and simulation update verification.

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Python 3.11+
- Node.js 18+

### 2. Start Backend Server
```bash
python -m uvicorn railreplan.api.server:app --port 8000
```
- Interactive API Docs: `http://localhost:8000/docs`
- Health Check: `http://localhost:8000/api/health`
- WebSocket Telemetry: `ws://localhost:8000/ws/events`

### 3. Start Frontend UI
```bash
cd frontend2/frontend2
npm run dev
```
- Open `http://localhost:5173` in your browser.

---

## 🧪 Automated Test Suite

Run the full end-to-end recovery agent test verifying incident parsing, impact projection, CP-SAT optimization, safety validation, and controller approval:
```bash
python -m pytest backend/tests/test_recovery_agent_e2e.py -v
```

Run unit validation and benchmark tests:
```bash
python -m pytest backend/tests/test_validation_and_benchmark.py -v
```

Run comprehensive system smoke test:
```bash
python backend/tests/test_smoke.py
```

---

## 🎬 3-Minute Demonstration Script

See [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md) for the step-by-step controller walkthrough featuring the primary scenario:
**Heavy radiation fog near Agra Cantt for 60 minutes capping speeds at 45 km/h**.
