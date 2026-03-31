import React, { useEffect, useMemo, useRef, useState } from "react";

function toText(v) {
  return v == null ? "" : String(v);
}

function pct(n, d) {
  if (!d) return 0;
  return Math.round((n / d) * 1000) / 10;
}

function buildDomainRows(checklistItems) {
  const map = new Map();

  for (const x of checklistItems || []) {
    const domain = toText(x.domain).trim() || "미지정";
    const r = toText(x.result || x.vulnResult).trim();

    const cur = map.get(domain) || {
      domain,
      total: 0,
      vuln: 0,
      ok: 0,
      empty: 0,
    };

    cur.total += 1;
    if (r === "취약") cur.vuln += 1;
    else if (r === "양호") cur.ok += 1;
    else cur.empty += 1;

    map.set(domain, cur);
  }

  const rows = Array.from(map.values()).map((d) => ({
    ...d,
    rate: d.total ? Math.round((d.vuln / d.total) * 1000) / 10 : 0,
  }));

  rows.sort((a, b) => b.rate - a.rate || b.vuln - a.vuln || b.total - a.total);
  return rows;
}

function KpiCard({ title, value, sub, tone = "slate" }) {
  const toneMap = {
    slate: { bar: "bg-slate-300/70", dot: "bg-slate-400" },
    red: { bar: "bg-rose-300/70", dot: "bg-rose-400" },
    emerald: { bar: "bg-emerald-300/70", dot: "bg-emerald-400" },
    amber: { bar: "bg-amber-300/70", dot: "bg-amber-400" },
  };

  const t = toneMap[tone] || toneMap.slate;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition">
      <div className={`absolute left-0 top-0 h-full w-[6px] ${t.bar}`} />

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={`inline-block w-2 h-2 rounded-full ${t.dot}`} />
              <div className="text-sm font-bold text-slate-900 truncate">{title}</div>
            </div>

            <div className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 tabular-nums">
              {value}
            </div>
          </div>
        </div>

        {sub ? <div className="mt-2 text-sm font-semibold text-slate-900">{sub}</div> : null}
      </div>
    </div>
  );
}

function ProgressPanel({ done, total, pctValue }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm px-5 py-5">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="text-lg font-bold text-slate-900">평가 진행률</div>
        </div>
        <div className="text-base font-bold text-slate-900 tabular-nums">{pctValue}%</div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-sm font-semibold text-slate-900">
        <span>{done} / {total} 완료</span>
        <span className="tabular-nums">{pctValue}%</span>
      </div>

      <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-gradient-to-r from-rose-400 to-amber-400"
          style={{ width: `${Math.max(pctValue, total > 0 ? 1 : 0)}%` }}
        />
      </div>
    </div>
  );
}

function getHeatTone(r) {
  if (!r.total || r.empty === r.total) {
    return "border-slate-300 bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 text-slate-700 shadow-[inset_1px_1px_0_rgba(255,255,255,0.9),inset_-1px_-1px_0_rgba(148,163,184,0.2),0_3px_8px_rgba(15,23,42,0.08)]";
  }
  if (r.rate > 0) {
    return "border-rose-300 bg-gradient-to-br from-rose-50 via-rose-100 to-rose-200 text-rose-800 shadow-[inset_1px_1px_0_rgba(255,255,255,0.85),inset_-1px_-1px_0_rgba(244,63,94,0.14),0_3px_8px_rgba(244,63,94,0.16)]";
  }
  return "border-emerald-300 bg-gradient-to-br from-emerald-50 via-emerald-100 to-emerald-200 text-emerald-800 shadow-[inset_1px_1px_0_rgba(255,255,255,0.88),inset_-1px_-1px_0_rgba(16,185,129,0.14),0_3px_8px_rgba(16,185,129,0.16)]";
}

