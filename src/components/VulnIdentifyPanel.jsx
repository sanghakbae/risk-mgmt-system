import React, { useMemo } from "react";
import Select from "../ui/Select";

/**
 * 취약 도출 패널
 *
 * 기능:
 * 1. 체크리스트 항목 표시
 * 2. 각 항목 아래 "현황(status)"을 파란색으로 강조 표시
 * 3. 결과는 가운데 정렬 + 폭 축소
 *    - 취약 = 빨간색
 *    - 양호 = 파란색
 * 4. props 누락/로딩 전 상태에서도 페이지가 깨지지 않도록 안전가드 적용
 */
export default function VulnIdentifyPanel({
  checklistItems = [],
  assessments = [],
  selectedAssessmentId = "",
  setSelectedAssessmentId = () => {},
  vulnerabilities = [],
  setVulnerabilities = () => {},
  matrix = null,
}) {
  /**
   * 안전가드
   * checklistItems가 없으면 화면이 깨지지 않고 안내 메시지 표시
   */
  if (!Array.isArray(checklistItems)) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        checklistItems 데이터가 없습니다.
      </div>
    );
  }

  /**
   * 취약 여부 결과 가져오기
   */
  function getResult(code) {
    const found = vulnerabilities.find((v) => v.code === code);
    return found?.result || "";
  }

  /**
   * 결과 저장
   */
  function setResult(code, result) {
    setVulnerabilities((prev) => {
      const exists = prev.find((v) => v.code === code);
      if (exists) {
        return prev.map((v) =>
          v.code === code ? { ...v, result } : v
        );
      }
      return [...prev, { code, result }];
    });
  }

  /**
   * 결과 스타일
   * - 취약: 빨강
   * - 양호: 파랑
   */
  function resultStyle(result) {
    if (result === "취약")
      return "bg-red-100 text-red-700 border-red-200";
    if (result === "양호")
      return "bg-blue-100 text-blue-700 border-blue-200";
    return "bg-slate-100 text-slate-600 border-slate-200";
  }

  return (
    <div className="space-y-4">

      {/* 데이터 없을 경우 */}
      {checklistItems.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          표시할 체크리스트 항목이 없습니다.
        </div>
      ) : null}

      {/* 항목 리스트 */}
      <div className="space-y-4">
        {checklistItems.map((item) => {
          const code = String(item.code || "").trim();
          const result = getResult(code);

          return (
            <div
              key={code}
              className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3"
            >
              {/* 질문(항목) */}
              <div className="text-sm font-semibold text-slate-900">
                {code} {item.itemCode}
              </div>

              {/* ✅ 현황(status) 파란색 강조 */}
              <div className="text-sm text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                <span className="font-semibold">현황:</span>{" "}
                {item.status ? item.status : "현황 미입력"}
              </div>

              {/* 결과 선택 */}
              <div className="flex items-center gap-3">
                <div className="text-xs font-semibold text-slate-600">
                  결과
                </div>

                {/* ✅ 폭 축소 + 가운데 정렬 */}
                <div className="flex items-center gap-2">
                  {["양호", "취약"].map((r) => {
                    const active = result === r;
                    return (
                      <button
                        key={r}
                        onClick={() => setResult(code, r)}
                        className={`
                          w-16 text-center
                          px-2 py-1 text-xs font-semibold rounded-lg border transition
                          ${active ? resultStyle(r) : "bg-white text-slate-500 border-slate-200"}
                        `}
                      >
                        {r}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
