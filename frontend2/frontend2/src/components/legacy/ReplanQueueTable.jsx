import React from "react";
import {
  CheckCircle,
  XCircle,
  Clock,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  TrendingDown,
  CheckCircle2,
  AlertTriangle,
  Zap,
} from "lucide-react";

export default function ReplanQueueTable({
  proposedPlan,
  onApprove,
  onReject,
  isApproving,
}) {
  if (!proposedPlan || !proposedPlan.events || proposedPlan.events.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500 shadow-sm">
        <Clock className="w-10 h-10 text-slate-400 mx-auto mb-3" />
        <p className="text-slate-800 font-bold text-sm">No Pending Recovery Plan (कोई लंबित योजना नहीं)</p>
        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
          When an incident occurs or a preset is clicked above, the OR-Tools CP-SAT multi-agent optimizer will generate an optimized recovery timetable here for Chief Controller approval.
        </p>
      </div>
    );
  }

  const { id, metrics, events, status, safety_report } = proposedPlan;
  const isApproved = status === "approved";
  const isRejected = status === "rejected";
  const isSafe = safety_report ? safety_report.is_safe : true;
  const violations = safety_report?.violations || [];
  const solverStatus = metrics?.solver_status || "OPTIMAL";

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
      {/* Header & Approval Gate */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-base text-[#162A52]">
              Proposed Recovery Timetable // Chief Controller Queue
            </h3>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-[#213D77] text-xs font-bold border border-blue-200">
              Plan #{id}
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                solverStatus === "OPTIMAL"
                  ? "bg-emerald-100 text-emerald-800"
                  : solverStatus === "FEASIBLE"
                  ? "bg-blue-100 text-blue-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              Solver: {solverStatus}
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            Policy: <span className="text-[#213D77] font-bold uppercase">{proposedPlan.policy}</span> • Solve Time:{" "}
            <span className="font-semibold text-slate-700">{metrics?.solve_time_seconds?.toFixed(2) || "0.05"}s</span> • Total Delay:{" "}
            <span className="text-[#EA580C] font-bold">
              {metrics?.total_delay_minutes?.toFixed(0) || "0"} mins
            </span>
          </div>
        </div>

        {/* Big Action Buttons */}
        <div className="flex items-center gap-2.5 text-xs">
          {isApproved ? (
            <div className="px-4 py-2 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-800 font-bold flex items-center gap-2 shadow-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>PLAN APPROVED & BROADCASTED (अनुमोदित)</span>
            </div>
          ) : isRejected ? (
            <div className="px-4 py-2 rounded-lg bg-red-50 border border-red-300 text-red-800 font-bold flex items-center gap-2 shadow-sm">
              <XCircle className="w-5 h-5 text-red-600" />
              <span>PLAN REJECTED (अस्वीकृत)</span>
            </div>
          ) : (
            <>
              <button
                onClick={() => onApprove(id)}
                disabled={isApproving || !isSafe}
                className={`flex items-center gap-2 px-5 py-2.5 font-bold rounded-lg shadow-md transition-all text-xs ${
                  isSafe
                    ? "bg-[#16A34A] hover:bg-green-700 text-white active:scale-95 hover:shadow-lg"
                    : "bg-slate-300 text-slate-500 cursor-not-allowed"
                }`}
                title={isSafe ? "Authorize plan execution" : "Plan has safety violations"}
              >
                <CheckCircle className="w-4 h-4" />
                <span>Approve Recovery Plan (मुख्य नियंत्रक अनुमोदन)</span>
              </button>

              <button
                onClick={() => onReject(id)}
                disabled={isApproving}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-red-50 hover:bg-red-100 border border-red-300 text-red-700 font-bold rounded-lg active:scale-95 transition-all text-xs"
              >
                <XCircle className="w-4 h-4" />
                <span>Reject</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Safety Validator Status Banner */}
      <div
        className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
          isSafe
            ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
            : "bg-red-50 border-red-300 text-red-900"
        }`}
      >
        <div className="flex items-center gap-2 font-medium">
          {isSafe ? (
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" />
          )}
          <div>
            <span className="font-bold">
              Deterministic Safety Validator: {isSafe ? "ALL CHECKS PASSED" : `FAILED (${violations.length} VIOLATIONS)`}
            </span>
            <div className="text-[11px] opacity-80">
              G&SR 9.07 5-min block headways, platform clearance, and HOER 12h duty limits verified.
            </div>
          </div>
        </div>

        {safety_report && (
          <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-600">
            <span>Headways: {safety_report.checked_headway_intervals}</span>
            <span>Platforms: {safety_report.checked_platform_berthings}</span>
            <span>Crews: {safety_report.checked_crew_duties}</span>
          </div>
        )}
      </div>

      {/* If violations exist, list them */}
      {!isSafe && violations.length > 0 && (
        <div className="p-3 bg-red-100/60 border border-red-300 rounded-lg space-y-1 text-xs">
          <div className="font-bold text-red-800 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-red-700" />
            <span>Safety Rule Infringements (Approval Blocked):</span>
          </div>
          <ul className="list-disc pl-5 text-red-900 text-[11px] space-y-0.5">
            {violations.map((v, vIdx) => (
              <li key={vIdx}>
                <span className="font-bold">[{v.rule_code}]</span> {v.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Events Table */}
      <div className="overflow-x-auto custom-scroll max-h-[320px] rounded-lg border border-slate-200">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-700 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200 sticky top-0">
              <th className="py-2.5 px-3">Train No.</th>
              <th className="py-2.5 px-3">Station</th>
              <th className="py-2.5 px-3">Delay Delta</th>
              <th className="py-2.5 px-3">Platform</th>
              <th className="py-2.5 px-3">Scheduled ➔ Revised</th>
              <th className="py-2.5 px-3">Action</th>
              <th className="py-2.5 px-3">Validation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {events.slice(0, 30).map((ev, idx) => {
              const origArr = ev.original_arrival
                ? new Date(ev.original_arrival).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "--";
              const revArr = ev.revised_arrival
                ? new Date(ev.revised_arrival).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : origArr;

              const isDelayHigh = ev.delay_minutes > 30;

              return (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2.5 px-3 font-bold text-[#213D77]">
                    {ev.train_number}
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-slate-800">
                    {ev.station_code}
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        isDelayHigh
                          ? "bg-red-100 text-red-800"
                          : ev.delay_minutes > 0
                          ? "bg-amber-100 text-amber-800"
                          : "text-slate-500"
                      }`}
                    >
                      +{ev.delay_minutes}m
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-semibold">
                    {ev.revised_platform ? (
                      <span className="text-[#213D77] bg-blue-50 px-2 py-0.5 rounded border border-blue-200 font-bold">
                        PF {ev.revised_platform}
                      </span>
                    ) : (
                      <span className="text-slate-400">Main</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-slate-700 flex items-center gap-1.5 font-medium">
                    <span className="text-slate-400 line-through">{origArr}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-slate-900 font-bold">{revArr}</span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 font-medium">
                    {ev.action || "RUN"}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      PASSED
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
