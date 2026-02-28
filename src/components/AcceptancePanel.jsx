import React from "react";
import { Badge } from "../ui/Card";

export default function AcceptancePanel({ acceptThreshold, selectedRisk }) {
  if (!selectedRisk) {
    return <div className="text-sm text-slate-500">선택된 위험이 없습니다. (위험 분석 단계에서 위험을 선택하세요)</div>;
  }
  const ok = selectedRisk.score <= acceptThreshold;
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="text-sm font-semibold">허용기준 비교</div>
        <div className="text-sm text-slate-600 mt-1">설정된 허용 기준(≤ {acceptThreshold})과 현재 점수를 비교합니다.</div>
        <div className="mt-4 flex items-center gap-3">
          <div className="text-3xl font-bold">{selectedRisk.score}</div>
          <Badge variant={ok ? "ok" : "warn"}>{ok ? "허용 가능" : "기준 초과"}</Badge>
          <span className="text-xs text-slate-500">등급: {selectedRisk.grade}</span>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-sm font-semibold">UX 포인트</div>
        <div className="text-sm text-slate-600 mt-1">기준 초과일 때만 <b>처리 계획(전략/기한/담당)</b> 입력을 강제하면, 데이터 품질이 올라갑니다.</div>
      </div>
    </div>
  );
}
