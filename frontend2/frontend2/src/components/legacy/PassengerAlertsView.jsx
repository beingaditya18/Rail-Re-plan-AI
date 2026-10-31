import React, { useState, useEffect } from "react";
import {
  Bell,
  Smartphone,
  CheckCircle2,
  Copy,
  Check,
  Send,
  Train,
} from "lucide-react";
import { getAlerts } from "../api";

export default function PassengerAlertsView() {
  const [alerts, setAlerts] = useState([]);
  const [selectedLang, setSelectedLang] = useState("all");
  const [selectedChannel, setSelectedChannel] = useState("all");
  const [activeAlert, setActiveAlert] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getAlerts()
      .then((data) => {
        setAlerts(data);
        if (data.length > 0) setActiveAlert(data[0]);
      })
      .catch((err) => console.warn("Failed to load alerts:", err));
  }, []);

  const filtered = alerts.filter((a) => {
    if (selectedLang !== "all" && a.language !== selectedLang) return false;
    if (selectedChannel !== "all" && a.channel !== selectedChannel) return false;
    return true;
  });

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-[#213D77]" />
            <h2 className="font-bold text-base text-[#162A52]">
              IRCTC Bilingual Passenger Communications (यात्री सूचना केंद्र)
            </h2>
          </div>
          <p className="text-slate-500 text-xs mt-0.5">
            Bilingual English & Hindi alerts grounded on approved recovery plan • Simulated sandbox dispatch (no live SMS charges)
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Language selector */}
          <div className="flex bg-slate-100 border border-slate-300 rounded-lg p-0.5 font-medium">
            <button
              onClick={() => setSelectedLang("all")}
              className={`px-3 py-1 rounded-md transition-all ${
                selectedLang === "all" ? "bg-[#213D77] text-white font-bold shadow-sm" : "text-slate-600"
              }`}
            >
              All Languages
            </button>
            <button
              onClick={() => setSelectedLang("en")}
              className={`px-3 py-1 rounded-md transition-all ${
                selectedLang === "en" ? "bg-[#213D77] text-white font-bold shadow-sm" : "text-slate-600"
              }`}
            >
              English
            </button>
            <button
              onClick={() => setSelectedLang("hi")}
              className={`px-3 py-1 rounded-md transition-all ${
                selectedLang === "hi" ? "bg-[#213D77] text-white font-bold shadow-sm" : "text-slate-600"
              }`}
            >
              हिंदी (Hindi)
            </button>
          </div>

          {/* Channel selector */}
          <select
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(e.target.value)}
            className="bg-slate-50 border border-slate-300 text-slate-700 rounded-lg px-3 py-1.5 focus:outline-none font-medium"
          >
            <option value="all">All Channels (सभी माध्यम)</option>
            <option value="sms">SMS</option>
            <option value="app_push">IRCTC App Push</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="pa_system">Station PA</option>
            <option value="display_board">Platform Display</option>
          </select>
        </div>
      </div>

      {/* Grid: Alert List (Left) + Smartphone Preview (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Alerts Feed Table (8 cols) */}
        <div className="lg:col-span-8 bg-slate-50 rounded-xl border border-slate-200 p-3 overflow-hidden flex flex-col">
          <div className="overflow-x-auto custom-scroll max-h-[480px]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-[11px] font-bold uppercase sticky top-0 bg-slate-50">
                  <th className="py-2.5 px-3">Train</th>
                  <th className="py-2.5 px-3">Station</th>
                  <th className="py-2.5 px-3">Lang</th>
                  <th className="py-2.5 px-3">Channel</th>
                  <th className="py-2.5 px-3">Alert Content</th>
                  <th className="py-2.5 px-3 text-right">Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-slate-500 font-medium">
                      No passenger alerts generated yet. Approve a recovery plan above to trigger verified passenger SMS notifications.
                    </td>
                  </tr>
                ) : (
                  filtered.slice(0, 40).map((alert) => (
                    <tr
                      key={alert.id}
                      onClick={() => setActiveAlert(alert)}
                      className={`cursor-pointer transition-colors ${
                        activeAlert?.id === alert.id
                          ? "bg-blue-100/70 border-l-4 border-l-[#213D77]"
                          : "hover:bg-slate-100/80"
                      }`}
                    >
                      <td className="py-2.5 px-3 font-bold text-[#213D77]">
                        {alert.train_number}
                      </td>
                      <td className="py-2.5 px-3 text-slate-800 font-semibold">
                        {alert.station_code || "EN-ROUTE"}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            alert.language === "hi"
                              ? "bg-orange-100 text-orange-900 border border-orange-200"
                              : "bg-blue-100 text-[#213D77] border border-blue-200"
                          }`}
                        >
                          {alert.language === "hi" ? "HINDI" : "ENGLISH"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 uppercase text-[10px] font-semibold">
                        {alert.channel}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 truncate max-w-xs text-xs">
                        {alert.body}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            GROUNDED
                          </span>
                          <span className="text-[9px] text-slate-500 font-mono">
                            SIMULATED PUSH
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Smartphone Mockup Preview (4 cols) */}
        <div className="lg:col-span-4 flex flex-col items-center justify-center">
          <div className="w-[300px] bg-slate-800 border-4 border-slate-700 rounded-[38px] p-3 shadow-2xl relative">
            {/* Notch */}
            <div className="w-24 h-4 bg-slate-900 rounded-full mx-auto mb-3" />

            {/* Screen */}
            <div className="bg-slate-50 rounded-[26px] p-3.5 min-h-[400px] flex flex-col justify-between text-xs space-y-3 border border-slate-200">
              {/* Phone Header */}
              <div className="flex justify-between items-center text-[10px] text-slate-500 pb-2 border-b border-slate-200">
                <span className="font-bold text-[#213D77]">IRCTC RailConnect</span>
                <span className="font-mono">14:45</span>
              </div>

              {/* Notification Card */}
              {activeAlert ? (
                <div className="bg-white border-2 border-blue-200 rounded-xl p-3.5 shadow-md space-y-2.5">
                  <div className="flex items-center gap-2 text-[#213D77] text-xs font-bold pb-1 border-b border-slate-100">
                    <Smartphone className="w-4 h-4 text-[#EA580C]" />
                    <span>INDIAN RAILWAYS ALERT</span>
                  </div>

                  <p className="text-slate-800 text-xs leading-relaxed font-medium">
                    {activeAlert.body}
                  </p>

                  <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-500">
                    <span className="uppercase font-semibold">Channel: {activeAlert.channel}</span>
                    <button
                      onClick={() => handleCopy(activeAlert.body)}
                      className="text-[#213D77] hover:text-blue-800 flex items-center gap-1 font-bold"
                    >
                      {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copied ? "Copied" : "Copy Text"}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center text-slate-400 py-20 text-xs">
                  Select an alert on the left to preview passenger notification.
                </div>
              )}

              {/* Helpline Footer */}
              <div className="bg-blue-50 p-2.5 rounded-lg border border-blue-200 text-[10px] text-blue-900 text-center font-bold">
                RailMadad Helpline: 139 (Toll Free)
              </div>
            </div>

            {/* Home indicator bar */}
            <div className="w-20 h-1 bg-slate-600 rounded-full mx-auto mt-3" />
          </div>
        </div>
      </div>
    </div>
  );
}
