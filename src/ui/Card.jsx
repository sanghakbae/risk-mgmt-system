import React from "react";

export default function Card({ title, desc, right, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      {title || desc || right ? (
        <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
          <div>
            {title ? <div className="text-base font-semibold text-slate-900">{title}</div> : null}
            {desc ? <div className="text-sm text-slate-500 mt-0.5">{desc}</div> : null}
          </div>
          {right ? <div className="shrink-0">{right}</div> : null}
        </div>
      ) : null}
      <div className="p-5">{children}</div>
    </div>
  );
}

export function pillClass(variant) {
  if (variant === "ok") return "bg-emerald-100 text-emerald-900 border-emerald-200";
  if (variant === "warn") return "bg-amber-100 text-amber-900 border-amber-200";
  if (variant === "bad") return "bg-rose-100 text-rose-900 border-rose-200";
  return "bg-slate-100 text-slate-900 border-slate-200";
}

export function Badge({ children, variant = "neutral" }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${pillClass(variant)}`}>{children}</span>
  );
}

export function Field({ label, children, hint }) {
  return (
    <label className="block">
      <div className="text-xs font-semibold text-slate-700">{label}</div>
      <div className="mt-1">{children}</div>
      {hint ? <div className="text-xs text-slate-500 mt-1">{hint}</div> : null}
    </label>
  );
}
