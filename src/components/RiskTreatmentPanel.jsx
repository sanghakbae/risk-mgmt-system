// src/components/RiskTreatmentPanel.jsx
import React, { useMemo, useState, useRef, useEffect } from "react";
import Button from "../ui/Button";
import { updateChecklistByCode } from "../api/checklist";

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

function getTreatmentBlockMessage(totalCount, statusDoneCount, vulnDoneCount, riskDoneCount) {
  return `Treatment 단계는 위험도 산정이 완료되어야 수정할 수 있습니다. (Risk ${riskDoneCount}/${totalCount})`;
}

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

function riskLevel(n) {
  if (n == null) return "Unknown";
  if (n <= 3) return "High";
  if (n <= 6) return "Medium";
  return "Low";
}

function riskLabelFromNumber(n) {
  if (n == null) return "Risk -";
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

function progressBarClass(pct) {
  if (pct === 100) return "bg-emerald-500";
  if (pct < 50) return "bg-rose-500";
  return "bg-amber-500";
}

function ProgressBar({ done, total }) {
  const pct = total <= 0 ? 0 : Math.round((done / total) * 100);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between text-sm text-slate-700">
        <div className="font-semibold">처리 계획 작성 진행률</div>
        <div className="tabular-nums">
          {done}/{total} ({pct}%)
        </div>
      </div>

      <div className="mt-2 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full ${progressBarClass(pct)}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function treatmentBadge(strategy) {
  const s = safeStr(strategy).trim() || "수용";
  if (s === "감소") return { text: "감소", cls: "bg-amber-50 text-amber-800 border-amber-200" };
  if (s === "회피") return { text: "회피", cls: "bg-rose-50 text-rose-700 border-rose-200" };
  if (s === "전가") return { text: "전가", cls: "bg-blue-50 text-blue-700 border-blue-200" };
  return { text: "수용", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
}

function StrategyGuide() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">처리 전략 안내</div>
          <div className="text-xs text-slate-500">위험을 어떤 방식으로 처리할지 결정합니다.</div>
        </div>

        <div className="text-[11px] px-2 py-1 rounded-full border border-slate-200 bg-slate-50 text-slate-600">
          TIP
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <div className="text-sm font-semibold text-emerald-900">수용 (Accept)</div>
          <ul className="text-xs text-emerald-900 mt-1 space-y-1 list-disc pl-4">
            <li>위험을 현재 상태로 유지</li>
            <li>개선이 어렵거나 비용 대비 효과가 낮을 때</li>
            <li>수용 사유 기록 권장</li>
          </ul>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <div className="text-sm font-semibold text-amber-900">감소 (Mitigate)</div>
          <ul className="text-xs text-amber-900 mt-1 space-y-1 list-disc pl-4">
            <li>보안 통제로 위험 감소</li>
            <li>가장 일반적인 대응 전략</li>
            <li>예: 패치, 설정 변경, 접근통제</li>
          </ul>
        </div>

        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
          <div className="text-sm font-semibold text-rose-900">회피 (Avoid)</div>
          <ul className="text-xs text-rose-900 mt-1 space-y-1 list-disc pl-4">
            <li>위험이 발생하는 기능 제거</li>
            <li>High 위험 또는 규제 대응 시</li>
            <li>예: 기능 비활성화, 서비스 중단</li>
          </ul>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
          <div className="text-sm font-semibold text-blue-900">전가 (Transfer)</div>
          <ul className="text-xs text-blue-900 mt-1 space-y-1 list-disc pl-4">
            <li>위험을 제3자에게 이전</li>
            <li>책임은 계약으로 관리</li>
            <li>예: 외주 운영, 보안관제, 보험</li>
          </ul>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
        <div className="font-semibold mb-1">작성 팁</div>
        <div className="space-y-1">
          <div>• High(Risk 1~3) → 감소 또는 회피 우선 검토</div>
          <div>• 수용 선택 시 → 수용 사유 + 재평가 시점 기록</div>
          <div>• 전가 선택 시 → 계약/SLA 근거 기록</div>
        </div>
      </div>
    </div>
  );
}

function StatPill({ label, value, tone = "slate" }) {
  const toneMap = {
    slate: "bg-slate-50 border-slate-200 text-slate-700",
    rose: "bg-rose-50 border-rose-200 text-rose-800",
    amber: "bg-amber-50 border-amber-200 text-amber-900",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-900",
    blue: "bg-blue-50 border-blue-200 text-blue-900",
  };

  return (
    <div className={["px-3 py-2 rounded-xl border text-sm flex items-center gap-2", toneMap[tone]].join(" ")}>
      <span className="text-xs font-semibold opacity-80">{label}</span>
      <span className="font-bold tabular-nums">{value}</span>
    </div>
  );
}

