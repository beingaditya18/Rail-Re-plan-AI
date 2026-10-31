# 🚀 RailReplan — Localhost Quickstart Guide

This guide explains how to start the **RailReplan** Railway Disruption Replanning System on your local machine.

---

## 📋 Prerequisites
1. **Python 3.11+** installed and available in your terminal (`python --version`).
2. **Node.js 18+** & **npm** installed (`node -v` & `npm -v`).
3. Port **8000** (FastAPI backend) and Port **5173** (Vite React frontend) available.

---

## ⚡ Option A: One-Click Startup (Windows)

Double-click **`start.bat`** in the project folder, or run:

```cmd
start.bat
```

This will automatically launch:
1. The **FastAPI Backend Server** in one terminal window (`http://localhost:8000`).
2. The **Vite Control Room Frontend** in a second terminal window (`http://localhost:5173`).
3. Your default web browser opening to the dashboard.

---

## 🛠️ Option B: Manual Startup (Two Terminals)

### Terminal 1 — Backend API Server (FastAPI + Uvicorn)
Open PowerShell or Command Prompt in the repository root (`kmrl_dashboard_full`):

```powershell
python -m uvicorn railreplan.api.server:app --app-dir backend --port 8000 --reload
```

- **Health Status**: [http://localhost:8000/api/health](http://localhost:8000/api/health)
- **Interactive Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Live WebSocket Telemetry**: `ws://localhost:8000/ws/events`

---

### Terminal 2 — Frontend Control Room (Vite + React)
Open a second terminal window:

```powershell
cd frontend2/frontend2
npm run dev
```

- **Control Room Dashboard**: [http://localhost:5173](http://localhost:5173)

---

## 🧪 Option C: Run Automated Smoke Test

To verify the entire pipeline (corridor data generation, CP-SAT solver, multi-agent negotiation, plan approval, alert generation, and Groq Copilot chat) in under 10 seconds:

```powershell
python backend/tests/test_smoke.py
```

Expected output:
```
🚂 [1/6] Generating corridor data...
   ✓ Generated 9 stations, 8 sections, 35 trains, 116 crew
🤖 [2/6] Initializing Orchestrator & Agents...
   ✓ Multi-Agent system initialized
⚠️ [3/6] Injecting Disruption: Fog at Mathura (speed cap 45 km/h, 120 min)...
   ✓ Plan ID: PLAN-XXXXXXXX
   ✓ Policy: agent, Total Delay: 1696.0 min
   ✓ Affected Trains: 35, Solve Time: 0.03s
   ✓ Agent Negotiation Messages: 376
✅ [4/6] Chief Controller Approves Plan...
   ✓ Status: approved, Alerts Generated: 1660
💬 [5/6] Testing Copilot Controller Assistant...
   ✓ Copilot Answer: **Reason for the delay of 12002...**
   ✓ Rulebook Evidence Cited: 3 claims
🔮 [6/6] Testing What-If Scenario Evaluation...
   ✓ What-If Data: {'hypothetical_extension_min': 90, ...}

🎉 ALL 6 SMOKE TEST STEPS PASSED SUCCESSFULLY!
```

---

## 🌐 Localhost Port & URL Summary

| Component | URL | Purpose |
|---|---|---|
| **Control Room UI** | `http://localhost:5173` | Interactive Section Controller Dashboard |
| **Backend API Health** | `http://localhost:8000/api/health` | Backend status, Groq & Serper connectivity |
| **API Documentation** | `http://localhost:8000/docs` | Interactive OpenAPI / Swagger UI |
| **Corridor Overview** | `http://localhost:8000/api/corridor/overview` | Live train positions and track topology |
| **WebSocket Stream** | `ws://localhost:8000/ws/events` | 2Hz live train tracking and deliberation events |

---

## 🎮 How to Test in the Browser

1. Navigate to `http://localhost:5173`.
2. Observe the **Simulation Clock** advancing from `05:00 IST` and live train blips moving on the **NDLS—BPL Corridor Schematic**.
3. Under the schematic, click any preset disruption:
   - **Fog Mathura**: Radiation fog with 45 km/h speed cap.
   - **Track Block MTJ-AGC**: Emergency line block with single-line working.
   - **Loco Fail 12002**: Bhopal Shatabdi traction motor failure.
4. Watch the **Multi-Agent Deliberation Stream** (Schedule Agent, Platform Agent, Crew Agent) resolve conflicts and reach consensus.
5. In the **AI Re-Plan Review Table**, click **"Approve Plan (Chief Controller)"**.
6. Check the **3-Way Policy Impact Matrix** showing **>70% delay reduction** vs the do-nothing baseline.
7. Ask questions in the **G&SR Copilot** panel (e.g. *"Why divert 12002?"* or *"What if fog lasts 90 min longer?"*).
8. Explore the tabs at the top: **Marey Time-Distance**, **Platform Gantt**, **Crew Rosters (HOER)**, **Passenger Alerts (English + Hindi)**, and **Audit Log**.

---

## 🔧 Troubleshooting

### Port 8000 is already in use
```powershell
# Find and stop process using port 8000
netstat -ano | findstr :8000
taskkill /PID <PID_NUMBER> /F
```

### Port 5173 is already in use
Vite will automatically offer to run on `http://localhost:5174`. Update `API_BASE` in `frontend2/frontend2/src/api.js` if necessary.

### Backend missing dependencies
```powershell
python -m pip install fastapi uvicorn pydantic ortools simpy httpx python-dotenv pyyaml sentence-transformers rank-bm25
```
