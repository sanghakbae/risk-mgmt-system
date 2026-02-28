import React, { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import Button from "../ui/Button";

/**
 * 통제 항목 관리(체크리스트) 화면
 * - 스프레드시트에서 로드된 checklistItems를 표로 보여줌
 * - CSV Export 지원
 * - 검색(버튼으로 적용) + 페이지네이션(20개)
 *
 * checklistItems 예상 컬럼(일부만 써도 OK):
 * - type, area, domain, code, itemCode
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

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm text-slate-600">
          통제 항목 목록(검색/페이지) + CSV Export
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={exportCsv}
            iconLeft={<Download className="w-4 h-4" />}
          >
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
                <td
                  colSpan={cols.length}
                  className="px-3 py-10 text-center text-sm text-slate-500"
                >
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
                  active
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
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
