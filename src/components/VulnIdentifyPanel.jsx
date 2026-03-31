import React, { useEffect, useMemo, useState } from "react";
import Button from "../ui/Button";
import { updateChecklistByCode } from "../api/checklist";
import EvidenceModalTrigger from "./EvidenceModalTrigger";
import TopProgressBar from "./TopProgressBar";
import { parseEvidenceUrls } from "../utils/evidence";

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

function isStatusCompleted(row) {
  return safeStr(row?.status ?? row?.current_status ?? row?.state).trim() !== "";
}

function isVulnCompleted(row) {
  const r = safeStr(row?.result ?? row?.vulnResult).trim();
  return r === "양호" || r === "취약";
}

function getVulnBlockMessage(totalCount, doneCount) {
  return `Status 단계가 완료되어야 취약 여부 식별이 가능합니다. (${doneCount}/${totalCount} 완료)`;
}

function EvidencePreview({ urls = [] }) {
  if (!urls.length) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="text-sm font-bold text-slate-800">증적</div>

      <div className="mt-2 flex flex-wrap gap-2">
        {urls.map((u, idx) => (
          <EvidenceModalTrigger
            key={`${u}-${idx}`}
            url={u}
            imageClassName="h-20 w-32 rounded-xl border border-slate-200 object-cover hover:opacity-90"
            linkClassName="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            hint="클릭하면 팝업 보기"
            fit="contain"
          />
        ))}
      </div>
    </div>
  );
}

