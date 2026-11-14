import { useState } from 'react';
import { AlertTriangle, Check, Minus } from 'lucide-react';
import type { BloodGroup } from '../../types/database';
import {
  BLOOD_COMPATIBILITY_MAP,
  BLOOD_GROUPS,
  isRbcCompatible,
} from '../../utils/bloodCompatibility';

export function CompatibilityPage() {
  const [selectedGroup, setSelectedGroup] = useState<BloodGroup>('O+');
  const info = BLOOD_COMPATIBILITY_MAP[selectedGroup];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold text-[#C62828] dark:text-red-400">
          Educational Reference
        </p>
        <h1 className="font-display mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          ABO & Rh Red Blood Cell Compatibility Guide
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          Use this reference to understand standard red blood cell (RBC) ABO and Rh compatibility
          before coordinating voluntary donors.
        </p>
      </div>

      {/* Prominent Medical Disclaimer */}
      <div
        role="note"
        aria-label="Medical disclaimer"
        className="mt-6 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-5 text-amber-950 dark:border-amber-800/80 dark:bg-amber-950/40 dark:text-amber-100"
      >
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
        <div className="text-sm leading-relaxed">
          <p className="font-bold">Mandatory Clinical Disclaimer</p>
          <p className="mt-1">
            This table is strictly educational and does <strong>not</strong> provide medical
            clearance. Actual transfusion compatibility, antibody crossmatching, plasma/platelet
            rules, and donor medical eligibility must always be confirmed by qualified healthcare
            professionals and the hospital blood bank.
          </p>
        </div>
      </div>

      {/* Interactive Blood Group Selector */}
      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">
          Select a Blood Group to Inspect Red Cell Compatibility
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {BLOOD_GROUPS.map((group) => (
            <button
              key={group}
              type="button"
              onClick={() => setSelectedGroup(group)}
              className={`font-display rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
                selectedGroup === group
                  ? 'bg-[#C62828] text-white'
                  : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {group}
            </button>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 border-t border-slate-200 pt-6 md:grid-cols-3 dark:border-slate-800">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Overview</p>
            <p className="font-display mt-1 text-2xl font-extrabold text-[#C62828] dark:text-red-400">
              {info.group}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {info.summary}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Can Receive Red Cells From
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {info.canReceiveRedCellsFrom.map((g) => (
                <span
                  key={g}
                  className="font-mono-tabular rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-sm font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  {g}
                </span>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Can Donate Red Cells To
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {info.canDonateRedCellsTo.map((g) => (
                <span
                  key={g}
                  className="font-mono-tabular rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-sm font-bold text-[#C62828] dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
                >
                  {g}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Full Compatibility Matrix */}
      <div className="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
            Donor-to-Recipient Red Blood Cell Matrix
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Rows indicate Donor blood group · Columns indicate Recipient blood group
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-center text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
                <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">
                  Donor \ Recipient
                </th>
                {BLOOD_GROUPS.map((rec) => (
                  <th
                    key={rec}
                    className="font-mono-tabular px-3 py-3 font-bold text-slate-900 dark:text-white"
                  >
                    {rec}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {BLOOD_GROUPS.map((donor) => (
                <tr key={donor} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <th className="font-mono-tabular px-4 py-3 text-left font-bold text-slate-900 dark:text-white">
                    {donor}
                  </th>
                  {BLOOD_GROUPS.map((recipient) => {
                    const compatible = isRbcCompatible(donor, recipient);
                    return (
                      <td key={recipient} className="px-3 py-3">
                        {compatible ? (
                          <span
                            title={`${donor} donor compatible with ${recipient} recipient (subject to hospital crossmatch)`}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                          >
                            <Check className="h-4 w-4" />
                          </span>
                        ) : (
                          <span
                            title="Incompatible"
                            className="inline-flex h-7 w-7 items-center justify-center text-slate-300 dark:text-slate-700"
                          >
                            <Minus className="h-4 w-4" />
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
