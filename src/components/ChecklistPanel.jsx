import React, { useMemo, useRef, useState } from "react";
import { Download, Search, Upload } from "lucide-react";
import Papa from "papaparse";
import Button from "../ui/Button";
import { supabase } from "../lib/supabaseClient";

/**
 * 통제 항목 관리(체크리스트) 화면
 * - checklistItems를 표로 보여줌
 * - CSV Export 지원 (DB checklist 테이블 전체 컬럼 export)
 * - CSV Import 지원 (CSV 내용을 DB checklist 테이블에 upsert)
 * - 유형 필터(ISMS/ISO27001) + 검색(버튼으로 적용) + 페이지네이션(20개)
 *
 * checklistItems 예상 컬럼(일부만 써도 OK):
 * - type, area, domain, code, itemCode
 */
export default function ChecklistPanel({ checklistItems = [] }) {
  const PAGE_SIZE = 20;

  // ----------------------------
  // Filter / Search / Pagination states
  // ----------------------------
  const [typeFilter, setTypeFilter] = useState("ISMS");
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [page, setPage] = useState(1);

  // ----------------------------
  // Import state
  // ----------------------------
  const fileInputRef = useRef(null);
  const [importing, setImporting] = useState(false);

  // ----------------------------
  // Table columns (유형 제거)
  // ----------------------------
  const cols = useMemo(
    () => [
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

  // ----------------------------
  // Export (DB 전체 컬럼)
  // ----------------------------
  async function exportCsv() {
    try {
      const { data, error } = await supabase
        .from("checklist")
        .select("*")
        .order("code", { ascending: true });

      if (error) {
        console.error("CSV export error:", error);
        alert(`CSV export error: ${error.message}`);
        return;
      }

      const rows = Array.isArray(data) ? data : [];
      if (!rows.length) {
        alert("내보낼 데이터가 없습니다.");
        return;
      }

      // 첫 row의 key 기준으로 전체 컬럼 export
      const keys = Object.keys(rows[0]);

      const lines = [];
      lines.push(keys.map((k) => csvEscape(k)).join(","));
      for (const r of rows) {
        lines.push(keys.map((k) => csvEscape(r?.[k] ?? "")).join(","));
      }

      const csv = "\ufeff" + lines.join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = "checklist_all_columns.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("CSV export unexpected error:", e);
      alert(`CSV export unexpected error: ${e?.message ?? String(e)}`);
    }
  }

  // ----------------------------
  // Import helpers
  // ----------------------------
  function normalizeRow(row) {
    const out = { ...row };

    // 1) PK/자동값은 DB가 만들게 둔다 (빈값 들어가면 bigint/timestamp에서 터짐)
    delete out.id;
    delete out.created_at;

    // 2) itemCode -> itemcode (DB 컬럼명 맞추기)
    if (out.itemCode != null && out.itemcode == null) {
      out.itemcode = out.itemCode;
      delete out.itemCode;
    }

    // 3) 빈 문자열은 null로 (숫자/날짜 컬럼 안전)
    for (const k of Object.keys(out)) {
      if (out[k] === "") out[k] = null;
      if (typeof out[k] === "string") out[k] = out[k].trim();
    }

    // 4) 숫자 컬럼들 캐스팅 (필요한 것만)
    const toInt = (v) => (v == null ? null : Number.isFinite(Number(v)) ? parseInt(v, 10) : null);

    // 테이블에 이런 컬럼들이 있으면 bigint/int로 들어갈 수 있어서 안전하게 변환
    // (없으면 그냥 무시됨)
    for (const key of ["cost", "risk", "impact", "likelihood", "residual_impact", "residual_likelihood"]) {
      if (key in out) out[key] = toInt(out[key]);
    }

    return out;
  }

  async function upsertChecklist(rows) {
    // 너무 큰 파일 대비 batch upsert
    const BATCH = 500;
    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk = rows.slice(i, i + BATCH);

      // onConflict가 동작하려면 DB에 code UNIQUE 제약이 있는 게 가장 좋음
      const { error } = await supabase
        .from("checklist")
        .upsert(chunk, { onConflict: "code" });

      if (error) throw error;
    }
  }

  async function onImportFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // 동일 파일 재선택 가능
    if (!file) return;

    setImporting(true);
    try {
      const parsed = await new Promise((resolve, reject) => {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => resolve(results),
          error: (err) => reject(err),
        });
      });

      const { data, errors, meta } = parsed;

      if (errors?.length) {
        console.error("CSV parse errors:", errors);
        alert(`CSV 파싱 오류: ${errors[0]?.message ?? "unknown error"}`);
        return;
      }

      if (!Array.isArray(data) || data.length === 0) {
        alert("CSV에 데이터가 없습니다.");
        return;
      }

      const headers = meta?.fields ?? [];
      if (!headers.includes("code")) {
        alert('CSV 헤더에 "code" 컬럼이 필요합니다.');
        return;
      }

      const rows = data
        .map(normalizeRow)
        .filter((r) => String(r.code ?? "").trim());

      // type이 비어있으면 기본값 (원하면 제거)
      for (const r of rows) {
        if (!r.type) r.type = "ISMS";
      }

      await upsertChecklist(rows);

      alert(`Import 완료: ${rows.length}건 처리`);
    } catch (err) {
      console.error("Import failed:", err);
      alert(`Import 실패: ${err?.message ?? String(err)}`);
    } finally {
      setImporting(false);
    }
  }

  // ----------------------------
  // Search apply
  // ----------------------------
  function applySearch() {
    setAppliedQuery(query);
    setPage(1);
  }

  function changeType(next) {
    setTypeFilter(next);
    setPage(1);
  }

  // ----------------------------
  // Filtered / paged rows (유형 + 검색 AND)
  // ----------------------------
  const filtered = useMemo(() => {
    const q = appliedQuery.trim().toLowerCase();

    return checklistItems.filter((row) => {
      const t = String(row.type ?? "").trim().toUpperCase();
      if (t !== typeFilter) return false;

      if (!q) return true;

      const hay = cols
        .map((c) => String(row[c.key] ?? ""))
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });
  }, [appliedQuery, checklistItems, cols, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(Math.max(1, page), totalPages);

  const paged = useMemo(() => {
    const start = (pageSafe - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, pageSafe]);

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm text-slate-600">
          통제 항목 목록(유형 필터/검색/페이지) + CSV Export/Import
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            iconLeft={<Upload className="w-4 h-4" />}
          >
            {importing ? "Importing..." : "Import"}
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={onImportFile}
          />

          <Button
            variant="outline"
            onClick={exportCsv}
            iconLeft={<Download className="w-4 h-4" />}
          >
            CSV Export
          </Button>
        </div>
      </div>

      {/* Filter + Search row: [유형][검색입력][검색버튼] */}
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={typeFilter}
          onChange={(e) => changeType(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
        >
          <option value="ISMS">ISMS</option>
          <option value="ISO27001">ISO27001</option>
        </select>

        <div className="flex-1 min-w-[220px]">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            placeholder="영역/분야/코드/항목 검색"
            onKeyDown={(e) => {
              if (e.key === "Enter") applySearch();
            }}
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
                  style={{ whiteSpace: "nowrap" }}
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
                      style={{ whiteSpace: isItem ? "pre-wrap" : "nowrap" }}
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