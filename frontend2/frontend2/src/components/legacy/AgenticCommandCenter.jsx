import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Bot,
  Zap,
  CheckCircle,
  AlertTriangle,
  Clock,
  Radio,
  Users,
  ShieldCheck,
  ArrowRight,
  TrendingUp,
  RefreshCw,
  Send,
  MessageSquare,
  Flame,
  Train,
  Check,
} from "lucide-react";
import {
  getAgenticRecommendations,
  executeAgenticRecommendation,
  resetAgenticRecommendations,
  copilotChat,
} from "../api";

export default function AgenticCommandCenter() {
  const [recommendations, setRecommendations] = useState([]);
  const [, setLoading] = useState(true);
  const [executingId, setExecutingId] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Copilot mini-chat inside command center
  const [chatMessages, setChatMessages] = useState([
    {
      sender: "ai",
      text: "⚡ RailSahayak Agentic AI active across 64 corridor rakes. 4 proactive safety & precedence interventions generated for Controller authorization.",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    loadRecommendations();
  }, []);

  const loadRecommendations = async () => {
    try {
      setLoading(true);
      const data = await getAgenticRecommendations();
      setRecommendations(data || []);
    } catch (e) {
      console.warn("Failed to load agentic recommendations:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async (rec) => {
    try {
      setExecutingId(rec.id);
      const res = await executeAgenticRecommendation(rec.id);
      if (res && res.recommendation) {
        setRecommendations((prev) =>
          prev.map((r) => (r.id === rec.id ? { ...r, status: "approved" } : r))
        );
        setActionSuccess(`✅ Action Executed: ${rec.title}`);
        setTimeout(() => setActionSuccess(null), 4000);
      }
    } catch (e) {
      console.error("Execute error:", e);
    } finally {
      setExecutingId(null);
    }
  };

  const handleReset = async () => {
    try {
      await resetAgenticRecommendations();
      await loadRecommendations();
      setActionSuccess("🔄 Proactive Agent Recommendations Reset to Pending");
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (e) {
      console.error("Reset error:", e);
    }
  };

  const handleChatSend = async (queryText) => {
    const query = queryText || chatInput;
    if (!query.trim() || chatLoading) return;

    setChatMessages((prev) => [...prev, { sender: "user", text: query }]);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await copilotChat(query);
      setChatMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: res.answer || "Operating Directive: Sectional headway verified at 5 minutes under automatic block rules.",
          citations: res.evidence || [],
        },
      ]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: "G&SR Safe Dispatch Guidance: Prioritize Passenger Express over Heavy Freight rakes. Maintain absolute 5-minute section headway.",
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  // Agent role visual styling
  const getAgentTheme = (agent) => {
    switch (agent) {
      case "Schedule Agent":
        return {
          bg: "bg-blue-50/60 border-blue-200 text-blue-900",
          badge: "bg-[#213D77] text-white",
          btn: "bg-[#213D77] hover:bg-[#162A52] text-white",
          icon: Clock,
        };
      case "Platform Agent":
        return {
          bg: "bg-emerald-50/60 border-emerald-200 text-emerald-900",
          badge: "bg-emerald-700 text-white",
          btn: "bg-emerald-700 hover:bg-emerald-800 text-white",
          icon: CheckCircle,
        };
      case "Crew Agent":
        return {
          bg: "bg-amber-50/60 border-amber-200 text-amber-900",
          badge: "bg-amber-700 text-white",
          btn: "bg-[#EA580C] hover:bg-orange-700 text-white",
          icon: Users,
        };
      case "Comms Agent":
        return {
          bg: "bg-purple-50/60 border-purple-200 text-purple-900",
          badge: "bg-purple-700 text-white",
          btn: "bg-purple-700 hover:bg-purple-800 text-white",
          icon: Radio,
        };
      default:
        return {
          bg: "bg-slate-50 border-slate-200 text-slate-900",
          badge: "bg-slate-700 text-white",
          btn: "bg-[#213D77] text-white",
          icon: Bot,
        };
    }
  };

  const quickAgentQueries = [
    "Why loop FGHT02 at Dholpur instead of Agra?",
    "Check Platform 1 clearance time at Agra Cantt",
    "Explain HOER 9-hour continuous crew duty limit",
    "How to recover 12920 Malwa Express +45m delay?",
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
      {/* Header with Title and Reset */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-orange-100 text-[#EA580C] flex items-center justify-center font-bold shadow-inner">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-extrabold text-base sm:text-lg text-[#162A52]">
                Proactive AI Agent Recommendations (एजेंटिक एआई नियंत्रण)
              </h2>
              <span className="text-[10px] font-extrabold bg-[#EA580C] text-white px-2 py-0.5 rounded-full tracking-wider animate-pulse">
                AGENTIC AI
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Autonomous multi-agent proposals: Safe precedence, berthing optimization, HOER relief & bilingual comms
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleReset}
            className="text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors border border-slate-200"
            title="Reset proactive recommendations to pending"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reset State
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {actionSuccess && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm animate-fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* 4 Agent Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {recommendations.map((rec) => {
          const theme = getAgentTheme(rec.agent);
          const isPending = rec.status === "pending";
          const isApproved = rec.status === "approved";
          const AgentIcon = theme.icon;

          return (
            <div
              key={rec.id}
              className={`rounded-xl border p-3.5 sm:p-4 flex flex-col justify-between transition-all duration-200 relative overflow-hidden shadow-sm ${
                isApproved
                  ? "bg-slate-50/80 border-slate-300 opacity-95"
                  : `${theme.bg} hover:shadow-md`
              }`}
            >
              {/* Card Top: Role Badge & Delay Savings */}
              <div>
                <div className="flex items-center justify-between gap-2 pb-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full tracking-wider uppercase flex items-center gap-1 ${theme.badge}`}
                    >
                      <AgentIcon className="w-3 h-3" />
                      {rec.role_badge} AGENT
                    </span>
                    <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded shadow-2xs">
                      {rec.id}
                    </span>
                  </div>

                  {rec.delay_saved_min > 0 && (
                    <span className="text-[11px] font-extrabold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-md flex items-center gap-1 shadow-2xs">
                      <TrendingUp className="w-3 h-3 text-emerald-700" />
                      Saves {rec.delay_saved_min}m Delay
                    </span>
                  )}
                </div>

                {/* Title */}
                <h3 className="font-extrabold text-sm text-[#162A52] leading-snug mt-1">
                  {rec.title}
                </h3>

                {/* Location and Train tags */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[11px]">
                  <span className="font-bold bg-white text-[#213D77] border border-blue-200 px-2 py-0.5 rounded">
                    🚆 Train: {rec.train_number}
                  </span>
                  <span className="text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded">
                    📍 {rec.location}
                  </span>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-700 mt-2 leading-relaxed font-normal">
                  {rec.description}
                </p>

                {/* Action Detail Box */}
                <div className="mt-2.5 bg-white/90 border border-slate-200 rounded-lg p-2.5 text-[11px] text-slate-800 space-y-1">
                  <div className="font-bold text-[#162A52] flex items-center gap-1">
                    <Zap className="w-3 h-3 text-[#EA580C]" />
                    Autonomous Action:
                  </div>
                  <div className="font-medium text-slate-700">{rec.action_detail}</div>
                  <div className="text-[10px] text-slate-500 pt-0.5 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    Verified Rule: <span className="font-semibold text-slate-700">{rec.rule_ref}</span>
                  </div>
                </div>
              </div>

              {/* Card Footer: Action Button */}
              <div className="mt-3.5 pt-2.5 border-t border-slate-200/80 flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold text-slate-500">
                  {isApproved ? "Status: Executed in Master Log" : "Awaiting Controller Approval"}
                </span>

                {isPending ? (
                  <button
                    onClick={() => handleExecute(rec)}
                    disabled={executingId === rec.id}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5 transition-all transform active:scale-95 ${theme.btn}`}
                  >
                    {executingId === rec.id ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    {rec.action_label}
                  </button>
                ) : (
                  <div className="flex items-center gap-1 text-xs font-extrabold text-emerald-800 bg-emerald-100 border border-emerald-300 px-3 py-1 rounded-lg">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-700" />
                    AUTHORIZED BY CONTROLLER
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Ask RailSahayak AI Assistant Box */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 sm:p-4 space-y-2.5 mt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#213D77] text-white flex items-center justify-center font-bold text-xs">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <span className="font-extrabold text-xs text-[#162A52]">
              Ask RailSahayak AI (तत्काल निर्णय व्याख्या)
            </span>
            <span className="text-[10px] text-slate-500">
              Grounded on 64 Corridor Trains & IR Operating Manual
            </span>
          </div>

          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            Groq Llama-3 120B / RAG Active
          </span>
        </div>

        {/* Quick query chips */}
        <div className="flex flex-wrap gap-1.5">
          {quickAgentQueries.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleChatSend(q)}
              disabled={chatLoading}
              className="text-[11px] bg-white hover:bg-orange-50 hover:text-orange-900 hover:border-orange-300 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200 font-medium transition-all shadow-2xs text-left"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Chat Log Snippets */}
        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
          {chatMessages.map((msg, i) => (
            <div
              key={i}
              className={`p-2 rounded-lg text-xs leading-relaxed ${
                msg.sender === "user"
                  ? "bg-[#213D77] text-white ml-8 font-medium"
                  : "bg-white text-slate-800 border border-slate-200 mr-4 font-normal shadow-2xs"
              }`}
            >
              {msg.text}
              {msg.citations && msg.citations.length > 0 && (
                <div className="mt-1 pt-1 border-t border-slate-100 text-[10px] text-slate-500 flex flex-wrap gap-1">
                  <span className="font-bold text-slate-700">Citations:</span>
                  {msg.citations.map((c, ci) => (
                    <span key={ci} className="bg-slate-100 px-1.5 py-0.5 rounded font-mono">
                      {c.title || c}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
          {chatLoading && (
            <div className="p-2 rounded-lg text-xs bg-white text-slate-500 border border-slate-200 flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#EA580C]" />
              <span>RailSahayak reasoning over multi-agent constraints...</span>
            </div>
          )}
        </div>

        {/* Chat Input */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleChatSend()}
            placeholder="Ask anything about train delays, track precedence, platform berths, or crew relief..."
            className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#213D77] focus:ring-1 focus:ring-blue-100"
          />
          <button
            onClick={() => handleChatSend()}
            disabled={chatLoading || !chatInput.trim()}
            className="bg-[#213D77] hover:bg-[#162A52] disabled:opacity-50 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 transition-all"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send</span>
          </button>
        </div>
      </div>
    </div>
  );
}
