import React from "react";
import Select from "../ui/Select";
import Input from "../ui/Input";
import { Field } from "../ui/Card";

export default function TreatmentPanel({ selectedRisk, setRisks }) {
  if (!selectedRisk) return <div className="text-sm text-slate-500">선택된 위험이 없습니다.</div>;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="text-sm font-semibold">위험 처리 결정</div>
        <div className="text-sm text-slate-600 mt-1">전략/담당/기한을 입력합니다.</div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="전략">
            <Select
              value={selectedRisk.treatment ?? "Mitigate"}
              onChange={(v) => setRisks((prev) => prev.map((r) => (r.id === selectedRisk.id ? { ...r, treatment: v } : r)))}
              options={["Mitigate", "Transfer", "Avoid", "Accept"].map((x) => ({ value: x, label: x }))}
            />
          </Field>
          <Field label="담당자">
            <Input
              value={selectedRisk.owner ?? ""}
              onChange={(e) => setRisks((prev) => prev.map((r) => (r.id === selectedRisk.id ? { ...r, owner: e.target.value } : r)))}
              placeholder="예: 홍길동"
            />
          </Field>
          <Field label="기한">
            <Input
              type="date"
              value={selectedRisk.dueDate ?? ""}
              onChange={(e) => setRisks((prev) => prev.map((r) => (r.id === selectedRisk.id ? { ...r, dueDate: e.target.value } : r)))}
            />
          </Field>
        </div>
      </div>
    </div>
  );
}
