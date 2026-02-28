import React from "react";

export default function Table({ columns, rows, onRowClick }) {
  return (
    <div className="rounded-2xl border border-slate-200 overflow-hidden">
      <div className="grid" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
        {columns.map((c) => (
          <div key={c.key} className="px-4 py-3 text-xs font-semibold bg-slate-50 text-slate-700 text-center">
            {c.header}
          </div>
        ))}
      </div>
      <div className="divide-y">
        {rows.map((r, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onRowClick?.(r)}
            className="w-full text-left grid hover:bg-slate-50 transition"
            style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
          >
            {columns.map((c) => (
              <div key={c.key} className="px-4 py-3 text-sm text-slate-800 text-center">
                {c.render ? c.render(r) : String(r[c.key] ?? "")}
              </div>
            ))}
          </button>
        ))}
        {rows.length === 0 ? <div className="px-4 py-10 text-sm text-slate-500 text-center">데이터가 없습니다.</div> : null}
      </div>
    </div>
  );
}
