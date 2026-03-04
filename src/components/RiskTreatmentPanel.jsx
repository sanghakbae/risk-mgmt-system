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

  if (s === "감소") return { text: "위험감소(감소)", cls: "bg-amber-50 text-amber-800 border-amber-200" };
  if (s === "회피") return { text: "위험회피(회피)", cls: "bg-rose-50 text-rose-700 border-rose-200" };
  if (s === "전가") return { text: "위험전가(전가)", cls: "bg-blue-50 text-blue-700 border-blue-200" };

  return { text: "위험유지(수용)", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
}

function TreatmentCard({ row, isSaving, onSave }) {

  const [strategy, setStrategy] = useState(safeStr(row.treatment_strategy) || "수용");
  const [acceptReason, setAcceptReason] = useState(safeStr(row.accept_reason));
  const [plan, setPlan] = useState(safeStr(row.treatment_plan));
  const [owner, setOwner] = useState(safeStr(row.treatment_owner));
  const [due, setDue] = useState(safeStr(row.treatment_due_date));
  const [status, setStatus] = useState(safeStr(row.treatment_status));

  const planRef = useRef(null);
  const acceptRef = useRef(null);

  function autoResize(el) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  useEffect(() => {
    autoResize(planRef.current);
  }, [plan]);

  useEffect(() => {
    autoResize(acceptRef.current);
  }, [acceptReason, strategy]);

  const baseRisk = useMemo(() => {
    const l = row.likelihood == null ? null : Number(row.likelihood);
    const i = row.impact == null ? null : Number(row.impact);
    if (!l || !i) return null;
    return riskNumber(l, i);
  }, [row.likelihood, row.impact]);

  async function handleSave() {
    await onSave(row.code, {
      treatment_strategy: strategy,
      accept_reason: strategy === "수용" ? (acceptReason === "" ? null : acceptReason) : null,
      treatment_plan: plan === "" ? null : plan,
      treatment_owner: owner === "" ? null : owner,
      treatment_due_date: due === "" ? null : due,
      treatment_status: status === "" ? null : status,
    });
  }

  const tb = treatmentBadge(strategy);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">

      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-slate-500">
            {normalizeType(row.type)} · {safeStr(row.domain)} · {safeStr(row.area)}
          </div>

          <div className="text-sm font-semibold text-slate-900">
            [{row.code}] {safeStr(row.itemCode)}
          </div>
        </div>

        <div className="flex items-center gap-2">
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
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
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
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
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
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <div className="text-xs font-semibold text-slate-700 mb-1">완료 기한</div>

          <input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
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
            onChange={(e) => {
              setPlan(e.target.value);
              autoResize(e.target);
            }}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm resize-none overflow-hidden"
          />
        </div>

        <div>
          <div className="text-xs font-semibold text-slate-700 mb-1">수용 사유</div>

          <textarea
            ref={acceptRef}
            value={acceptReason}
            rows={3}
            disabled={strategy !== "수용"}
            onChange={(e) => {
              setAcceptReason(e.target.value);
              autoResize(e.target);
            }}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm resize-none overflow-hidden"
          />
        </div>

      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          저장
        </Button>
      </div>

    </div>
  );
}

export default function RiskTreatmentPanel({ checklistItems = [], onUpdated }) {

  const [savingCode, setSavingCode] = useState(null);

  const targets = useMemo(() => {
    return checklistItems.filter((x) => safeStr(x.result) === "취약");
  }, [checklistItems]);

  async function onSave(code, payload) {
    try {
      setSavingCode(code);
      await updateChecklistByCode(code, payload);
      onUpdated?.();
    } finally {
      setSavingCode(null);
    }
  }

  return (
    <div className="space-y-4">

      <ProgressBar
        done={targets.filter((x) => safeStr(x.treatment_strategy)).length}
        total={targets.length}
      />

      {targets.map((row) => (
        <TreatmentCard
          key={row.code}
          row={row}
          isSaving={savingCode === row.code}
          onSave={onSave}
        />
      ))}

    </div>
  );
}