import React, { useMemo } from "react";
import Table from "../ui/Table";
import Card, { Badge, Field } from "../ui/Card";
import Input from "../ui/Input";
import Select from "../ui/Select";
import { score, gradeFromScore } from "../utils/scoring";

// v4.0 취약 식별
// - 부분적합/부적합 현황(assessment)을 대상으로 취약을 작성
// - 취약의 가능성/영향도는 v4.0 정책상 자동(읽기 전용)

function autoVulnIL(result, bound) {
  const clamp = (n) => Math.min(bound, Math.max(1, n));
  if (result === "부적합") return { likelihood: clamp(4), impact: clamp(4) };
  if (result === "부분적합") return { likelihood: clamp(3), impact: clamp(3) };
  return { likelihood: clamp(3), impact: clamp(3) };
}

export default function VulnIdentifyPanel({
  checklistItems,
  assessments,
  selectedAssessmentId,
  setSelectedAssessmentId,
  vulnerabilities,
  setVulnerabilities,
  matrix,
}) {
  const rows = useMemo(
    () => assessments.filter((a) => a.result === "부분적합" || a.result === "부적합"),
    [assessments]
  );

  const selected = useMemo(
    () => rows.find((a) => a.id === selectedAssessmentId) ?? rows[0] ?? null,
    [rows, selectedAssessmentId]
  );

  const item = useMemo(() => {
    if (!selected) return null;
    return checklistItems.find((i) => i.id === selected.checklistItemId) ?? null;
  }, [checklistItems, selected]);

  const vuln = useMemo(() => {
    if (!selected) return null;
    return vulnerabilities.find((v) => v.assessmentId === selected.id) ?? null;
  }, [vulnerabilities, selected]);

  const bound = matrix === "3x3" ? 3 : 5;
  const auto = selected ? autoVulnIL(selected.result, bound) : { likelihood: 3, impact: 3 };
  const likelihood = auto.likelihood;
  const impact = auto.impact;
  const sc = score(impact, likelihood);
  const gr = gradeFromScore(sc);

  function upsertVuln(patch) {
    if (!selected) return;
    setVulnerabilities((prev) => {
      const exists = prev.find((v) => v.assessmentId === selected.id);
      if (exists) return prev.map((v) => (v.assessmentId === selected.id ? { ...v, ...patch, likelihood, impact } : v));
      const newId = `V-${String(prev.length + 1).padStart(3, "0")}`;
      return [
        {
          id: newId,
          assessmentId: selected.id,
          description: "",
          likelihood,
          impact,
          mitigation: "",
          ...patch,
        },
        ...prev,
      ];
    });
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-slate-600">
        “부분적합/부적합” 현황을 대상으로 취약을 식별합니다. 현황(증적/비고)은 읽기 전용이며, 취약 내용/조치 계획만 작성합니다.
      </div>

      <Table
        columns={[
          { key: "id", header: "현황ID" },
          {
            key: "type",
            header: "유형",
            render: (r) => checklistItems.find((i) => i.id === r.checklistItemId)?.type ?? "-",
          },
          {
            key: "item",
            header: "항목",
            render: (r) => {
              const it = checklistItems.find((i) => i.id === r.checklistItemId);
              if (!it) return "-";
              // ✅ 요청사항
              // 1) "항목(질문)"이 가장 중요 -> 질문 본문을 노출
              // 2) 질문 아래에 "현황"을 파란색으로 가독성 있게 표시
              //    - 현황 데이터는 assessment의 evidence/notes(증적/비고)를 사용
              //    - 너무 길어지는 것을 막기 위해 1줄 요약(80자) 적용
              const evidence = String(r?.evidence ?? "").trim();
              const notes = String(r?.notes ?? "").trim();
              const statusRaw = evidence || notes;
              const status = statusRaw.length > 80 ? `${statusRaw.slice(0, 80)}…` : statusRaw;

              return (
                <div className="space-y-1">
                  <div className="text-slate-700 text-xs font-semibold">{it.detailCode ?? it.id}</div>
                  <div className="whitespace-pre-wrap break-words text-slate-900">{it.item}</div>
                  {status ? (
                    <div className="text-blue-700 text-sm font-semibold">현황: {status}</div>
                  ) : null}
                </div>
              );
            },
          },
          {
            key: "result",
            header: "결과",
            render: (r) => {
              // ✅ 요청사항: 폭 축소 + 가운데 정렬 + 취약/양호 색상
              // - result가 부적합/부분적합이면 취약(빨강)
              // - 그 외(적합 등)면 양호(파랑)
              const raw = String(r.result ?? "").trim();
              const isVuln = raw === "부적합" || raw === "부분적합" || raw === "취약";
              const label = isVuln ? "취약" : "양호";
              return (
                <div className="flex justify-center">
                  <span
                    className={
                      "inline-flex w-16 justify-center rounded-full px-2 py-1 text-xs font-bold border " +
                      (isVuln
                        ? "bg-red-50 text-red-700 border-red-200"
                        : "bg-blue-50 text-blue-700 border-blue-200")
                    }
                    title={raw}
                  >
                    {label}
                  </span>
                </div>
              );
            },
          },
          {
            key: "vuln",
            header: "취약작성",
            render: (r) => {
              const has = vulnerabilities.some((v) => v.assessmentId === r.id && (v.description ?? "").trim().length > 0);
              return <span className="text-xs font-semibold rounded-full border px-2 py-0.5 bg-white">{has ? "Y" : "N"}</span>;
            },
          },
        ]}
        rows={rows}
        onRowClick={(row) => setSelectedAssessmentId(row.id)}
      />

      <Card title={`선택한 항목: ${selected?.id ?? "-"}`} desc="좌측(표)에서 선택 → 현황 확인(읽기) → 취약 작성">
        {!selected ? (
          <div className="text-sm text-slate-500">취약 작성 대상(부분적합/부적합)이 없습니다.</div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <Field label="유형">
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">{item?.type ?? "-"}</div>
              </Field>

              <Field label="항목(코드/제목)">
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                  {item ? `${item.detailCode ?? item.id} · ${item.itemTitle ?? "-"}` : "-"}
                </div>
              </Field>

              <Field label="결과">
                {/* ✅ 요청사항: 결과 폭 축소 + 가운데 정렬 + 취약(빨강)/양호(파랑) */}
                {(() => {
                  const raw = String(selected.result ?? "").trim();
                  const isVuln = raw === "부적합" || raw === "부분적합" || raw === "취약";
                  const label = isVuln ? "취약" : raw ? "양호" : "-";
                  return (
                    <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <span
                        className={
                          "inline-flex w-16 justify-center rounded-full px-2 py-1 text-xs font-bold border " +
                          (isVuln
                            ? "bg-red-50 text-red-700 border-red-200"
                            : "bg-blue-50 text-blue-700 border-blue-200")
                        }
                        title={raw}
                      >
                        {label}
                      </span>
                    </div>
                  );
                })()}
              </Field>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <Field label="현황-증적(요약) [읽기]">
                {/* ✅ 요청사항: 현황을 파란색으로 잘 보이게 */}
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800 whitespace-pre-wrap">
                  {selected.evidence ?? "-"}
                </div>
              </Field>

              <Field label="현황-비고(메모) [읽기]">
                {/* ✅ 요청사항: 현황을 파란색으로 잘 보이게 */}
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800 whitespace-pre-wrap">
                  {selected.notes ?? "-"}
                </div>
              </Field>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold">취약 작성</div>

              <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
                <Field label="취약 내용">
                  <Input
                    value={vuln?.description ?? ""}
                    onChange={(e) => upsertVuln({ description: e.target.value })}
                    placeholder="예: 정책/절차 미비로 권한 오남용 가능"
                  />
                </Field>

                <Field label="위험도(읽기)">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold rounded-full border px-2 py-0.5 bg-white">{sc}</span>
                    <span className="text-xs font-semibold rounded-full border px-2 py-0.5 bg-white">{gr.g}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">Matrix={matrix} (1~{bound}) · v4.0 정책: 자동 산정</div>
                </Field>
              </div>

              <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
                <Field label={`발생 가능성(1~${bound})`}
                >
                  <Select
                    value={String(likelihood)}
                    onChange={() => {}}
                    options={Array.from({ length: bound }, (_, i) => i + 1).map((x) => ({ value: String(x), label: String(x) }))}
                    disabled
                  />
                </Field>

                <Field label={`영향도(1~${bound})`}>
                  <Select
                    value={String(impact)}
                    onChange={() => {}}
                    options={Array.from({ length: bound }, (_, i) => i + 1).map((x) => ({ value: String(x), label: String(x) }))}
                    disabled
                  />
                </Field>
              </div>

              <div className="mt-3">
                <Field label="조치 계획">
                  <Input
                    value={vuln?.mitigation ?? ""}
                    onChange={(e) => upsertVuln({ mitigation: e.target.value })}
                    placeholder="예: 정책/절차 문서화, 승인 프로세스 수립, 교육 시행"
                  />
                </Field>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
