// src/components/DashboardPanel.jsx
import React, { useMemo } from "react";
import DomainVulnRateChart from "./DomainVulnRateChart";

function toText(v) {
  return v == null ? "" : String(v);
}

function pct(n, d) {
  if (!d) return 0;
  return Math.round((n / d) * 1000) / 10; // 소수 1자리 %
}

function buildDomainRows(checklistItems) {
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
    rate: d.total ? Math.round((d.vuln / d.total) * 1000) / 10 : 0, // 소수1자리
  }));

  rows.sort((a, b) => b.rate - a.rate || b.vuln - a.vuln || b.total - a.total);
  return rows;
}

function KpiCard({ title, value, sub }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="text-xs font-semibold text-slate-500">{title}</div>
      <div className="mt-2 text-2xl font-bold text-slate-900">{value}</div>
      {sub ? <div className="mt-2 text-xs text-slate-500">{sub}</div> : null}
    </div>
  );
}

export default function DashboardPanel({ checklistItems = [] }) {
  const kpi = useMemo(() => {
    const total = Array.isArray(checklistItems) ? checklistItems.length : 0;

    const statusDone = (checklistItems || []).filter(
      (x) => toText(x.status).trim().length > 0
    ).length;

    const vulnDone = (checklistItems || []).filter((x) => {
      const r = toText(x.result || x.vulnResult).trim();
      return r === "양호" || r === "취약";
    }).length;

    const riskCount = (checklistItems || []).filter(
      (x) => toText(x.result || x.vulnResult).trim() === "취약"
    ).length;

    const okCount = (checklistItems || []).filter(
      (x) => toText(x.result || x.vulnResult).trim() === "양호"
    ).length;

    return {
      total,
      statusDone,
      statusPct: pct(statusDone, total),
      vulnDone,
      vulnPct: pct(vulnDone, total),
      riskCount,
      okCount,
      emptyCount: Math.max(0, total - (riskCount + okCount)),
    };
  }, [checklistItems]);

  const domainRows = useMemo(
    () => buildDomainRows(checklistItems),
    [checklistItems]
  );

  return (
    <div className="w-full max-w-none space-y-6">
      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard title="총 점검 항목" value={kpi.total} />
        <KpiCard
          title="취약"
          value={kpi.riskCount}
          sub={`취약률(전체 대비): ${pct(kpi.riskCount, kpi.total)}%`}
        />
        <KpiCard
          title="양호"
          value={kpi.okCount}
          sub={`양호율(전체 대비): ${pct(kpi.okCount, kpi.total)}%`}
        />
        <KpiCard
          title="미평가"
          value={kpi.emptyCount}
          sub={`평가완료: ${kpi.vulnDone}/${kpi.total} (${kpi.vulnPct}%)`}
        />
      </div>

      {/* 도메인별 취약률 그래프 */}
      <DomainVulnRateChart checklistItems={checklistItems} maxDomains={12} />

      {/* 도메인 요약 테이블 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <div className="text-sm font-semibold text-slate-900">
              도메인별 요약
            </div>
            <div className="text-xs text-slate-500 mt-1">
              도메인 기준으로 전체/취약/양호/미입력 및 취약률을 집계합니다.
            </div>
          </div>
          <div className="text-xs text-slate-500">
            도메인 {domainRows.length}개
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[900px] w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 border-b border-slate-200">
                <th className="text-left py-2 pr-3">도메인</th>
                <th className="text-right py-2 px-3">전체</th>
                <th className="text-right py-2 px-3">취약</th>
                <th className="text-right py-2 px-3">양호</th>
                <th className="text-right py-2 px-3">미입력</th>
                <th className="text-right py-2 pl-3">취약률</th>
              </tr>
            </thead>
            <tbody>
              {domainRows.map((r) => (
                <tr
                  key={r.domain}
                  className="border-b border-slate-100 text-slate-800"
                >
                  <td className="py-3 pr-3 font-medium">{r.domain}</td>
                  <td className="py-3 px-3 text-right">{r.total}</td>
                  <td className="py-3 px-3 text-right">{r.vuln}</td>
                  <td className="py-3 px-3 text-right">{r.ok}</td>
                  <td className="py-3 px-3 text-right">{r.empty}</td>
                  <td className="py-3 pl-3 text-right font-semibold">
                    {r.rate}%
                  </td>
                </tr>
              ))}

              {domainRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-10 text-center text-sm text-slate-500"
                  >
                    표시할 데이터가 없습니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}