function autoResize(el) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

function TreatmentCard({ row, isSaving, onSave, editable, blockMessage }) {
  const [strategy, setStrategy] = useState(safeStr(row.treatment_strategy) || "수용");
  const [acceptReason, setAcceptReason] = useState(safeStr(row.accept_reason));
  const [plan, setPlan] = useState(safeStr(row.treatment_plan));
  const [owner, setOwner] = useState(safeStr(row.treatment_owner));
  const [due, setDue] = useState(safeStr(row.treatment_due_date));
  const [status, setStatus] = useState(safeStr(row.treatment_status));

  const planRef = useRef(null);
  const acceptRef = useRef(null);

  useEffect(() => {
    setStrategy(safeStr(row.treatment_strategy) || "수용");
    setAcceptReason(safeStr(row.accept_reason));
    setPlan(safeStr(row.treatment_plan));
    setOwner(safeStr(row.treatment_owner));
    setDue(safeStr(row.treatment_due_date));
    setStatus(safeStr(row.treatment_status));
  }, [
    row.treatment_strategy,
    row.accept_reason,
    row.treatment_plan,
    row.treatment_owner,
    row.treatment_due_date,
    row.treatment_status,
  ]);

  useEffect(() => autoResize(planRef.current), [plan]);
  useEffect(() => autoResize(acceptRef.current), [acceptReason, strategy]);

  const baseRisk = useMemo(() => {
    const l = row.likelihood == null ? null : Number(row.likelihood);
    const i = row.impact == null ? null : Number(row.impact);
    if (!l || !i) return null;
    return riskNumber(l, i);
  }, [row.likelihood, row.impact]);

  const tb = treatmentBadge(strategy);

  async function handleSave() {
    if (!editable) {
      alert(blockMessage);
      return;
    }

    await onSave(row.code, {
      treatment_strategy: strategy,
      accept_reason: strategy === "수용" ? (acceptReason === "" ? null : acceptReason) : null,
      treatment_plan: plan === "" ? null : plan,
      treatment_owner: owner === "" ? null : owner,
      treatment_due_date: due === "" ? null : due,
      treatment_status: status === "" ? null : status,
    });
  }

  const metaLine = [normalizeType(row.type), safeStr(row.domain), safeStr(row.area)]
    .filter(Boolean)
    .join(" · ");
  const titleText = `[${row.code}] ${safeStr(row.itemCode)}`;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-slate-500 truncate">{metaLine}</div>
          <div className="text-sm font-semibold text-slate-900 mt-1 truncate">{titleText}</div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className={["px-3 py-1 rounded-full border text-xs font-semibold", badgeClassFromRisk(baseRisk)].join(" ")}>
            {riskLabelFromNumber(baseRisk)}
          </span>
          <span className={["px-3 py-1 rounded-full border text-xs font-semibold", tb.cls].join(" ")}>
            {tb.text}
          </span>
        </div>
      </div>

      {safeStr(row.reason || row.result_detail) ? (
        <div className="w-full rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 whitespace-pre-wrap">
          <div className="font-semibold mb-2">사유</div>
          {safeStr(row.reason || row.result_detail)}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <div className="text-xs font-semibold text-slate-700 mb-1">처리 전략</div>
          <select
            value={strategy}
            onChange={(e) => setStrategy(e.target.value)}
            disabled={!editable || isSaving}
            className={[
              "w-full rounded-xl border px-3 py-2 text-sm",
              editable
                ? "border-slate-200 bg-white"
                : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed",
            ].join(" ")}
          >
            <option value="수용">수용</option>
            <option value="감소">감소</option>
            <option value="회피">회피</option>
            <option value="전가">전가</option>
          </select>
        </div>

        <div>
          <div className="text-xs font-semibold text-slate-700 mb-1">처리 상태</div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            disabled={!editable || isSaving}
            className={[
              "w-full rounded-xl border px-3 py-2 text-sm",
              editable
                ? "border-slate-200 bg-white"
                : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed",
            ].join(" ")}
          >
            <option value="">선택</option>
            <option value="계획">계획</option>
            <option value="진행">진행</option>
            <option value="완료">완료</option>
            <option value="보류">보류</option>
          </select>
        </div>

        <div>
          <div className="text-xs font-semibold text-slate-700 mb-1">처리 담당</div>
          <input
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            disabled={!editable || isSaving}
            className={[
              "w-full rounded-xl border px-3 py-2 text-sm",
              editable
                ? "border-slate-200 bg-white"
                : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed",
            ].join(" ")}
            placeholder="예: 홍길동"
          />
        </div>

        <div>
          <div className="text-xs font-semibold text-slate-700 mb-1">완료 기한</div>
          <input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            disabled={!editable || isSaving}
            className={[
              "w-full rounded-xl border px-3 py-2 text-sm",
              editable
                ? "border-slate-200 bg-white"
                : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed",
            ].join(" ")}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div>
          <div className="text-xs font-semibold text-slate-700 mb-1">처리 계획</div>
          <textarea
            ref={planRef}
            value={plan}
            rows={3}
            disabled={!editable || isSaving}
            onChange={(e) => {
              setPlan(e.target.value);
              autoResize(e.target);
            }}
            className={[
              "w-full rounded-xl border px-3 py-2 text-sm resize-none overflow-hidden",
              editable
                ? "border-slate-200 bg-white"
                : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed",
            ].join(" ")}
            placeholder="예: 패치 적용, 접근 통제 강화, 모니터링 룰 추가..."
          />
        </div>

        <div>
          <div className="text-xs font-semibold text-slate-700 mb-1">
            수용 사유 <span className="text-slate-400">(수용 선택 시 필수)</span>
          </div>
          <textarea
            ref={acceptRef}
            value={acceptReason}
            rows={3}
            disabled={!editable || isSaving || strategy !== "수용"}
            onChange={(e) => {
              setAcceptReason(e.target.value);
              autoResize(e.target);
            }}
            className={[
              "w-full rounded-xl border px-3 py-2 text-sm resize-none overflow-hidden",
              !editable || strategy !== "수용"
                ? "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed"
                : "border-slate-200 bg-white",
            ].join(" ")}
            placeholder={
              !editable
                ? "선행 단계 전체 완료 후 입력 가능"
                : strategy !== "수용"
                  ? "수용 선택 시 입력 가능"
                  : "예: 운영상 즉시 개선 어려움, 대체 통제 적용, 재평가 일정..."
            }
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

function matchQuery(row, q) {
  if (!q) return true;
  const hay = [
    safeStr(row.code),
    safeStr(row.itemCode),
    safeStr(row.domain),
    safeStr(row.area),
    safeStr(row.reason || row.result_detail),
    safeStr(row.treatment_plan),
    safeStr(row.treatment_owner),
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q.toLowerCase());
}

export default function RiskTreatmentPanel({ checklistItems = [], onUpdated }) {
  const [savingCode, setSavingCode] = useState(null);

  const [q, setQ] = useState("");
  const [riskF, setRiskF] = useState("All");
  const [strategyF, setStrategyF] = useState("All");
  const [statusF, setStatusF] = useState("All");
  const [sortKey, setSortKey] = useState("risk_desc");

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

  const allPrerequisitesCompleted =
    totalCount > 0 &&
    totalCount === statusDoneCount &&
    totalCount === vulnDoneCount &&
    totalCount === riskDoneCount;

  const blockMessage = getTreatmentBlockMessage(
    totalCount,
    statusDoneCount,
    vulnDoneCount,
    riskDoneCount
  );

  const targetsRaw = useMemo(() => {
    return (checklistItems || []).filter((x) => safeStr(x.result) === "취약");
  }, [checklistItems]);

  const targets = useMemo(() => {
    return targetsRaw.map((row) => {
      const l = row.likelihood == null ? null : Number(row.likelihood);
      const i = row.impact == null ? null : Number(row.impact);
      const rn = l && i ? riskNumber(l, i) : null;
      return { ...row, _riskNumber: rn, _riskLevel: riskLevel(rn) };
    });
  }, [targetsRaw]);

  const doneCount = useMemo(() => {
    return targets.filter((x) => safeStr(x.treatment_strategy)).length;
  }, [targets]);

  const summary = useMemo(() => {
    const total = targets.length;
    const high = targets.filter((x) => x._riskLevel === "High").length;
    const med = targets.filter((x) => x._riskLevel === "Medium").length;
    const low = targets.filter((x) => x._riskLevel === "Low").length;

    const planned = targets.filter((x) => safeStr(x.treatment_status) === "계획").length;
    const doing = targets.filter((x) => safeStr(x.treatment_status) === "진행").length;
    const done = targets.filter((x) => safeStr(x.treatment_status) === "완료").length;
    const hold = targets.filter((x) => safeStr(x.treatment_status) === "보류").length;

    return { total, high, med, low, planned, doing, done, hold };
  }, [targets]);

  const filtered = useMemo(() => {
    let rows = [...targets];

    if (riskF !== "All") rows = rows.filter((r) => r._riskLevel === riskF);
    if (strategyF !== "All") rows = rows.filter((r) => safeStr(r.treatment_strategy || "수용") === strategyF);
    if (statusF !== "All") {
      if (statusF === "(미선택)") rows = rows.filter((r) => !safeStr(r.treatment_status));
      else rows = rows.filter((r) => safeStr(r.treatment_status) === statusF);
    }
    rows = rows.filter((r) => matchQuery(r, q));

    rows.sort((a, b) => {
      if (sortKey === "risk_desc") {
        const ar = a._riskNumber ?? 999;
        const br = b._riskNumber ?? 999;
        return ar - br;
      }
      if (sortKey === "due_asc") return safeStr(a.treatment_due_date).localeCompare(safeStr(b.treatment_due_date));
      if (sortKey === "due_desc") return safeStr(b.treatment_due_date).localeCompare(safeStr(a.treatment_due_date));
      if (sortKey === "code_asc") return safeStr(a.code).localeCompare(safeStr(b.code));
      return 0;
    });

    return rows;
  }, [targets, riskF, strategyF, statusF, q, sortKey]);

  async function onSave(code, payload) {
    try {
      if (!allPrerequisitesCompleted) {
        alert(blockMessage);
        return;
      }

      setSavingCode(code);
      await updateChecklistByCode(code, payload);
      onUpdated?.();
    } finally {
      setSavingCode(null);
    }
  }

  return (
    <div className="h-[calc(100vh-160px)] flex flex-col gap-4 w-full max-w-none">
      <div className={["sticky top-0 z-10", "-mx-6 px-6", "bg-slate-50/95 backdrop-blur", "pt-1"].join(" ")}>
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
                Status / 취약 식별 / 위험도 산정 단계가 전체 완료되어 위험 대응/조치 입력이 가능합니다.
              </div>
            </div>
          )}

          <ProgressBar done={doneCount} total={targets.length} />

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="text-sm font-semibold text-slate-900">취약 항목 Treatment 작업대</div>
                <div className="text-xs text-slate-500 mt-1">
                  필터/검색으로 우선순위를 정리하고, 처리 계획/담당/기한/상태를 기록하세요.
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <StatPill label="TOTAL" value={summary.total} tone="slate" />
                <StatPill label="HIGH" value={summary.high} tone="rose" />
                <StatPill label="MED" value={summary.med} tone="amber" />
                <StatPill label="LOW" value={summary.low} tone="blue" />
                <StatPill label="DONE" value={doneCount} tone="emerald" />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-3">
              <div className="lg:col-span-4">
                <div className="text-xs font-semibold text-slate-700 mb-1">검색</div>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="코드/도메인/항목명/사유/담당/계획 검색"
                />
              </div>

              <div className="lg:col-span-2">
                <div className="text-xs font-semibold text-slate-700 mb-1">Risk</div>
                <select
                  value={riskF}
                  onChange={(e) => setRiskF(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
                >
                  <option value="All">All</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>

              <div className="lg:col-span-2">
                <div className="text-xs font-semibold text-slate-700 mb-1">전략</div>
                <select
                  value={strategyF}
                  onChange={(e) => setStrategyF(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
                >
                  <option value="All">All</option>
                  <option value="수용">수용</option>
                  <option value="감소">감소</option>
                  <option value="회피">회피</option>
                  <option value="전가">전가</option>
                </select>
              </div>

              <div className="lg:col-span-2">
                <div className="text-xs font-semibold text-slate-700 mb-1">상태</div>
                <select
                  value={statusF}
                  onChange={(e) => setStatusF(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
                >
                  <option value="All">All</option>
                  <option value="(미선택)">(미선택)</option>
                  <option value="계획">계획</option>
                  <option value="진행">진행</option>
                  <option value="완료">완료</option>
                  <option value="보류">보류</option>
                </select>
              </div>

              <div className="lg:col-span-2">
                <div className="text-xs font-semibold text-slate-700 mb-1">정렬</div>
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
                >
                  <option value="risk_desc">Risk 우선(High 먼저)</option>
                  <option value="due_asc">기한 임박(오름차순)</option>
                  <option value="due_desc">기한 먼 것(내림차순)</option>
                  <option value="code_asc">코드순</option>
                </select>
              </div>
            </div>

            <div className="mt-3 text-xs text-slate-500">
              표시 중: <span className="font-semibold text-slate-700">{filtered.length}</span> / {targets.length}
            </div>
          </div>

          <StrategyGuide />
        </div>

        <div className="mt-4 border-b border-slate-200" />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-1 pb-6 space-y-4">
        {filtered.map((row) => (
          <TreatmentCard
            key={row.code}
            row={row}
            isSaving={savingCode === row.code}
            onSave={onSave}
            editable={allPrerequisitesCompleted}
            blockMessage={blockMessage}
          />
        ))}

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            조건에 맞는 항목이 없습니다. (필터/검색 조건을 조정해보세요)
          </div>
        ) : null}
      </div>
    </div>
  );
}