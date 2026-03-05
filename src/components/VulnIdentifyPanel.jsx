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
  if (s.toUpperCase().includes("ISO")) return "ISO27001";
  if (s.toUpperCase().includes("ISMS")) return "ISMS";
  return s;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function isImageUrl(url) {
  const u = safeStr(url).trim();
  if (!u) return false;

  const clean = u.split("?")[0].split("#")[0].toLowerCase();
  return (
    clean.endsWith(".png") ||
    clean.endsWith(".jpg") ||
    clean.endsWith(".jpeg") ||
    clean.endsWith(".gif") ||
    clean.endsWith(".webp") ||
    clean.endsWith(".bmp") ||
    clean.endsWith(".svg")
  );
}

function EvidencePreview({ url }) {
  const u = safeStr(url).trim();
  if (!u) return null;

  const img = isImageUrl(u);

  return (
    <div className="mt-3">
      <div className="text-sm font-bold text-slate-800">증적</div>

      <div className="mt-2">
        {img ? (
          <a href={u} target="_blank" rel="noopener noreferrer" className="inline-block">
            <img
              src={u}
              alt="evidence"
              className="h-20 w-32 rounded-xl border border-slate-200 object-cover hover:opacity-90"
              loading="lazy"
            />
            <div className="mt-1 text-sm text-slate-500">클릭하면 원본 보기</div>
          </a>
        ) : (
          <a
            href={u}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            업로드된 증적 보기
          </a>
        )}
      </div>
    </div>
  );
}

