import React, { useState, useMemo } from "react";
import {
  Train,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Search,
  Filter,
  ArrowRight,
  ShieldAlert,
  Zap,
  Info,
  ChevronRight,
  X,
} from "lucide-react";

export default function FleetMatrixTable({
  trainPositions = [],
  onSelectTrain,
  selectedTrainNumber,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("ALL"); // ALL, ON_TIME, DELAYED, EMERGENCY, HIGH_PRIORITY, FREIGHT

  // Combine trainPositions with delay classification
  const categorizedTrains = useMemo(() => {
    return trainPositions.map((tp) => {
      const delay = tp.delay_minutes || 0;
      let delayCategory = "ON_TIME";
      if (delay > 30) delayCategory = "EMERGENCY";
      else if (delay > 5) delayCategory = "DELAYED";

      const isHighPriority =
        tp.train_type?.includes("VANDE") || tp.train_type?.includes("RAJDHANI");
      const isFreight = tp.train_type?.includes("FREIGHT");

      return {
        ...tp,
        delay,
        delayCategory,
        isHighPriority,
        isFreight,
      };
    });
  }, [trainPositions]);

  // Counts
  const counts = useMemo(() => {
    const total = categorizedTrains.length;
    const onTime = categorizedTrains.filter((t) => t.delayCategory === "ON_TIME").length;
    const delayed = categorizedTrains.filter((t) => t.delayCategory === "DELAYED").length;
    const emergency = categorizedTrains.filter((t) => t.delayCategory === "EMERGENCY").length;
    return { total, onTime, delayed, emergency };
  }, [categorizedTrains]);

  // Filtered List
  const filteredTrains = useMemo(() => {
    return categorizedTrains.filter((t) => {
      // Type filter
      if (filterType === "ON_TIME" && t.delayCategory !== "ON_TIME") return false;
      if (filterType === "DELAYED" && t.delayCategory !== "DELAYED") return false;
      if (filterType === "EMERGENCY" && t.delayCategory !== "EMERGENCY") return false;
      if (filterType === "HIGH_PRIORITY" && !t.isHighPriority) return false;
      if (filterType === "FREIGHT" && !t.isFreight) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const num = String(t.train_number).toLowerCase();
        const name = String(t.train_name || "").toLowerCase();
        const stn = String(t.current_station || "").toLowerCase();
        const sec = Array.isArray(t.current_section)
          ? t.current_section.join("-").toLowerCase()
          : "";
        return num.includes(q) || name.includes(q) || stn.includes(q) || sec.includes(q);
      }

      return true;
    });
  }, [categorizedTrains, filterType, searchQuery]);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-extrabold text-base sm:text-lg text-[#162A52] flex items-center gap-2">
              <Train className="w-5 h-5 text-[#213D77]" />
              64-Train Corridor Fleet & Delay Matrix (ट्रेन सारणी एवं विलंब ट्रैकर)
            </h2>
            <span className="text-[10px] font-extrabold bg-[#213D77] text-white px-2 py-0.5 rounded-full">
              {counts.total} TRAINS
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time live status, operational delays, sectional positions, and AI dispatch directives across NDLS-BPL
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search train no, name, station..."
            className="w-full pl-9 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#213D77] focus:bg-white"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Chips Bar */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button
          onClick={() => setFilterType("ALL")}
          className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 border ${
            filterType === "ALL"
              ? "bg-[#213D77] text-white border-[#213D77] shadow-xs"
              : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
          }`}
        >
          All Fleet ({counts.total})
        </button>

        <button
          onClick={() => setFilterType("ON_TIME")}
          className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 border ${
            filterType === "ON_TIME"
              ? "bg-emerald-700 text-white border-emerald-800 shadow-xs"
              : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          🟢 On Time ≤5m ({counts.onTime})
        </button>

        <button
          onClick={() => setFilterType("DELAYED")}
          className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 border ${
            filterType === "DELAYED"
              ? "bg-amber-500 text-slate-950 border-amber-600 shadow-xs"
              : "bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100"
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-amber-700" />
          🟡 Delayed 6-30m ({counts.delayed})
        </button>

        <button
          onClick={() => setFilterType("EMERGENCY")}
          className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 border ${
            filterType === "EMERGENCY"
              ? "bg-red-600 text-white border-red-700 shadow-xs animate-pulse"
              : "bg-red-50 text-red-800 border-red-200 hover:bg-red-100"
          }`}
        >
          <Flame className="w-3.5 h-3.5 text-red-600" />
          🔴 Emergency &gt;30m ({counts.emergency})
        </button>

        <button
          onClick={() => setFilterType("HIGH_PRIORITY")}
          className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 border ${
            filterType === "HIGH_PRIORITY"
              ? "bg-[#EA580C] text-white border-orange-700 shadow-xs"
              : "bg-orange-50 text-orange-900 border-orange-200 hover:bg-orange-100"
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-[#EA580C]" />
          ⚡ Vande Bharat / Rajdhani
        </button>

        <button
          onClick={() => setFilterType("FREIGHT")}
          className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 border ${
            filterType === "FREIGHT"
              ? "bg-slate-700 text-white border-slate-800 shadow-xs"
              : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
          }`}
        >
          📦 Freight Rakes
        </button>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200">
              <th className="py-2.5 px-3">Train # & Name</th>
              <th className="py-2.5 px-3">Type & Dir</th>
              <th className="py-2.5 px-3">Live Position</th>
              <th className="py-2.5 px-3">Speed</th>
              <th className="py-2.5 px-3">Operational Delay</th>
              <th className="py-2.5 px-3">AI Agent Directive</th>
              <th className="py-2.5 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
            {filteredTrains.map((t) => {
              const isSelected = selectedTrainNumber === t.train_number;
              const isEmergency = t.delayCategory === "EMERGENCY";
              const isLate = t.delayCategory === "DELAYED";

              // Badges
              let delayBadge = (
                <span className="font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  +{t.delay}m (On Time)
                </span>
              );
              if (isEmergency) {
                delayBadge = (
                  <span className="font-extrabold text-red-800 bg-red-100 border border-red-300 px-2 py-0.5 rounded-md inline-flex items-center gap-1 animate-pulse">
                    <Flame className="w-3 h-3 text-red-600" />
                    +{t.delay}m EMERGENCY
                  </span>
                );
              } else if (isLate) {
                delayBadge = (
                  <span className="font-extrabold text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-700" />
                    +{t.delay}m Late
                  </span>
                );
              }

              // AI Recommendation text
              let aiAdvice = "Schedule on track; maintain normal headway";
              if (isEmergency) {
                if (t.isFreight) {
                  aiAdvice = "Divert to loop siding to grant Vande Bharat priority";
                } else if (t.train_number?.startsWith("54") || t.train_number?.startsWith("64")) {
                  aiAdvice = "Reassign platform to clear main passenger berths";
                } else {
                  aiAdvice = "HOER relief crew order & priority signal clearance";
                }
              } else if (isLate) {
                aiAdvice = "Speed recovery permissible up to track MPS (+10 km/h)";
              }

              return (
                <tr
                  key={t.train_number}
                  onClick={() => onSelectTrain && onSelectTrain(t)}
                  className={`hover:bg-slate-50 transition-colors cursor-pointer ${
                    isSelected ? "bg-blue-50/70 font-semibold" : ""
                  }`}
                >
                  {/* Train # & Name */}
                  <td className="py-2 px-3">
                    <div className="font-bold text-[#162A52] flex items-center gap-1.5">
                      <span className="font-mono text-[#213D77]">{t.train_number}</span>
                      <span>{t.train_name}</span>
                    </div>
                  </td>

                  {/* Type & Direction */}
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded border border-slate-200">
                        {t.train_type || "EXPRESS"}
                      </span>
                      <span className="text-[10px] font-bold text-blue-800 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                        {t.direction}
                      </span>
                    </div>
                  </td>

                  {/* Live Position */}
                  <td className="py-2 px-3">
                    <div className="text-slate-800">
                      {t.current_station ? (
                        <span className="font-semibold text-indigo-900">
                          At {t.current_station}
                        </span>
                      ) : t.current_section ? (
                        <span className="text-slate-700">
                          {t.current_section[0]} → {t.current_section[1]}
                        </span>
                      ) : (
                        <span>km {t.current_km}</span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      km {t.current_km}
                    </div>
                  </td>

                  {/* Speed */}
                  <td className="py-2 px-3">
                    <span className="font-bold text-slate-800">
                      {t.speed_kmph || 0} km/h
                    </span>
                  </td>

                  {/* Delay */}
                  <td className="py-2 px-3">{delayBadge}</td>

                  {/* AI Directive */}
                  <td className="py-2 px-3">
                    <span className="text-[11px] text-slate-700 flex items-center gap-1">
                      <Zap className="w-3 h-3 text-[#EA580C] shrink-0" />
                      {aiAdvice}
                    </span>
                  </td>

                  {/* Action */}
                  <td className="py-2 px-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectTrain && onSelectTrain(t);
                      }}
                      className="text-xs font-bold text-[#213D77] hover:text-[#EA580C] hover:underline inline-flex items-center gap-0.5"
                    >
                      Inspect
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List */}
      <div className="md:hidden space-y-2">
        {filteredTrains.map((t) => {
          const isSelected = selectedTrainNumber === t.train_number;
          const isEmergency = t.delayCategory === "EMERGENCY";
          const isLate = t.delayCategory === "DELAYED";

          return (
            <div
              key={t.train_number}
              onClick={() => onSelectTrain && onSelectTrain(t)}
              className={`p-3 rounded-xl border transition-all cursor-pointer ${
                isSelected
                  ? "border-[#213D77] bg-blue-50/50 shadow-sm"
                  : isEmergency
                  ? "border-red-300 bg-red-50/30"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex items-center justify-between pb-1">
                <div className="font-bold text-xs text-[#162A52] flex items-center gap-1">
                  <span className="font-mono text-[#213D77]">#{t.train_number}</span>
                  <span className="truncate max-w-[160px]">{t.train_name}</span>
                </div>
                <span
                  className={`text-[10px] font-extrabold px-2 py-0.5 rounded ${
                    isEmergency
                      ? "bg-red-600 text-white animate-pulse"
                      : isLate
                      ? "bg-amber-400 text-slate-950"
                      : "bg-emerald-700 text-white"
                  }`}
                >
                  +{t.delay}m
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1 border-t border-slate-100">
                <span>
                  {t.current_station ? `At ${t.current_station}` : `km ${t.current_km}`}
                </span>
                <span className="font-semibold text-[#213D77] flex items-center gap-0.5">
                  Inspect <ChevronRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
