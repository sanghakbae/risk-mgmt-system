import React from "react";
import Select from "../ui/Select";
import { Field } from "../ui/Card";

export default function ResidualPanel({ selectedRisk, setRisks, readOnly }) {
  if (!selectedRisk) return <div className="text-sm text-slate-500">선택된 위험이 없습니다.</div>;

  const impact = selectedRisk.residualImpact ?? selectedRisk.impact ?? 1;
  const likelihood = selectedRisk.residualLikelihood ?? selectedRisk.likelihood ?? 1;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="text-sm font-semibold">잔여 위험 평가</div>
        <div className="text-sm text-slate-600 mt-1">v4.0 정책: 잔여 위험의 가능성/영향도는 처리 전략 기반으로 자동 산정됩니다.</div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="잔여 위험 상태">
            <Select
              value={selectedRisk.residualStatus ?? "Pending"}
              onChange={(v) => setRisks((prev) => prev.map((r) => (r.id === selectedRisk.id ? { ...r, residualStatus: v } : r)))}
              options={["Pending", "Reduced", "Accepted", "Not Reduced"].map((x) => ({ value: x, label: x }))}
            />
          </Field>
          <Field label="재평가 Impact (자동)">
            <Select
              value={String(impact)}
              onChange={() => {}}
              options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))}
              disabled={Boolean(readOnly)}
            />
          </Field>
          <Field label="재평가 Likelihood (자동)">
            <Select
              value={String(likelihood)}
              onChange={() => {}}
              options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))}
              disabled={Boolean(readOnly)}
            />
          </Field>
        </div>

        <div className="mt-4 text-xs text-slate-500">
          현재 잔여 점수: {selectedRisk.residualScore ?? "-"} / 등급: {selectedRisk.residualGrade ?? "-"}
        </div>
      </div>
    </div>
  );
}
