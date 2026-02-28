import React from "react";
import { AlertTriangle } from "lucide-react";
import Button from "../ui/Button";

// v4.0 시나리오
// - 체크리스트 항목(현황/취약)을 사고 시나리오로 번역

export default function ScenarioPanel({
  selectedAssessment,
  selectedChecklistItem,
  scenarioText,
  setScenarioText,
  suggestedScenario,
  canGenerate,
  onGenerate,
}) {
  const vulnerable = selectedAssessment?.result === "부분적합" || selectedAssessment?.result === "부적합";

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-sm font-semibold">왜 위험 시나리오가 필요?</div>
        <div className="text-sm text-slate-600 mt-1">
          체크리스트 현황(취약 상태)을 <b>사업/보안 사고 영향</b>으로 연결해야 자동 위험 평가(가능성/영향도)를 설명할 수 있습니다.
        </div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500">유형</div>
            <div className="text-sm font-semibold mt-1">{selectedChecklistItem?.type ?? "-"}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500">항목</div>
            <div className="text-sm font-semibold mt-1">{selectedChecklistItem?.detailCode ?? selectedChecklistItem?.id ?? "-"}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500">현황 결과</div>
            <div className="text-sm font-semibold mt-1">{selectedAssessment?.result ?? "-"}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-sm font-semibold">시나리오(필수)</div>
          <div className="text-xs text-slate-500 mt-1">자동 제안 → 사람이 문장 확정</div>
          <textarea
            value={scenarioText}
            onChange={(e) => setScenarioText(e.target.value)}
            rows={7}
            className="mt-3 w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
          />
          <div className="mt-3 flex items-center justify-between gap-2">
            <Button variant="outline" onClick={() => setScenarioText(suggestedScenario)}>
              제안문 다시 넣기
            </Button>
            <Button
              disabled={!canGenerate || !vulnerable || !scenarioText.trim()}
              onClick={onGenerate}
              iconLeft={<AlertTriangle className="w-4 h-4" />}
            >
              위험 생성
            </Button>
          </div>
          {!vulnerable ? (
            <div className="text-xs text-slate-500 mt-2">현재 현황 결과가 취약(부분/부적합)이 아니어서 위험 생성을 막습니다.</div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-sm font-semibold">작성 힌트</div>
          <div className="text-xs text-slate-500 mt-1">권장 구성</div>
          <div className="mt-3 space-y-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="text-xs text-slate-500">권장 구성</div>
              <div className="mt-1 text-slate-700">
                <div>① 통제 미흡(무엇이 부족?)</div>
                <div>② 위협/오남용(어떻게 악용?)</div>
                <div>③ 영향(유출/중단/법적/평판)</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