function DomainHeatmap({ rows }) {
  return (
    <div className="w-full rounded-2xl bg-white ring-1 ring-slate-200/70 shadow-sm">
      <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-lg font-bold text-slate-900">도메인 위험 히트맵</div>
          <div className="mt-1 text-sm font-semibold text-slate-900">
            도메인별 취약 여부와 평가 상태를 한눈에 확인합니다.
          </div>
        </div>
        <div className="pt-0.5 text-sm font-bold leading-[1.25] text-slate-900">도메인 {rows.length}개</div>
      </div>

      <div className="px-5 pb-5">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(84px,96px))] justify-center gap-1.5">
          {rows.map((r) => (
            <div
              key={r.domain}
              title={`${r.domain} | 전체 ${r.total} · 취약 ${r.vuln} · 양호 ${r.ok} · 미입력 ${r.empty} · 취약률 ${r.rate}%`}
              className={[
                "group aspect-square w-full rounded-lg border p-1",
                "flex items-center justify-center text-center",
                "text-sm font-bold leading-none",
                "overflow-hidden break-words transition-transform duration-150 hover:-translate-y-0.5",
                getHeatTone(r),
              ].join(" ")}
            >
              <span className="line-clamp-2 drop-shadow-[0_1px_0_rgba(255,255,255,0.45)]">{r.domain}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DomainSummaryTable({ rows, height }) {
  return (
    <div className="rounded-2xl bg-white ring-1 ring-slate-200/70 shadow-sm" style={height ? { height } : undefined}>
      <div className="px-5 pt-5 pb-4 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="text-lg font-bold text-slate-900">도메인별 요약</div>
          <div className="mt-1 text-sm font-semibold text-slate-900">
            도메인 기준으로 전체/취약/양호/미입력 및 취약률을 집계합니다.
          </div>
        </div>
        <div className="text-sm font-bold text-slate-900">도메인 {rows.length}개</div>
      </div>

      <div className="px-5 pb-5" style={height ? { height: "calc(100% - 76px)" } : undefined}>
        <div className="overflow-y-auto overflow-x-hidden rounded-2xl ring-1 ring-slate-200/70" style={height ? { height: "100%" } : { maxHeight: 560 }}>
          <table className="w-full table-fixed text-sm bg-white">
            <colgroup>
              <col className="w-auto" />
              <col className="w-14" />
              <col className="w-14" />
              <col className="w-14" />
              <col className="w-16" />
              <col className="w-[72px]" />
            </colgroup>

            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr className="text-sm text-slate-700 border-b border-slate-200">
                <th className="text-center py-1.5 px-2 font-bold">도메인</th>
                <th className="text-center py-1.5 px-2 font-bold">전체</th>
                <th className="text-center py-1.5 px-2 font-bold">취약</th>
                <th className="text-center py-1.5 px-2 font-bold">양호</th>
                <th className="text-center py-1.5 px-2 font-bold">미입력</th>
                <th className="text-center py-1.5 px-2 font-bold">취약률</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((r, idx) => (
                <tr
                  key={r.domain}
                  className={[
                    "border-b border-slate-100",
                    idx % 2 === 0 ? "bg-white" : "bg-slate-50/40",
                    "hover:bg-slate-50 transition",
                    "text-slate-800",
                  ].join(" ")}
                >
                  <td className="py-1.5 px-2 font-semibold truncate text-left">{r.domain}</td>
                  <td className="py-1.5 px-2 text-center font-semibold tabular-nums">{r.total}</td>
                  <td className="py-1.5 px-2 text-center font-semibold tabular-nums">{r.vuln}</td>
                  <td className="py-1.5 px-2 text-center font-semibold tabular-nums">{r.ok}</td>
                  <td className="py-1.5 px-2 text-center font-semibold tabular-nums">{r.empty}</td>
                  <td className="py-1.5 px-2 text-center font-bold tabular-nums">{r.rate}%</td>
                </tr>
              ))}

              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-sm text-slate-500">
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

function TopRiskDomains({ rows, panelRef }) {
  const topRows = rows.filter((r) => r.vuln > 0).slice(0, 5);

  return (
    <div ref={panelRef} className="rounded-2xl bg-white ring-1 ring-slate-200/70 shadow-sm">
      <div className="px-5 pt-5 pb-4 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="text-lg font-bold text-slate-900">Top 5 취약 도메인</div>
          <div className="mt-1 text-sm font-semibold text-slate-900">
            취약률과 취약 건수를 기준으로 우선 확인이 필요한 도메인입니다.
          </div>
        </div>
        <div className="text-sm font-bold text-slate-900">{topRows.length}개 표시</div>
      </div>

      <div className="px-5 pb-5 space-y-3">
        {topRows.length ? (
          topRows.map((row, idx) => (
            <div
              key={row.domain}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-100 text-sm font-bold text-rose-700">
                {idx + 1}
              </div>

              <div className="min-w-0 flex-1">
                <div className="truncate text-base font-bold text-slate-900">{row.domain}</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  전체 {row.total}건 · 취약 {row.vuln}건 · 양호 {row.ok}건
                </div>
              </div>

              <div className="shrink-0 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-right">
                <div className="text-sm font-semibold text-rose-600">취약률</div>
                <div className="text-base font-bold text-rose-700 tabular-nums">{Math.round(row.rate)}%</div>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
            취약으로 분류된 도메인이 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPanel({ checklistItems = [] }) {
  const topRiskRef = useRef(null);
  const [summaryHeight, setSummaryHeight] = useState(null);

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

  const domainRows = useMemo(() => buildDomainRows(checklistItems), [checklistItems]);

  useEffect(() => {
    function syncHeight() {
      const nextHeight = topRiskRef.current?.offsetHeight ?? null;
      setSummaryHeight(nextHeight);
    }

    syncHeight();
    window.addEventListener("resize", syncHeight);
    return () => window.removeEventListener("resize", syncHeight);
  }, [domainRows]);

  return (
    <div className="w-full max-w-none space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          title="총 점검 항목"
          value={kpi.total}
          sub={`현황 작성: ${kpi.statusDone}/${kpi.total} (${kpi.statusPct}%)`}
          tone="slate"
        />
        <KpiCard
          title="취약"
          value={kpi.riskCount}
          sub={`취약률(전체 대비): ${pct(kpi.riskCount, kpi.total)}%`}
          tone="red"
        />
        <KpiCard
          title="양호"
          value={kpi.okCount}
          sub={`양호율(전체 대비): ${pct(kpi.okCount, kpi.total)}%`}
          tone="emerald"
        />
        <KpiCard
          title="미평가"
          value={kpi.emptyCount}
          sub={`평가완료: ${kpi.vulnDone}/${kpi.total} (${kpi.vulnPct}%)`}
          tone="amber"
        />
      </div>

      <ProgressPanel done={kpi.vulnDone} total={kpi.total} pctValue={kpi.vulnPct} />


      <div>
        <DomainHeatmap rows={domainRows} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
        <TopRiskDomains rows={domainRows} panelRef={topRiskRef} />
        <DomainSummaryTable rows={domainRows} height={summaryHeight} />
      </div>
    </div>
  );
}
