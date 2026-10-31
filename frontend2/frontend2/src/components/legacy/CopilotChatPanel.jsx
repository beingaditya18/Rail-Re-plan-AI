import React, { useState } from "react";
import {
  MessageSquare,
  Send,
  BookOpen,
  Sparkles,
  RotateCw,
  HelpCircle,
} from "lucide-react";
import { copilotChat } from "../api";

export default function CopilotChatPanel() {
  const [messages, setMessages] = useState([
    {
      sender: "copilot",
      text: "Namaste! I am your Indian Railways RailSahayak Copilot. I assist Section Controllers in explaining AI dispatch decisions, citing G&SR safety rulebooks, and evaluating What-If scenarios.",
      evidence: [],
      what_if_data: null,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const quickPrompts = [
    "Why divert 12002 to AGC Platform 3?",
    "What if fog lasts 90 min longer?",
    "Explain crew rest limits under HOER",
    "Cite G&SR rules for automatic block failure",
  ];

  const handleSend = async (queryText) => {
    const query = queryText || input;
    if (!query.trim() || loading) return;

    setMessages((prev) => [...prev, { sender: "user", text: query }]);
    setInput("");
    setLoading(true);

    try {
      const res = await copilotChat(query);
      setMessages((prev) => [
        ...prev,
        {
          sender: "copilot",
          text: res.answer,
          evidence: res.evidence || [],
          what_if_data: res.what_if_data,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          sender: "copilot",
          text: "RailSahayak is currently running in offline rulebook mode. Operating Directive: All movements strictly adhere to 5-minute section headway and HOER 12-hour continuous duty limits.",
          evidence: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col h-full space-y-3.5">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-orange-100 text-[#EA580C] flex items-center justify-center font-bold">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-[#162A52]">
              RailSahayak AI Copilot (रेल सहायक)
            </h3>
            <p className="text-[11px] text-slate-500">
              G&SR Safety Rules, Decision Rationale & What-If Sandbox
            </p>
          </div>
        </div>
        <span className="text-[11px] font-bold text-orange-800 bg-orange-100 px-2.5 py-1 rounded-full border border-orange-200">
          G&SR RAG Active
        </span>
      </div>

      {/* Quick Prompt Pills */}
      <div className="flex flex-wrap gap-1.5">
        {quickPrompts.map((qp, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(qp)}
            disabled={loading}
            className="text-[11px] px-2.5 py-1 bg-slate-100 hover:bg-orange-50 hover:text-orange-900 text-slate-700 rounded-lg border border-slate-200 hover:border-orange-300 transition-all text-left font-medium"
          >
            {qp}
          </button>
        ))}
      </div>

      {/* Chat Messages Log */}
      <div className="flex-1 bg-slate-50 p-3.5 rounded-xl border border-slate-200 overflow-y-auto custom-scroll space-y-3 max-h-[380px] text-xs">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`space-y-1.5 ${
              m.sender === "user" ? "text-right" : "text-left"
            }`}
          >
            <div
              className={`inline-block p-3 rounded-xl max-w-[92%] text-xs leading-relaxed shadow-sm ${
                m.sender === "user"
                  ? "bg-[#213D77] text-white font-medium"
                  : "bg-white border border-slate-200 text-slate-800"
              }`}
            >
              <div className="whitespace-pre-wrap">{m.text}</div>

              {/* What-If Sandbox Projection Box */}
              {m.what_if_data && (
                <div className="mt-2.5 p-2.5 bg-orange-50 rounded-lg border border-orange-200 text-xs space-y-1 text-orange-900">
                  <div className="font-bold text-[#EA580C] uppercase flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    What-If Projection (+{m.what_if_data.hypothetical_extension_min} min incident duration)
                  </div>
                  <div>
                    Projected Delay Increase: ~
                    <span className="font-bold text-slate-900">
                      +{m.what_if_data.delay_increase_min} mins
                    </span>{" "}
                    (Total Sector Delay: {m.what_if_data.projected_total_delay_min} mins)
                  </div>
                  <div className="text-slate-700 font-medium">
                    Recommended Action: {m.what_if_data.recommended_action}
                  </div>
                </div>
              )}

              {/* Rulebook Citations */}
              {m.evidence && m.evidence.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-slate-100 text-[11px] space-y-1.5 text-slate-600">
                  <div className="font-bold text-[#213D77] flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                    Cited Railway Rulebooks:
                  </div>
                  {m.evidence.map((ev, eIdx) => (
                    <div
                      key={eIdx}
                      className="bg-slate-50 p-2 rounded border border-slate-200 text-[10px]"
                    >
                      <div className="text-slate-900 font-bold">
                        {ev.source_title} ({ev.source_type?.toUpperCase()})
                      </div>
                      <div className="text-slate-600 line-clamp-2 mt-0.5">{ev.excerpt}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="text-left">
            <div className="inline-flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-slate-200 text-[#213D77] text-xs font-semibold shadow-sm">
              <RotateCw className="w-3.5 h-3.5 animate-spin text-orange-600" />
              <span>Consulting G&SR rulebooks and live sector status...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input Field */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask RailSahayak about safety rules, decision reasons, or what-if scenarios..."
          className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#213D77] focus:bg-white"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="px-4 py-2 bg-[#213D77] hover:bg-[#162A52] disabled:opacity-40 text-white font-bold rounded-lg shadow transition-all"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
