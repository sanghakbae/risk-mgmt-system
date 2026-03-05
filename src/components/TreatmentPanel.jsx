import React from "react";
import Select from "../ui/Select";
import Input from "../ui/Input";
import { Field } from "../ui/Card";

export default function TreatmentPanel({ selectedRisk, setRisks }) {

  if (!selectedRisk)
    return (
      <div className="text-sm text-slate-500">
        선택된 위험이 없습니다.
      </div>
    );

  return (

    <div className="space-y-4">

      {/* 위험 처리 입력 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">

        <div className="text-sm font-semibold">
          위험 처리 결정
        </div>

        <div className="text-sm text-slate-600 mt-1">
          전략 / 담당자 / 기한을 입력합니다.
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">

          <Field label="전략">
            <Select
              value={selectedRisk.treatment ?? "Mitigate"}
              onChange={(v) =>
                setRisks((prev) =>
                  prev.map((r) =>
                    r.id === selectedRisk.id
                      ? { ...r, treatment: v }
                      : r
                  )
                )
              }
              options={[
                { value: "Mitigate", label: "Mitigate (감소)" },
                { value: "Transfer", label: "Transfer (전가)" },
                { value: "Avoid", label: "Avoid (회피)" },
                { value: "Accept", label: "Accept (수용)" }
              ]}
            />
          </Field>

          <Field label="담당자">
            <Input
              value={selectedRisk.owner ?? ""}
              onChange={(e) =>
                setRisks((prev) =>
                  prev.map((r) =>
                    r.id === selectedRisk.id
                      ? { ...r, owner: e.target.value }
                      : r
                  )
                )
              }
              placeholder="예: 홍길동"
            />
          </Field>

          <Field label="기한">
            <Input
              type="date"
              value={selectedRisk.dueDate ?? ""}
              onChange={(e) =>
                setRisks((prev) =>
                  prev.map((r) =>
                    r.id === selectedRisk.id
                      ? { ...r, dueDate: e.target.value }
                      : r
                  )
                )
              }
            />
          </Field>

        </div>

      </div>

      {/* 전략 설명 */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">

        <div className="text-sm font-semibold text-slate-900">
          위험 처리 전략 설명
        </div>

        <div className="text-xs text-slate-500 mt-1">
          각 전략의 의미와 적용 상황을 참고하세요.
        </div>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="font-semibold text-slate-800">
              Mitigate (감소)
            </div>
            <div className="text-slate-600 mt-1 text-xs">
              보안 통제나 기술적 조치를 통해 위험의 발생 가능성 또는 영향도를 낮추는 전략입니다.
              예: 보안 패치 적용, 접근통제 강화, 암호화 적용.
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="font-semibold text-slate-800">
              Transfer (전가)
            </div>
            <div className="text-slate-600 mt-1 text-xs">
              위험을 제3자에게 이전하는 전략입니다.
              예: 사이버 보험 가입, 보안 서비스 아웃소싱.
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="font-semibold text-slate-800">
              Avoid (회피)
            </div>
            <div className="text-slate-600 mt-1 text-xs">
              위험이 발생할 수 있는 활동 자체를 제거하는 전략입니다.
              예: 취약한 시스템 폐기, 위험한 기능 제거.
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="font-semibold text-slate-800">
              Accept (수용)
            </div>
            <div className="text-slate-600 mt-1 text-xs">
              위험을 인지하고 추가적인 조치 없이 받아들이는 전략입니다.
              일반적으로 영향도가 낮거나 대응 비용이 과도한 경우 사용됩니다.
            </div>
          </div>

        </div>

      </div>

    </div>

  );
}