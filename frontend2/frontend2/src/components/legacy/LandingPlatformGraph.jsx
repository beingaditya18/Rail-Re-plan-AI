import React, { useState, useEffect } from "react";
import {
  LayoutGrid,
  Train,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Flame,
  ArrowRight,
  Maximize2,
  ChevronRight,
} from "lucide-react";
import { getPlatformsStatus } from "../api";

export default function LandingPlatformGraph() {
  const [stations, setStations] = useState([]);
  const [selectedStation, setSelectedStation] = useState("AGC");
  const [selectedEvent, setSelectedEvent] = useState(null);

  useEffect(() => {
    getPlatformsStatus()
      .then((data) => {
        setStations(data);
        if (data && data.length > 0) {
          setSelectedStation((prev) => prev || data[0].station_code);
        }
      })
      .catch((err) => console.warn("Failed to load platform graph status:", err));
  }, []);

  const currentStation =
    stations.find((s) => s.station_code === selectedStation) || stations[0];

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-5 shadow-sm space-y-4">
      {/* Header & Station Selector - Responsive */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#213D77] flex items-center justify-center font-bold shrink-0">
            <LayoutGrid className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base text-[#162A52] flex items-center gap-2">
              <span>Station Platform Berthing Board (प्लेटफ़ॉर्म स्थिति)</span>
              <span className="text-[10px] font-bold bg-blue-50 text-[#213D77] px-2 py-0.5 rounded border border-blue-200">
                LIVE INTERLOCKING
              </span>
            </h3>
            <p className="text-xs text-slate-500 hidden sm:block">
              Visual track occupancy, 24-coach platform clearance, and loop line bypass
            </p>
          </div>
        </div>

        {/* Station Select Tabs - Mobile Horizontal Scrollable */}
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scroll pb-1 sm:pb-0 text-xs">
          {stations.map((stn) => {
            const isSelected = selectedStation === stn.station_code;
            return (
              <button
                key={stn.station_code}
                onClick={() => setSelectedStation(stn.station_code)}
                className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition-all text-xs border ${
                  isSelected
                    ? "bg-[#213D77] text-white border-[#213D77] shadow"
                    : "bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100"
                }`}
              >
                {stn.station_code}
                <span className="hidden md:inline font-normal text-[11px] ml-1 opacity-80">
                  ({stn.station_name?.split(" ")[0]})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend Bar - Simple to understand */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] bg-slate-50 p-2 sm:px-3 rounded-lg border border-slate-200">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-slate-600 font-semibold">Track Legend:</span>
          <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            🟢 On-Time Berth (≤5m)
          </span>
          <span className="inline-flex items-center gap-1 text-amber-700 font-bold">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            🟡 Delayed Berth (6-30m)
          </span>
          <span className="inline-flex items-center gap-1 text-red-700 font-bold">
            <span className="w-2 h-2 rounded-full bg-red-600 status-pulse" />
            🔴 Emergency Delay (&gt;30m)
          </span>
          <span className="inline-flex items-center gap-1 text-slate-500">
            <span className="w-2 h-2 rounded-full bg-slate-300" />
            ⚪ Track Clear
          </span>
        </div>

        <div className="text-slate-500 hidden md:block">
          Junction: <span className="font-bold text-slate-800">{currentStation?.station_name}</span> (Km {currentStation?.km || 195})
        </div>
      </div>

      {/* Visual Platform Tracks Grid */}
      {currentStation ? (
        <div className="space-y-3">
          {currentStation.platforms?.map((plat) => {
            const events =
              currentStation.scheduled_events?.filter(
                (e) =>
                  e.revised_platform === plat.id ||
                  e.original_platform === plat.id ||
                  plat.id.endsWith(e.revised_platform || "XYZ")
              ) || [];

            return (
              <div
                key={plat.id}
                className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-xs hover:border-slate-300 transition-all"
              >
                {/* Platform Label & Track Indicator */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="w-12 h-12 rounded-xl bg-white border border-blue-200 text-[#213D77] flex flex-col items-center justify-center font-bold shadow-sm">
                    <span className="text-[10px] text-slate-500 font-normal">PF</span>
                    <span className="text-base font-black">
                      {plat.id.split("-")[1] || plat.id}
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-xs">
                        Platform {plat.id.split("-")[1] || plat.id} Track
                      </span>
                      {plat.handles_freight && (
                        <span className="text-[10px] bg-slate-200/80 text-slate-700 px-1.5 py-0.2 rounded font-medium">
                          Freight Compatible
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Length: <span className="font-semibold">{plat.length_m}m</span> (24-Coach Broad Gauge Clear)
                    </div>
                  </div>
                </div>

                {/* Track Line Canvas with Trains Berthing on Track */}
                <div className="flex-1 bg-white p-2.5 rounded-xl border border-slate-200 min-h-[56px] flex items-center overflow-x-auto custom-scroll relative">
                  {/* Subtle railway track rails representation */}
                  <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-1 bg-slate-200 rounded-full pointer-events-none" />

                  <div className="relative z-10 flex items-center gap-3 w-full">
                    {events.length === 0 ? (
                      <div className="flex items-center gap-2 text-xs text-slate-600 italic px-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span>Track Clear & Available for Berthing</span>
                      </div>
                    ) : (
                      events.map((ev, eIdx) => {
                        const delay = ev.delay_minutes || 0;
                        const isEmergency = delay > 30;
                        const isLate = delay > 5 && delay <= 30;

                        let cardStyle =
                          "bg-emerald-50 border-emerald-400 text-emerald-900";
                        let pillStyle = "bg-emerald-600 text-white";

                        if (isEmergency) {
                          cardStyle =
                            "bg-red-50 border-red-500 text-red-900 shadow-md ring-2 ring-red-200 animate-pulse";
                          pillStyle = "bg-red-600 text-white font-bold";
                        } else if (isLate) {
                          cardStyle =
                            "bg-amber-50 border-amber-400 text-amber-900 shadow-sm";
                          pillStyle = "bg-amber-600 text-white font-bold";
                        }

                        const arrStr = ev.revised_arrival
                          ? new Date(ev.revised_arrival).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "--";
                        const depStr = ev.revised_departure
                          ? new Date(ev.revised_departure).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : arrStr;

                        return (
                          <div
                            key={eIdx}
                            onClick={() => setSelectedEvent(ev)}
                            className={`cursor-pointer px-3 py-2 rounded-xl border flex items-center gap-2.5 text-xs font-semibold whitespace-nowrap transition-transform hover:scale-105 ${cardStyle}`}
                          >
                            <Train className="w-4 h-4 shrink-0 text-[#213D77]" />
                            <div>
                              <div className="flex items-center gap-1.5 font-bold">
                                <span>Train #{ev.train_number}</span>
                                {ev.train_name && (
                                  <span className="text-[10px] text-slate-600 font-normal hidden sm:inline">
                                    ({ev.train_name.split(" ")[0]})
                                  </span>
                                )}
                                <span className={`text-[10px] px-1.5 py-0.2 rounded ${pillStyle}`}>
                                  {isEmergency
                                    ? `+${delay}m CRITICAL`
                                    : isLate
                                    ? `+${delay}m`
                                    : "ON TIME"}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-600 font-normal mt-0.5 flex items-center gap-1">
                                <span>Berth: {arrStr}</span>
                                <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
                                <span>Depart: {depStr}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8 text-slate-400 text-xs">
          Loading platform interlocking telemetry...
        </div>
      )}

      {/* Train Details Modal for Berthing Inspection */}
      {selectedEvent && (
        <div className="p-3.5 bg-blue-50/90 border border-blue-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#213D77] text-white flex items-center justify-center font-bold">
              {selectedEvent.train_number}
            </div>
            <div>
              <div className="font-bold text-slate-900 text-sm">
                Train #{selectedEvent.train_number} {selectedEvent.train_name}
              </div>
              <div className="text-slate-600 text-xs">
                Station: <span className="font-semibold">{selectedEvent.station_code}</span> • Platform:{" "}
                <span className="font-bold text-[#213D77]">
                  {selectedEvent.revised_platform || "PF 1"}
                </span> • Status:{" "}
                <span
                  className={`font-bold ${
                    (selectedEvent.delay_minutes || 0) > 30
                      ? "text-red-700"
                      : "text-emerald-700"
                  }`}
                >
                  {(selectedEvent.delay_minutes || 0) > 0
                    ? `+${selectedEvent.delay_minutes} min Delay`
                    : "On-Time (Scheduled)"}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setSelectedEvent(null)}
            className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-100 shadow-xs"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
