import React, { useEffect, useMemo, useState } from "react";
import Button from "../ui/Button";
import { updateChecklistByCode } from "../api/checklist";
import EvidenceModalTrigger from "./EvidenceModalTrigger";
import TopProgressBar from "./TopProgressBar";
import { parseEvidenceUrls } from "../utils/evidence";

const PAGE_SIZE = 5;

const TYPE_ALL = "전체";
const TYPE_ISMS = "ISMS";
const TYPE_ISO = "ISO27001";

function safeStr(v) {
  return v == null ? "" : String(v);
}

function normalizeType(v) {
  const s = safeStr(v).trim();
  if (!s) return "";
  const u = s.toUpperCase();
  if (u.includes("ISO")) return TYPE_ISO;
  if (u.includes("ISMS")) return TYPE_ISMS;
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

function isVulnIdentified(row) {
  const r = safeStr(row?.result ?? row?.vulnResult).trim();
  return r === "양호" || r === "취약";
}

function isRiskEvaluated(row) {
  const l = safeStr(row?.likelihood).trim();
  const i = safeStr(row?.impact).trim();
  return l !== "" && i !== "";
}

function isVulnerable(row) {
  return safeStr(row?.result ?? row?.vulnResult).trim() === "취약";
}

function getRiskBlockMessage(totalCount, doneCount) {
  return "취약 식별 단계 전체 완료 후 위험도 산정을 수정할 수 있습니다.";
}

// 회사 정책 Risk Matrix
function riskNumber(l, i) {
  const map = {
    "3-1": 6,
    "3-2": 3,
    "3-3": 1,
    "2-1": 8,
    "2-2": 5,
    "2-3": 2,
    "1-1": 9,
    "1-2": 7,
    "1-3": 4,
  };
  return map[`${l}-${i}`] ?? null;
}

function riskLabelFromNumber(n) {
  if (n == null) return "Risk -";
  if (n <= 3) return `Risk ${n} · High`;
  if (n <= 6) return `Risk ${n} · Medium`;
  return `Risk ${n} · Low`;
}

function badgeClassFromRisk(n) {
  if (n == null) return "bg-slate-50 text-slate-600 border-slate-200";
  if (n <= 3) return "bg-rose-50 text-rose-700 border-rose-200";
  if (n <= 6) return "bg-amber-50 text-amber-800 border-amber-200";
  return "bg-blue-50 text-blue-700 border-blue-200";
}

const L_LABEL = { 1: "Unlikely", 2: "Likely", 3: "Highly Likely" };
const I_LABEL = { 1: "Low", 2: "Medium", 3: "High" };

function EvidencePreviewInline({ urls = [] }) {
  if (!urls.length) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {urls.map((u, idx) => (
        <EvidenceModalTrigger
          key={`${u}-${idx}`}
          url={u}
          imageClassName="h-12 w-12 rounded-lg border border-slate-200 object-cover hover:opacity-90"
          linkClassName="text-sm text-blue-600 underline"
          fit="contain"
        />
      ))}
    </div>
  );
}

