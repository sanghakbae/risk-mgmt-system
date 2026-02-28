import React from "react";
import { ShieldCheck } from "lucide-react";
import Button from "../ui/Button";
import Select from "../ui/Select";
import { Badge } from "../ui/Card";

export default function AnalysisPanel({
  matrix,
  bound,
  impact,
  setImpact,
  likelihood,
  setLikelihood,
  computedScore,
  grade,
  acceptable,
  selectedRisk,
  risks,
  setSelectedRiskId,
  onAssess,
  readOnly,
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-sm font-semibold">대상 위험 선택</div>
          <div className="text-xs text-slate-500 mt-1">리스트에서 선택 후 평가</div>
          <div className="mt-3 space-y-2">
            {risks.length ? (
              risks.slice(0, 8).map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedRiskId(r.id)}
                  className={`w-full text-left rounded-2xl border px-3 py-2 transition ${
                    selectedRisk?.id === r.id ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div className="text-sm font-semibold">{r.id} · {r.asset}</div>
                  <div className={`text-xs mt-0.5 ${selectedRisk?.id === r.id ? "text-white/80" : "text-slate-500"}`}>
                    {r.grade}({r.score}) · {r.status}
                  </div>
                </button>
              ))
            ) : (
              <div className="text-sm text-slate-500">위험이 없습니다. (시나리오 단계에서 생성)</div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-sm font-semibold">Impact ({matrix})</div>
          <div className="text-xs text-slate-500 mt-1">사고 발생 시 피해 수준</div>
          <div className="mt-3">
            <Select
              value={String(impact)}
              onChange={(v) => setImpact(Number(v))}
              options={Array.from({ length: bound }, (_, i) => i + 1).map((n) => ({ value: String(n), label: String(n) }))}
              disabled={Boolean(readOnly)}
            />
          </div>
          <div className="mt-3 text-xs text-slate-500">예: 개인정보 유출/서비스 중단/법적 제재</div>
          {readOnly ? <div className="mt-2 text-xs text-slate-500">v4.0 정책: 자동 산정(수정 불가)</div> : null}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-sm font-semibold">Likelihood ({matrix})</div>
          <div className="text-xs text-slate-500 mt-1">현실적 발생 가능성</div>
          <div className="mt-3">
            <Select
              value={String(likelihood)}
              onChange={(v) => setLikelihood(Number(v))}
              options={Array.from({ length: bound }, (_, i) => i + 1).map((n) => ({ value: String(n), label: String(n) }))}
              disabled={Boolean(readOnly)}
            />
          </div>
          <div className="mt-3 text-xs text-slate-500">예: 노출 범위/공격 용이성/통제 성숙도</div>
          {readOnly ? <div className="mt-2 text-xs text-slate-500">v4.0 정책: 자동 산정(수정 불가)</div> : null}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="text-sm font-semibold">Risk Score</div>
          <div className="text-3xl font-bold mt-1">{computedScore}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${grade.cls}`}>{grade.label}</span>
          <Badge variant={acceptable ? "ok" : "warn"}>{acceptable ? "허용 가능" : "조치 필요"}</Badge>
        </div>
        <Button disabled={!selectedRisk} onClick={onAssess} iconLeft={<ShieldCheck className="w-4 h-4" />}>
          평가 저장(Assessed)
        </Button>
      </div>

      {selectedRisk ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-semibold">선택 위험 정보</div>
          <div className="mt-2 text-sm text-slate-700">{selectedRisk.scenario}</div>
        </div>
      ) : null}
    </div>
  );
}
