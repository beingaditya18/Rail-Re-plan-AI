import React, { useState, useEffect, useMemo } from "react";
import {
  Radio,
  Eye,
  EyeOff,
  Filter,
  Train,
  AlertTriangle,
  Clock,
  Layers,
  MapPin,
  Maximize2,
} from "lucide-react";
import { getMareyData } from "../api";

const DEFAULT_STATIONS = [
  { code: "NDLS", name: "New Delhi", km: 0 },
  { code: "MTJ", name: "Mathura Jn", km: 141 },
  { code: "AGC", name: "Agra Cantt", km: 195 },
  { code: "GWL", name: "Gwalior", km: 305 },
  { code: "DAA", name: "Datia", km: 365 },
  { code: "JHS", name: "Jhansi Jn", km: 403 },
  { code: "LAR", name: "Lalitpur", km: 458 },
  { code: "BINA", name: "Bina Jn", km: 534 },
  { code: "BPL", name: "Bhopal Jn", km: 702 },
];

const TOTAL_KM = 702;

export default function MareyDiagramView() {
  const [mareyData, setMareyData] = useState(null);
  const [showOriginal, setShowOriginal] = useState(true);
  const [showReplanned, setShowReplanned] = useState(true);
  const [directionFilter, setDirectionFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [onlyAffected, setOnlyAffected] = useState(false);
  const [selectedTrainNumber, setSelectedTrainNumber] = useState(null);
  const [hoveredTrain, setHoveredTrain] = useState(null);

  useEffect(() => {
    getMareyData()
      .then((data) => setMareyData(data))
      .catch((err) => console.warn("Failed to load Marey data:", err));
  }, []);

  const stations = mareyData?.stations?.length > 0 ? mareyData.stations : DEFAULT_STATIONS;

  // Compute time window bounds
  const { startMin, endMin, totalMin } = useMemo(() => {
    let sMin = 5 * 60; // 05:00
    let eMin = 13 * 60; // 13:00

    if (mareyData?.time_window?.start_time && mareyData?.time_window?.end_time) {
      const sDate = new Date(mareyData.time_window.start_time);
      const eDate = new Date(mareyData.time_window.end_time);
      sMin = sDate.getHours() * 60 + sDate.getMinutes();
      eMin = eDate.getHours() * 60 + eDate.getMinutes();
      if (eMin <= sMin) eMin += 24 * 60;
    }

    return { startMin: sMin, endMin: eMin, totalMin: Math.max(60, eMin - sMin) };
  }, [mareyData]);

  // SVG coordinate mappers
  const getY = (km) => {
    const topMargin = 50;
    const height = 500;
    return topMargin + (Math.max(0, Math.min(TOTAL_KM, km)) / TOTAL_KM) * height;
  };

  const getX = (timeIso) => {
    if (!timeIso) return null;
    const dt = new Date(timeIso);
    const m = dt.getHours() * 60 + dt.getMinutes();
    const normalizedM = m < startMin - 120 ? m + 24 * 60 : m;
    const clampedM = Math.max(startMin, Math.min(endMin, normalizedM));
    const width = 860;
    const leftMargin = 90;
    return leftMargin + ((clampedM - startMin) / totalMin) * width;
  };

  const makeSvgPath = (points) => {
    if (!points || points.length < 2) return "";
    // Ensure chronological sort
    const sorted = [...points].sort(
      (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
    );

    let d = "";
    let validCount = 0;
    for (let i = 0; i < sorted.length; i++) {
      const pt = sorted[i];
      const x = getX(pt.time);
      const y = getY(pt.km);
      if (x === null || isNaN(x) || isNaN(y)) continue;
      d += validCount === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)} ` : `L ${x.toFixed(1)} ${y.toFixed(1)} `;
      validCount++;
    }
    return validCount >= 2 ? d : "";
  };

  // Filter trajectories
  const filteredTrajectories = useMemo(() => {
    if (!mareyData?.trajectories) return [];
    return mareyData.trajectories.filter((tr) => {
      if (directionFilter !== "ALL" && tr.direction !== directionFilter) return false;
      if (typeFilter !== "ALL" && !tr.train_type?.toUpperCase().includes(typeFilter)) return false;
      if (onlyAffected && !tr.is_affected) return false;
      return true;
    });
  }, [mareyData, directionFilter, typeFilter, onlyAffected]);

  const activeTrain = hoveredTrain || filteredTrajectories.find((t) => t.train_number === selectedTrainNumber);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
      {/* Title & Multi-Criteria Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-[#213D77]" />
            <h2 className="font-bold text-base text-[#162A52]">
              Marey Time-Distance Trajectory Chart (समय-दूरी ग्राफ)
            </h2>
            <span className="px-2 py-0.5 rounded bg-blue-100 text-[#213D77] text-[11px] font-bold">
              IST (UTC+5:30)
            </span>
          </div>
          <p className="text-slate-500 text-xs mt-0.5">
            North-Central Mainline (05:00 — 13:00 IST) • Horizontal flats represent station dwells • Slants represent block running
          </p>
        </div>

        {/* Visibility Toggles */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <button
            onClick={() => setShowOriginal(!showOriginal)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all ${
              showOriginal
                ? "bg-slate-100 text-slate-800 border-slate-300 font-bold"
                : "bg-white text-slate-400 border-slate-200"
            }`}
          >
            {showOriginal ? <Eye className="w-4 h-4 text-slate-600" /> : <EyeOff className="w-4 h-4" />}
            <span>Original Timetable (Dashed)</span>
          </button>

          <button
            onClick={() => setShowReplanned(!showReplanned)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all ${
              showReplanned
                ? "bg-blue-50 text-[#213D77] border-blue-300 font-bold"
                : "bg-white text-slate-400 border-slate-200"
            }`}
          >
            {showReplanned ? <Eye className="w-4 h-4 text-blue-600" /> : <EyeOff className="w-4 h-4" />}
            <span>Replanned Schedule (Solid)</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-slate-600 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Filter:
          </span>

          {/* Direction */}
          <select
            value={directionFilter}
            onChange={(e) => setDirectionFilter(e.target.value)}
            className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-slate-700 font-medium"
          >
            <option value="ALL">All Directions (UP & DOWN)</option>
            <option value="DOWN">DOWN (NDLS ➔ BPL)</option>
            <option value="UP">UP (BPL ➔ NDLS)</option>
          </select>

          {/* Category */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-slate-700 font-medium"
          >
            <option value="ALL">All Categories (सभी श्रेणियां)</option>
            <option value="VANDE">Vande Bharat (वंदे भारत)</option>
            <option value="RAJDHANI">Rajdhani Express (राजधानी)</option>
            <option value="EXPRESS">Mail / Superfast</option>
            <option value="FREIGHT">Freight Trains (मालगाड़ी)</option>
          </select>

          {/* Affected Only Toggle */}
          <label className="flex items-center gap-1.5 cursor-pointer ml-1 font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={onlyAffected}
              onChange={(e) => setOnlyAffected(e.target.checked)}
              className="rounded text-[#EA580C] focus:ring-[#EA580C]"
            />
            <span>Affected In Incident Only</span>
          </label>
        </div>

        <div className="text-slate-500 font-medium">
          Showing <span className="font-bold text-slate-800">{filteredTrajectories.length}</span> of{" "}
          <span className="font-bold text-slate-800">{mareyData?.trajectories?.length || 0}</span> corridor rakes
        </div>
      </div>

      {/* SVG Canvas Container */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 overflow-x-auto custom-scroll relative">
        <svg
          viewBox="0 0 1020 620"
          className="w-full min-w-[940px] h-auto select-none"
        >
          {/* Station Horizontal Gridlines */}
          {stations.map((stn) => {
            const y = getY(stn.km);
            const isMajor = ["NDLS", "AGC", "JHS", "BPL"].includes(stn.code);

            return (
              <g key={stn.code}>
                <line
                  x1="90"
                  y1={y}
                  x2="950"
                  y2={y}
                  stroke={isMajor ? "#CBD5E1" : "#E2E8F0"}
                  strokeWidth={isMajor ? "1.5" : "1"}
                  strokeDasharray={isMajor ? "" : "3 3"}
                />
                <text
                  x="80"
                  y={y + 4}
                  fill={isMajor ? "#0F172A" : "#475569"}
                  fontSize={isMajor ? "11" : "10"}
                  fontFamily="Inter"
                  textAnchor="end"
                  fontWeight={isMajor ? "bold" : "600"}
                >
                  {stn.code}
                </text>
                <text
                  x="960"
                  y={y + 4}
                  fill="#64748B"
                  fontSize="9"
                  fontFamily="Inter"
                  fontWeight="500"
                >
                  {stn.km} km
                </text>
              </g>
            );
          })}

          {/* Time Vertical Gridlines (Every 60 minutes) */}
          {Array.from({ length: Math.floor(totalMin / 60) + 1 }).map((_, i) => {
            const m = startMin + i * 60;
            const hour = Math.floor(m / 60) % 24;
            const x = 90 + (i * 60 / totalMin) * 860;

            return (
              <g key={i}>
                <line
                  x1={x}
                  y1="45"
                  x2={x}
                  y2="555"
                  stroke="#E2E8F0"
                  strokeWidth="1"
                />
                <text
                  x={x}
                  y="30"
                  fill="#1E293B"
                  fontSize="11"
                  fontFamily="Inter"
                  textAnchor="middle"
                  fontWeight="bold"
                >
                  {String(hour).padStart(2, "0")}:00
                </text>
                <text
                  x={x}
                  y="575"
                  fill="#64748B"
                  fontSize="10"
                  fontFamily="Inter"
                  textAnchor="middle"
                >
                  {String(hour).padStart(2, "0")}:00 IST
                </text>
              </g>
            );
          })}

          {/* Active Disruption Shading (e.g. Fog or Track block) */}
          {mareyData?.active_disruptions?.map((d, dIdx) => {
            let y1 = getY(0);
            let y2 = getY(702);
            if (d.location_station) {
              const stn = stations.find((s) => s.code === d.location_station);
              if (stn) {
                y1 = getY(Math.max(0, stn.km - 40));
                y2 = getY(Math.min(702, stn.km + 40));
              }
            }
            return (
              <rect
                key={dIdx}
                x="90"
                y={y1}
                width="860"
                height={Math.max(20, y2 - y1)}
                fill="#FEF3C7"
                opacity="0.35"
              />
            );
          })}

          {/* TRAJECTORY LINES */}
          {filteredTrajectories.map((tr) => {
            const isHovered = activeTrain?.train_number === tr.train_number;
            const isSelected = selectedTrainNumber === tr.train_number;
            const origD = makeSvgPath(tr.original_path);
            const replanD = makeSvgPath(tr.replanned_path);

            // Palette based on train category
            let strokeColor = "#2563EB"; // Blue for Express
            if (tr.train_type?.includes("VANDE")) {
              strokeColor = "#EA580C"; // Saffron for Vande Bharat
            } else if (tr.train_type?.includes("RAJDHANI")) {
              strokeColor = "#0284C7"; // Sky blue for Rajdhani
            } else if (tr.train_type?.includes("FREIGHT")) {
              strokeColor = "#475569"; // Slate gray for Freight
            }

            return (
              <g
                key={tr.train_number}
                onMouseEnter={() => setHoveredTrain(tr)}
                onMouseLeave={() => setHoveredTrain(null)}
                onClick={() => setSelectedTrainNumber(tr.train_number === selectedTrainNumber ? null : tr.train_number)}
                className="cursor-pointer"
              >
                {/* Original Schedule (Dashed) */}
                {showOriginal && origD && (
                  <path
                    d={origD}
                    fill="none"
                    stroke="#94A3B8"
                    strokeWidth={isHovered ? "2.5" : "1.2"}
                    strokeDasharray="4 3"
                    opacity={isHovered ? 0.9 : 0.45}
                  />
                )}

                {/* Replanned Schedule (Solid) */}
                {showReplanned && replanD && (
                  <path
                    d={replanD}
                    fill="none"
                    stroke={tr.is_affected ? "#DC2626" : strokeColor}
                    strokeWidth={isHovered || isSelected ? "4.5" : tr.is_affected ? "2.5" : "1.8"}
                    strokeDasharray={tr.is_affected ? "6 2" : ""}
                    opacity={
                      isHovered || isSelected
                        ? 1.0
                        : tr.is_affected
                        ? 0.95
                        : 0.7
                    }
                  />
                )}
              </g>
            );
          })}
        </svg>

        {/* Interactive Train Detail Card Overlay */}
        {activeTrain && (
          <div className="absolute bottom-6 right-6 p-4 bg-white/95 backdrop-blur-md border-2 border-[#213D77] rounded-xl shadow-2xl text-xs space-y-1.5 max-w-sm">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-1.5">
              <span className="font-bold text-[#213D77] text-sm">
                #{activeTrain.train_number} — {activeTrain.train_name}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                {activeTrain.direction}
              </span>
            </div>

            <div className="text-slate-700 grid grid-cols-2 gap-1 text-[11px]">
              <div>
                Type: <span className="font-semibold text-slate-900">{activeTrain.train_type}</span>
              </div>
              <div>
                Priority: <span className="font-bold text-[#EA580C]">{activeTrain.priority}</span>
              </div>
              <div>
                Rake: <span className="font-semibold">{activeTrain.coaches || 24} Coaches</span>
              </div>
              <div>
                Length: <span className="font-semibold">{activeTrain.length_m || 550} m</span>
              </div>
            </div>

            <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Recovery Status:</span>
              {activeTrain.is_affected ? (
                <span className="text-red-700 font-bold bg-red-100 px-2 py-0.5 rounded">
                  ⚠️ Incident Affected (Replanned)
                </span>
              ) : (
                <span className="text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded">
                  ✓ On-Time Path
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-600 pt-2 border-t border-slate-100">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-0.5 bg-slate-400 border-b border-dashed border-slate-500" />
            <span>Original Timetable</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-1 bg-[#EA580C] rounded" />
            <span>Vande Bharat</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-1 bg-[#0284C7] rounded" />
            <span>Rajdhani Express</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-1 bg-[#2563EB] rounded" />
            <span>Mail / Superfast</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-1 bg-[#475569] rounded" />
            <span>Freight (BOXN/BCN)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-1 bg-[#DC2626] rounded border border-red-700" />
            <span>Incident Affected</span>
          </div>
        </div>

        <div className="text-slate-400 italic">
          Click any trajectory to lock details • Hover to inspect dwell intervals
        </div>
      </div>
    </div>
  );
}
