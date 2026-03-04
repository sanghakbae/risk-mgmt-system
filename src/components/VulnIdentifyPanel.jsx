// src/components/VulnIdentifyPanel.jsx
import React, { useEffect, useMemo, useState } from "react";
import Button from "../ui/Button";
import { updateChecklistByCode } from "../api/checklist";

const PAGE_SIZE = 20;
const TYPE_ALL = "전체";
const RESULT_ALL = "전체";
const DOMAIN_ALL = "";
const AREA_ALL = "";

function safeStr(v) {
  return v == null ? "" : String(v);
}

function normalizeType(v) {
  const s = safeStr(v).trim();
  if (!s) return "";
  // 기존 데이터 흔들림 보정: ISO 관련은 ISO27001로 묶되,
  // "ISO27001" 자체가 DB에 새로 추가되면 그대로 옵션에 반영됨(자동).
  if (s.toUpperCase().includes("ISO")) return "ISO27001";
  if (s.toUpperCase().includes("ISMS")) return "ISMS";
  return s;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function RowCard({ row, isSaving, onSave }) {
  const [result, setResult] = useState(""); // 처음엔 항상 "선택"
  const [detail, setDetail] = useState(safeStr(row.result_detail));

  async function handleSave() {
    await onSave(row.code, {
      result: result || null,
      result_detail: result === "취약" ? (detail ? detail : null) : null,
    });
  }

  const statusText = safeStr(row.status ?? row.current_status ?? row.state).trim();
  const guideText = safeStr(row.guide ?? row.Guide).trim();

  return (
    <div className="w-full max-w-none rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 w-full">
          <div className="text-xs text-slate-500">
            {normalizeType(row.type)} · {safeStr(row.domain)} · {safeStr(row.area)}
          </div>

          <div className="text-sm font-semibold text-slate-900 whitespace-pre-wrap">
            [{safeStr(row.code)}] {safeStr(row.itemCode)}
          </div>

          {statusText ? (
            <div className="mt-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 whitespace-pre-wrap">
              <span className="font-bold">현황: </span>
              <span className="italic">{statusText}</span>
            </div>
          ) : null}

          {guideText ? (
            <div className="mt-2 text-sm text-sky-700 whitespace-pre-wrap">
              <span className="font-bold">가이드: </span>
              <span className="italic">{guideText}</span>
            </div>
          ) : null}
        </div>

        <div className="shrink-0 text-xs text-slate-500">{isSaving ? "저장 중..." : ""}</div>
      </div>

      <div className="flex items-center gap-2">
        <div className="text-xs font-semibold text-slate-700">결과</div>
        <select
          value={result}
          onChange={(e) => setResult(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
        >
          <option value="">선택</option>
          <option value="양호">양호</option>
          <option value="취약">취약</option>
        </select>
      </div>

      {result === "양호" ? (
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="h-[42px] px-5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50"
          >
            저장
          </button>
        </div>
      ) : null}

      {result === "취약" ? (
        <div className="space-y-1">
          <div className="text-xs font-semibold text-slate-700">사유</div>

          <div className="flex items-end gap-3">
            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="취약 판단 근거를 입력하세요"
              className="flex-1 min-h-[140px] rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 outline-none focus:ring-2 focus:ring-rose-100"
            />

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="h-[42px] px-5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50"
            >
              저장
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function VulnIdentifyPanel({ checklistItems = [], onUpdated }) {
  // ✅ Status와 동일한 필터 세트
  const [typeFilter, setTypeFilter] = useState(TYPE_ALL);
  const [domainFilter, setDomainFilter] = useState(DOMAIN_ALL);
  const [areaFilter, setAreaFilter] = useState(AREA_ALL);
  const [resultFilter, setResultFilter] = useState(RESULT_ALL);
  const [keyword, setKeyword] = useState("");

  const [page, setPage] = useState(1);
  const [savingCode, setSavingCode] = useState(null);

  // ✅ 타입 옵션: 하드코딩 X → 데이터에서 자동 생성
  const typeOptions = useMemo(() => {
    const set = new Set();
    for (const x of checklistItems || []) {
      const t = normalizeType(x.type);
      if (t) set.add(t);
    }
    return [TYPE_ALL, ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [checklistItems]);

  // ✅ 도메인 옵션: 선택된 type 기준으로 자동 생성
  const domainOptions = useMemo(() => {
    const set = new Set();
    for (const x of checklistItems || []) {
      const t = normalizeType(x.type);
      if (typeFilter !== TYPE_ALL && t !== typeFilter) continue;
      const d = safeStr(x.domain).trim();
      if (d) set.add(d);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [checklistItems, typeFilter]);

  // ✅ 영역 옵션: 선택된 type/domain 기준으로 자동 생성
  const areaOptions = useMemo(() => {
    const set = new Set();
    for (const x of checklistItems || []) {
      const t = normalizeType(x.type);
      if (typeFilter !== TYPE_ALL && t !== typeFilter) continue;

      const d = safeStr(x.domain).trim();
      if (domainFilter && d !== domainFilter) continue;

      const a = safeStr(x.area).trim();
      if (a) set.add(a);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [checklistItems, typeFilter, domainFilter]);

  // ✅ Status와 동일하게: keyword 검색(코드/항목명/가이드/현황/도메인/영역)
  const filteredRows = useMemo(() => {
    const kw = safeStr(keyword).trim().toLowerCase();

    return (checklistItems || []).filter((x) => {
      const t = normalizeType(x.type);
      if (typeFilter !== TYPE_ALL && t !== typeFilter) return false;

      const d = safeStr(x.domain).trim();
      if (domainFilter && d !== domainFilter) return false;

      const a = safeStr(x.area).trim();
      if (areaFilter && a !== areaFilter) return false;

      const r = safeStr(x.result || x.vulnResult).trim();
      if (resultFilter !== RESULT_ALL) {
        if (resultFilter === "미입력") {
          if (r === "양호" || r === "취약") return false;
        } else {
          if (r !== resultFilter) return false;
        }
      }

      if (!kw) return true;

      const hay = [
        safeStr(x.code),
        safeStr(x.itemCode),
        safeStr(x.domain),
        safeStr(x.area),
        safeStr(x.guide ?? x.Guide),
        safeStr(x.status ?? x.current_status ?? x.state),
        safeStr(x.result_detail),
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(kw);
    });
  }, [checklistItems, typeFilter, domainFilter, areaFilter, resultFilter, keyword]);

  // ✅ 페이지 수 계산 + 현재 페이지 보정
  const totalPages = useMemo(() => {
    const n = Math.ceil(filteredRows.length / PAGE_SIZE);
    return n <= 0 ? 1 : n;
  }, [filteredRows.length]);

  useEffect(() => {
    // 필터/검색 바뀌면 1페이지
    setPage(1);
  }, [typeFilter, domainFilter, areaFilter, resultFilter, keyword]);

  useEffect(() => {
    // filteredRows 줄어들어 page가 넘어가면 보정
    setPage((p) => clamp(p, 1, totalPages));
  }, [totalPages]);

  const pageSafe = clamp(page, 1, totalPages);

  const paged = useMemo(() => {
    const start = (pageSafe - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, pageSafe]);

  // ✅ 페이지 번호 최대 10개(슬라이딩)
  const maxPageButtons = 10;
  const pageNumbers = useMemo(() => {
    const tp = totalPages || 1;
    const cur = clamp(pageSafe, 1, tp);

    if (tp <= maxPageButtons) {
      return Array.from({ length: tp }, (_, i) => i + 1);
    }

    const half = Math.floor(maxPageButtons / 2); // 5
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

  async function onSave(code, patch) {
    try {
      setSavingCode(code);
      await updateChecklistByCode(code, patch);
      onUpdated?.();
    } catch (e) {
      alert("저장 실패: " + e.message);
    } finally {
      setSavingCode(null);
    }
  }

  return (
    <div className="w-full max-w-none space-y-4">
      {/* ✅ Status와 동일한 필터 바(상단) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2 flex-wrap">
          {/* 유형 */}
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setDomainFilter("");
              setAreaFilter("");
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
          >
            {typeOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          {/* 도메인 */}
          <select
            value={domainFilter}
            onChange={(e) => {
              setDomainFilter(e.target.value);
              setAreaFilter("");
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
          >
            <option value="">분야(전체)</option>
            {domainOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          {/* 영역 */}
          <select
            value={areaFilter}
            onChange={(e) => setAreaFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
          >
            <option value="">영역(전체)</option>
            {areaOptions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>

          {/* 결과 */}
          <select
            value={resultFilter}
            onChange={(e) => setResultFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
          >
            <option value="전체">결과(전체)</option>
            <option value="취약">취약</option>
            <option value="양호">양호</option>
            <option value="미입력">미입력</option>
          </select>

          {/* 키워드 */}
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="min-w-[220px] flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            placeholder="검색(코드/항목/가이드/현황/도메인/영역)"
          />

          <div className="text-sm text-slate-600 ml-auto">
            표시 {filteredRows.length}건 · {pageSafe}/{totalPages} 페이지
          </div>
        </div>
      </div>

      {/* 리스트 */}
      <div className="space-y-3">
        {paged.map((row) => (
          <RowCard key={row.code} row={row} isSaving={savingCode === row.code} onSave={onSave} />
        ))}

        {paged.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">표시할 항목이 없습니다.</div>
        ) : null}
      </div>

      {/* ✅ 페이지네이션: 최대 10개만 */}
      {totalPages > 1 ? (
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
  );
}