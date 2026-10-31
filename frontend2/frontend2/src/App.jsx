import React, { useState, useEffect } from "react";
import TopCommandHeader from "./components/TopCommandHeader";
import RecoveryWorkspace from "./components/RecoveryWorkspace";
import {
  getCorridorOverview,
  getProposedPlan,
  getKpiComparison,
  controlSim,
  resetSim,
  injectDisruption,
  approvePlan,
  rejectPlan,
  copilotChat,
  initWebSocket,
} from "./api";

export default function App() {
  const [wsConnected, setWsConnected] = useState(false);
  const [simState, setSimState] = useState({
    clock: new Date().toISOString(),
    speed: 30,
    running: true,
    train_positions: [],
  });
  const [activeDisruptions, setActiveDisruptions] = useState([]);
  const [proposedPlan, setProposedPlan] = useState(null);
  const [impactData, setImpactData] = useState(null);
  const [benchmarkData, setBenchmarkData] = useState(null);
  const [aiExplanation, setAiExplanation] = useState("");
  const [aiExplanationHi, setAiExplanationHi] = useState("");
  const [safetyMargins, setSafetyMargins] = useState(null);
  const [evidenceClaims, setEvidenceClaims] = useState([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [rulebookAnswer, setRulebookAnswer] = useState("");
  const [isAskingRulebook, setIsAskingRulebook] = useState(false);

  // Initial Data Fetch
  useEffect(() => {
    getCorridorOverview()
      .then((data) => {
        if (data.train_positions) {
          setSimState((prev) => ({
            ...prev,
            clock: data.sim_clock || prev.clock,
            train_positions: data.train_positions,
          }));
        }
        if (data.active_disruptions && data.active_disruptions.length > 0) {
          setActiveDisruptions(data.active_disruptions);
        }
      })
      .catch((e) => console.warn("Overview fetch warning:", e.message));

    getProposedPlan()
      .then((plan) => {
        if (plan) setProposedPlan(plan);
      })
      .catch(() => {});

    getKpiComparison()
      .then((kpi) => {
        if (kpi && kpi.delay_savings_pct !== undefined) setBenchmarkData(kpi);
      })
      .catch(() => {});

    // WebSocket Telemetry Subscription
    const cleanupWs = initWebSocket(
      (event) => {
        if (event.type === "sim_tick" && event.data) {
          setSimState((prev) => ({
            ...prev,
            clock: event.data.clock,
            speed: event.data.speed,
            running: event.data.running,
            train_positions: event.data.train_positions || prev.train_positions,
          }));
        } else if (event.type === "plan_proposal" && event.data) {
          setProposedPlan(event.data.plan || event.data);
          if (event.data.impact) setImpactData(event.data.impact);
          if (event.data.benchmark) setBenchmarkData(event.data.benchmark);
          if (event.data.explanation) setAiExplanation(event.data.explanation);
          if (event.data.explanation_hi) setAiExplanationHi(event.data.explanation_hi);
          if (event.data.safety_margins) setSafetyMargins(event.data.safety_margins);
          if (event.data.evidence) setEvidenceClaims(event.data.evidence);
          setIsOptimizing(false);
        } else if (event.type === "plan_approved") {
          setProposedPlan((prev) => (prev ? { ...prev, status: "approved" } : null));
          getKpiComparison().then(setBenchmarkData).catch(() => {});
        } else if (event.type === "disruption_injected") {
          setIsOptimizing(true);
        } else if (event.type === "sim_reset") {
          setProposedPlan(null);
          setImpactData(null);
          setBenchmarkData(null);
          setAiExplanation("");
          setAiExplanationHi("");
          setSafetyMargins(null);
          setEvidenceClaims([]);
          setActiveDisruptions([]);
          setRulebookAnswer("");
        }
      },
      (connected) => setWsConnected(connected)
    );

    return () => cleanupWs();
  }, []);

  // Handlers
  const handleControlSim = async (action, speed) => {
    try {
      const res = await controlSim(action, speed);
      setSimState((prev) => ({
        ...prev,
        running: res.running,
        speed: res.speed,
      }));
    } catch (e) {
      console.error("Sim control error:", e);
    }
  };

  const handleResetSim = async () => {
    try {
      await resetSim();
      setProposedPlan(null);
      setImpactData(null);
      setBenchmarkData(null);
      setAiExplanation("");
      setAiExplanationHi("");
      setSafetyMargins(null);
      setEvidenceClaims([]);
      setActiveDisruptions([]);
      setRulebookAnswer("");
    } catch (e) {
      console.error("Reset error:", e);
    }
  };

  const handleInjectDisruption = async (payload) => {
    setIsOptimizing(true);
    try {
      const res = await injectDisruption(payload);
      if (res.disruption) {
        setActiveDisruptions([res.disruption]);
      }
      if (res.impact) {
        setImpactData(res.impact);
      }
      if (res.plan) {
        setProposedPlan(res.plan);
      }
      if (res.benchmark) {
        setBenchmarkData(res.benchmark);
      }
      if (res.explanation) {
        setAiExplanation(res.explanation);
      }
      if (res.explanation_hi) {
        setAiExplanationHi(res.explanation_hi);
      }
      if (res.safety_margins) {
        setSafetyMargins(res.safety_margins);
      }
      if (res.evidence) {
        setEvidenceClaims(res.evidence);
      }
    } catch (e) {
      console.error("Disruption injection error:", e);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleApprovePlan = async (planId) => {
    setIsApproving(true);
    try {
      await approvePlan(planId);
      setProposedPlan((prev) => (prev ? { ...prev, status: "approved" } : null));
      getKpiComparison().then(setBenchmarkData).catch(() => {});
    } catch (e) {
      console.error("Approve error:", e);
    } finally {
      setIsApproving(false);
    }
  };

  const handleRejectPlan = async (planId) => {
    try {
      await rejectPlan(planId);
      setProposedPlan((prev) => (prev ? { ...prev, status: "rejected" } : null));
    } catch (e) {
      console.error("Reject error:", e);
    }
  };

  const handleAskRulebook = async (query) => {
    setIsAskingRulebook(true);
    try {
      const res = await copilotChat(query);
      if (res && res.answer) {
        setRulebookAnswer(res.answer);
      }
    } catch (e) {
      console.error("Rulebook query error:", e);
      setRulebookAnswer("Rulebook query failed. Please verify local G&SR knowledge base.");
    } finally {
      setIsAskingRulebook(false);
    }
  };

  const isPlanApplied = proposedPlan?.status === "approved";

  return (
    <div className="min-h-screen bg-[#F1F5F9] text-slate-800 flex flex-col font-sans">
      {/* Top Command Header */}
      <TopCommandHeader
        simState={simState}
        onControlSim={handleControlSim}
        onResetSim={handleResetSim}
        wsConnected={wsConnected}
        activeDisruptions={activeDisruptions}
        isPlanApplied={isPlanApplied}
      />

      {/* Main Recovery Workspace Body (4 Sections: Input, Impact, Recommendation, Approval) */}
      <main className="flex-1 p-3 sm:p-6 overflow-y-auto custom-scroll">
        <RecoveryWorkspace
          simState={simState}
          activeDisruptions={activeDisruptions}
          proposedPlan={proposedPlan}
          impactData={impactData}
          benchmarkData={benchmarkData}
          aiExplanation={aiExplanation}
          aiExplanationHi={aiExplanationHi}
          safetyMargins={safetyMargins}
          evidenceClaims={evidenceClaims}
          isOptimizing={isOptimizing}
          isApproving={isApproving}
          onInjectDisruption={handleInjectDisruption}
          onApprovePlan={handleApprovePlan}
          onRejectPlan={handleRejectPlan}
          onAskRulebook={handleAskRulebook}
          rulebookAnswer={rulebookAnswer}
          isAskingRulebook={isAskingRulebook}
        />
      </main>
    </div>
  );
}
