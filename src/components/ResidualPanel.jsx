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

  const statBoxBase = "rounded-xl border border-slate-200 bg-white px-3 py-2";
  const statTitle = "text-[11px] font-semibold text-slate-500";
  const statValue = "text-sm font-semibold text-slate-900 tabular-nums";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between text-sm text-slate-700">
        <div className="font-semibold">잔여 위험 평가 진행률</div>
        <div className="tabular-nums">
          {done}/{total} ({pct}%)
        </div>
      </div>

      <div className="mt-2 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full ${barClass}`} style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className={statBoxBase}>
          <div className={statTitle}>총 대상</div>
          <div className={statValue}>{total}</div>
        </div>
        <div className={statBoxBase}>
          <div className={statTitle}>완료</div>
          <div className={statValue}>{done}</div>
        </div>

        <div className={`${statBoxBase} bg-rose-50 border-rose-200`}>
          <div className="text-[11px] font-semibold text-rose-600">High</div>
          <div className="text-sm font-semibold text-rose-900 tabular-nums">{highRisk}</div>
        </div>

        <div className={`${statBoxBase} bg-amber-50 border-amber-200`}>
          <div className="text-[11px] font-semibold text-amber-700">Medium</div>
          <div className="text-sm font-semibold text-amber-900 tabular-nums">{mediumRisk}</div>
        </div>

        <div className={`${statBoxBase} bg-blue-50 border-blue-200 col-span-2`}>
          <div className="text-[11px] font-semibold text-blue-700">Low</div>
          <div className="text-sm font-semibold text-blue-900 tabular-nums">{lowRisk}</div>
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
      <div className="text-sm font-semibold text-slate-800 mb-3">정성적 위험분석 행렬 (Qualitative Risk Matrix)</div>

      <div className="grid grid-cols-[160px_1fr] gap-3">
        <div />
        <div className="grid grid-cols-3 text-xs font-semibold text-slate-700">
          <div className="text-center">Low</div>
          <div className="text-center">Medium</div>
          <div className="text-center">High</div>
        </div>

        <div className="space-y-2 text-xs font-semibold text-slate-700">
          <div className="h-12 flex items-center justify-end pr-2">Highly Likely</div>
          <div className="h-12 flex items-center justify-end pr-2">Likely</div>
          <div className="h-12 flex items-center justify-end pr-2">Unlikely</div>
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
                      "h-12 rounded-xl border border-slate-200 flex items-center justify-center",
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

      <div className="mt-3 text-xs text-slate-500">* Likelihood/Impact는 DB에는 1~3 정수로 저장됩니다.</div>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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

      <div className="space-y-1">
        <div className="text-xs font-semibold text-slate-700">잔여 위험 상세 설명</div>
        <textarea
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          disabled={!editable || isSaving}
          className={[
            "w-full min-h-[140px] rounded-xl border px-3 py-2 text-sm outline-none",
            editable
              ? "border-slate-200 bg-white focus:ring-2 focus:ring-slate-200"
              : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed",
          ].join(" ")}
          placeholder={!editable ? "선행 단계 전체 완료 후 입력 가능" : "조치 후 남는 위험에 대한 설명을 입력하세요"}
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500">{isSaving ? "저장 중..." : ""}</div>
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
  const [onlyMitigate, setOnlyMitigate] = useState(true);
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
    <div className="h-[calc(100vh-180px)] flex flex-col gap-4 w-full max-w-none">
      <div className="sticky top-0 z-10 -mx-6 px-6 bg-slate-50/95 backdrop-blur pt-1">
        <div className="space-y-4">
          {!allPrerequisitesCompleted ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
              <div className="text-sm font-semibold text-rose-700">단계 잠금</div>
              <div className="mt-1 text-sm text-rose-700">{blockMessage}</div>
            </div>
          ) : (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <div className="text-sm font-semibold text-emerald-700">단계 활성화</div>
              <div className="mt-1 text-sm text-emerald-700">
                Status / 취약 식별 / 위험도 산정 / 위험 대응·조치 단계가 전체 완료되어 잔여 위험 재평가 입력이 가능합니다.
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <ProgressBar
              done={doneCount}
              total={targets.length}
              highRisk={dist.high}
              mediumRisk={dist.med}
              lowRisk={dist.low}
            />
            <RiskMatrixMini />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
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
              (기본은 result='취약' + treatment_strategy='감소' 항목만 표시됩니다. 필요하면 '전체 보기'를 눌러 확인하세요.)
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