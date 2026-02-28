import React from "react";

export default function Button({ children, variant = "primary", onClick, disabled, iconLeft, iconRight, className }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition border";
  const v =
    variant === "primary"
      ? "bg-slate-900 text-white border-slate-900 hover:bg-slate-800"
      : variant === "outline"
        ? "bg-white text-slate-900 border-slate-200 hover:bg-slate-50"
        : variant === "danger"
          ? "bg-rose-600 text-white border-rose-600 hover:bg-rose-500"
          : "bg-slate-100 text-slate-900 border-slate-200";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${v} ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className ?? ""}`}
    >
      {iconLeft ? <span className="-ml-0.5">{iconLeft}</span> : null}
      {children}
      {iconRight ? <span className="-mr-0.5">{iconRight}</span> : null}
    </button>
  );
}
