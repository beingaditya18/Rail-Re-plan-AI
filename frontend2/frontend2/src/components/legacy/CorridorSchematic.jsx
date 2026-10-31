import React, { useState } from "react";
import {
  Train,
  CloudFog,
  Wrench,
  Zap,
  Send,
  Plus,
  Compass,
  AlertCircle,
  MapPin,
  Info,
} from "lucide-react";

const STATIONS = [
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

export default function CorridorSchematic({
  trainPositions = [],
  activeDisruptions = [],
  onInjectDisruption,
  isOptimizing,
  activeFilter = "ALL",
}) {
  const [selectedTrain, setSelectedTrain] = useState(null);
  const [freeText, setFreeText] = useState("");
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customForm, setCustomForm] = useState({
    type: "WEATHER_FOG",
    station: "MTJ",
    duration_minutes: 120,
    severity: "HIGH",
    speed_cap_kmph: 40,
    delay_minutes: 45,
  });

  const getKmPercent = (km) => {
    return Math.min(100, Math.max(0, (km / TOTAL_KM) * 100));
  };

  const handlePreset = (presetName) => {
    onInjectDisruption({ preset: presetName });
  };

  const handleFreeTextSubmit = (e) => {
    e.preventDefault();
    if (!freeText.trim()) return;
    onInjectDisruption({ free_text: freeText });
    setFreeText("");
  };

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    onInjectDisruption(customForm);
    setShowCustomModal(false);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
      {/* Header and Disruption Triggers */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#213D77] flex items-center justify-center font-bold">
            <Train className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-base text-[#162A52] tracking-tight">
              Live Corridor Tracking & NTES Section Interlocking
            </h2>
            <p className="text-xs text-slate-500">
              New Delhi to Bhopal (702 km) • Automatic Double-Line Block Signalling • 35 Scheduled Trains
            </p>
          </div>
        </div>

        {/* Quick Scenario Preset Buttons (IR Style) */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500 font-semibold mr-1">Inject Incident:</span>
          
          <button
            onClick={() => handlePreset("fog_tundla")}
            disabled={isOptimizing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-50 border border-orange-300 text-orange-800 font-semibold hover:bg-orange-100 active:scale-95 transition-all shadow-sm"
            title="Inject Radiation Fog around Mathura (45 km/h cap)"
          >
            <CloudFog className="w-4 h-4 text-orange-600" />
            <span>🌫️ Fog Mathura (कोहरा)</span>
          </button>

          <button
            onClick={() => handlePreset("track_block_mathura")}
            disabled={isOptimizing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 border border-red-300 text-red-800 font-semibold hover:bg-red-100 active:scale-95 transition-all shadow-sm"
            title="Inject Track Maintenance Block MTJ-AGC"
          >
            <Wrench className="w-4 h-4 text-red-600" />
            <span>🚧 Track Block (ट्रैक ब्लॉक)</span>
          </button>

          <button
            onClick={() => handlePreset("loco_failure_bhopal")}
            disabled={isOptimizing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-300 text-[#213D77] font-semibold hover:bg-blue-100 active:scale-95 transition-all shadow-sm"
            title="Inject Locomotive Failure on 12002 Shatabdi"
          >
            <Zap className="w-4 h-4 text-blue-600" />
            <span>⚡ Loco Failure 12002 (इंजन खराबी)</span>
          </button>

          <button
            onClick={() => setShowCustomModal(true)}
            disabled={isOptimizing}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-300 text-slate-700 font-semibold hover:bg-slate-200 active:scale-95 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4 text-slate-600" />
            <span>Custom</span>
          </button>
        </div>
      </div>

      {/* Free Text Report Natural Language Input */}
      <form onSubmit={handleFreeTextSubmit} className="flex gap-2 text-xs">
        <input
          type="text"
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          placeholder="Enter disruption report in plain language (e.g. 'Dense fog between Mathura and Agra, speed restricted to 45 km/h for 2 hours')..."
          className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#213D77] focus:bg-white text-xs shadow-inner"
        />
        <button
          type="submit"
          disabled={!freeText.trim() || isOptimizing}
          className="flex items-center gap-1.5 px-5 py-2 bg-[#213D77] hover:bg-[#162A52] disabled:opacity-40 text-white font-bold rounded-lg shadow transition-all"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Parse & Optimize</span>
        </button>
      </form>

      {/* Track Schematic Canvas (Clean NTES Style) */}
      <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 overflow-x-auto custom-scroll relative">
        <div className="min-w-[860px] relative py-10 px-6">
          {/* UP Track Line (Delhi -> Bhopal) */}
          <div className="relative h-2.5 bg-slate-200 rounded-full my-6 border border-slate-300 shadow-inner">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 via-blue-500 to-emerald-400 rounded-full" />
            <span className="absolute -left-14 -top-2.5 font-bold text-[10px] text-[#213D77] flex items-center gap-1">
              UP LINE ➔
            </span>
          </div>

          {/* DOWN Track Line (Bhopal -> Delhi) */}
          <div className="relative h-2.5 bg-slate-200 rounded-full my-8 border border-slate-300 shadow-inner">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 via-amber-400 to-emerald-400 rounded-full" />
            <span className="absolute -left-14 -top-2.5 font-bold text-[10px] text-amber-700 flex items-center gap-1">
              DN LINE ⬅
            </span>
          </div>

          {/* STATIONS ALONG THE CORRIDOR */}
          {STATIONS.map((stn) => {
            const leftPct = getKmPercent(stn.km);
            const isDisruptedStation = activeDisruptions.some(
              (d) => d.location_station === stn.code
            );

            return (
              <div
                key={stn.code}
                style={{ left: `${leftPct}%` }}
                className="absolute top-0 bottom-0 -translate-x-1/2 flex flex-col items-center justify-between pointer-events-none"
              >
                {/* Station Node Top */}
                <div className="pointer-events-auto flex flex-col items-center group cursor-pointer">
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shadow-sm ${
                      isDisruptedStation
                        ? "bg-red-600 border-red-700 status-pulse text-white"
                        : "bg-white border-[#213D77] group-hover:scale-125"
                    }`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full ${
                        isDisruptedStation ? "bg-white" : "bg-[#213D77]"
                      }`}
                    />
                  </div>

                  <span className="mt-1.5 font-bold text-xs text-[#162A52] group-hover:text-[#EA580C]">
                    {stn.code}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    {stn.km} km
                  </span>
                </div>

                {/* Station Node Bottom */}
                <div className="w-0.5 h-10 bg-slate-300 -mt-2" />
              </div>
            );
          })}

          {/* TRAIN BADGES ON TRACK */}
          {trainPositions.map((tp) => {
            const leftPct = getKmPercent(tp.current_km);
            const isUp = tp.direction === "UP";
            const topOffset = isUp ? "2.6rem" : "6.2rem";
            const delay = tp.delay_minutes || 0;

            const isEmergency = delay > 30 || tp.status === "halted";
            const isLate = delay > 5 && delay <= 30;
            const isOnTime = delay <= 5;

            // Check if dimmed by activeFilter
            let isDimmed = false;
            if (activeFilter === "ON_TIME" && !isOnTime) isDimmed = true;
            if (activeFilter === "LATE" && !isLate) isDimmed = true;
            if (activeFilter === "EMERGENCY" && !isEmergency) isDimmed = true;

            // Explicit Color Coding: Green / Yellow / Emergency Red
            let badgeStyle = "bg-[#213D77] text-white border-blue-900";
            if (isEmergency) {
              badgeStyle =
                "bg-red-600 text-white border-red-700 ring-2 ring-red-400 font-black animate-pulse shadow-lg";
            } else if (isLate) {
              badgeStyle =
                "bg-amber-400 text-slate-950 border-amber-500 font-bold shadow-md";
            } else {
              // On-time
              if (tp.train_type?.includes("VANDE")) {
                badgeStyle = "bg-[#EA580C] text-white border-orange-600 font-bold shadow-md";
              } else {
                badgeStyle = "bg-emerald-700 text-white border-emerald-800 font-semibold shadow-sm";
              }
            }

            return (
              <div
                key={tp.train_number}
                onClick={() => setSelectedTrain(tp)}
                style={{ left: `${leftPct}%`, top: topOffset }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer z-20 group transition-all duration-300 hover:scale-125 ${
                  isDimmed ? "opacity-20 pointer-events-none" : "opacity-100"
                }`}
                title={`${tp.train_number} ${tp.train_name} (${tp.speed_kmph} km/h, Delay: ${delay}m)`}
              >
                <div
                  className={`px-2 py-0.5 rounded text-[10px] shadow-md flex items-center gap-1 border ${badgeStyle}`}
                >
                  <Train className="w-3 h-3 shrink-0" />
                  <span className="font-bold">{tp.train_number}</span>
                  {isEmergency ? (
                    <span className="text-[9px] bg-red-900 text-white px-1 rounded font-extrabold">
                      +{delay}m 🚨
                    </span>
                  ) : isLate ? (
                    <span className="text-[9px] bg-amber-900 text-amber-100 px-1 rounded font-bold">
                      +{delay}m
                    </span>
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 shrink-0" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Train Quick Inspection Drawer */}
      {selectedTrain && (
        <div className="p-4 bg-blue-50/80 rounded-xl border border-blue-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#213D77] text-white flex items-center justify-center font-bold text-sm shadow">
              {selectedTrain.train_number}
            </div>
            <div>
              <div className="font-bold text-slate-900 text-sm">
                {selectedTrain.train_name} ({selectedTrain.train_type})
              </div>
              <div className="text-slate-600 text-xs">
                Direction: <span className="font-semibold">{selectedTrain.direction}</span> • Position: Km {selectedTrain.current_km} • Speed:{" "}
                <span className="font-semibold">{selectedTrain.speed_kmph} km/h</span> • Status:{" "}
                <span className="capitalize font-semibold">{selectedTrain.status}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Current Delay</div>
              <div
                className={`text-base font-bold ${
                  selectedTrain.delay_minutes > 15 ? "text-red-600" : "text-emerald-700"
                }`}
              >
                +{selectedTrain.delay_minutes} mins
              </div>
            </div>
            <button
              onClick={() => setSelectedTrain(null)}
              className="text-slate-600 hover:text-slate-900 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold shadow-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Custom Disruption Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full shadow-2xl text-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-base text-[#162A52] flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-orange-600" />
                Configure Disruption Incident
              </h3>
              <button
                onClick={() => setShowCustomModal(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCustomSubmit} className="space-y-3.5">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Disruption Type</label>
                <select
                  value={customForm.type}
                  onChange={(e) =>
                    setCustomForm({ ...customForm, type: e.target.value })
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 font-medium"
                >
                  <option value="WEATHER_FOG">Weather: Dense Fog (कोहरा / Speed Cap)</option>
                  <option value="TRACK_BLOCK">Engineering: Track Block (ट्रैक रखरखाव)</option>
                  <option value="TRAIN_DELAY">Operational: Train En-Route Delay (विलंब)</option>
                  <option value="LOCO_FAILURE">Traction: Locomotive Failure (इंजन विफलता)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Location Station</label>
                  <select
                    value={customForm.station}
                    onChange={(e) =>
                      setCustomForm({ ...customForm, station: e.target.value })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 font-medium"
                  >
                    {STATIONS.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.code} ({s.name})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Duration (Mins)</label>
                  <input
                    type="number"
                    value={customForm.duration_minutes}
                    onChange={(e) =>
                      setCustomForm({
                        ...customForm,
                        duration_minutes: parseInt(e.target.value) || 60,
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Speed Cap (km/h)</label>
                  <input
                    type="number"
                    value={customForm.speed_cap_kmph}
                    onChange={(e) =>
                      setCustomForm({
                        ...customForm,
                        speed_cap_kmph: parseInt(e.target.value) || 40,
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Severity</label>
                  <select
                    value={customForm.severity}
                    onChange={(e) =>
                      setCustomForm({ ...customForm, severity: e.target.value })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 font-medium"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCustomModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#EA580C] hover:bg-orange-700 text-white font-bold shadow"
                >
                  Inject & Replan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
