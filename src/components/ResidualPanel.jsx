// src/components/ResidualPanel.jsx
import React, { useMemo, useState, useEffect } from "react";
import Button from "../ui/Button";
import { updateChecklistByCode } from "../api/checklist";

const PAGE_SIZE = 20;

const TYPE_ALL = "전체";
const TYPE_ISMS = "ISMS";
const TYPE_ISO = "ISO27001";

function normalizeType(v) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  if (s.toUpperCase().includes("ISO")) return TYPE_ISO;
  if (s.toUpperCase().includes("ISMS")) return TYPE_ISMS;
  return s;
}

function safeStr(v) {
  return v == null ? "" : String(v);
}

function hasStatusCompleted(row) {
  return safeStr(row?.status ?? row?.current_status ?? row?.state).trim() !== "";
}

function hasVulnCompleted(row) {
  const r = safeStr(row?.result ?? row?.vulnResult).trim();
  return r === "양호" || r === "취약";
}

function hasRiskEvaluation(row) {
  const l = safeStr(row?.likelihood).trim();
  const i = safeStr(row?.impact).trim();
  return l !== "" && i !== "";
}

function hasTreatmentCompleted(row) {
  const strategy = safeStr(row?.treatment_strategy).trim();
  const status = safeStr(row?.treatment_status).trim();
  const plan = safeStr(row?.treatment_plan).trim();
  const owner = safeStr(row?.treatment_owner).trim();
  const due = safeStr(row?.treatment_due_date).trim();
  const acceptReason = safeStr(row?.accept_reason).trim();

  if (!strategy || !status || !plan || !owner || !due) return false;
  if (strategy === "수용" && !acceptReason) return false;

  return true;
}

function getResidualBlockMessage(totalCount, statusDoneCount, vulnDoneCount, riskDoneCount, treatmentDoneCount) {
  return `잔여 위험 재평가는 위험 대응·조치가 완료되어야 수행할 수 있습니다. (Treatment ${treatmentDoneCount}/${totalCount})`;
}

// UI 표기(문자열) ↔ DB 저장값(숫자) 매핑
const L_LABEL = { 1: "Unlikely", 2: "Likely", 3: "Highly Likely" };
const I_LABEL = { 1: "Low", 2: "Medium", 3: "High" };

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
  if (n == null) return "-";
  if (n <= 3) return `Risk ${n} · High`;
  if (n <= 6) return `Risk ${n} · Medium`;
  return `Risk ${n} · Low`;
}

function badgeClassFromRisk(n) {
  if (n == null) return "bg-slate-100 text-slate-700 border-slate-200";
  if (n <= 3) return "bg-rose-50 text-rose-700 border-rose-200";
  if (n <= 6) return "bg-amber-50 text-amber-800 border-amber-200";
  return "bg-blue-50 text-blue-700 border-blue-200";
}

