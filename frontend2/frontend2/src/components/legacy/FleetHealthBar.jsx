import React from "react";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Train,
  ShieldAlert,
  Flame,
  ArrowUpRight,
  Filter,
} from "lucide-react";

export default function FleetHealthBar({
  trainPositions = [],
  activeFilter = "ALL",
  onSelectFilter,
}) {
  const total = trainPositions.length || 35;
  const onTimeTrains = trainPositions.filter((t) => (t.delay_minutes || 0) <= 5);
  const lateTrains = trainPositions.filter(
    (t) => (t.delay_minutes || 0) > 5 && (t.delay_minutes || 0) <= 30
  );
  const emergencyTrains = trainPositions.filter(
    (t) => (t.delay_minutes || 0) > 30 || t.status === "halted"
  );

  const onTimePct = Math.round((onTimeTrains.length / total) * 100);
  const latePct = Math.round((lateTrains.length / total) * 100);
  const emergencyPct = Math.round((emergencyTrains.length / total) * 100);

  return (
    <div className="space-y-2.5">
      {/* 4 Cards Grid - Fully Responsive */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        {/* Total Active Trains (IR Blue) */}
        <div
          onClick={() => onSelectFilter(activeFilter === "ALL" ? "ALL" : "ALL")}
          className={`cursor-pointer rounded-xl p-3 sm:p-4 border transition-all duration-200 bg-white shadow-sm flex flex-col justify-between ${
            activeFilter === "ALL"
              ? "border-[#213D77] ring-2 ring-blue-100"
              : "border-slate-200 hover:border-blue-300"
          }`}
        >
          <div className="flex items-center justify-between text-xs pb-1">
            <span className="font-bold text-[#162A52] flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
              <Train className="w-4 h-4 text-[#213D77]" />
              Active Fleet (कुल ट्रेनें)
            </span>
            <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
              NDLS-BPL
            </span>
          </div>

          <div className="flex items-baseline justify-between mt-1">
            <div className="text-2xl sm:text-3xl font-black text-[#213D77] tracking-tight">
              {total}
            </div>
            <span className="text-xs text-slate-500 font-medium">100% Corridor</span>
          </div>

          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>702 km Mainline</span>
            <span className="text-[#213D77] font-semibold">Automatic Signalling</span>
          </div>
        </div>

        {/* 🟢 ON TIME (Green) */}
        <div
          onClick={() => onSelectFilter(activeFilter === "ON_TIME" ? "ALL" : "ON_TIME")}
          className={`cursor-pointer rounded-xl p-3 sm:p-4 border transition-all duration-200 bg-white shadow-sm flex flex-col justify-between ${
            activeFilter === "ON_TIME"
              ? "border-emerald-500 ring-2 ring-emerald-100 bg-emerald-50/20"
              : "border-emerald-200/80 hover:border-emerald-400"
          }`}
        >
          <div className="flex items-center justify-between text-xs pb-1">
            <span className="font-bold text-emerald-800 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 status-pulse" />
              On Time (समय पर)
            </span>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              ≤ 5 min delay
            </span>
          </div>

          <div className="flex items-baseline justify-between mt-1">
            <div className="text-2xl sm:text-3xl font-black text-emerald-700 tracking-tight">
              {onTimeTrains.length}
            </div>
            <span className="text-xs font-bold text-emerald-700">{onTimePct}% Fleet</span>
          </div>

          {/* Mini progress bar */}
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              style={{ width: `${onTimePct}%` }}
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
            />
          </div>
        </div>

        {/* 🟡 MODERATE DELAY (Yellow / Amber) */}
        <div
          onClick={() => onSelectFilter(activeFilter === "LATE" ? "ALL" : "LATE")}
          className={`cursor-pointer rounded-xl p-3 sm:p-4 border transition-all duration-200 bg-white shadow-sm flex flex-col justify-between ${
            activeFilter === "LATE"
              ? "border-amber-500 ring-2 ring-amber-100 bg-amber-50/20"
              : "border-amber-200/80 hover:border-amber-400"
          }`}
        >
          <div className="flex items-center justify-between text-xs pb-1">
            <span className="font-bold text-amber-800 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
              <Clock className="w-4 h-4 text-amber-600" />
              Delayed (विलंबित)
            </span>
            <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              6 — 30 mins
            </span>
          </div>

          <div className="flex items-baseline justify-between mt-1">
            <div className="text-2xl sm:text-3xl font-black text-amber-800 tracking-tight">
              {lateTrains.length}
            </div>
            <span className="text-xs font-bold text-amber-800">{latePct}% Fleet</span>
          </div>

          {/* Mini progress bar */}
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              style={{ width: `${latePct}%` }}
              className="bg-amber-500 h-full rounded-full transition-all duration-500"
            />
          </div>
        </div>

        {/* 🔴 EMERGENCY / CRITICAL DELAY (Red) */}
        <div
          onClick={() => onSelectFilter(activeFilter === "EMERGENCY" ? "ALL" : "EMERGENCY")}
          className={`cursor-pointer rounded-xl p-3 sm:p-4 border transition-all duration-200 bg-white shadow-sm flex flex-col justify-between relative overflow-hidden ${
            activeFilter === "EMERGENCY"
              ? "border-red-500 ring-2 ring-red-100 bg-red-50/30"
              : "border-red-200/90 hover:border-red-400"
          } ${emergencyTrains.length > 0 ? "border-l-4 border-l-red-600" : ""}`}
        >
          <div className="flex items-center justify-between text-xs pb-1">
            <span className="font-bold text-red-700 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
              <Flame className="w-4 h-4 text-red-600 animate-bounce" />
              Critical / Emergency (आपातकाल)
            </span>
            <span className="text-[10px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
              &gt; 30 mins delay
            </span>
          </div>

          <div className="flex items-baseline justify-between mt-1">
            <div className="text-2xl sm:text-3xl font-black text-red-700 tracking-tight">
              {emergencyTrains.length}
            </div>
            <span className="text-xs font-bold text-red-700">{emergencyPct}% Fleet</span>
          </div>

          {/* Mini progress bar */}
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              style={{ width: `${emergencyPct}%` }}
              className="bg-red-600 h-full rounded-full transition-all duration-500"
            />
          </div>
        </div>
      </div>

      {/* Integrated Fleet Punctuality Spectrum Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-2.5 sm:p-3 shadow-xs space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
          <div className="flex items-center gap-2">
            <span className="text-[#162A52] flex items-center gap-1">
              <Train className="w-3.5 h-3.5 text-[#213D77]" />
              Corridor Fleet Punctuality Spectrum (पंक्चुअलिटी अनुपात):
            </span>
            <span className="text-emerald-700">🟢 {onTimeTrains.length} On-Time ({onTimePct}%)</span>
            <span className="text-slate-300">•</span>
            <span className="text-amber-700">🟡 {lateTrains.length} Delayed ({latePct}%)</span>
            <span className="text-slate-300">•</span>
            <span className="text-red-700">🔴 {emergencyTrains.length} Critical ({emergencyPct}%)</span>
          </div>

          <div className="text-[10px] text-slate-500 font-medium hidden sm:block">
            Target: ≥ 90% Punctuality (IR Operating Directive)
          </div>
        </div>

        {/* Multi-segment Progress Bar */}
        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
          <div
            style={{ width: `${onTimePct}%` }}
            className="bg-emerald-600 h-full transition-all duration-500"
            title={`On-time: ${onTimeTrains.length} trains (${onTimePct}%)`}
          />
          <div
            style={{ width: `${latePct}%` }}
            className="bg-amber-400 h-full transition-all duration-500"
            title={`Delayed: ${lateTrains.length} trains (${latePct}%)`}
          />
          <div
            style={{ width: `${emergencyPct}%` }}
            className="bg-red-600 h-full transition-all duration-500"
            title={`Emergency: ${emergencyTrains.length} trains (${emergencyPct}%)`}
          />
        </div>
      </div>

      {/* Emergency Alert Trains Banner if any trains have critical delay */}
      {emergencyTrains.length > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-xl p-2.5 sm:p-3 flex flex-wrap items-center justify-between gap-2 text-xs shadow-sm">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
            <span className="font-bold text-red-900">
              🚨 Emergency Priority Action Required ({emergencyTrains.length} Critical Delayed Trains &gt; 30m):
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {emergencyTrains.slice(0, 8).map((t) => (
              <span
                key={t.train_number}
                className="bg-white border border-red-300 text-red-800 px-2 py-0.5 rounded font-bold text-[11px] flex items-center gap-1 shadow-sm"
              >
                <span>#{t.train_number}</span>
                <span className="text-red-600 font-extrabold">+{t.delay_minutes}m</span>
              </span>
            ))}
            {activeFilter !== "ALL" && (
              <button
                onClick={() => onSelectFilter("ALL")}
                className="text-[11px] text-blue-700 hover:underline font-semibold ml-2"
              >
                Clear Filter (सभी दिखाएं)
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
