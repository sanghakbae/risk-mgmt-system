import React from "react";

function clampPct(done, total) {
  if (!total || total <= 0) return 0;
  const pct = Math.round((done / total) * 100);
  return Math.max(0, Math.min(100, pct));
}

function progressColor(pct) {
  if (pct >= 100) return "bg-emerald-500";
  if (pct >= 50) return "bg-amber-500";
  return "bg-rose-500";
}

export default function TopProgressBar({ title = "진행 현황", done = 0, total = 0 }) {
  const pct = clampPct(done, total);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2 text-sm">
        <div className="font-semibold text-slate-900">{title}</div>
        <div className="tabular-nums text-slate-700">
          {done}/{total} ({pct}%)
        </div>
      </div>

      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full ${progressColor(pct)}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
