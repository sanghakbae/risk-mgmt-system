// src/components/DomainVulnRateChart.jsx
import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LabelList,
} from "recharts";

function toText(v) {
  return v == null ? "" : String(v);
}

function buildDomainStats(checklistItems) {
  const map = new Map();

  for (const x of checklistItems || []) {
    const domain = toText(x.domain).trim() || "미지정";
    const r = toText(x.result || x.vulnResult).trim();

    const cur =
      map.get(domain) || { domain, total: 0, vuln: 0, ok: 0, empty: 0 };

    cur.total += 1;
    if (r === "취약") cur.vuln += 1;
    else if (r === "양호") cur.ok += 1;
    else cur.empty += 1;

    map.set(domain, cur);
  }

  const rows = Array.from(map.values()).map((d) => ({
    ...d,
    rate: d.total ? Math.round((d.vuln / d.total) * 1000) / 10 : 0, // 소수 1자리 %
  }));

  rows.sort((a, b) => b.rate - a.rate || b.vuln - a.vuln || b.total - a.total);
  return rows;
}

function TooltipBox({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
      <div className="font-semibold text-slate-900 mb-1">{label}</div>
      <div className="text-slate-700">
        취약률: <b>{d.rate}%</b>
      </div>
      <div className="text-slate-600">
        취약: {d.vuln} / 전체: {d.total}
      </div>
      <div className="text-slate-500">
        양호: {d.ok}, 미입력: {d.empty}
      </div>
    </div>
  );
}

export default function DomainVulnRateChart({
  checklistItems = [],
  maxDomains = 12,
  height = 320,
}) {
  const data = useMemo(() => {
    return buildDomainStats(checklistItems).slice(0, maxDomains);
  }, [checklistItems, maxDomains]);

  const totals = useMemo(() => {
    const total = (checklistItems || []).length;
    const vuln = (checklistItems || []).filter(
      (x) => toText(x.result || x.vulnResult).trim() === "취약"
    ).length;
    return { total, vuln };
  }, [checklistItems]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="text-sm font-semibold text-slate-900">
            도메인별 취약 비율
          </div>
          <div className="text-xs text-slate-500 mt-1">
            취약률 = (취약 / 전체) × 100 · 상위 {Math.min(maxDomains, data.length)}
            개
          </div>
        </div>
        <div className="text-xs text-slate-500">
          전체 {totals.total}건 · 취약 {totals.vuln}건
        </div>
      </div>

      <div className="mt-4" style={{ width: "100%", height }}>
        {data.length ? (
          <ResponsiveContainer>
            <BarChart
              data={data}
              margin={{ top: 10, right: 12, left: 0, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="domain"
                tick={{ fontSize: 12 }}
                interval={0}
                height={40}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip content={<TooltipBox />} />
              <Bar dataKey="rate">
                <LabelList
                  dataKey="rate"
                  position="top"
                  formatter={(v) => `${v}%`}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="py-12 text-center text-sm text-slate-500">
            표시할 데이터가 없습니다.
          </div>
        )}
      </div>

      <div className="mt-2 text-xs text-slate-400">
        * 취약 항목이 적으면(예: 4건) 비율 변동이 크게 보일 수 있습니다.
      </div>
    </div>
  );
}