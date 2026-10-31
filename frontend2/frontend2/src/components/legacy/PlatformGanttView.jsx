import React, { useState, useEffect, useMemo } from "react";
import {
  LayoutGrid,
  Train,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Ruler,
  ShieldAlert,
  ArrowRight,
  Info,
} from "lucide-react";
import { getPlatformsStatus } from "../api";

const START_HOUR = 5; // 05:00 IST
const END_HOUR = 13;   // 13:00 IST
const TOTAL_HOURS = END_HOUR - START_HOUR;
const TOTAL_MINUTES = TOTAL_HOURS * 60;

export default function PlatformGanttView() {
  const [stationsData, setStationsData] = useState([]);
  const [selectedStation, setSelectedStation] = useState("AGC");
  const [hoveredEvent, setHoveredEvent] = useState(null);

  useEffect(() => {
    getPlatformsStatus()
      .then((data) => {
        setStationsData(data || []);
        if (data && data.length > 0) {
          setSelectedStation((prev) => prev || data[0].station_code);
        }
      })
      .catch((err) => console.warn("Failed to load platforms status:", err));
  }, []);

  const currentStation = useMemo(() => {
    return stationsData.find((s) => s.station_code === selectedStation) || stationsData[0];
  }, [stationsData, selectedStation]);

  // Combine platforms and loop lines into resource rows
  const resources = useMemo(() => {
    if (!currentStation) return [];
    const plats = (currentStation.platforms || []).map((p) => ({
      id: p.id,
      label: p.id.includes("-") ? `Platform ${p.id.split("-")[1]}` : `Platform ${p.id}`,
      usable_length_m: p.usable_length_m || p.length_m || 580,
      clearance_margin_m: p.clearance_margin_m || 25,
      resource_type: p.resource_type || "platform",
      handles_freight: p.handles_freight || false,
    }));

    const loops = (currentStation.loop_lines || []).map((l, idx) => ({
      id: l.id || `${currentStation.station_code}-LOOP-${idx + 1}`,
      label: `Loop Line ${idx + 1}`,
      usable_length_m: l.usable_length_m || 750,
      clearance_margin_m: l.clearance_margin_m || 25,
      resource_type: "loop_line",
      handles_freight: true,
    }));

    return [...plats, ...loops];
  }, [currentStation]);

  // Map time to percentage (0% to 100%)
  const getTimePercent = (timeIso) => {
    if (!timeIso) return 0;
    const dt = new Date(timeIso);
    const minutes = dt.getHours() * 60 + dt.getMinutes() - START_HOUR * 60;
    return Math.max(0, Math.min(100, (minutes / TOTAL_MINUTES) * 100));
  };

  // Metrics summary for station
  const stationStats = useMemo(() => {
    if (!currentStation?.scheduled_events) {
      return { total: 0, overlaps: 0, lengthViolations: 0 };
    }
    const events = currentStation.scheduled_events;
    const overlaps = events.filter((e) => e.is_overlapping).length;
    const lengthViolations = events.filter((e) => e.fits_length === false).length;
    return {
      total: events.length,
      overlaps,
      lengthViolations,
    };
  }, [currentStation]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
      {/* Header & Station Selector */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-[#213D77]" />
            <h2 className="font-bold text-base text-[#162A52]">
              Station Platform & Loop-Line Gantt Chart (प्लेटफ़ॉर्म गेंट चार्ट)
            </h2>
          </div>
          <p className="text-slate-500 text-xs mt-0.5">
            Resource occupancy intervals • Usable length clearance (m) • Overlapping headway conflict detection
          </p>
        </div>

        {/* Station Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1 text-xs font-semibold">
          {stationsData.map((stn) => (
            <button
              key={stn.station_code}
              onClick={() => setSelectedStation(stn.station_code)}
              className={`px-3 py-1.5 rounded-lg border transition-all ${
                selectedStation === stn.station_code
                  ? "bg-[#213D77] text-white border-[#213D77] shadow"
                  : "bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100"
              }`}
            >
              {stn.station_code}
            </button>
          ))}
        </div>
      </div>

      {currentStation ? (
        <div className="space-y-4">
          {/* Station Overview & Clearance Summary Banner */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
            <div className="flex items-center gap-3">
              <span className="font-bold text-slate-900 text-sm">
                {currentStation.station_name} ({currentStation.station_code})
              </span>
              <span className="text-slate-500">• {currentStation.km} corridor km</span>
              <span className="text-slate-500">• {resources.length} berthing tracks</span>
            </div>

            {/* Validation Badges */}
            <div className="flex items-center gap-3">
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-bold text-xs ${
                  stationStats.lengthViolations === 0
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-300"
                    : "bg-red-50 text-red-800 border border-red-300"
                }`}
              >
                {stationStats.lengthViolations === 0 ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                )}
                <span>
                  Length Clearance:{" "}
                  {stationStats.lengthViolations === 0 ? "PASSED (All Fit)" : `${stationStats.lengthViolations} OVERFLOW`}
                </span>
              </div>

              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-bold text-xs ${
                  stationStats.overlaps === 0
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-300"
                    : "bg-amber-50 text-amber-800 border border-amber-300 animate-pulse"
                }`}
              >
                {stationStats.overlaps === 0 ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                )}
                <span>
                  Occupancy Headway:{" "}
                  {stationStats.overlaps === 0 ? "PASSED (No Overlap)" : `${stationStats.overlaps} Overlapping`}
                </span>
              </div>
            </div>
          </div>

          {/* Gantt Timeline Container */}
          <div className="border border-slate-200 rounded-xl overflow-x-auto custom-scroll bg-white">
            <div className="min-w-[900px]">
              {/* Timeline Header (Time Scale) */}
              <div className="flex border-b border-slate-200 bg-slate-100 text-[11px] font-bold text-slate-700 py-2 sticky top-0 z-10">
                <div className="w-56 px-4 shrink-0 border-r border-slate-200">
                  Track / Platform Resource
                </div>
                <div className="flex-1 relative h-6">
                  {Array.from({ length: TOTAL_HOURS + 1 }).map((_, i) => {
                    const hour = START_HOUR + i;
                    const leftPct = (i / TOTAL_HOURS) * 100;
                    return (
                      <div
                        key={hour}
                        className="absolute text-center transform -translate-x-1/2"
                        style={{ left: `${leftPct}%` }}
                      >
                        <span className="font-mono">{String(hour).padStart(2, "0")}:00</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Resource Rows */}
              <div className="divide-y divide-slate-100">
                {resources.map((res) => {
                  // Find events on this platform/loop
                  const events = (currentStation.scheduled_events || []).filter((e) => {
                    const p = e.revised_platform || e.original_platform;
                    return p === res.id || p === res.id.replace(`${currentStation.station_code}-`, "");
                  });

                  return (
                    <div key={res.id} className="flex hover:bg-slate-50/60 transition-colors">
                      {/* Left: Resource Metadata */}
                      <div className="w-56 px-3 py-3 shrink-0 border-r border-slate-200 text-xs flex flex-col justify-center">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">{res.label}</span>
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                              res.resource_type === "loop_line"
                                ? "bg-amber-100 text-amber-900 border border-amber-200"
                                : "bg-blue-100 text-[#213D77] border border-blue-200"
                            }`}
                          >
                            {res.resource_type === "loop_line" ? "Loop" : "PF"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-1">
                          <span className="flex items-center gap-0.5">
                            <Ruler className="w-3 h-3 text-slate-400" />
                            {res.usable_length_m}m clear
                          </span>
                          {res.handles_freight && (
                            <span className="text-slate-400 font-semibold">• Freight OK</span>
                          )}
                        </div>
                      </div>

                      {/* Right: Gantt Timeline Track */}
                      <div className="flex-1 relative h-16 py-2">
                        {/* Background Hour Gridlines */}
                        {Array.from({ length: TOTAL_HOURS + 1 }).map((_, i) => {
                          const leftPct = (i / TOTAL_HOURS) * 100;
                          return (
                            <div
                              key={i}
                              className="absolute top-0 bottom-0 border-r border-slate-100"
                              style={{ left: `${leftPct}%` }}
                            />
                          );
                        })}

                        {/* Occupancy Duration Blocks */}
                        {events.map((ev, evIdx) => {
                          const arrStr = ev.revised_arrival || ev.original_arrival;
                          const depStr = ev.revised_departure || ev.original_departure;
                          const leftPct = getTimePercent(arrStr);
                          const rightPct = getTimePercent(depStr);
                          const widthPct = Math.max(3.5, rightPct - leftPct);

                          const hasOverlap = ev.is_overlapping;
                          const lengthOverflow = ev.fits_length === false;

                          let bgClass = "bg-blue-600 text-white border-blue-700";
                          if (ev.train_type?.includes("VANDE")) {
                            bgClass = "bg-[#EA580C] text-white border-orange-700";
                          } else if (ev.train_type?.includes("RAJDHANI")) {
                            bgClass = "bg-[#0284C7] text-white border-sky-700";
                          } else if (ev.train_type?.includes("FREIGHT")) {
                            bgClass = "bg-slate-700 text-white border-slate-800";
                          }

                          if (hasOverlap) {
                            bgClass = "bg-red-600 text-white border-2 border-amber-300 animate-pulse";
                          } else if (lengthOverflow) {
                            bgClass = "bg-purple-700 text-white border-2 border-red-400";
                          }

                          return (
                            <div
                              key={evIdx}
                              onMouseEnter={() => setHoveredEvent({ ...ev, resource: res })}
                              onMouseLeave={() => setHoveredEvent(null)}
                              className={`absolute top-2.5 h-10 rounded-lg px-2 flex items-center justify-between text-xs font-bold shadow-md cursor-pointer transition-all hover:scale-[1.02] hover:z-20 border ${bgClass}`}
                              style={{
                                left: `${leftPct}%`,
                                width: `${widthPct}%`,
                              }}
                            >
                              <div className="flex items-center gap-1 truncate">
                                <Train className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">#{ev.train_number}</span>
                              </div>
                              <span className="text-[10px] font-normal opacity-90 hidden sm:inline ml-1">
                                {ev.duration_minutes || 5}m
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Interactive Tooltip Card */}
          {hoveredEvent && (
            <div className="p-4 bg-white border-2 border-[#213D77] rounded-xl shadow-lg text-xs space-y-2">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <Train className="w-4 h-4 text-[#213D77]" />
                  <span className="font-bold text-slate-900 text-sm">
                    Train #{hoveredEvent.train_number} — {hoveredEvent.train_name}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-blue-100 text-[#213D77] text-[10px] font-bold">
                    {hoveredEvent.train_type}
                  </span>
                </div>
                <span className="font-bold text-slate-700">
                  Track: {hoveredEvent.resource?.label}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-slate-700">
                <div>
                  <span className="text-slate-500 block">Arrival — Departure:</span>
                  <span className="font-bold text-slate-900 font-mono">
                    {new Date(hoveredEvent.revised_arrival || hoveredEvent.original_arrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {" ➔ "}
                    {new Date(hoveredEvent.revised_departure || hoveredEvent.original_departure).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block">Dwell Duration:</span>
                  <span className="font-bold text-slate-900">
                    {hoveredEvent.duration_minutes || 5} minutes
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block">Length Verification:</span>
                  <span className={`font-bold ${hoveredEvent.fits_length !== false ? "text-emerald-700" : "text-red-700"}`}>
                    Train: {hoveredEvent.train_length_m || 550}m ≤ Platform: {hoveredEvent.usable_platform_length_m || hoveredEvent.resource?.usable_length_m}m
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block">Clearance Status:</span>
                  {hoveredEvent.is_overlapping ? (
                    <span className="text-red-700 font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> OVERLAP CONFLICT
                    </span>
                  ) : hoveredEvent.fits_length === false ? (
                    <span className="text-red-700 font-bold flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5" /> LENGTH OVERFLOW
                    </span>
                  ) : (
                    <span className="text-emerald-700 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> G&SR CLEARANCE VALID
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12 text-slate-400 text-xs">
          Loading platform and loop line allocations...
        </div>
      )}
    </div>
  );
}
