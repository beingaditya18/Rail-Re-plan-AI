import React from "react";
import {
  Train,
  Play,
  Pause,
  RotateCcw,
  AlertTriangle,
  Clock,
  Radio,
  ShieldCheck,
  CheckCircle2,
  Zap,
} from "lucide-react";

export default function TopCommandHeader({
  simState,
  onControlSim,
  onResetSim,
  wsConnected,
  activeDisruptions = [],
  isPlanApplied = false,
}) {
  const clockStr = simState?.clock
    ? new Date(simState.clock).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "06:00:00";

  const speeds = [1, 5, 15, 30, 60];

  return (
    <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-50">
      {/* Top Government of India Header Bar */}
      <div className="bg-[#162A52] text-white px-3 sm:px-6 lg:px-8 py-2 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs">
        {/* Ministry & Indian Railways Branding */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white flex items-center justify-center p-1 shadow shrink-0">
              <svg viewBox="0 0 24 24" className="w-6 h-6 sm:w-7 sm:h-7 text-[#213D77]" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
                <path d="M12 4a8 8 0 100 16 8 8 0 000-16zm-1 3h2v2h-2V7zm0 4h2v6h-2v-6z" opacity="0.3" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-wide text-xs sm:text-sm font-headline">
                  भारतीय रेल • INDIAN RAILWAYS
                </span>
                <span className="bg-[#EA580C] text-white text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">
                  RailReplan AI
                </span>
              </div>
              <div className="text-[10px] sm:text-[11px] text-slate-300">
                रेल मंत्रालय / Ministry of Railways • Recovery Agent (North-Central Trunk Line)
              </div>
            </div>
          </div>
        </div>

        {/* Live Simulation Controls & Clock */}
        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
          {/* Simulated Data Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 border border-amber-400/40 text-amber-200 text-[11px] rounded font-medium">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span>SIMULATED DATA (प्रयोगात्मक डेटा)</span>
          </div>

          {/* Telemetry Indicator */}
          <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-800/80 rounded text-[11px] text-slate-300">
            <span
              className={`w-2 h-2 rounded-full ${
                wsConnected ? "bg-emerald-400 status-pulse" : "bg-red-400"
              }`}
            />
            <span className="hidden sm:inline font-mono">
              {wsConnected ? "Live Telemetry" : "Connecting..."}
            </span>
          </div>

          {/* Simulation Clock Display */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#213D77] border border-blue-400/40 rounded-lg text-white font-mono font-bold text-xs shadow-inner">
            <Clock className="w-3.5 h-3.5 text-[#FB923C]" />
            <span className="text-xs sm:text-sm tracking-wider">{clockStr} IST</span>
          </div>

          {/* Play/Pause & Speed Buttons */}
          <div className="flex items-center bg-slate-800/90 rounded-lg p-0.5 border border-slate-700">
            <button
              onClick={() => onControlSim(simState?.running ? "pause" : "play")}
              className={`p-1.5 rounded transition-all ${
                simState?.running
                  ? "bg-amber-500 text-slate-950 font-bold"
                  : "bg-emerald-500 text-slate-950 font-bold"
              }`}
              title={simState?.running ? "Pause Clock" : "Resume Clock"}
            >
              {simState?.running ? <Pause className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : <Play className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
            </button>

            <button
              onClick={() => onControlSim("step")}
              className="px-1.5 sm:px-2 py-1 text-slate-300 hover:text-white text-xs font-mono"
              title="Step 5 Minutes Forward"
            >
              +5m
            </button>

            {speeds.map((spd) => (
              <button
                key={spd}
                onClick={() => onControlSim(null, spd)}
                className={`px-1.5 py-0.5 text-[10px] font-mono rounded transition-colors ${
                  (simState?.speed || 30) === spd
                    ? "bg-[#EA580C] text-white font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {spd}x
              </button>
            ))}

            <button
              onClick={onResetSim}
              className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
              title="Reset Simulation to Initial State"
            >
              <RotateCcw className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Primary Workspace Status Ribbon */}
      <div className="bg-[#213D77] text-white px-3 sm:px-6 lg:px-8 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 font-semibold">
            <Zap className="w-4 h-4 text-[#FB923C]" />
            <span className="tracking-wide uppercase text-[11px] text-slate-300">
              DISRUPTION RECOVERY AGENT // DECISION WORKSPACE
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5">
            <span className="text-slate-400">•</span>
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                isPlanApplied
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
              }`}
            >
              {isPlanApplied ? "✓ APPROVED RECOVERY SCHEDULE ACTIVE" : "● INITIAL TIMETABLE ACTIVE"}
            </span>
          </div>
        </div>

        {/* Active Disruption Alert Marquee */}
        {activeDisruptions.length > 0 ? (
          <div className="flex items-center gap-2 bg-red-600/90 text-white px-3 py-1 rounded text-xs font-semibold shadow animate-pulse">
            <span className="w-2 h-2 rounded-full bg-white status-pulse" />
            <span className="uppercase text-[11px] tracking-wide">ACTIVE INCIDENT:</span>
            <span className="truncate max-w-sm sm:max-w-md">
              {activeDisruptions[activeDisruptions.length - 1].description}
            </span>
          </div>
        ) : (
          <div className="text-[11px] text-slate-300 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Normal automatic block signaling in effect (NDLS - BPL 702 km)</span>
          </div>
        )}
      </div>
    </header>
  );
}
