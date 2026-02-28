import React, { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import Button from "../ui/Button";

export default function ChecklistPanel({ checklistItems }) {
  const PAGE_SIZE = 20;

  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [page, setPage] = useState(1);

  // ✅ 테이블 컬럼: code 추가 + 숫자계열 제거
  const cols = useMemo(
    () => [
      { key: "type", label: "유형" },
      { key: "area", label: "영역" },
      { key: "domain", label: "분야" },
      { key: "code", label: "코드" },       // ✅ NEW
      { key: "itemCode", label: "항목" },   // ✅ 항목(줄바꿈 허용)
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
    const headers = cols.map((c) => [c.key, c.label]);
    const lines = [];
    lines.push(headers.map((h) => csvEscape(h[1])).join(","));

    for (const x of Array.isArray(checklistItems) ? checklistItems : []) {
      lines.push(headers.map(([k]) => csvEscape(x?.[k] ?? "")).join(","));
    }

    const csv = "\ufeff" + lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "checklist.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const filtered = useMemo(() => {
    const list = Array.isArray(checklistItems) ? checklistItems : [];
    const q = String(appliedQuery || "").trim().toLowerCase();
    if (!q) return list;

    return list.filter((row) => {
      const hay = cols
        .map((c) => (row?.[c.key] == null ? "" : String(row[c.key])))
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [checklistItems, appliedQuery, cols]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const pagedRows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  const pageNumbers = useMemo(() => {
    const maxWindow = 7;
    if (totalPages <= maxWindow) return Array.from({ length: totalPages }, (_, i) => i + 1);

    const windowHalf = 3;
    let start = Math.max(1, safePage - windowHalf);
    let end = Math.min(totalPages, safePage + windowHalf);

    if (end - start < maxWindow - 1) {
      if (start === 1) end = Math.min(totalPages, start + (maxWindow - 1));
      else if (end === totalPages) start = Math.max(1, end - (maxWindow - 1));
    }

    const nums = [];
    if (start > 1) nums.push(1);
    if (start > 2) nums.push("…");
    for (let p = start; p <= end; p++) nums.push(p);
    if (end < totalPages - 1) nums.push("…");
    if (end < totalPages) nums.push(totalPages);
    return nums;
  }, [totalPages, safePage]);

  function applySearch() {
    setAppliedQuery(query);
    setPage(1);
  }

  return (
    <div className="space-y-4">
      {/* 상단: 검색 + CSV Export */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-sm text-slate-600">체크리스트</div>

          <div className="flex items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applySearch();
              }}
              placeholder="테이블 값 검색 (유형/영역/분야/코드/항목)"
              className="w-[380px] max-w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            />
            <Button variant="outline" onClick={applySearch} iconLeft={<Search className="w-4 h-4" />}>
              검색
            </Button>
            {appliedQuery ? (
              <Button
                variant="outline"
                onClick={() => {
                  setQuery("");
                  setAppliedQuery("");
                  setPage(1);
                }}
              >
                초기화
              </Button>
            ) : null}
          </div>
        </div>

        <Button variant="outline" onClick={exportCsv} iconLeft={<Download className="w-4 h-4" />}>
          CSV Export
        </Button>
      </div>

      <div className="text-xs text-slate-500">
        총 {total}건 · 페이지 {safePage}/{totalPages} · 페이지당 {PAGE_SIZE}건
      </div>

      {/* 테이블: 컬럼 폭 자동 + 특정 컬럼 개행 제어 */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-auto">
        <table className="w-full table-auto">
          <thead className="sticky top-0 bg-slate-50">
            <tr>
              {cols.map((c) => (
                <th
                  key={c.key}
                  className="text-center text-xs font-semibold text-slate-700 px-3 py-2 border-b border-slate-200 whitespace-nowrap"
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {pagedRows.length ? (
              pagedRows.map((row, idx) => (
                <tr key={`${safePage}-${idx}`} className="hover:bg-slate-50">
                  {cols.map((c) => {
                    const val = row?.[c.key] ?? "";

                    // ✅ 개행 금지 컬럼: type/area/domain/code
                    const noWrap = c.key === "type" || c.key === "area" || c.key === "domain" || c.key === "code";

                    return (
                      <td key={c.key} className="px-3 py-2 text-sm text-slate-900 border-b border-slate-100">
                        {noWrap ? (
                          // 한 줄 고정 + 길면 ...
                          <div className="whitespace-nowrap overflow-hidden text-ellipsis max-w-[260px]" title={String(val)}>
                            {String(val)}
                          </div>
                        ) : (
                          // ✅ 항목(itemCode)은 개행 허용(줄바꿈 OK)
                          <div className="whitespace-normal break-words">{String(val)}</div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={cols.length} className="px-3 py-6 text-sm text-slate-500 text-center">
                  데이터가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 페이징 */}
      {totalPages > 1 ? (
        <div className="flex items-center justify-center gap-2 flex-wrap pt-1">
          <Button variant="outline" onClick={() => setPage(1)} disabled={safePage === 1}>
            처음
          </Button>
          <Button variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}>
            이전
          </Button>

          {pageNumbers.map((p, i) =>
            p === "…" ? (
              <span key={`dots-${i}`} className="px-2 text-slate-400">
                …
              </span>
            ) : (
              <button
                key={`p-${p}`}
                type="button"
                onClick={() => setPage(Number(p))}
                className={`min-w-[36px] px-3 py-2 rounded-xl border text-sm ${
                  Number(p) === safePage
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {p}
              </button>
            )
          )}

          <Button variant="outline" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}>
            다음
          </Button>
          <Button variant="outline" onClick={() => setPage(totalPages)} disabled={safePage === totalPages}>
            끝
          </Button>
        </div>
      ) : null}
    </div>
  );
}
