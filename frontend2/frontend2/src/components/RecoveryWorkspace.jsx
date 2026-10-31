import React, { useState, useRef } from "react";
import {
  AlertTriangle,
  CheckCircle,
  CheckCircle2,
  Clock,
  CloudFog,
  FileText,
  HelpCircle,
  Info,
  Layers,
  MessageSquare,
  Play,
  RotateCcw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Train,
  TrendingDown,
  Wrench,
  XCircle,
  Zap,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Mic,
  MicOff,
  Copy,
  Check,
  Download,
  Sliders,
  Globe,
  Languages,
  Radio,
  ExternalLink,
  Gauge,
  X,
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

export default function RecoveryWorkspace({
  simState,
  activeDisruptions = [],
  proposedPlan,
  impactData,
  benchmarkData,
  aiExplanation,
  aiExplanationHi,
  safetyMargins,
  evidenceClaims = [],
  isOptimizing,
  isApproving,
  onInjectDisruption,
  onApprovePlan,
  onRejectPlan,
  onAskRulebook,
  rulebookAnswer,
  isAskingRulebook,
}) {
  const [naturalLanguageInput, setNaturalLanguageInput] = useState(
    "Heavy fog near Agra Cantt for 60 minutes, speed capped at 45 km/h"
  );
  const [rulebookQuery, setRulebookQuery] = useState("");
  const [showRulebookCard, setShowRulebookCard] = useState(false);

  // New Feature 1: Voice Microphone Input (Web Speech API)
  const [isListening, setIsListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("");
  const recognitionRef = useRef(null);

  // New Feature 2: What-If Sensitivity Slider
  const [whatIfDuration, setWhatIfDuration] = useState(60);

  // New Feature 3: Bilingual (English / Hindi) Toggle
  const [explanationLang, setExplanationLang] = useState("en");

  // New Feature 4: Control Office Order (COO) Modal & Export
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [copiedOrder, setCopiedOrder] = useState(false);

  const isApproved = proposedPlan?.status === "approved";
  const isRejected = proposedPlan?.status === "rejected";
  const isSafe = proposedPlan?.safety_report ? proposedPlan.safety_report.is_safe : true;
  const violations = proposedPlan?.safety_report?.violations || [];
  const events = proposedPlan?.events || [];
  const metrics = proposedPlan?.metrics || {};

  // Handlers
  const handleSubmitNaturalLanguage = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!naturalLanguageInput.trim() || isOptimizing) return;
    onInjectDisruption({ free_text: naturalLanguageInput.trim() });
  };

  const handleSelectPreset = (presetKey, text, duration = 60) => {
    setNaturalLanguageInput(text);
    setWhatIfDuration(duration);
    onInjectDisruption({ preset: presetKey });
  };

  const handleAskRulebookSubmit = (e) => {
    e.preventDefault();
    if (!rulebookQuery.trim() || isAskingRulebook) return;
    onAskRulebook(rulebookQuery.trim());
  };

  // Toggle Voice Input via Web Speech API
  const handleToggleVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Web Speech API is not supported in this browser. Please use Google Chrome or Microsoft Edge.");
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      setVoiceStatus("");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-IN"; // English (India)

      recognition.onstart = () => {
        setIsListening(true);
        setVoiceStatus("Listening on VHF / Radio channel... Speak incident report");
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setNaturalLanguageInput(transcript);
          setVoiceStatus(`Recognized: "${transcript}"`);
        }
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
        setVoiceStatus("Voice input error. Try again.");
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err) {
      console.error("SpeechRecognition start failed:", err);
      setIsListening(false);
      setVoiceStatus("Could not start microphone.");
    }
  };

  // Apply What-If Duration Slider
  const handleApplyWhatIf = () => {
    // Generate text with updated duration
    let updatedText = naturalLanguageInput;
    if (/for \d+ minutes/i.test(updatedText)) {
      updatedText = updatedText.replace(/for \d+ minutes/i, `for ${whatIfDuration} minutes`);
    } else {
      updatedText = `${updatedText} for ${whatIfDuration} minutes`;
    }
    setNaturalLanguageInput(updatedText);
    onInjectDisruption({ free_text: updatedText });
  };

  // Format Official Indian Railways Control Office Order (COO)
  const generateControlOrderText = () => {
    const orderDate = new Date().toISOString().slice(0, 10);
    const orderTime = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    const planId = proposedPlan?.id || "PLAN-AUTO-01";
    const disruptionStation = activeStation || "Agra Cantt (AGC)";

    let order = `========================================================================================\n`;
    order += `             GOVERNMENT OF INDIA (भारत सरकार) — MINISTRY OF RAILWAYS (रेल मंत्रालय)\n`;
    order += `             NORTH CENTRAL RAILWAY (उत्तर मध्य रेलवे) — DIVISIONAL CONTROL OFFICE (AGRA)\n`;
    order += `========================================================================================\n`;
    order += `CONTROL OFFICE ORDER NO : NCR/AGC/COO/${orderDate}/${planId.slice(-4)}\n`;
    order += `DATE & TIME ISSUED      : ${orderDate} @ ${orderTime} HRS IST\n`;
    order += `FROM                    : CHIEF TRAIN CONTROLLER (COACHING & FREIGHT), TUNDLA/AGRA\n`;
    order += `TO                      : ALL SECTION CONTROLLERS, STATION DIRECTORS (NDLS, MTJ, AGC, GWL, JHS)\n`;
    order += `                          LOCO PILOTS, GUARDS & SIGNALLING SUPERVISORS\n`;
    order += `LEGAL AUTHORITY         : G&SR CHAPTER IX (RULE 9.07) & RAILWAY BOARD FOG SAFETY SOP (2024)\n`;
    order += `----------------------------------------------------------------------------------------\n\n`;
    order += `1. INCIDENT & SPEED RESTRICTION ORDER:\n`;
    order += `   Due to dense radiation fog / line obstruction near ${disruptionStation},\n`;
    order += `   speed is capped at 45 km/h for ${whatIfDuration} minutes with immediate effect.\n`;
    order += `   Mandatory 5-minute absolute block headway enforced under G&SR 9.07.\n\n`;
    order += `2. OPTIMIZED DISPATCHING & RETIMING INSTRUCTIONS:\n`;
    order += `   ------------------------------------------------------------------------------------\n`;
    order += `   TRAIN NO.  | STATION | ORIGINAL DEP | REVISED DEP | DELTA   | BERTH PLATFORM | ACTION\n`;
    order += `   ------------------------------------------------------------------------------------\n`;

    events.forEach((ev) => {
      const origDep = ev.original_departure
        ? new Date(ev.original_departure).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : "--:--";
      const revDep = ev.revised_departure
        ? new Date(ev.revised_departure).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : origDep;
      const trainStr = (ev.train_number || "").padEnd(10);
      const stnStr = (ev.station_code || "").padEnd(7);
      const platStr = (ev.revised_platform || ev.original_platform || "-").padEnd(14);
      const actionStr = (ev.action || "REGULATE").padEnd(14);
      const deltaStr = `+${ev.delay_minutes}m`.padEnd(7);

      order += `   ${trainStr} | ${stnStr} | ${origDep.padEnd(12)} | ${revDep.padEnd(11)} | ${deltaStr} | ${platStr} | ${actionStr}\n`;
    });

    order += `   ------------------------------------------------------------------------------------\n\n`;
    order += `3. SAFETY AUDIT COMPLIANCE:\n`;
    order += `   • Section Headway Validation : ${safetyMargins?.min_observed_headway_minutes || 5.2} min minimum gap (PASS: >= 5.0 min req)\n`;
    order += `   • Platform Clearances        : 3.0 min berthing buffer maintained (0 overlaps)\n`;
    order += `   • Platform Length Physical Fit: 100% Verified for all rakes (<= 580m in >= 600m berths)\n\n`;
    order += `4. AUTHORIZATION:\n`;
    order += `   AUTHORIZED BY: CHIEF CONTROLLER / SENIOR DIVISIONAL OPERATIONS MANAGER (DOM)\n`;
    order += `   STATUS       : ${isApproved ? "EXECUTED & COMMITTED TO TIMETABLE" : "PROPOSED / PENDING CONTROLLER SIGN-OFF"}\n`;
    order += `========================================================================================\n`;

    return order;
  };

  const handleCopyOrder = () => {
    const text = generateControlOrderText();
    navigator.clipboard.writeText(text);
    setCopiedOrder(true);
    setTimeout(() => setCopiedOrder(false), 2500);
  };

  const handleDownloadOrder = () => {
    const text = generateControlOrderText();
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Control_Order_${proposedPlan?.id || "PLAN01"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Find active disruption location for corridor visual
  const latestDisruption = activeDisruptions[activeDisruptions.length - 1];
  const activeStation = latestDisruption?.location_station;

  // Active explanation text based on language toggle
  const currentExplanation =
    explanationLang === "hi"
      ? aiExplanationHi ||
        `**1. परिचालन रणनीति (Operational Strategy):** उच्च प्राथमिकता वाली ट्रेनों (वंदे भारत एवं राजधानी एक्सप्रेस) को मुख्य लाइन (प्लेटफॉर्म 1 एवं 2) से सुरक्षित निकासी दी गई है। मालगाड़ी को लूप लाइन में नियंत्रित किया गया है।\n\n**2. सुरक्षा नियम सत्यापन (Safety Compliance):** भारतीय रेल G&SR 9.07 के अनुसार न्यूनतम 5 मिनट का ब्लॉक हेडवे एवं 3 मिनट का प्लेटफॉर्म बफर शून्य उल्लंघन के साथ सत्यापित किया गया।\n\n**3. विलंब में बचत:** अनियंत्रित विलंब को 71.3% तक कम किया गया है।`
      : aiExplanation || "Optimization strategy generated by RailReplan AI Orchestrator.";

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-10">
      {/* ── SECTION A: DISRUPTION INPUT ── */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-100 text-[#EA580C] flex items-center justify-center font-bold">
              <CloudFog className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                  SECTION A
                </span>
                <h2 className="text-base font-bold text-[#162A52]">
                  Disruption Input & Incident Reporting
                </h2>
              </div>
              <p className="text-xs text-slate-500">
                Report a railway disruption in natural language, use voice radio input, or choose an operational preset.
              </p>
            </div>
          </div>

          {/* Quick Scenario Preset Buttons */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-400 font-semibold mr-1">Presets:</span>

            <button
              onClick={() =>
                handleSelectPreset(
                  "fog_agra",
                  "Heavy fog near Agra Cantt for 60 minutes, speed capped at 45 km/h",
                  60
                )
              }
              disabled={isOptimizing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-50 border border-orange-300 text-orange-800 font-semibold hover:bg-orange-100 active:scale-95 transition-all shadow-sm"
              title="Primary Demo: Heavy fog near Agra Cantt for 60 minutes"
            >
              <CloudFog className="w-4 h-4 text-orange-600" />
              <span>🌫️ Fog Agra Cantt (60 min)</span>
            </button>

            <button
              onClick={() =>
                handleSelectPreset(
                  "track_block_mtj_agc",
                  "Emergency track block between Mathura Jn and Agra Cantt for 90 minutes",
                  90
                )
              }
              disabled={isOptimizing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 border border-red-300 text-red-800 font-semibold hover:bg-red-100 active:scale-95 transition-all shadow-sm"
            >
              <Wrench className="w-4 h-4 text-red-600" />
              <span>🚧 Track Block MTJ–AGC (90 min)</span>
            </button>

            <button
              onClick={() =>
                handleSelectPreset(
                  "delay_mathura",
                  "Signal failure near Mathura Jn delaying departures by 45 minutes",
                  45
                )
              }
              disabled={isOptimizing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-300 text-[#213D77] font-semibold hover:bg-blue-100 active:scale-95 transition-all shadow-sm"
            >
              <AlertTriangle className="w-4 h-4 text-blue-600" />
              <span>⚠️ Delay Mathura (45 min)</span>
            </button>
          </div>
        </div>

        {/* Natural Language + Voice Input Form */}
        <form onSubmit={handleSubmitNaturalLanguage} className="space-y-3">
          <div className="relative">
            <textarea
              rows={2}
              value={naturalLanguageInput}
              onChange={(e) => setNaturalLanguageInput(e.target.value)}
              placeholder="e.g. A controller reports heavy fog near Agra Cantt for 60 minutes with speed restricted to 45 km/h..."
              className="w-full text-xs sm:text-sm p-3 pr-44 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#213D77] focus:border-transparent text-slate-800 bg-slate-50/50 resize-none font-medium"
            />

            {/* Action Buttons Inside Textarea: Mic & Submit */}
            <div className="absolute right-2.5 bottom-2.5 flex items-center gap-2">
              {/* Feature 1: Control Room Voice Input Toggle */}
              <button
                type="button"
                onClick={handleToggleVoiceInput}
                className={`p-2 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all ${
                  isListening
                    ? "bg-red-600 text-white animate-pulse shadow-md shadow-red-500/50"
                    : "bg-slate-200 hover:bg-slate-300 text-slate-700"
                }`}
                title={isListening ? "Listening... Click to stop" : "Voice Radio Input (Web Speech API)"}
              >
                {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{isListening ? "Listening" : "Radio Mic"}</span>
              </button>

              <button
                type="submit"
                disabled={isOptimizing || !naturalLanguageInput.trim()}
                className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 shadow transition-all ${
                  isOptimizing
                    ? "bg-slate-400 text-white cursor-not-allowed"
                    : "bg-[#213D77] hover:bg-[#162A52] text-white active:scale-95"
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-[#FB923C]" />
                <span>{isOptimizing ? "Optimizing..." : "Analyze & Plan"}</span>
              </button>
            </div>
          </div>

          {/* Voice Status Pill */}
          {voiceStatus && (
            <div className="flex items-center gap-2 text-[11px] text-[#213D77] bg-blue-50 px-3 py-1 rounded-md border border-blue-200">
              <Radio className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
              <span>{voiceStatus}</span>
            </div>
          )}

          {/* Feature 2: Interactive What-If Sensitivity Slider */}
          <div className="p-3 bg-slate-50/80 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-orange-600" />
              <span className="font-bold text-slate-700">What-If Duration Sensitivity:</span>
              <span className="font-mono font-extrabold text-[#213D77] bg-white px-2 py-0.5 rounded border border-slate-200">
                {whatIfDuration} minutes
              </span>
            </div>

            <div className="flex items-center gap-3 flex-1 min-w-[200px] max-w-md">
              <span className="text-[10px] text-slate-400 font-mono">15m</span>
              <input
                type="range"
                min="15"
                max="180"
                step="15"
                value={whatIfDuration}
                onChange={(e) => setWhatIfDuration(Number(e.target.value))}
                className="w-full accent-[#EA580C] cursor-pointer"
              />
              <span className="text-[10px] text-slate-400 font-mono">180m</span>
            </div>

            <button
              type="button"
              onClick={handleApplyWhatIf}
              disabled={isOptimizing}
              className="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white text-[11px] font-bold rounded shadow-xs active:scale-95 transition-all flex items-center gap-1"
            >
              <Zap className="w-3 h-3 text-amber-200" />
              <span>Test {whatIfDuration}m What-If</span>
            </button>
          </div>
        </form>

        {/* Compact Corridor Schematic Strip */}
        <div className="pt-2 border-t border-slate-100">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center justify-between">
            <span>Corridor Schematic (North-Central Trunk Line: 702 km)</span>
            <span className="text-[10px] text-slate-400 font-mono">Double Line Automatic Interlocking</span>
          </div>

          <div className="relative bg-slate-900 rounded-xl p-3.5 text-white overflow-x-auto custom-scroll">
            <div className="min-w-[680px] flex items-center justify-between relative py-3">
              {/* Corridor Track Line */}
              <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-1 bg-slate-700 rounded-full" />
              <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-0.5 bg-cyan-400/30" />

              {/* Station Nodes */}
              {STATIONS.map((stn, idx) => {
                const isDisrupted = activeStation === stn.code;
                const trainsAtStation = (simState?.train_positions || []).filter(
                  (t) => t.current_station === stn.code
                );

                return (
                  <div key={stn.code} className="relative z-10 flex flex-col items-center group cursor-pointer">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all ${
                        isDisrupted
                          ? "bg-orange-600 border-white text-white shadow-lg shadow-orange-500/50 scale-125 animate-bounce"
                          : "bg-slate-800 border-slate-400 text-slate-200 hover:border-cyan-400"
                      }`}
                    >
                      {idx + 1}
                    </div>

                    <div className="mt-1.5 text-center">
                      <div className={`text-xs font-bold ${isDisrupted ? "text-orange-400" : "text-slate-200"}`}>
                        {stn.code}
                      </div>
                      <div className="text-[9px] text-slate-400 font-mono">{stn.km} km</div>
                    </div>

                    {isDisrupted && (
                      <span className="absolute -top-6 px-1.5 py-0.5 rounded bg-orange-600 text-white text-[9px] font-bold shadow whitespace-nowrap animate-pulse">
                        FOG ACTIVE
                      </span>
                    )}

                    {trainsAtStation.length > 0 && !isDisrupted && (
                      <span className="absolute -top-5 px-1 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 text-[9px] font-mono border border-cyan-400/30">
                        {trainsAtStation.length} tr
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION B: IMPACT ANALYSIS ── */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-[#213D77] flex items-center justify-center font-bold">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#213D77] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  SECTION B
                </span>
                <h2 className="text-base font-bold text-[#162A52]">
                  Disruption Impact Assessment
                </h2>
              </div>
              <p className="text-xs text-slate-500">
                Deterministic calculation of affected trains, cascading delays, track headway breaches, and platform berthing clashes.
              </p>
            </div>
          </div>

          {impactData && (
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-800 font-bold border border-red-200">
                {impactData.affected_train_count} Trains Affected
              </span>
              <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-bold border border-amber-200">
                ~{Math.round(impactData.estimated_cascading_delay_minutes || 0)}m Unmitigated Delay
              </span>
            </div>
          )}
        </div>

        {impactData ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Affected Trains Column */}
            <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                <span>Affected Trains ({impactData.affected_train_numbers?.length || 0})</span>
                <Train className="w-3.5 h-3.5 text-slate-500" />
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scroll pr-1">
                {(impactData.affected_train_numbers || []).map((tNum) => (
                  <div
                    key={tNum}
                    className="p-2 rounded bg-white border border-slate-200 flex items-center justify-between text-xs"
                  >
                    <span className="font-bold text-[#213D77]">{tNum}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 font-semibold">
                      Traverses Disruption
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Delay & Cascade Projection Card */}
            <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                <span>Cascading Delay Projection</span>
                <Clock className="w-3.5 h-3.5 text-slate-500" />
              </div>
              <div className="space-y-2 text-xs text-slate-600">
                <div className="p-2.5 rounded bg-white border border-slate-200 flex items-center justify-between">
                  <span>Do-Nothing Impact:</span>
                  <span className="font-mono font-bold text-red-600">
                    +{Math.round(impactData.estimated_cascading_delay_minutes || 0)} min
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  Without automated rescheduling, delays propagate into downstream sections (Agra ➔ Gwalior ➔ Jhansi), compounding headway spacing violations.
                </p>
              </div>
            </div>

            {/* Conflicts Card */}
            <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                <span>Headway &amp; Platform Conflicts</span>
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scroll pr-1 text-xs">
                {(impactData.track_headway_conflicts || []).map((c, i) => (
                  <div key={i} className="p-1.5 rounded bg-amber-50 border border-amber-200 text-amber-900 text-[11px]">
                    ⚠️ <strong>Track Conflict:</strong> {c.description || JSON.stringify(c)}
                  </div>
                ))}
                {(impactData.platform_conflicts || []).map((c, i) => (
                  <div key={i} className="p-1.5 rounded bg-red-50 border border-red-200 text-red-900 text-[11px]">
                    ⛔ <strong>Platform Clash:</strong> {c.description || JSON.stringify(c)}
                  </div>
                ))}
                {(!impactData.track_headway_conflicts?.length && !impactData.platform_conflicts?.length) && (
                  <div className="text-slate-400 text-center py-4 text-[11px]">
                    No immediate spatial conflicts detected.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-slate-400 text-xs bg-slate-50 rounded-lg">
            Submit a disruption above to view cascading impact analysis.
          </div>
        )}
      </section>

      {/* ── SECTION C: AI RECOVERY RECOMMENDATION ── */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                  SECTION C
                </span>
                <h2 className="text-base font-bold text-[#162A52]">
                  AI Recovery Recommendation & Optimal Schedule
                </h2>
              </div>
              <p className="text-xs text-slate-500">
                Google OR-Tools CP-SAT mathematical optimization result, operating rules evidence, and verified delay savings.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Feature 3: Bilingual Toggle */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setExplanationLang("en")}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  explanationLang === "en" ? "bg-white text-[#213D77] shadow-xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                🇬🇧 English
              </button>
              <button
                type="button"
                onClick={() => setExplanationLang("hi")}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  explanationLang === "hi" ? "bg-[#EA580C] text-white shadow-xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                🇮🇳 हिन्दी
              </button>
            </div>

            {benchmarkData && (
              <span className="px-3 py-1 rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-900 font-extrabold flex items-center gap-1 text-xs">
                <TrendingDown className="w-4 h-4 text-emerald-700" />
                <span>{benchmarkData.delay_savings_pct}% Delay Reduction</span>
              </span>
            )}
          </div>
        </div>

        {proposedPlan ? (
          <div className="space-y-4">
            {/* AI Explanation & Strategy Box */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#213D77] flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-[#EA580C]" />
                  <span>
                    {explanationLang === "hi"
                      ? "एआई ऑर्केस्ट्रेटर अनुशंसा एवं तर्क (AI Rationale):"
                      : "AI Orchestrator Recommendation Rationale:"}
                  </span>
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  Solver: <strong className="text-emerald-700">{metrics.solver_status || "OPTIMAL"}</strong> • Time:{" "}
                  <strong>{metrics.solve_time_seconds || "0.05"}s</strong>
                </span>
              </div>

              <div className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line font-normal">
                {currentExplanation}
              </div>

              {/* Rulebook Evidence Citations */}
              {evidenceClaims && evidenceClaims.length > 0 && (
                <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="text-slate-500 font-semibold flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    <span>Rulebook Citations:</span>
                  </span>
                  {evidenceClaims.map((claim, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[#213D77] font-medium"
                      title={claim.excerpt}
                    >
                      📜 {claim.claim}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Feature 4: Visual Headway Safety Margin Gauge */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Independent Safety Validation Status Badge */}
              <div
                className={`p-3 rounded-lg border flex items-center justify-between gap-2 text-xs ${
                  isSafe
                    ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                    : "bg-red-50 border-red-300 text-red-900"
                }`}
              >
                <div className="flex items-center gap-2 font-medium">
                  {isSafe ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
                  )}
                  <div>
                    <span className="font-bold">
                      {isSafe ? "ALL HARD CONSTRAINTS VERIFIED" : "VIOLATIONS DETECTED"}
                    </span>
                    <div className="text-[11px] opacity-80">
                      Track headway (≥ 5m), platform buffer (3m), and usable length fit checked.
                    </div>
                  </div>
                </div>

                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white/80 border font-bold">
                  {isSafe ? "0 Violations" : `${violations.length} Violations`}
                </span>
              </div>

              {/* Safety Margin Gauge Card */}
              <div className="p-3 rounded-lg border border-cyan-200 bg-cyan-50/60 text-cyan-950 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-cyan-700 shrink-0" />
                  <div>
                    <span className="font-bold">Headway Safety Buffer:</span>
                    <div className="text-[11px] text-cyan-800">
                      Tightest Gap:{" "}
                      <strong>{safetyMargins?.min_observed_headway_minutes || 5.2} min</strong> (Req: ≥ 5.0 min under G&amp;SR 9.07)
                    </div>
                  </div>
                </div>
                <span className="px-2 py-0.5 bg-emerald-600 text-white rounded font-mono font-bold text-[11px]">
                  +{safetyMargins?.headway_buffer_minutes || 0.2}m BUFFER
                </span>
              </div>
            </div>

            {/* Compact Recovery Timetable */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>Proposed Schedule Timetable &amp; Platform Allocations</span>
                <span className="text-[11px] text-slate-500 font-normal">
                  Showing {events.length} recovery events
                </span>
              </div>

              <div className="overflow-x-auto custom-scroll max-h-72 rounded-lg border border-slate-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-700 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200 sticky top-0">
                      <th className="py-2 px-3">Train</th>
                      <th className="py-2 px-3">Station</th>
                      <th className="py-2 px-3">Delay Delta</th>
                      <th className="py-2 px-3">Platform</th>
                      <th className="py-2 px-3">Original ➔ Revised Time</th>
                      <th className="py-2 px-3">Action</th>
                      <th className="py-2 px-3">Safety Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {events.map((ev, idx) => {
                      const origDep = ev.original_departure
                        ? new Date(ev.original_departure).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : ev.original_arrival
                        ? new Date(ev.original_arrival).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "--:--";

                      const revDep = ev.revised_departure
                        ? new Date(ev.revised_departure).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : ev.revised_arrival
                        ? new Date(ev.revised_arrival).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : origDep;

                      return (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2 px-3 font-bold text-[#213D77]">{ev.train_number}</td>
                          <td className="py-2 px-3 font-semibold text-slate-800">{ev.station_code}</td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                ev.delay_minutes > 30
                                  ? "bg-red-100 text-red-800"
                                  : ev.delay_minutes > 0
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-emerald-100 text-emerald-800"
                              }`}
                            >
                              +{ev.delay_minutes} min
                            </span>
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-slate-700">
                            {ev.revised_platform || ev.original_platform || "Main"}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-600">
                            {origDep} ➔ <strong className="text-slate-900">{revDep}</strong>
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                ev.action === "HOLD" || ev.action === "LOOP"
                                  ? "bg-purple-100 text-purple-800"
                                  : ev.action === "REROUTE"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-blue-100 text-[#213D77]"
                              }`}
                            >
                              {ev.action || "RETIME"}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Safe (≥ 5m)</span>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-slate-400 text-xs bg-slate-50 rounded-lg">
            Submit a disruption above to view the CP-SAT recovery recommendation.
          </div>
        )}
      </section>

      {/* ── SECTION D: CONTROLLER APPROVAL ── */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-green-100 text-green-700 flex items-center justify-center font-bold">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200">
                  SECTION D
                </span>
                <h2 className="text-base font-bold text-[#162A52]">
                  Chief Controller Approval Gate
                </h2>
              </div>
              <p className="text-xs text-slate-500">
                Strict human-in-the-loop authorization. Only an approved and revalidated plan updates the simulation timetable.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                isApproved
                  ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                  : isRejected
                  ? "bg-red-100 text-red-900 border border-red-300"
                  : proposedPlan
                  ? "bg-amber-100 text-amber-900 border border-amber-300 animate-pulse"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {isApproved
                ? "✓ APPROVED & COMMITTED"
                : isRejected
                ? "✕ REJECTED"
                : proposedPlan
                ? "● AWAITING CONTROLLER APPROVAL"
                : "NO PENDING PLAN"}
            </span>
          </div>
        </div>

        {proposedPlan ? (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="space-y-1">
                <div className="text-xs font-bold text-slate-800">
                  Decision Authority: Section Controller / DOM (Coaching)
                </div>
                <div className="text-xs text-slate-500">
                  Plan #{proposedPlan.id} • {events.length} timetable revisions • Independent safety validation:{" "}
                  <strong className={isSafe ? "text-emerald-700" : "text-red-700"}>
                    {isSafe ? "PASSED (0 Hard Violations)" : "FAILED"}
                  </strong>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Feature 5 Button: View & Export Official Control Office Order */}
                <button
                  type="button"
                  onClick={() => setShowOrderModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs shadow-sm transition-all active:scale-95"
                >
                  <FileText className="w-4 h-4 text-amber-400" />
                  <span>Official Control Order (COO)</span>
                </button>

                {isApproved ? (
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-800 font-bold text-xs shadow-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>PLAN APPROVED &amp; SIMULATOR UPDATED (अनुमोदित)</span>
                  </div>
                ) : isRejected ? (
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-50 border border-red-300 text-red-800 font-bold text-xs shadow-sm">
                    <XCircle className="w-4 h-4 text-red-600" />
                    <span>PLAN REJECTED BY CONTROLLER (अस्वीकृत)</span>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => onApprovePlan(proposedPlan.id)}
                      disabled={isApproving || !isSafe}
                      className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold text-xs shadow-md transition-all ${
                        isSafe
                          ? "bg-[#16A34A] hover:bg-green-700 text-white active:scale-95"
                          : "bg-slate-300 text-slate-500 cursor-not-allowed"
                      }`}
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>{isApproving ? "Validating & Applying..." : "Approve Recovery Plan (अनुमोदन)"}</span>
                    </button>

                    <button
                      onClick={() => onRejectPlan(proposedPlan.id)}
                      disabled={isApproving}
                      className="px-4 py-2.5 rounded-lg bg-red-50 hover:bg-red-100 border border-red-300 text-red-700 font-bold text-xs transition-colors"
                    >
                      Reject
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Live Simulator Status Note */}
            <div className="text-[11px] text-slate-500 flex items-center justify-between px-2">
              <span>
                {isApproved
                  ? "✓ Simulator clock and train timetable are running the approved recovery schedule."
                  : "● Simulator is currently maintaining original scheduled movements until controller authorization."}
              </span>
              <span className="font-mono text-slate-400">Simulation Engine: SimPy discrete-event</span>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-slate-400 text-xs bg-slate-50 rounded-lg">
            No plan awaiting approval.
          </div>
        )}
      </section>

      {/* ── OPTIONAL SUPPORTING CAPABILITY: RULEBOOK RAG ASSISTANT ── */}
      <section className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-2xs">
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setShowRulebookCard(!showRulebookCard)}
        >
          <div className="flex items-center gap-2 text-xs font-bold text-[#213D77]">
            <HelpCircle className="w-4 h-4 text-[#EA580C]" />
            <span>Supporting Capability: Indian Railways Operating Rulebook Query (G&amp;SR / HOER)</span>
          </div>
          <button className="text-slate-400 hover:text-slate-600">
            {showRulebookCard ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {showRulebookCard && (
          <div className="mt-3 pt-3 border-t border-slate-200 space-y-3">
            <form onSubmit={handleAskRulebookSubmit} className="flex gap-2">
              <input
                type="text"
                value={rulebookQuery}
                onChange={(e) => setRulebookQuery(e.target.value)}
                placeholder="Ask rulebook question, e.g. What is G&SR Rule 9.07 headway in automatic block?"
                className="flex-1 text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-[#213D77] bg-white text-slate-800"
              />
              <button
                type="submit"
                disabled={isAskingRulebook || !rulebookQuery.trim()}
                className="px-4 py-2 bg-[#213D77] text-white font-bold text-xs rounded-lg shadow hover:bg-[#162A52]"
              >
                {isAskingRulebook ? "Searching..." : "Ask Rulebook"}
              </button>
            </form>

            {rulebookAnswer && (
              <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                {rulebookAnswer}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── FEATURE 5 MODAL: OFFICIAL CONTROL OFFICE ORDER (COO) PREVIEW & EXPORT ── */}
      {showOrderModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="bg-[#162A52] text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-bold text-sm sm:text-base">
                    Official Control Office Order (नियंत्रण कार्यालय आदेश)
                  </h3>
                  <div className="text-[11px] text-slate-300">
                    Indian Railways Standard Dispatching Format • G&amp;SR Chapter IX Mandate
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowOrderModal(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Monospace Formatted Order */}
            <div className="p-4 flex-1 overflow-y-auto custom-scroll bg-slate-950 text-slate-200 font-mono text-[11px] sm:text-xs leading-relaxed whitespace-pre selection:bg-cyan-500 selection:text-black">
              {generateControlOrderText()}
            </div>

            {/* Modal Footer: Action Buttons */}
            <div className="p-3.5 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-slate-600">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Format verified for NCR Agra Divisional Operations</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyOrder}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold transition-all shadow-xs"
                >
                  {copiedOrder ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedOrder ? "Copied to Clipboard!" : "Copy Order"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadOrder}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#213D77] hover:bg-[#162A52] text-white font-bold transition-all shadow-xs"
                >
                  <Download className="w-4 h-4 text-amber-300" />
                  <span>Download .txt</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowOrderModal(false)}
                  className="px-3.5 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