function ProgressBar({ done, total, highRisk, mediumRisk, lowRisk }) {
  const ratio = total <= 0 ? 0 : done / total;
  const pct = Math.round(ratio * 100);

  const barClass = pct === 100 ? "bg-emerald-500" : pct < 50 ? "bg-rose-500" : "bg-amber-500";

  const chipBase = "rounded-lg border px-2.5 py-1";
  const chipLabel = "text-[11px] font-semibold";
  const chipValue = "text-xs font-semibold tabular-nums";

  return (
    <div className="w-full rounded-2xl border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between text-xs text-slate-700">
        <div className="text-sm font-bold text-slate-900">잔여 위험 평가 진행률</div>
        <div className="tabular-nums">
          {done}/{total} ({pct}%)
        </div>
      </div>

      <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full ${barClass}`} style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-2 grid w-full grid-cols-5 gap-1.5">
        <div className={`${chipBase} border-slate-200 bg-white text-slate-700 text-center min-w-0`}>
          <span className={chipLabel}>Total</span>
          <span className={`ml-1 ${chipValue}`}>{total}</span>
        </div>
        <div className={`${chipBase} border-emerald-200 bg-emerald-50 text-emerald-800 text-center min-w-0`}>
          <span className={chipLabel}>Done</span>
          <span className={`ml-1 ${chipValue}`}>{done}</span>
        </div>
        <div className={`${chipBase} border-rose-200 bg-rose-50 text-rose-800 text-center min-w-0`}>
          <span className={chipLabel}>High</span>
          <span className={`ml-1 ${chipValue}`}>{highRisk}</span>
        </div>
        <div className={`${chipBase} border-amber-200 bg-amber-50 text-amber-800 text-center min-w-0`}>
          <span className={chipLabel}>Med</span>
          <span className={`ml-1 ${chipValue}`}>{mediumRisk}</span>
        </div>
        <div className={`${chipBase} border-blue-200 bg-blue-50 text-blue-800 text-center min-w-0`}>
          <span className={chipLabel}>Low</span>
          <span className={`ml-1 ${chipValue}`}>{lowRisk}</span>
        </div>
      </div>
    </div>
  );
}

function RiskMatrixMini() {
  const cells = [
    [{ l: 3, i: 1 }, { l: 3, i: 2 }, { l: 3, i: 3 }],
    [{ l: 2, i: 1 }, { l: 2, i: 2 }, { l: 2, i: 3 }],
    [{ l: 1, i: 1 }, { l: 1, i: 2 }, { l: 1, i: 3 }],
  ];

  function cellBg(n) {
    if (n <= 3) return "bg-rose-100";
    if (n <= 6) return "bg-amber-100";
    return "bg-blue-100";
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-sm font-bold text-slate-900 mb-3">정성적 위험분석 행렬</div>

      <div className="grid grid-cols-[132px_1fr] gap-3">
        <div />
        <div className="grid grid-cols-3 text-xs font-semibold text-slate-700">
          <div className="text-center">Low</div>
          <div className="text-center">Medium</div>
          <div className="text-center">High</div>
        </div>

        <div className="space-y-2 text-xs font-semibold text-slate-700">
          <div className="h-10 flex items-center justify-end pr-2">Highly Likely</div>
          <div className="h-10 flex items-center justify-end pr-2">Likely</div>
          <div className="h-10 flex items-center justify-end pr-2">Unlikely</div>
        </div>

        <div className="grid grid-rows-3 gap-2">
          {cells.map((row, rIdx) => (
            <div key={rIdx} className="grid grid-cols-3 gap-2">
              {row.map((c, cIdx) => {
                const n = riskNumber(c.l, c.i);
                return (
                  <div
                    key={`${rIdx}-${cIdx}`}
                    className={[
                      "h-10 rounded-xl border border-slate-200 flex items-center justify-center",
                      cellBg(n),
                    ].join(" ")}
                  >
                    <div className="text-center">
                      <div className="text-sm font-bold text-slate-900 tabular-nums">{n}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 text-right text-xs text-slate-500">* Likelihood/Impact는 DB에 1~3 정수로 저장됩니다.</div>
    </div>
  );
}

function HighResidualPriority({ rows }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-bold text-slate-900">잔여 High 우선 확인</div>
        <div className="text-xs text-rose-700">{rows.length}건</div>
      </div>

      {rows.length === 0 ? (
        <div className="mt-2 text-xs text-rose-700">현재 잔여 High 항목이 없습니다.</div>
      ) : (
        <div className="mt-2 space-y-1.5">
          {rows.map((x) => (
            <div key={x.code} className="rounded-lg border border-rose-200 bg-white px-2.5 py-2">
              <div className="text-xs font-semibold text-slate-900">
                [{x.code}] {x.itemCode}
              </div>
              <div className="mt-1 text-[11px] text-slate-600">
                담당: {x.owner || "-"} · 기한: {x.due || "-"} · 잔여 Risk: {x.risk}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ResidualCard({ row, isSaving, onSave, editable, blockMessage }) {
  const baseRisk = useMemo(() => {
    const lRaw = row.likelihood ?? row.Likelihood ?? row.risk_likelihood ?? null;
    const iRaw = row.impact ?? row.Impact ?? row.risk_impact ?? null;

    const l = lRaw == null || lRaw === "" ? null : Number(lRaw);
    const i = iRaw == null || iRaw === "" ? null : Number(iRaw);

    if (!Number.isFinite(l) || !Number.isFinite(i)) return null;
    return riskNumber(l, i);
  }, [row]);

  const [resL, setResL] = useState(row.residual_likelihood ?? "");
  const [resI, setResI] = useState(row.residual_impact ?? "");
  const [detail, setDetail] = useState(safeStr(row.residual_detail));

  useEffect(() => {
    setResL(row.residual_likelihood ?? "");
    setResI(row.residual_impact ?? "");
    setDetail(safeStr(row.residual_detail));
  }, [row.residual_likelihood, row.residual_impact, row.residual_detail]);

  const residualRisk = useMemo(() => {
    const l = resL === "" ? null : Number(resL);
    const i = resI === "" ? null : Number(resI);
    if (!Number.isFinite(l) || !Number.isFinite(i)) return null;
    return riskNumber(l, i);
  }, [resL, resI]);

  async function handleSave() {
    if (!editable) {
      alert(blockMessage);
      return;
    }

    const payload = {
      residual_likelihood: resL === "" ? null : Number(resL),
      residual_impact: resI === "" ? null : Number(resI),
      residual_detail: detail === "" ? null : detail,
    };
    await onSave(row.code, payload);
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-slate-500">
            {normalizeType(row.type)} · {row.domain} · {row.area}
          </div>
          <div className="text-sm font-semibold text-slate-900 whitespace-pre-wrap">
            [{row.code}] {row.itemCode}
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2">
          <span
            className={[
              "px-3 py-1 rounded-full border text-xs font-semibold",
              badgeClassFromRisk(baseRisk),
            ].join(" ")}
          >
            기준 {riskLabelFromNumber(baseRisk)}
          </span>

          <span
            className={[
              "px-3 py-1 rounded-full border text-xs font-semibold",
              badgeClassFromRisk(residualRisk),
            ].join(" ")}
          >
            잔여 {riskLabelFromNumber(residualRisk)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[160px_1fr] gap-4 items-stretch">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex flex-col gap-3 h-full min-h-[120px]">
          <div>
            <div className="text-xs font-semibold text-slate-700 mb-1">Residual Likelihood</div>
            <select
              value={resL}
              onChange={(e) => setResL(e.target.value)}
              disabled={!editable || isSaving}
              className={[
                "w-full rounded-xl border px-3 py-2 text-sm text-center outline-none",
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

          <div>
            <div className="text-xs font-semibold text-slate-700 mb-1">Residual Impact</div>
            <select
              value={resI}
              onChange={(e) => setResI(e.target.value)}
              disabled={!editable || isSaving}
              className={[
                "w-full rounded-xl border px-3 py-2 text-sm text-center outline-none",
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
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3 flex flex-col h-full min-h-[120px]">
          <div className="text-sm font-bold text-slate-800 text-left">잔여 위험 상세 설명</div>
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            disabled={!editable || isSaving}
            className={[
              "w-full flex-1 min-h-[80px] rounded-xl border px-3 py-2 text-sm outline-none",
              editable
                ? "border-slate-200 bg-white focus:ring-2 focus:ring-slate-200"
                : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed",
            ].join(" ")}
            placeholder={!editable ? "선행 단계 전체 완료 후 입력 가능" : "조치 후 남는 위험에 대한 설명을 입력하세요"}
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        {isSaving ? <div className="text-xs text-slate-500">저장 중...</div> : null}
        <Button onClick={handleSave} disabled={!editable || isSaving}>
          저장
        </Button>
      </div>
    </div>
  );
}

export default function ResidualPanel({ checklistItems = [], onUpdated }) {
  const [typeFilter, setTypeFilter] = useState(TYPE_ALL);
  const [domainFilter, setDomainFilter] = useState("");
  const [onlyMitigate, setOnlyMitigate] = useState(false);
  const [page, setPage] = useState(1);
  const [savingCode, setSavingCode] = useState(null);

  const totalCount = useMemo(() => (checklistItems || []).length, [checklistItems]);

  const statusDoneCount = useMemo(() => {
    return (checklistItems || []).filter(hasStatusCompleted).length;
  }, [checklistItems]);

  const vulnDoneCount = useMemo(() => {
    return (checklistItems || []).filter(hasVulnCompleted).length;
  }, [checklistItems]);

  const riskDoneCount = useMemo(() => {
    return (checklistItems || []).filter(hasRiskEvaluation).length;
  }, [checklistItems]);

  const treatmentDoneCount = useMemo(() => {
    return (checklistItems || []).filter(hasTreatmentCompleted).length;
  }, [checklistItems]);

  const allPrerequisitesCompleted =
    totalCount > 0 &&
    totalCount === statusDoneCount &&
    totalCount === vulnDoneCount &&
    totalCount === riskDoneCount &&
    totalCount === treatmentDoneCount;

  const blockMessage = getResidualBlockMessage(
    totalCount,
    statusDoneCount,
    vulnDoneCount,
    riskDoneCount,
    treatmentDoneCount
  );

  const typeOptions = useMemo(() => [TYPE_ALL, TYPE_ISMS, TYPE_ISO], []);

  const domainOptions = useMemo(() => {
    const set = new Set();
    for (const x of checklistItems) {
      const t = normalizeType(x.type);
      if (typeFilter !== TYPE_ALL && t !== typeFilter) continue;
      const d = safeStr(x.domain).trim();
      if (d) set.add(d);
    }
    return Array.from(set);
  }, [checklistItems, typeFilter]);

  const targets = useMemo(() => {
    return (checklistItems || []).filter((x) => {
      if (safeStr(x.result).trim() !== "취약") return false;
      if (onlyMitigate && safeStr(x.treatment_strategy).trim() !== "감소") return false;

      const t = normalizeType(x.type);
      if (typeFilter !== TYPE_ALL && t !== typeFilter) return false;
      if (domainFilter && safeStr(x.domain).trim() !== domainFilter) return false;
      return true;
    });
  }, [checklistItems, onlyMitigate, typeFilter, domainFilter]);

  const doneCount = useMemo(() => {
    return targets.filter((x) => x.residual_likelihood != null && x.residual_impact != null).length;
  }, [targets]);

  const dist = useMemo(() => {
    let high = 0;
    let med = 0;
    let low = 0;

    for (const x of targets) {
      const l = x.residual_likelihood == null ? null : Number(x.residual_likelihood);
      const i = x.residual_impact == null ? null : Number(x.residual_impact);
      if (!l || !i) continue;

      const n = riskNumber(l, i);
      if (n == null) continue;

      if (n <= 3) high += 1;
      else if (n <= 6) med += 1;
      else low += 1;
    }

    return { high, med, low };
  }, [targets]);

  const highPriorityRows = useMemo(() => {
    return targets
      .map((x) => {
        const l = x.residual_likelihood == null ? null : Number(x.residual_likelihood);
        const i = x.residual_impact == null ? null : Number(x.residual_impact);
        const n = l && i ? riskNumber(l, i) : null;
        return {
          code: safeStr(x.code),
          itemCode: safeStr(x.itemCode ?? x.itemcode),
          owner: safeStr(x.treatment_owner),
          due: safeStr(x.treatment_due_date),
          risk: n,
        };
      })
      .filter((x) => x.risk != null && x.risk <= 3)
      .sort((a, b) => a.risk - b.risk || a.code.localeCompare(b.code))
      .slice(0, 5);
  }, [targets]);

  const totalPages = Math.max(1, Math.ceil(targets.length / PAGE_SIZE));
  const pageSafe = Math.min(Math.max(1, page), totalPages);

  const paged = useMemo(() => {
    const start = (pageSafe - 1) * PAGE_SIZE;
    return targets.slice(start, start + PAGE_SIZE);
  }, [targets, pageSafe]);

  async function onSave(code, payload) {
    try {
      if (!allPrerequisitesCompleted) {
        alert(blockMessage);
        return;
      }

      setSavingCode(code);
      await updateChecklistByCode(code, payload);
      onUpdated?.();
    } catch (e) {
      alert("저장 실패: " + e.message);
    } finally {
      setSavingCode(null);
    }
  }

  function onChangeType(v) {
    setTypeFilter(v);
    setDomainFilter("");
    setPage(1);
  }

  function onChangeDomain(v) {
    setDomainFilter(v);
    setPage(1);
  }

  function onToggleOnlyMitigate() {
    setOnlyMitigate((p) => !p);
    setPage(1);
  }

  return (
    <div className="panel-shell flex flex-col gap-4 w-full max-w-none">
      <div className="panel-sticky">
        <div className="panel-header-stack">
          {!allPrerequisitesCompleted ? (
            <div className="panel-banner rounded-2xl border border-rose-200 bg-rose-50">
              <div className="panel-banner-title text-rose-700">단계 잠금</div>
              <div className="panel-banner-body text-rose-700">{blockMessage}</div>
            </div>
          ) : (
            <div className="panel-banner rounded-2xl border border-emerald-200 bg-emerald-50">
              <div className="panel-banner-title text-emerald-700">단계 활성화</div>
              <div className="panel-banner-body text-emerald-700">
                Status / 취약 식별 / 위험도 산정 / 위험 대응·조치 단계가 전체 완료되어 잔여 위험 재평가 입력이 가능합니다.
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <ProgressBar
              done={doneCount}
              total={targets.length}
              highRisk={dist.high}
              mediumRisk={dist.med}
              lowRisk={dist.low}
            />
            <HighResidualPriority rows={highPriorityRows} />
            <RiskMatrixMini />
          </div>

          <div className="panel-filter-card rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={typeFilter}
                onChange={(e) => onChangeType(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-center outline-none focus:ring-2 focus:ring-slate-200 w-[180px]"
              >
                {typeOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              {typeFilter !== TYPE_ALL ? (
                <select
                  value={domainFilter}
                  onChange={(e) => onChangeDomain(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-center outline-none focus:ring-2 focus:ring-slate-200 w-[220px]"
                >
                  <option value="">분야(전체)</option>
                  {domainOptions.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              ) : null}

              <button
                type="button"
                onClick={onToggleOnlyMitigate}
                className={[
                  "px-3 py-2 rounded-xl border text-sm font-semibold",
                  onlyMitigate
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
                ].join(" ")}
              >
                {onlyMitigate ? "감소만" : "전체 보기"}
              </button>

              <div className="text-sm text-slate-600 ml-auto">
                표시 {targets.length}건 · {pageSafe}/{totalPages} 페이지
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 border-b border-slate-200" />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-1 pb-6 space-y-4">
        {paged.map((row) => (
          <ResidualCard
            key={row.code}
            row={row}
            isSaving={savingCode === row.code}
            onSave={onSave}
            editable={allPrerequisitesCompleted}
            blockMessage={blockMessage}
          />
        ))}

        {paged.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">
            잔여 위험 평가 대상이 없습니다.
            <div className="mt-2 text-xs text-slate-400">
              (기본은 전체 보기입니다. 필요하면 '감소만'으로 좁혀서 확인하세요.)
            </div>
          </div>
        ) : null}

        {totalPages > 1 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
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
            </div>

            <div className="mt-2 text-center text-xs text-slate-500">
              총 {targets.length}건 · 페이지당 {PAGE_SIZE}건 · {pageSafe}/{totalPages} 페이지
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
