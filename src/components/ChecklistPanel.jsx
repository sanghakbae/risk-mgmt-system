import React, { useEffect, useMemo, useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import Papa from "papaparse";
import Button from "../ui/Button";
import { supabase } from "../lib/supabaseClient";
import TopProgressBar from "./TopProgressBar";

const PAGE_SIZE = 20;

function safeStr(v) {
  return v == null ? "" : String(v);
}

function normalizeType(v) {
  const s = safeStr(v).trim();
  if (!s) return "";
  const u = s.toUpperCase();
  if (u.includes("ISO")) return "ISO27001";
  if (u.includes("ISMS")) return "ISMS";
  return s;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function formatFileTimestamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(
    date.getHours()
  )}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function compareCode(a, b) {
  const aa = safeStr(a).split(".").map((x) => Number(x));
  const bb = safeStr(b).split(".").map((x) => Number(x));
  const len = Math.max(aa.length, bb.length);

  for (let i = 0; i < len; i += 1) {
    const av = Number.isFinite(aa[i]) ? aa[i] : -1;
    const bv = Number.isFinite(bb[i]) ? bb[i] : -1;
    if (av !== bv) return av - bv;
  }
  return safeStr(a).localeCompare(safeStr(b));
}

function buildOrderedUniqueOptions(rows, valueGetter) {
  const sorted = [...rows].sort((a, b) => compareCode(a.code, b.code));
  const seen = new Set();
  const out = [];

  for (const row of sorted) {
    const value = safeStr(valueGetter(row)).trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }

  return out;
}

function isChecklistDefined(row) {
  return (
    safeStr(row?.type).trim() !== "" &&
    safeStr(row?.area).trim() !== "" &&
    safeStr(row?.domain).trim() !== "" &&
    safeStr(row?.code).trim() !== "" &&
    safeStr(row?.itemCode ?? row?.itemcode).trim() !== ""
  );
}

export default function ChecklistPanel({
  checklistItems = [],
  setChecklistItems,
  onReload,
}) {
  const rows = useMemo(() => {
    const base = Array.isArray(checklistItems) ? checklistItems : [];
    return [...base].sort((a, b) => compareCode(a?.code, b?.code));
  }, [checklistItems]);

  // ✅ 필터: 유형 → 영역 → 도메인
  const [typeFilter, setTypeFilter] = useState("ISMS");
  const [areaFilter, setAreaFilter] = useState("전체");
  const [domainFilter, setDomainFilter] = useState("전체");
  const [keyword, setKeyword] = useState("");

  // ✅ pagination
  const [page, setPage] = useState(1);

  // ✅ Import state
  const fileInputRef = useRef(null);
  const [importing, setImporting] = useState(false);

  // ✅ 테이블 컬럼: 유형 → 영역 → 도메인
  const cols = useMemo(
    () => [
      { key: "type", label: "유형" },
      { key: "area", label: "영역" },
      { key: "domain", label: "도메인" },
      { key: "code", label: "코드" },
      { key: "itemCode", label: "항목" },
    ],
    []
  );

  // ----------------------------
  // Options (코드 순서 기준 첫 등장 순서)
  // ----------------------------
  const typeOptions = useMemo(() => {
    const types = buildOrderedUniqueOptions(rows, (x) => normalizeType(x.type));
    return ["전체", ...types];
  }, [rows]);

  const areaOptions = useMemo(() => {
    const scoped = rows.filter((x) => {
      const t = normalizeType(x.type);
      if (typeFilter !== "전체" && t !== typeFilter) return false;
      return true;
    });

    const areas = buildOrderedUniqueOptions(scoped, (x) => x.area);
    return ["전체", ...areas];
  }, [rows, typeFilter]);

  const domainOptions = useMemo(() => {
    const scoped = rows.filter((x) => {
      const t = normalizeType(x.type);
      if (typeFilter !== "전체" && t !== typeFilter) return false;

      const a = safeStr(x.area).trim();
      if (areaFilter !== "전체" && a !== areaFilter) return false;

      return true;
    });

    const domains = buildOrderedUniqueOptions(scoped, (x) => x.domain);
    return ["전체", ...domains];
  }, [rows, typeFilter, areaFilter]);

  // ----------------------------
  // Live Filter (입력 즉시 반영)
  // ----------------------------
  const filteredRows = useMemo(() => {
    const kw = safeStr(keyword).trim().toLowerCase();

    return rows.filter((x) => {
      const t = normalizeType(x.type);
      if (typeFilter !== "전체" && t !== typeFilter) return false;

      const a = safeStr(x.area).trim();
      if (areaFilter !== "전체" && a !== areaFilter) return false;

      const d = safeStr(x.domain).trim();
      if (domainFilter !== "전체" && d !== domainFilter) return false;

      if (!kw) return true;

      const hay = [
        safeStr(x.code),
        safeStr(x.itemCode ?? x.itemcode),
        safeStr(x.domain),
        safeStr(x.area),
        safeStr(x.type),
        safeStr(x.guide ?? x.Guide),
        safeStr(x.status ?? x.current_status ?? x.state),
        safeStr(x.result),
        safeStr(x.result_detail),
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(kw);
    });
  }, [rows, typeFilter, areaFilter, domainFilter, keyword]);

  const progressRows = useMemo(() => {
    return rows.filter((x) => {
      const t = normalizeType(x.type);
      if (typeFilter !== "전체" && t !== typeFilter) return false;
      return true;
    });
  }, [rows, typeFilter]);

  // ✅ 필터 변경 시 1페이지로
  useEffect(() => {
    setPage(1);
  }, [typeFilter, areaFilter, domainFilter, keyword]);

  const totalPages = useMemo(() => {
    const n = Math.ceil(filteredRows.length / PAGE_SIZE);
    return n <= 0 ? 1 : n;
  }, [filteredRows.length]);

  useEffect(() => {
    setPage((p) => clamp(p, 1, totalPages));
  }, [totalPages]);

  const pageSafe = clamp(page, 1, totalPages);

  const paged = useMemo(() => {
    const start = (pageSafe - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, pageSafe]);

  const checklistDoneCount = useMemo(
    () => progressRows.filter(isChecklistDefined).length,
    [progressRows]
  );

  // ✅ 페이지 번호 최대 10개(슬라이딩)
  const maxPageButtons = 10;
  const pageNumbers = useMemo(() => {
    const tp = totalPages || 1;
    const cur = clamp(pageSafe, 1, tp);

    if (tp <= maxPageButtons) return Array.from({ length: tp }, (_, i) => i + 1);

    const half = Math.floor(maxPageButtons / 2);
    let start = cur - half;
    let end = start + maxPageButtons - 1;

    if (start < 1) {
      start = 1;
      end = maxPageButtons;
    }
    if (end > tp) {
      end = tp;
      start = tp - maxPageButtons + 1;
    }
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [pageSafe, totalPages]);

  // ----------------------------
  // CSV Export (DB 전체 컬럼)
  // ----------------------------
  function csvEscape(v) {
    const s = v == null ? "" : String(v);
    const needs = /[\n\r",]/.test(s);
    const quoted = s.replaceAll('"', '""');
    return needs ? `"${quoted}"` : quoted;
  }

  async function exportCsv() {
    try {
      const { data, error } = await supabase.from("checklist").select("*").order("code", { ascending: true });
      if (error) {
        console.error("CSV export error:", error);
        alert(`CSV export error: ${error.message}`);
        return;
      }

      const out = (Array.isArray(data) ? data : []).sort((a, b) => compareCode(a?.code, b?.code));
      if (!out.length) {
        alert("내보낼 데이터가 없습니다.");
        return;
      }

      const keys = Object.keys(out[0]);
      const lines = [];
      lines.push(keys.map((k) => csvEscape(k)).join(","));
      for (const r of out) lines.push(keys.map((k) => csvEscape(r?.[k] ?? "")).join(","));

      const csv = "\ufeff" + lines.join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `checklist_all_columns_${formatFileTimestamp()}.csv`;
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
  // CSV Import (upsert)
  // ----------------------------
  function normalizeRow(row) {
    const out = { ...row };

    delete out.id;
    delete out.created_at;

    if (out.type == null && out["구분"] != null) {
      out.type = out["구분"];
    }
    if (out.type == null && out["유형"] != null) {
      out.type = out["유형"];
    }
    if (out.type == null && out["표준"] != null) {
      out.type = out["표준"];
    }
    delete out["구분"];
    delete out["유형"];
    delete out["표준"];

    if (out.itemCode != null && out.itemcode == null) {
      out.itemcode = out.itemCode;
      delete out.itemCode;
    }

    for (const k of Object.keys(out)) {
      if (out[k] === "") out[k] = null;
      if (typeof out[k] === "string") out[k] = out[k].trim();
    }

    const toInt = (v) => (v == null ? null : Number.isFinite(Number(v)) ? parseInt(v, 10) : null);
    for (const key of ["cost", "risk", "impact", "likelihood", "residual_impact", "residual_likelihood"]) {
      if (key in out) out[key] = toInt(out[key]);
    }

    if (out.type != null) out.type = normalizeType(out.type);

    return out;
  }

  async function upsertChecklist(rowsToUpsert) {
    const BATCH = 500;
    for (let i = 0; i < rowsToUpsert.length; i += BATCH) {
      const chunk = rowsToUpsert.slice(i, i + BATCH);
      const { error } = await supabase.from("checklist").upsert(chunk, { onConflict: "code" });
      if (error) throw error;
    }
  }

  async function reloadChecklistRows() {
    const { data, error } = await supabase
      .from("checklist")
      .select("*")
      .order("code", { ascending: true });

    if (error) throw error;

    const normalized = Array.isArray(data) ? [...data].sort((a, b) => compareCode(a?.code, b?.code)) : [];
    setChecklistItems?.(normalized);

    try {
      localStorage.setItem("checklist_cache_v1", JSON.stringify(normalized));
    } catch (e) {
      console.warn("checklist cache save error", e);
    }

    onReload?.();
  }

  async function onImportFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
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

      const rowsClean = data.map(normalizeRow).filter((r) => String(r.code ?? "").trim());

      for (const r of rowsClean) {
        if (!r.type) r.type = "ISMS";
      }

      await upsertChecklist(rowsClean);
      await reloadChecklistRows();
      alert(`Import 완료: ${rowsClean.length}건 처리`);
    } catch (err) {
      console.error("Import failed:", err);
      alert(`Import 실패: ${err?.message ?? String(err)}`);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="panel-shell flex flex-col gap-4 w-full max-w-none">
      <div className="panel-sticky">
        <div className="panel-header-stack">
          <TopProgressBar
            title="Checklist 작성 진행률"
            done={checklistDoneCount}
            total={progressRows.length}
          />

          <div className="panel-filter-card rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setAreaFilter("전체");
                  setDomainFilter("전체");
                }}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              >
                {typeOptions.map((t) => (
                  <option key={t} value={t}>
                    {t === "전체" ? "유형(전체)" : t}
                  </option>
                ))}
              </select>

              <select
                value={areaFilter}
                onChange={(e) => {
                  setAreaFilter(e.target.value);
                  setDomainFilter("전체");
                }}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              >
                {areaOptions.map((a) => (
                  <option key={a} value={a}>
                    {a === "전체" ? "영역(전체)" : a}
                  </option>
                ))}
              </select>

              <select
                value={domainFilter}
                onChange={(e) => setDomainFilter(e.target.value)}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              >
                {domainOptions.map((d) => (
                  <option key={d} value={d}>
                    {d === "전체" ? "도메인(전체)" : d}
                  </option>
                ))}
              </select>

              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="min-w-[220px] flex-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                placeholder="검색(코드/항목/가이드/현황/도메인/영역 등)"
              />

              <div className="text-xs text-slate-600 ml-auto">
                표시 {filteredRows.length}건 · {pageSafe}/{totalPages} 페이지
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              iconLeft={<Upload className="w-4 h-4" />}
              className="h-9 rounded-md px-3"
            >
              {importing ? "Importing..." : "Import"}
            </Button>

            <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onImportFile} />

            <Button variant="outline" onClick={exportCsv} iconLeft={<Download className="w-4 h-4" />} className="h-9 rounded-md px-3">
              CSV Export
            </Button>
          </div>
        </div>

        <div className="mt-4 border-b border-slate-200" />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-1 pb-6 space-y-3">
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full table-auto">
            <thead className="bg-slate-50 sticky top-0 z-[1]">
              <tr>
                {cols.map((c) => (
                  <th
                    key={c.key}
                    className="px-3 py-3 text-xs font-bold text-black border-b border-slate-200 text-center"
                    style={{ whiteSpace: "nowrap" }}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {paged.map((row, idx) => (
                <tr key={`${safeStr(row.code)}-${idx}`} className="hover:bg-slate-50">
                  {cols.map((c) => {
                    let v = row[c.key];

                    if (c.key === "itemCode") v = row.itemCode ?? row.itemcode ?? "";
                    if (c.key === "type") v = normalizeType(row.type);

                    const isItem = c.key === "itemCode";
                    const isCentered = ["type", "area", "domain", "code"].includes(c.key);
                    return (
                      <td
                        key={c.key}
                        className={[
                          "px-3 py-3 text-sm text-slate-800 align-top",
                          isCentered ? "text-center" : "text-left",
                        ].join(" ")}
                        style={{ whiteSpace: isItem ? "pre-wrap" : "nowrap" }}
                      >
                        {safeStr(v)}
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

        {filteredRows.length > PAGE_SIZE ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <Button
                variant="outline"
                onClick={() => setPage((p) => clamp(p - 1, 1, totalPages))}
                disabled={pageSafe <= 1}
              >
                이전
              </Button>

              {totalPages > 10 && pageNumbers[0] > 1 ? (
                <>
                  <button
                    onClick={() => setPage(1)}
                    className="h-9 min-w-[36px] px-3 rounded-xl border text-sm font-semibold bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  >
                    1
                  </button>
                  <span className="text-slate-400 px-1">…</span>
                </>
              ) : null}

              {pageNumbers.map((n) => {
                const active = n === pageSafe;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    className={[
                      "h-9 min-w-[36px] px-3 rounded-xl border text-sm font-semibold",
                      active
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    {n}
                  </button>
                );
              })}

              {totalPages > 10 && pageNumbers[pageNumbers.length - 1] < totalPages ? (
                <>
                  <span className="text-slate-400 px-1">…</span>
                  <button
                    onClick={() => setPage(totalPages)}
                    className="h-9 min-w-[36px] px-3 rounded-xl border text-sm font-semibold bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  >
                    {totalPages}
                  </button>
                </>
              ) : null}

              <Button
                variant="outline"
                onClick={() => setPage((p) => clamp(p + 1, 1, totalPages))}
                disabled={pageSafe >= totalPages}
              >
                다음
              </Button>
            </div>

            <div className="mt-2 text-center text-xs text-slate-500">
              총 {filteredRows.length}건 · 페이지당 {PAGE_SIZE}건 · {pageSafe}/{totalPages} 페이지
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