function RowCard({ row, isSaving, onSave }) {
  // ✅ 기존 저장값을 초기값으로 보여주기 (안 그러면 "저장했는데 왜 선택이 비었지?"가 발생)
  const [result, setResult] = useState(safeStr(row.result).trim());
  const [detail, setDetail] = useState(safeStr(row.result_detail));

  // ✅ 결과를 "양호"로 바꾸면, 화면의 detail도 비워서 UX/데이터 일관성 유지
  useEffect(() => {
    if (result === "양호") setDetail("");
  }, [result]);

  async function handleSave() {
    const r = safeStr(result).trim();
    if (!r) {
      alert("결과를 선택하세요.");
      return;
    }

    // ✅ 핵심: 양호면 result_detail + reason 무조건 NULL로 초기화
    const payload =
      r === "취약"
        ? {
            result: "취약",
            result_detail: detail.trim() ? detail.trim() : null,
            // reason 입력 UI가 없더라도, 기존 데이터가 남아있을 수 있으니 유지하거나 함께 비우고 싶으면 아래처럼 선택
            // reason: safeStr(row.reason).trim() || null,
          }
        : {
            result: "양호",
            result_detail: null,
            reason: null,
          };

    await onSave(row.code, payload);
  }

  const statusText = safeStr(row.status ?? row.current_status ?? row.state).trim();
  const guideText = safeStr(row.guide ?? row.Guide).trim();
  const evidenceUrl = safeStr(row.evidence_url).trim();

  return (
    <div className="w-full max-w-none rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 w-full">
          <div className="text-sm text-slate-500">
            {normalizeType(row.type)} · {safeStr(row.domain)} · {safeStr(row.area)}
          </div>

          <div className="text-sm font-semibold text-slate-900 whitespace-pre-wrap">
            [{safeStr(row.code)}] {safeStr(row.itemCode)}
          </div>
        </div>

        <div className="shrink-0 text-sm text-slate-500">{isSaving ? "저장 중..." : ""}</div>
      </div>

      {/* 가이드 */}
      {guideText ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2">
          <div className="text-sm font-bold text-sky-800 mb-1">가이드</div>
          <div className="text-sm text-sky-800 whitespace-pre-wrap break-words">{guideText}</div>
        </div>
      ) : null}

      {/* 현황 */}
      {statusText ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
          <div className="text-sm font-bold text-emerald-800 mb-1">현황</div>
          <div className="text-sm text-emerald-800 whitespace-pre-wrap break-words">{statusText}</div>
        </div>
      ) : null}

      {/* 증적 */}
      {evidenceUrl ? <EvidencePreview url={evidenceUrl} /> : null}

      {/* 결과 라인 */}
      <div className="flex items-center gap-3">
        <div className="text-sm font-bold text-slate-800">결과</div>

        <select
          value={result}
          onChange={(e) => setResult(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
        >
          <option value="">선택</option>
          <option value="양호">양호</option>
          <option value="취약">취약</option>
        </select>

        {/* 양호 저장 버튼 */}
        {result === "양호" ? (
          <div className="ml-auto">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="h-[42px] px-5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50"
            >
              저장
            </button>
          </div>
        ) : null}
      </div>

      {/* 취약이면 사유(상세) + 저장 */}
      {result === "취약" ? (
        <div className="space-y-2">
          <div className="text-sm font-bold text-slate-800">사유</div>

          <div className="flex items-end gap-3">
            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="취약 판단 근거를 입력하세요"
              className="flex-1 min-h-[140px] rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 outline-none focus:ring-2 focus:ring-rose-100"
            />

            <button
              type="button"
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
  const [typeFilter, setTypeFilter] = useState(TYPE_ALL);
  const [domainFilter, setDomainFilter] = useState(DOMAIN_ALL);
  const [areaFilter, setAreaFilter] = useState(AREA_ALL);
  const [resultFilter, setResultFilter] = useState(RESULT_ALL);
  const [keyword, setKeyword] = useState("");

  const [page, setPage] = useState(1);
  const [savingCode, setSavingCode] = useState(null);

  const typeOptions = useMemo(() => {
    const set = new Set();
    for (const x of checklistItems || []) {
      const t = normalizeType(x.type);
      if (t) set.add(t);
    }
    return [TYPE_ALL, ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [checklistItems]);

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
        safeStr(x.evidence_url),
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(kw);
    });
  }, [checklistItems, typeFilter, domainFilter, areaFilter, resultFilter, keyword]);

  const totalPages = useMemo(() => {
    const n = Math.ceil(filteredRows.length / PAGE_SIZE);
    return n <= 0 ? 1 : n;
  }, [filteredRows.length]);

  useEffect(() => {
    setPage(1);
  }, [typeFilter, domainFilter, areaFilter, resultFilter, keyword]);

  useEffect(() => {
    setPage((p) => clamp(p, 1, totalPages));
  }, [totalPages]);

  const pageSafe = clamp(page, 1, totalPages);

  const paged = useMemo(() => {
    const start = (pageSafe - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, pageSafe]);

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

  async function onSave(code, patch) {
    try {
      setSavingCode(code);

      // ✅ undefined 제거(안전), null은 유지해야 DB에서 지워짐
      const payload = Object.fromEntries(
        Object.entries(patch || {}).filter(([, v]) => v !== undefined)
      );

      await updateChecklistByCode(code, payload);
      onUpdated?.();
    } catch (e) {
      alert("저장 실패: " + e.message);
    } finally {
      setSavingCode(null);
    }
  }

  return (
    <div className="h-[calc(100vh-160px)] flex flex-col gap-4 w-full max-w-none">
      <div className={["sticky top-0 z-10", "-mx-6 px-6", "bg-slate-50/95 backdrop-blur", "pt-1"].join(" ")}>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 flex-wrap">
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

            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="min-w-[220px] flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              placeholder="검색(코드/항목/가이드/현황/도메인/영역/증적)"
            />

            <div className="text-sm text-slate-600 ml-auto">
              표시 {filteredRows.length}건 · {pageSafe}/{totalPages} 페이지
            </div>
          </div>
        </div>

        <div className="mt-4 border-b border-slate-200" />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-1 pb-6 space-y-3">
        {paged.map((row) => (
          <RowCard key={row.code} row={row} isSaving={savingCode === row.code} onSave={onSave} />
        ))}

        {paged.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">표시할 항목이 없습니다.</div>
        ) : null}

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