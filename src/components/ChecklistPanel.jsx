import React, { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import Button from "../ui/Button";

/**
 * 통제 항목 관리(체크리스트) 화면
 * - 스프레드시트에서 로드된 checklistItems를 표로 보여줌
 * - CSV Export 지원
 * - 검색(버튼으로 적용) + 페이지네이션(20개)
 * - ✅ 상단 대시보드: 통제/점검/취약/위험 지표 요약
 *
 * checklistItems 예상 컬럼(일부만 써도 OK):
 * - type, area, domain, code, itemCode
 * - status                : 통제 이행 점검에서 작성한 현황(텍스트)
 * - result                : 취약 도출 결과(양호/취약)
 * - impact                : 위험 평가(영향도)
 * - likelihood            : 위험 평가(가능성)
 * - treatment_*           : 위험 처리(선택/계획 등)
 */
export default function ChecklistPanel({ checklistItems = [] }) {
  const PAGE_SIZE = 20;

  // ----------------------------
  // Search / Pagination states
  // ----------------------------
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [page, setPage] = useState(1);

  // ----------------------------
  // ✅ Dashboard metrics
  // ----------------------------
  const metrics = useMemo(() => {
    const totalControls = checklistItems.length;

    // 통제 이행 점검 진행률: status가 저장된 항목 수 / 전체
    const statusDone = checklistItems.filter((x) => String(x.status ?? "").trim().length > 0).length;

    // 취약 도출 진행률: result(양호/취약)가 저장된 항목 수 / 전체
    const vulnDone = checklistItems.filter((x) => {
      const r = String(x.result ?? x.vulnResult ?? "").trim();
      return r === "양호" || r === "취약";
    }).length;

    // 위험(평가 대상) 개수: result=취약 인 항목 수
    const riskTotal = checklistItems.filter((x) => String(x.result ?? x.vulnResult ?? "").trim() === "취약").length;

    // 위험 평가(영향도 지정) 개수: impact 값이 저장된 항목 수
    // (보통 취약 항목에 대해서만 영향도를 입력하므로, 화면에는 "impact 지정 N / 취약 M" 형태로 보여줌)
    const impactAssigned = checklistItems.filter((x) => {
      const i = String(x.impact ?? "").trim();
      if (!i) return false;
      return true;
    }).length;

    // percent helper
    const pct = (done, total) => (total > 0 ? Math.round((done / total) * 100) : 0);

    return {
      totalControls,
      statusDone,
      statusPct: pct(statusDone, totalControls),
      vulnDone,
      vulnPct: pct(vulnDone, totalControls),
      impactAssigned,
      riskTotal,
    };
  }, [checklistItems]);

  // ----------------------------
  // Table columns
  // ----------------------------
  const cols = useMemo(
    () => [
      { key: "type", label: "유형" },
      { key: "area", label: "영역" },
      { key: "domain", label: "분야" },
      { key: "code", label: "코드" },
      { key: "itemCode", label: "항목" }, // ✅ 항목(줄바꿈 허용)
    ],
    []
  );

  function csvEscape(v) {
    const s = v == null ? "" : String(v);
    const needs = /[\n\r",]/.test(s);
    const quoted = s.replaceAll('"', '""');
    return needs ? `"${quoted}"` : quoted;
  }

  function exportCsv() {
    // ✅ 요구사항: CSV export만 유지
    const headers = cols.map((c) => [c.key, c.label]);
    const lines = [];
    lines.push(headers.map((h) => csvEscape(h[1])).join(","));
    for (const x of checklistItems) {
      lines.push(headers.map(([k]) => csvEscape(x[k] ?? "")).join(","));
    }
    const csv = "\ufeff" + lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "controls.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  // ----------------------------
  // Filtered / paged rows
  // ----------------------------
  const filtered = useMemo(() => {
    const q = appliedQuery.trim().toLowerCase();
    if (!q) return checklistItems;

    return checklistItems.filter((row) => {
      const hay = cols
        .map((c) => String(row[c.key] ?? ""))
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [appliedQuery, checklistItems, cols]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(Math.max(1, page), totalPages);

  const paged = useMemo(() => {
    const start = (pageSafe - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, pageSafe]);

  // 검색 적용 시 페이지 1로 리셋
  function applySearch() {
    setAppliedQuery(query);
    setPage(1);
  }

  // ----------------------------
  // UI helpers
  // ----------------------------
  function StatCard({ title, value, sub, tone = "slate" }) {
    const toneCls =
      tone === "blue"
        ? "border-blue-200 bg-blue-50 text-blue-900"
        : tone === "red"
        ? "border-red-200 bg-red-50 text-red-900"
        : "border-slate-200 bg-white text-slate-900";

    return (
      <div className={`rounded-2xl border p-4 ${toneCls}`}>
        <div className="text-xs font-semibold text-slate-600">{title}</div>
        <div className="mt-1 text-2xl font-bold">{value}</div>
        {sub ? <div className="mt-1 text-xs text-slate-600">{sub}</div> : null}
      </div>
    );
  }

  function ProgressCard({ title, done, total, pct }) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs font-semibold text-slate-700">{title}</div>
          <div className="text-xs text-slate-500">
            {done}/{total} ({pct}%)
          </div>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full bg-slate-900" style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ✅ Dashboard */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <StatCard title="통제 항목 관리" value={`${metrics.totalControls}`} sub="통제 항목(전체) 개수" />
        <ProgressCard
          title="통제 이행 점검"
          done={metrics.statusDone}
          total={metrics.totalControls}
          pct={metrics.statusPct}
        />
        <ProgressCard
          title="취약 도출"
          done={metrics.vulnDone}
          total={metrics.totalControls}
          pct={metrics.vulnPct}
        />
        <StatCard
          title="위험 평가"
          value={`${metrics.impactAssigned}`}
          sub={`영향도(impact) 지정 건수 · 취약 ${metrics.riskTotal}건`}
          tone="blue"
        />
        <StatCard title="위험 처리" value={`${metrics.riskTotal}`} sub="취약(위험) 항목 개수" tone="red" />
      </div>

      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm text-slate-600">통제 항목 목록(검색/페이지) + CSV Export</div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportCsv} iconLeft={<Download className="w-4 h-4" />}>
            CSV Export
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-end gap-2 flex-wrap">
        <div className="flex-1 min-w-[220px]">
          <div className="text-xs font-semibold text-slate-700 mb-1">검색</div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            placeholder="유형/영역/분야/코드/항목 검색"
          />
        </div>
        <Button onClick={applySearch} iconLeft={<Search className="w-4 h-4" />}>
          검색
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full table-auto">
          <thead className="bg-slate-50">
            <tr>
              {cols.map((c) => (
                <th
                  key={c.key}
                  className="px-3 py-3 text-xs font-semibold text-slate-600 border-b border-slate-200 text-center"
                  style={{ whiteSpace: "nowrap" }} // ✅ 유형/영역/분야/코드는 줄바꿈 금지
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {paged.map((row, idx) => (
              <tr key={`${row.code ?? ""}-${idx}`} className="hover:bg-slate-50">
                {cols.map((c) => {
                  const v = row[c.key] ?? "";
                  const isItem = c.key === "itemCode";

                  return (
                    <td
                      key={c.key}
                      className="px-3 py-3 text-sm text-slate-800 align-top"
                      style={{
                        // ✅ 항목만 개행 허용, 나머지는 줄바꿈 금지
                        whiteSpace: isItem ? "pre-wrap" : "nowrap",
                      }}
                    >
                      {String(v)}
                    </td>
                  );
                })}
              </tr>
            ))}

            {paged.length === 0 ? (
              <tr>
                <td colSpan={cols.length} className="px-3 py-10 text-center text-sm text-slate-500">
                  표시할 항목이 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {filtered.length > PAGE_SIZE ? (
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {Array.from({ length: totalPages }).map((_, i) => {
            const n = i + 1;
            const active = n === pageSafe;
            return (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                className={[
                  "px-3 py-1.5 rounded-xl border text-sm font-semibold",
                  active ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
                ].join(" ")}
              >
                {n}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
