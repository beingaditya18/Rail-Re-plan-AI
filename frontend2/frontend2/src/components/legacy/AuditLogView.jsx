import React, { useState, useEffect } from "react";
import { CheckCircle2, ShieldCheck, Terminal, Filter, Search } from "lucide-react";
import { getAuditLog } from "../api";

export default function AuditLogView() {
  const [logs, setLogs] = useState({ decisions: [], messages: [] });
  const [filterAgent, setFilterAgent] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    getAuditLog()
      .then((data) => setLogs(data))
      .catch((err) => console.warn("Failed to load audit log:", err));
  }, []);

  const decisions = logs.decisions || [];

  const filteredDecisions = decisions.filter((d) => {
    if (filterAgent !== "all" && d.agent !== filterAgent) return false;
    if (
      search &&
      !d.decision.toLowerCase().includes(search.toLowerCase()) &&
      !d.reason.toLowerCase().includes(search.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-[#213D77]" />
            <h2 className="font-bold text-base text-[#162A52]">
              Orchestrator Decision & Negotiation Audit Trail (ऑडिट ट्रेल)
            </h2>
          </div>
          <p className="text-slate-500 text-xs mt-0.5">
            Immutable log of all autonomous agent proposals, constraints, and Chief Controller approval actions
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search decisions or reasons..."
            className="bg-slate-50 border border-slate-300 text-slate-800 rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#213D77]"
          />

          <select
            value={filterAgent}
            onChange={(e) => setFilterAgent(e.target.value)}
            className="bg-slate-50 border border-slate-300 text-slate-800 rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#213D77] font-medium"
          >
            <option value="all">All Agents (सभी एजेंट)</option>
            <option value="INTAKE">INTAKE</option>
            <option value="IMPACT">IMPACT</option>
            <option value="SCHEDULE">SCHEDULE (CP-SAT)</option>
            <option value="PLATFORM">PLATFORM</option>
            <option value="CREW">CREW</option>
            <option value="COMMUNICATION">COMMUNICATION</option>
            <option value="COPILOT">COPILOT</option>
            <option value="ORCHESTRATOR">ORCHESTRATOR</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 overflow-x-auto custom-scroll max-h-[500px]">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500 text-[11px] font-bold uppercase sticky top-0 bg-slate-50">
              <th className="py-2 px-2.5">Timestamp</th>
              <th className="py-2 px-2.5">Agent Role</th>
              <th className="py-2 px-2.5">Decision</th>
              <th className="py-2 px-2.5">Operational Rationale</th>
              <th className="py-2 px-2.5 text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredDecisions.length === 0 ? (
              <tr>
                <td colSpan="5" className="py-12 text-center text-slate-400 font-medium">
                  No decision logs recorded yet. Trigger a disruption scenario to observe decision trajectory.
                </td>
              </tr>
            ) : (
              filteredDecisions.map((d, idx) => (
                <tr key={idx} className="hover:bg-white transition-colors">
                  <td className="py-2.5 px-2.5 text-slate-500 text-[11px] whitespace-nowrap font-mono">
                    {new Date(d.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="py-2 px-2.5">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                        d.agent === "SCHEDULE"
                          ? "bg-blue-100 text-[#213D77] border-blue-200"
                          : d.agent === "PLATFORM"
                          ? "bg-orange-100 text-orange-800 border-orange-200"
                          : d.agent === "CREW"
                          ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                          : "bg-slate-100 text-slate-700 border-slate-200"
                      }`}
                    >
                      {d.agent}
                    </span>
                  </td>
                  <td className="py-2 px-2.5 font-bold text-slate-900 max-w-xs">{d.decision}</td>
                  <td className="py-2 px-2.5 text-slate-700 text-xs leading-relaxed">
                    {d.reason}
                  </td>
                  <td className="py-2 px-2.5 text-right text-[11px] text-slate-500 font-mono">
                    {d.details && Object.keys(d.details).length > 0 ? (
                      <span className="text-[#213D77] font-semibold">{JSON.stringify(d.details).slice(0, 30)}...</span>
                    ) : (
                      <span className="text-slate-400">--</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
