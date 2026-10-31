import React, { useState, useEffect } from "react";
import { ShieldAlert, Users, Clock, AlertTriangle } from "lucide-react";
import { getCrewStatus } from "../api";

export default function CrewRosterView() {
  const [crewData, setCrewData] = useState({ crew: [], reassignments: [], spare_count: 0 });

  useEffect(() => {
    getCrewStatus()
      .then((data) => setCrewData(data))
      .catch((err) => console.warn("Failed to load crew status:", err));
  }, []);

  const { crew, reassignments, spare_count } = crewData;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-[#213D77]" />
            <h2 className="font-bold text-base text-[#162A52]">
              Running Staff & Crew Duty Clock Monitor (HOER 1989)
            </h2>
          </div>
          <p className="text-slate-500 text-xs mt-0.5">
            Loco Pilots (LP), Assistant Loco Pilots (ALP), and Train Managers (Guards) • 10h normal duty limit, 12h emergency ceiling
          </p>
        </div>

        <div className="flex items-center gap-2.5 text-xs font-semibold">
          <div className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800">
            Standby Relief Pool: {spare_count} Staff Available
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-[#213D77]">
            Relief Swaps Ordered: {reassignments.length}
          </div>
        </div>
      </div>

      {/* Swaps Directive Card */}
      {reassignments.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 p-3.5 rounded-xl space-y-2">
          <div className="text-amber-900 font-bold text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Active Crew Relief Directives (HOER Duty Ceiling Relief):</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
            {reassignments.map((re, idx) => (
              <div
                key={idx}
                className="bg-white p-3 rounded-lg border border-amber-200 flex items-center justify-between shadow-sm"
              >
                <div>
                  <div className="text-slate-900 font-bold">
                    Train #{re.train_number} — {re.role}
                  </div>
                  <div className="text-slate-600 text-[11px]">
                    Assigned: <span className="text-[#213D77] font-semibold">{re.crew_name}</span> ({re.crew_id})
                  </div>
                </div>
                <div className="text-right text-[11px] text-amber-800 font-bold">
                  Relief at {re.from_station} ➔ {re.to_station}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Crew Table */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 overflow-x-auto custom-scroll max-h-[480px]">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500 text-[11px] font-bold uppercase sticky top-0 bg-slate-50">
              <th className="py-2.5 px-3">Crew ID</th>
              <th className="py-2.5 px-3">Staff Name</th>
              <th className="py-2.5 px-3">Role</th>
              <th className="py-2.5 px-3">Base Station</th>
              <th className="py-2.5 px-3">Footplate Duty Hours</th>
              <th className="py-2.5 px-3">Assigned Train</th>
              <th className="py-2.5 px-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {crew.map((c) => {
              const isOvertime = c.hours_on_duty >= 10;
              const isCritical = c.hours_on_duty >= 11.5;

              return (
                <tr key={c.id} className="hover:bg-white transition-colors">
                  <td className="py-2.5 px-3 font-bold text-[#213D77]">{c.id}</td>
                  <td className="py-2.5 px-3 font-semibold text-slate-900">{c.name}</td>
                  <td className="py-2.5 px-3">
                    <span className="bg-white px-2 py-0.5 rounded border border-slate-200 font-medium text-slate-700">
                      {c.role}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 font-medium">{c.base_station}</td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-bold ${
                          isCritical
                            ? "text-red-700"
                            : isOvertime
                            ? "text-amber-700"
                            : "text-emerald-700"
                        }`}
                      >
                        {c.hours_on_duty.toFixed(1)}h / 12h
                      </span>
                      <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${Math.min(100, (c.hours_on_duty / 12) * 100)}%` }}
                          className={`h-full ${
                            isCritical ? "bg-red-600" : isOvertime ? "bg-amber-500" : "bg-emerald-500"
                          }`}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-slate-800">
                    {c.assigned_train || <span className="text-slate-400 font-normal">Standby</span>}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {c.is_spare ? (
                      <span className="text-[11px] bg-purple-100 text-purple-900 border border-purple-200 px-2 py-0.5 rounded-full font-bold">
                        Standby Pool
                      </span>
                    ) : (
                      <span className="text-[11px] bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-full font-medium">
                        On Duty
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