function RiskCard({ row, draft, onChangeDraft, onSave, saving, editable, blockMessage }) {
  const code = safeStr(row.code);
  const type = normalizeType(row.type);
  const area = safeStr(row.area);
  const domain = safeStr(row.domain);
  const title = safeStr(row.itemCode ?? row.itemcode);

  const guideText = safeStr(row.guide ?? row.Guide).trim();
  const statusText = safeStr(row.status ?? row.current_status ?? row.state).trim();
  const reasonText = safeStr(row.reason ?? row.result_detail).trim();
  const evidenceUrls = parseEvidenceUrls(row.evidence_url);

  const l = draft.likelihood === "" ? null : Number(draft.likelihood);
  const i = draft.impact === "" ? null : Number(draft.impact);
  const rn = l && i ? riskNumber(l, i) : null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 text-sm text-slate-800">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm text-slate-500 whitespace-pre-wrap">
            {type} · {area} · {domain}
          </div>

          <div className="mt-1 text-sm font-semibold text-slate-900 whitespace-pre-wrap">
            [{code}] {title}
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2">
          <span
            className={[
              "px-3 py-1 rounded-full border text-sm font-semibold",
              badgeClassFromRisk(rn),
            ].join(" ")}
          >
            {riskLabelFromNumber(rn)}
          </span>
        </div>
      </div>

      {guideText ? (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2">
          <div className="mb-1 flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-sm border border-sky-400 bg-sky-300" />
            <span className="text-sm font-semibold text-sky-800">가이드</span>
          </div>
          <div className="text-sm text-sky-800 whitespace-pre-wrap break-words">{guideText}</div>
        </div>
      ) : null}

      {statusText ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="mb-1 flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-sm border border-slate-400 bg-slate-300" />
            <span className="text-sm font-semibold text-slate-900">현황</span>
          </div>
          <div className="mt-1 text-sm text-slate-800 whitespace-pre-wrap break-words">
            {statusText}
          </div>

          {evidenceUrls.length ? (
            <div className="mt-2">
              <EvidencePreviewInline urls={evidenceUrls} />
            </div>
          ) : null}
        </div>
      ) : evidenceUrls.length ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
          <div className="mb-1 flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-sm border border-slate-400 bg-slate-300" />
            <span className="text-sm font-semibold text-slate-900">증적</span>
          </div>
          <div className="mt-2">
            <EvidencePreviewInline urls={evidenceUrls} />
          </div>
        </div>
      ) : null}

      {reasonText ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2">
          <div className="mb-1 flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-sm border border-rose-400 bg-rose-300" />
            <span className="text-sm font-semibold text-rose-700">사유</span>
          </div>
          <div className="mt-1 text-sm text-rose-700 whitespace-pre-wrap break-words">
            {reasonText}
          </div>
        </div>
      ) : null}

      <div className="flex items-end gap-4 flex-wrap">
        <div className="min-w-[240px]">
          <div className="text-sm font-semibold text-slate-900 mb-2">Likelihood</div>
          <select
            value={draft.likelihood}
            onChange={(e) => onChangeDraft(code, { likelihood: e.target.value })}
            disabled={!editable || saving}
            className={[
              "w-full rounded-xl border px-3 py-2 text-sm outline-none",
              editable
                ? "border-slate-200 bg-white focus:ring-2 focus:ring-slate-200"
                : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed",
            ].join(" ")}
          >
            <option value="">선택</option>
            <option value="1">{L_LABEL[1]}</option>
            <option value="2">{L_LABEL[2]}</option>
            <option value="3">{L_LABEL[3]}</option>
          </select>
        </div>

        <div className="min-w-[240px]">
          <div className="text-sm font-semibold text-slate-900 mb-2">Impact</div>
          <select
            value={draft.impact}
            onChange={(e) => onChangeDraft(code, { impact: e.target.value })}
            disabled={!editable || saving}
            className={[
              "w-full rounded-xl border px-3 py-2 text-sm outline-none",
              editable
                ? "border-slate-200 bg-white focus:ring-2 focus:ring-slate-200"
                : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed",
            ].join(" ")}
          >
            <option value="">선택</option>
            <option value="1">{I_LABEL[1]}</option>
            <option value="2">{I_LABEL[2]}</option>
            <option value="3">{I_LABEL[3]}</option>
          </select>
        </div>

        <div className="flex items-center gap-3 ml-auto">
          {editable ? <div className="text-sm text-slate-500">* 두 값 모두 선택 후 저장하세요.</div> : null}

          <Button
            onClick={() => onSave(row, draft)}
            disabled={!editable || saving || draft.likelihood === "" || draft.impact === ""}
          >
            {saving ? "처리 중..." : "저장"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function RiskEvaluatePanel({ checklistItems = [], onUpdated }) {
  const rows = useMemo(
    () => (Array.isArray(checklistItems) ? checklistItems : []),
    [checklistItems]
  );

  const [draftByCode, setDraftByCode] = useState({});
  useEffect(() => {
    setDraftByCode({});
  }, [rows]);

  const [typeFilter, setTypeFilter] = useState(TYPE_ALL);
  const [areaFilter, setAreaFilter] = useState("전체");
  const [domainFilter, setDomainFilter] = useState("전체");
  const [statusFilter, setStatusFilter] = useState("전체");
  const [keyword, setKeyword] = useState("");

  const [page, setPage] = useState(1);
  const [savingCode, setSavingCode] = useState(null);

  const totalCount = useMemo(() => rows.length, [rows]);
  const riskTargetCount = useMemo(() => rows.filter(isVulnerable).length, [rows]);
  const riskDoneCount = useMemo(
    () => rows.filter((x) => isVulnerable(x) && isRiskEvaluated(x)).length,
    [rows]
  );

  const vulnDoneCount = useMemo(() => {
    return rows.filter(isVulnIdentified).length;
  }, [rows]);

  const allVulnCompleted = totalCount > 0 && totalCount === vulnDoneCount;
  const blockMessage = getRiskBlockMessage(totalCount, vulnDoneCount);

  const typeOptions = useMemo(() => {
    const types = buildOrderedUniqueOptions(rows, (x) => normalizeType(x.type));
    return [TYPE_ALL, ...types];
  }, [rows]);

  const areaOptions = useMemo(() => {
    const scoped = rows.filter((x) => {
      const t = normalizeType(x.type);

      if (typeFilter !== TYPE_ALL && t !== typeFilter) {
        return false;
      }

      return true;
    });

    return ["전체", ...buildOrderedUniqueOptions(scoped, (x) => x.area)];
  }, [rows, typeFilter]);

  const domainOptions = useMemo(() => {
    const scoped = rows.filter((x) => {
      const t = normalizeType(x.type);
      if (typeFilter !== TYPE_ALL && t !== typeFilter) return false;

      const a = safeStr(x.area).trim();
      if (areaFilter !== "전체" && a !== areaFilter) return false;

      return true;
    });

    return ["전체", ...buildOrderedUniqueOptions(scoped, (x) => x.domain)];
  }, [rows, typeFilter, areaFilter]);

  function getDraft(row) {
    const code = safeStr(row.code);
    const d = draftByCode[code];
    if (d) return d;

    const lRaw = row.likelihood ?? row.Likelihood ?? row.risk_likelihood ?? "";
    const iRaw = row.impact ?? row.Impact ?? row.risk_impact ?? "";

    return {
      likelihood: lRaw == null ? "" : safeStr(lRaw),
      impact: iRaw == null ? "" : safeStr(iRaw),
    };
  }

  function setDraft(code, patch) {
    const k = safeStr(code);
    setDraftByCode((prev) => ({
      ...prev,
      [k]: { ...(prev[k] || {}), ...patch },
    }));
  }

  const filtered = useMemo(() => {
    const kw = safeStr(keyword).trim().toLowerCase();

    return rows.filter((x) => {
      const t = normalizeType(x.type);
      if (typeFilter !== TYPE_ALL && t !== typeFilter) return false;

      const a = safeStr(x.area).trim();
      if (areaFilter !== "전체" && a !== areaFilter) return false;

      const d = safeStr(x.domain).trim();
      if (domainFilter !== "전체" && d !== domainFilter) return false;

      const l = x.likelihood == null ? "" : safeStr(x.likelihood).trim();
      const i = x.impact == null ? "" : safeStr(x.impact).trim();
      const hasRisk = l !== "" && i !== "";
      if (statusFilter === "입력됨" && !hasRisk) return false;
      if (statusFilter === "미입력" && hasRisk) return false;

      if (!kw) return true;

      const hay = [
        x.code,
        x.itemCode,
        x.itemcode,
        x.domain,
        x.area,
        x.type,
        x.status,
        x.reason,
        x.result_detail,
        x.evidence_url,
      ]
        .map((v) => safeStr(v).toLowerCase())
        .join(" | ");

      return hay.includes(kw);
    });
  }, [rows, typeFilter, areaFilter, domainFilter, statusFilter, keyword]);

  const totalPages = useMemo(() => {
    const n = Math.ceil(filtered.length / PAGE_SIZE);
    return n <= 0 ? 1 : n;
  }, [filtered.length]);

  useEffect(() => {
    setPage(1);
  }, [typeFilter, areaFilter, domainFilter, statusFilter, keyword]);

  useEffect(() => {
    setPage((p) => clamp(p, 1, totalPages));
  }, [totalPages]);

  const pageSafe = clamp(page, 1, totalPages);

  const paged = useMemo(() => {
    const start = (pageSafe - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, pageSafe]);

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

  async function handleSave(row, draft) {
    if (!allVulnCompleted) {
      alert(blockMessage);
      return;
    }

    const code = safeStr(row.code);
    const l = draft.likelihood === "" ? null : Number(draft.likelihood);
    const i = draft.impact === "" ? null : Number(draft.impact);

    if (!Number.isFinite(l) || !Number.isFinite(i) || !l || !i) {
      alert("Likelihood/Impact 두 값을 모두 선택하세요.");
      return;
    }

    try {
      setSavingCode(code);

      const payload = {
        likelihood: l,
        impact: i,
        risk: riskNumber(l, i),
      };

      await updateChecklistByCode(code, payload);

      setDraftByCode((prev) => ({
        ...prev,
        [code]: { likelihood: String(l), impact: String(i) },
      }));

      onUpdated?.();
    } catch (e) {
      alert("저장 실패: " + (e?.message || "unknown"));
    } finally {
      setSavingCode(null);
    }
  }

  return (
    <div className="panel-shell flex flex-col gap-4 w-full max-w-none">
      <div className="panel-sticky">
        {!allVulnCompleted ? (
          <div className="panel-banner mb-4 rounded-2xl border border-rose-200 bg-rose-50">
            <div className="panel-banner-title text-rose-700">단계 잠금</div>
            <div className="panel-banner-body text-rose-700">{blockMessage}</div>
          </div>
        ) : (
          <div className="panel-banner mb-4 rounded-2xl border border-emerald-200 bg-emerald-50">
            <div className="panel-banner-title text-emerald-700">단계 활성화</div>
            <div className="panel-banner-body text-emerald-700">
              취약 식별 단계가 전체 완료되어 위험도 산정 입력이 가능합니다.
            </div>
          </div>
        )}

        <div className="mb-4">
          <TopProgressBar
            title="위험도 산정 진행률"
            done={allVulnCompleted ? riskDoneCount : 0}
            total={riskTargetCount}
          />
        </div>

        <div className="panel-filter-card rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setAreaFilter("전체");
                setDomainFilter("전체");
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
                setDomainFilter("전체");
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
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
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            >
              {domainOptions.map((d) => (
                <option key={d} value={d}>
                  {d === "전체" ? "도메인(전체)" : d}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            >
              <option value="전체">Risk(전체)</option>
              <option value="입력됨">Risk(입력됨)</option>
              <option value="미입력">Risk(미입력)</option>
            </select>

            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="min-w-[240px] flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              placeholder="검색(코드/항목/현황/사유/도메인/영역/증적)"
            />

            <div className="text-sm text-slate-600 ml-auto">
              표시 {filtered.length}건 · {pageSafe}/{totalPages} 페이지
            </div>
          </div>
        </div>

        <div className="mt-4 border-b border-slate-200" />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-1 pb-6 space-y-3">
        {paged.map((row) => {
          const code = safeStr(row.code);
          const draft = getDraft(row);

          return (
            <RiskCard
              key={code}
              row={row}
              draft={draft}
              onChangeDraft={(c, patch) => setDraft(c, patch)}
              onSave={handleSave}
              saving={savingCode === code}
              editable={allVulnCompleted}
              blockMessage={blockMessage}
            />
          );
        })}

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

              {totalPages > 10 && pageNumbers[0] > 1 ? (
                <>
                  <button
                    type="button"
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
                    type="button"
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
              총 {filtered.length}건 · 페이지당 {PAGE_SIZE}건 · {pageSafe}/{totalPages} 페이지
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
