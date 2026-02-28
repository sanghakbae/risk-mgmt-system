import React from "react";
import Table from "../ui/Table";
import { Badge, Field } from "../ui/Card";
import Input from "../ui/Input";
import Select from "../ui/Select";

export default function AssessPanel({ assets, checklistItems, assessments, setAssessments, selectedAssessmentId, setSelectedAssessmentId, onChangeResult }) {
  return (
    <div className="space-y-4">
      <div className="text-sm text-slate-600">부적합/부분적합을 선택하면 다음 단계에서 “위험 시나리오 작성”을 강제하도록 설계합니다.</div>

      <Table
        columns={[
          { key: "id", header: "ID" },
          {
            key: "assetId",
            header: "자산",
            render: (r) => assets.find((a) => a.id === r.assetId)?.assetCode ?? assets.find((a) => a.id === r.assetId)?.id ?? "-",
          },
          {
            key: "checklistItemId",
            header: "항목",
            render: (r) => checklistItems.find((i) => i.id === r.checklistItemId)?.detailCode ?? checklistItems.find((i) => i.id === r.checklistItemId)?.id ?? "-",
          },
          {
            key: "result",
            header: "결과",
            render: (r) => {
              const v = r.result;
              const variant = v === "적합" ? "ok" : v === "부분적합" ? "warn" : "bad";
              return <Badge variant={variant}>{v}</Badge>;
            },
          },
          { key: "date", header: "일자" },
          {
            key: "riskGenerated",
            header: "위험생성",
            render: (r) => <span className="text-xs font-semibold rounded-full border px-2 py-0.5 bg-white">{r.riskGenerated ? "Y" : "N"}</span>,
          },
        ]}
        rows={assessments}
        onRowClick={(row) => setSelectedAssessmentId(row.id)}
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="text-sm font-semibold">선택한 점검 결과: {selectedAssessmentId}</div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="결과 변경">
            <Select
              value={assessments.find((a) => a.id === selectedAssessmentId)?.result ?? "적합"}
              onChange={(v) => onChangeResult(selectedAssessmentId, v)}
              options={["적합", "부분적합", "부적합"].map((x) => ({ value: x, label: x }))}
            />
          </Field>
          <Field label="증적(요약)">
            <Input
              value={assessments.find((a) => a.id === selectedAssessmentId)?.evidence ?? ""}
              onChange={(e) =>
                setAssessments((prev) =>
                  prev.map((a) => (a.id === selectedAssessmentId ? { ...a, evidence: e.target.value } : a))
                )
              }
              placeholder="예: 패치 이력 미존재"
            />
          </Field>
          <Field label="비고">
            <Input
              value={assessments.find((a) => a.id === selectedAssessmentId)?.notes ?? ""}
              onChange={(e) =>
                setAssessments((prev) =>
                  prev.map((a) => (a.id === selectedAssessmentId ? { ...a, notes: e.target.value } : a))
                )
              }
              placeholder="추가 코멘트"
            />
          </Field>
        </div>
      </div>
    </div>
  );
}