function RowCard({ row, isSaving, onSave, editable, blockMessage }) {
  const [result, setResult] = useState(safeStr(row.result).trim());
  const [detail, setDetail] = useState(safeStr(row.result_detail));

  useEffect(() => {
    setResult(safeStr(row.result).trim());
    setDetail(safeStr(row.result_detail));
  }, [row.result, row.result_detail]);

  useEffect(() => {
    if (result === "양호") setDetail("");
  }, [result]);

  async function handleSave() {
    if (!editable) {
      alert(blockMessage);
      return;
    }

    const r = safeStr(result).trim();
    if (!r) {
      alert("결과를 선택하세요.");
      return;
    }

    const payload =
      r === "취약"
        ? {
            result: "취약",
            result_detail: detail.trim() ? detail.trim() : null,
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
  const evidenceUrls = parseEvidenceUrls(row.evidence_url);

  return (
    <div className="w-full max-w-none rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 w-full">
          <div className="space-y-1">
            <div className="text-xs text-slate-500 break-words">
              {normalizeType(row.type)} · {safeStr(row.area)} · {safeStr(row.domain)}
            </div>

            <div className="text-sm font-bold text-slate-900 whitespace-pre-wrap break-words">
              [{safeStr(row.code)}] {safeStr(row.itemCode)}
            </div>
          </div>
        </div>

        <div className="shrink-0 text-sm text-slate-500">{isSaving ? "저장 중..." : ""}</div>
      </div>

      {guideText ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2">
          <div className="mb-1 flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-sm border border-sky-400 bg-sky-300" />
            <span className="text-sm font-bold text-sky-800">가이드</span>
          </div>
          <div className="text-sm font-bold text-sky-800 whitespace-pre-wrap break-words">{guideText}</div>
        </div>
      ) : null}

      {statusText ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
          <div className="mb-1 flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-sm border border-emerald-400 bg-emerald-300" />
            <span className="text-sm font-bold text-emerald-800">현황</span>
          </div>
          <div className="text-sm font-bold text-emerald-800 whitespace-pre-wrap break-words">{statusText}</div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="mb-1 flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-sm border border-slate-400 bg-slate-300" />
            <span className="text-sm font-bold text-slate-700">현황</span>
          </div>
          <div className="text-sm font-bold text-slate-500 whitespace-pre-wrap break-words">
            현황 미작성
          </div>
        </div>
      )}

      {result === "취약" ? (
        <div>
          <div className="flex items-stretch gap-2">
            <div className="w-9 shrink-0 rounded-xl border border-rose-300 bg-rose-200 flex items-center justify-center text-sm font-bold text-rose-800 whitespace-pre-line">
              {"사\n유"}
            </div>
            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              disabled={!editable || isSaving}
              placeholder={
                editable ? "취약 판단 근거를 입력하세요" : "Status 전체 완료 후 입력 가능합니다."
              }
              className={[
                "w-full max-w-[720px] min-h-[140px] rounded-xl px-3 py-2 text-sm outline-none",
                editable
                  ? "border border-rose-300 bg-rose-100 text-rose-800 focus:ring-2 focus:ring-rose-200"
                  : "border border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed",
              ].join(" ")}
            />
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          {evidenceUrls.length ? <EvidencePreview urls={evidenceUrls} /> : null}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="text-sm font-bold text-slate-800 whitespace-nowrap">결과 선택</div>
          <select
            value={result}
            onChange={(e) => setResult(e.target.value)}
            disabled={!editable || isSaving}
            className={[
              "rounded-xl border px-3 py-2 text-sm outline-none",
              editable
                ? "border-slate-200 bg-white focus:ring-2 focus:ring-slate-200"
                : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed",
            ].join(" ")}
          >
            <option value="">선택</option>
            <option value="양호">양호</option>
            <option value="취약">취약</option>
          </select>

          {result ? (
            <button
              type="button"
              onClick={handleSave}
              disabled={!editable || isSaving}
              className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              저장
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function VulnIdentifyPanel({ checklistItems = [], onUpdated }) {
  const [typeFilter, setTypeFilter] = useState(TYPE_ISMS);
  const [areaFilter, setAreaFilter] = useState(AREA_ALL);
  const [domainFilter, setDomainFilter] = useState(DOMAIN_ALL);
  const [resultFilter, setResultFilter] = useState(RESULT_ALL);
  const [keyword, setKeyword] = useState("");

  const [page, setPage] = useState(1);
  const [savingCode, setSavingCode] = useState(null);

  const totalCount = useMemo(() => (checklistItems || []).length, [checklistItems]);
  const vulnDoneCount = useMemo(() => (checklistItems || []).filter(isVulnCompleted).length, [checklistItems]);

  const statusDoneCount = useMemo(() => {
    return (checklistItems || []).filter(isStatusCompleted).length;
  }, [checklistItems]);

  const allStatusCompleted = totalCount > 0 && totalCount === statusDoneCount;
  const blockMessage = getVulnBlockMessage(totalCount, statusDoneCount);

  const typeOptions = useMemo(() => {
    const types = buildOrderedUniqueOptions(checklistItems || [], (x) => normalizeType(x.type));
    return [TYPE_ALL, ...types];
  }, [checklistItems]);

  const areaOptions = useMemo(() => {
    const scoped = (checklistItems || []).filter((x) => {
      const t = normalizeType(x.type);
      if (typeFilter !== TYPE_ALL && t !== typeFilter) return false;
      return true;
    });

    return [AREA_ALL, ...buildOrderedUniqueOptions(scoped, (x) => x.area)];
  }, [checklistItems, typeFilter]);

  const domainOptions = useMemo(() => {
    const scoped = (checklistItems || []).filter((x) => {
      const t = normalizeType(x.type);
      if (typeFilter !== TYPE_ALL && t !== typeFilter) return false;

      const a = safeStr(x.area).trim();
      if (areaFilter && a !== areaFilter) return false;

      return true;
    });

    return [DOMAIN_ALL, ...buildOrderedUniqueOptions(scoped, (x) => x.domain)];
  }, [checklistItems, typeFilter, areaFilter]);

  const filteredRows = useMemo(() => {
    const kw = safeStr(keyword).trim().toLowerCase();

    return (checklistItems || []).filter((x) => {
      const t = normalizeType(x.type);
      if (typeFilter !== TYPE_ALL && t !== typeFilter) return false;

      const a = safeStr(x.area).trim();
      if (areaFilter && a !== areaFilter) return false;

      const d = safeStr(x.domain).trim();
      if (domainFilter && d !== domainFilter) return false;

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
  }, [checklistItems, typeFilter, areaFilter, domainFilter, resultFilter, keyword]);

  const totalPages = useMemo(() => {
    const n = Math.ceil(filteredRows.length / PAGE_SIZE);
    return n <= 0 ? 1 : n;
  }, [filteredRows.length]);

  useEffect(() => {
    setPage(1);
  }, [typeFilter, areaFilter, domainFilter, resultFilter, keyword]);

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
      if (!allStatusCompleted) {
        alert(blockMessage);
        return;
      }

      setSavingCode(code);

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
    <div className="panel-shell flex flex-col gap-4 w-full max-w-none">
      <div className="panel-sticky">
        {!allStatusCompleted ? (
          <div className="panel-banner mb-4 rounded-2xl border border-rose-200 bg-rose-50">
            <div className="panel-banner-title text-rose-700">단계 잠금</div>
            <div className="panel-banner-body text-rose-700">{blockMessage}</div>
          </div>
        ) : (
          <div className="panel-banner mb-4 rounded-2xl border border-emerald-200 bg-emerald-50">
            <div className="panel-banner-title text-emerald-700">단계 활성화</div>
            <div className="panel-banner-body text-emerald-700">
              Status 단계가 전체 완료되어 취약 식별 입력이 가능합니다.
            </div>
          </div>
        )}

        <div className="mb-4">
          <TopProgressBar title="취약 식별 진행률" done={vulnDoneCount} total={totalCount} />
        </div>

        <div className="panel-filter-card rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setAreaFilter(AREA_ALL);
                setDomainFilter(DOMAIN_ALL);
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            >
              {typeOptions.map((t) => (
                <option key={t} value={t}>
                  {t === TYPE_ALL ? "유형(전체)" : t}
                </option>
              ))}
            </select>

            <select
              value={areaFilter}
              onChange={(e) => {
                setAreaFilter(e.target.value);
                setDomainFilter(DOMAIN_ALL);
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            >
              {areaOptions.map((a) => (
                <option key={a || "__all_area__"} value={a}>
                  {a === AREA_ALL ? "영역(전체)" : a}
                </option>
              ))}
            </select>

            <select
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            >
              {domainOptions.map((d) => (
                <option key={d || "__all_domain__"} value={d}>
                  {d === DOMAIN_ALL ? "도메인(전체)" : d}
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
          <RowCard
            key={row.code}
            row={row}
            isSaving={savingCode === row.code}
            onSave={onSave}
            editable={allStatusCompleted}
            blockMessage={blockMessage}
          />
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
