import React from "react";
import {
  Brain,
  CheckCircle,
  RotateCw,
  Sparkles,
  ShieldCheck,
  Train,
  Users,
} from "lucide-react";

export default function AgentNegotiationFeed({ messages = [], isOptimizing }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col h-full space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-[#213D77]" />
          <div>
            <h3 className="font-bold text-sm text-[#162A52]">
              Multi-Agent Deliberation Stream (स्वायत्त एजेंट संवाद)
            </h3>
            <p className="text-[11px] text-slate-500">
              Contract-Net negotiation between Schedule, Platform, and Crew agents
            </p>
          </div>
        </div>
        <div>
          {isOptimizing ? (
            <span className="flex items-center gap-1.5 text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200 text-xs font-semibold">
              <RotateCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
              Deliberating...
            </span>
          ) : (
            <span className="text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 font-bold text-xs">
              Consensus Reached
            </span>
          )}
        </div>
      </div>

      {/* 3 Agents Overview Cards */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        {/* Schedule Agent */}
        <div className="p-2.5 rounded-lg bg-blue-50/60 border border-blue-200 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="font-bold text-[#213D77] text-[11px]">Schedule Agent</span>
            <span className="w-2 h-2 rounded-full bg-blue-600" />
          </div>
          <p className="text-slate-600 text-[10px] leading-tight">
            CP-SAT Solver & Section Headway
          </p>
        </div>

        {/* Platform Agent */}
        <div className="p-2.5 rounded-lg bg-orange-50/60 border border-orange-200 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="font-bold text-[#EA580C] text-[11px]">Platform Agent</span>
            <span className="w-2 h-2 rounded-full bg-orange-500" />
          </div>
          <p className="text-slate-600 text-[10px] leading-tight">
            Berthing, Length & Loop Lines
          </p>
        </div>

        {/* Crew Agent */}
        <div className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-200 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="font-bold text-emerald-800 text-[11px]">Crew Agent</span>
            <span className="w-2 h-2 rounded-full bg-emerald-600" />
          </div>
          <p className="text-slate-600 text-[10px] leading-tight">
            G&SR 14.2 & HOER 12h Duty Safety
          </p>
        </div>
      </div>

      {/* Negotiation Log Terminal */}
      <div className="flex-1 bg-slate-50 p-3 rounded-xl border border-slate-200 overflow-y-auto custom-scroll space-y-2.5 max-h-[380px] text-xs">
        {messages.length === 0 ? (
          <div className="h-44 flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
            <Sparkles className="w-6 h-6 text-slate-400" />
            <span>Agents standing by. Trigger a disruption preset above to observe live negotiation.</span>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isConflict = msg.message_type === "conflict" || msg.type === "conflict";
            const round = msg.negotiation_round || 1;

            let borderClass = "border-slate-200 bg-white";
            let agentBadge = "bg-blue-100 text-[#213D77]";

            if (msg.from_agent === "SCHEDULE" || msg.agent === "SCHEDULE") {
              borderClass = "border-l-4 border-l-blue-600 bg-white shadow-sm";
              agentBadge = "bg-blue-100 text-[#213D77]";
            } else if (msg.from_agent === "PLATFORM" || msg.agent === "PLATFORM") {
              borderClass = "border-l-4 border-l-orange-500 bg-white shadow-sm";
              agentBadge = "bg-orange-100 text-orange-800";
            } else if (msg.from_agent === "CREW" || msg.agent === "CREW") {
              borderClass = "border-l-4 border-l-emerald-600 bg-white shadow-sm";
              agentBadge = "bg-emerald-100 text-emerald-800";
            }

            if (isConflict) {
              borderClass = "border-l-4 border-l-red-500 bg-red-50/50 shadow-sm";
            }

            return (
              <div
                key={idx}
                className={`p-3 rounded-lg border text-xs space-y-1 ${borderClass}`}
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className={`font-bold uppercase px-2 py-0.5 rounded text-[10px] ${agentBadge}`}>
                    {msg.from_agent || msg.agent || "AGENT"}
                  </span>
                  <span className="text-slate-400 text-[10px] font-semibold">
                    Round {round}
                  </span>
                </div>
                <p className="text-slate-800 leading-relaxed text-xs">
                  {msg.content || msg.message}
                </p>
                {msg.data?.conflicts && (
                  <div className="mt-1 text-[11px] text-amber-800 bg-amber-50 p-1.5 rounded border border-amber-200">
                    Constraints: {msg.data.conflicts.length} conflict(s) returned to optimizer
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Consensus Footer */}
      <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
        <span className="font-medium">Protocol: Contract-Net (≤3 Rounds)</span>
        <span className="text-emerald-700 font-bold flex items-center gap-1">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          Pareto Optimal Consensus
        </span>
      </div>
    </div>
  );
}
