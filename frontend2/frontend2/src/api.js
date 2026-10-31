/**
 * RailReplan AI - Frontend API & WebSocket Client
 * Configured with environment variables for local development and Vercel cloud deployment.
 */

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://127.0.0.1:8000"
    : "");

const WS_BASE =
  import.meta.env.VITE_WS_URL ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "ws://127.0.0.1:8000"
    : "");

/**
 * 1. Corridor Overview & Current Simulated State
 */
export async function getCorridorOverview() {
  const res = await fetch(`${API_BASE}/api/corridor/overview`);
  if (!res.ok) throw new Error(`Overview fetch failed: ${res.statusText}`);
  return res.json();
}

/**
 * 2. Get Currently Proposed Recovery Plan
 */
export async function getProposedPlan() {
  const res = await fetch(`${API_BASE}/api/plans/proposed`);
  if (!res.ok) throw new Error(`Plan fetch failed: ${res.statusText}`);
  return res.json();
}

/**
 * 3. KPI Comparison & Benchmark Delay Savings
 */
export async function getKpiComparison() {
  const res = await fetch(`${API_BASE}/api/benchmark/comparison`);
  if (!res.ok) throw new Error(`KPI fetch failed: ${res.statusText}`);
  return res.json();
}

/**
 * 4. Simulation Engine Clock Controls (play, pause, step, speed)
 */
export async function controlSim(action = "toggle", speed = 30) {
  const res = await fetch(`${API_BASE}/api/sim/control`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, speed }),
  });
  if (!res.ok) throw new Error(`Sim control failed: ${res.statusText}`);
  return res.json();
}

/**
 * 5. Reset Simulation & Clear Disruption
 */
export async function resetSim() {
  const res = await fetch(`${API_BASE}/api/sim/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Sim reset failed: ${res.statusText}`);
  return res.json();
}

/**
 * 6. Inject Disruption (Free-text Natural Language or Preset)
 */
export async function injectDisruption(payload) {
  const res = await fetch(`${API_BASE}/api/disruptions/inject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Disruption injection failed: ${res.statusText}`);
  return res.json();
}

/**
 * 7. Chief Controller Approval Gate
 */
export async function approvePlan(planId) {
  const res = await fetch(`${API_BASE}/api/plans/${planId}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Plan approval failed: ${res.statusText}`);
  return res.json();
}

/**
 * 8. Reject Plan
 */
export async function rejectPlan(planId) {
  const res = await fetch(`${API_BASE}/api/plans/${planId}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Plan rejection failed: ${res.statusText}`);
  return res.json();
}

/**
 * 9. Railway Rulebook Query (G&SR Copilot)
 */
export async function copilotChat(query) {
  const res = await fetch(`${API_BASE}/api/copilot/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: query }),
  });
  if (!res.ok) throw new Error(`Copilot chat failed: ${res.statusText}`);
  return res.json();
}

/**
 * 10. WebSocket Live Stream for Simulation Clock & Agent Telemetry
 */
export function initWebSocket(onMessage, onStatusChange) {
  if (!WS_BASE) {
    if (onStatusChange) onStatusChange(false);
    return () => {};
  }

  let ws = null;
  let shouldReconnect = true;
  let retryCount = 0;

  const connect = () => {
    try {
      const url = `${WS_BASE}/ws/events`;
      ws = new WebSocket(url);

      ws.onopen = () => {
        retryCount = 0;
        if (onStatusChange) onStatusChange(true);
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (onMessage) onMessage(parsed);
        } catch (e) {
          console.warn("WS parse error:", e);
        }
      };

      ws.onerror = () => {
        if (onStatusChange) onStatusChange(false);
      };

      ws.onclose = () => {
        if (onStatusChange) onStatusChange(false);
        if (shouldReconnect) {
          const backoff = Math.min(5000, 1000 * Math.pow(1.5, retryCount++));
          setTimeout(connect, backoff);
        }
      };
    } catch (e) {
      if (onStatusChange) onStatusChange(false);
    }
  };

  connect();

  return () => {
    shouldReconnect = false;
    if (ws) ws.close();
  };
}
