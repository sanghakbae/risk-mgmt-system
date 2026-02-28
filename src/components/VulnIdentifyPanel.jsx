// src/components/VulnIdentifyPanel.jsx
// 취약 도출(2단계) 화면
//
// ✅ 요구사항 반영 요약
// 1) 진행률: "분야별"이 아니라 "전체 통제 개수 대비" (결과가 저장된 항목 수 / 전체 항목 수)
// 2) 분야(domain): 상단 셀렉트로 필터링. (전체 선택 시에는 분야 구분(섹션 헤더)도 보여줌)
// 3) 현황(status): 통제 이행 점검 페이지처럼 "개행이 유지"되어 보이게(whitespace-pre-wrap) + 파란색 강조 박스
// 4) 결과(양호/취약): 폭 줄이고 가운데 정렬. 취약=빨강, 양호=파랑.
// 5) 저장: (양호/취약) 선택만으로는 반영되지 않고, "저장"을 눌렀을 때만 시트에 반영 + savedMap 갱신
// 6) 항목/현황: 화면에서 가장 중요하니 폭을 크게. (항목과 현황을 거의 동일 폭)
// 7) 사유(result_detail): 결과(양호/취약)와 함께 입력, 저장 버튼을 눌러야만 반영
// 8) 항목 컬럼: itemCode 가 "항목"으로 표시됨 (사용자 확인 사항)
//
// ✅ 가정
// - checklistItems: 상위에서 내려오는 시트 로드 결과 배열
// - updateFields: code 기준으로 특정 컬럼을 업데이트하는 함수(배열 입력)
//   예) updateFields([{ code, result: "취약", result_detail: "사유..." }])
// - 저장 컬럼명은 프로젝트마다 다를 수 있어 result/vulnResult 둘 다 시도하고,
//   사유도 result_detail/vulnResult_detail 둘 다 시도하도록 안전장치 포함.

import React, { useEffect, useMemo, useState } from "react";
import Select from "../ui/Select";
import { updateFields } from "../lib/sheetsApi";

/** 진행률 바 (통제 이행 점검 페이지 스타일과 최대한 유사하게) */
function ProgressBar({ done, total, label }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-slate-900">{label}</div>
        <div className="text-xs text-slate-500">
          {done}/{total} ({pct}%)
        </div>
      </div>

      <div className="mt-3 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full bg-slate-900" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** null/undefined 안전 문자열 변환 */
function normalizeText(v) {
  if (v == null) return "";
  return String(v);
}

/** 저장된 결과(양호/취약) 컬럼은 repo마다 이름이 다를 수 있어 둘 다 허용 */
function getSavedResultFromItem(item) {
  return normalizeText(item.vulnResult || item.result || "").trim();
}

/** 저장된 사유(result_detail)도 컬럼명이 다를 수 있어 둘 다 허용 */
function getSavedDetailFromItem(item) {
  return normalizeText(item.result_detail || item.vulnResult_detail || "").trim();
}

/** domain 기준 섹션 그룹핑 (전체 보기에서만 사용) */
function groupByDomain(items) {
  const map = new Map();
  items.forEach((it) => {
    const d = normalizeText(it.domain || "미분류");
    if (!map.has(d)) map.set(d, []);
    map.get(d).push(it);
  });

  return Array.from(map.entries()).map(([domain, list]) => ({
    domain,
    list,
  }));
}

/** textarea 자동 높이 조절 (입력 내용에 맞춰 늘어남) */
function autoResizeTextarea(el) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

/** 결과 Pill 버튼 (폭 줄이고 가운데 정렬) */
function ResultPill({ label, tone, active, onClick }) {
  // tone: "good"(파랑) | "bad"(빨강)
  const base =
    "w-[64px] text-center px-2 py-1 rounded-full text-xs font-semibold border transition select-none";
  const activeCls =
    tone === "bad"
      ? "bg-red-600 border-red-600 text-white"
      : "bg-blue-600 border-blue-600 text-white";
  const idleCls =
    tone === "bad"
      ? "bg-white border-red-200 text-red-600 hover:bg-red-50"
      : "bg-white border-blue-200 text-blue-600 hover:bg-blue-50";

  return (
    <button
      type="button"
      className={`${base} ${active ? activeCls : idleCls}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export default function VulnIdentifyPanel({ checklistItems = [], onUpdated }) {
  // ----------------------------
  // UI 상태값
  // ----------------------------

  /** 분야(domain) 필터 */
  const [selectedDomain, setSelectedDomain] = useState("");

  /** 검색어 */
  const [q, setQ] = useState("");

  /**
   * savedMap: code -> { result: "양호"|"취약", detail: "..." }
   * - 화면 초기 렌더/데이터 갱신 시 checklistItems에서 동기화됨
   * - 저장 버튼을 눌렀을 때만 갱신됨
   */
  const [savedMap, setSavedMap] = useState({});

  /**
   * draftMap: code -> { result?: "양호"|"취약", detail?: "..." }
   * - 사용자가 "선택/입력"한 임시값
   * - 저장 전까지 시트에는 반영되지 않음
   */
  const [draftMap, setDraftMap] = useState({});

  /** 저장 중인 row(code) */
  const [savingCode, setSavingCode] = useState(null);

  // ----------------------------
  // savedMap 초기 동기화
  // ----------------------------
  useEffect(() => {
    const m = {};
    (checklistItems || []).forEach((it) => {
      const code = normalizeText(it.code).trim();
      if (!code) return;

      const r = getSavedResultFromItem(it);
      const d = getSavedDetailFromItem(it);

      if (r || d) {
        m[code] = { result: r, detail: d };
      }
    });

    setSavedMap(m);
    // ⚠️ draftMap은 사용자가 입력 중인 내용을 유지하기 위해 여기서 초기화하지 않음
  }, [checklistItems]);

  // ----------------------------
  // 도메인 목록(셀렉트 옵션)
  // ----------------------------
  const domains = useMemo(() => {
    const set = new Set();
    (checklistItems || []).forEach((it) => {
      const d = normalizeText(it.domain).trim();
      if (d) set.add(d);
    });
    return Array.from(set);
  }, [checklistItems]);

  // ----------------------------
  // 전체 진행률 (필터와 무관하게 전체 기준)
  // ----------------------------
  const progress = useMemo(() => {
    const total = (checklistItems || []).length;
    let done = 0;

    (checklistItems || []).forEach((it) => {
      const code = normalizeText(it.code).trim();
      if (!code) return;

      const saved = savedMap[code]?.result || getSavedResultFromItem(it);
      if (saved === "양호" || saved === "취약") done += 1;
    });

    return { done, total };
  }, [checklistItems, savedMap]);

  // ----------------------------
  // 검색 + 도메인 필터 적용
  // ----------------------------
  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();

    return (checklistItems || []).filter((it) => {
      // domain 필터
      const domainOk = selectedDomain
        ? normalizeText(it.domain).trim() === selectedDomain
        : true;
      if (!domainOk) return false;

      // 검색
      if (!query) return true;

      const hay = [
        it.type,
        it.area,
        it.domain,
        it.code,
        it.itemCode, // 항목
        it.status, // 현황
        getSavedResultFromItem(it),
        getSavedDetailFromItem(it),
      ]
        .map(normalizeText)
        .join(" ")
        .toLowerCase();

      return hay.includes(query);
    });
  }, [checklistItems, selectedDomain, q]);

  // ----------------------------
  // 섹션 구성 (전체 보기: domain별 섹션 / 특정 domain 선택: 단일 섹션)
  // ----------------------------
  const sections = useMemo(() => {
    if (selectedDomain) {
      return [{ domain: selectedDomain, list: filtered }];
    }
    return groupByDomain(filtered);
  }, [filtered, selectedDomain]);

  // ----------------------------
  // draft 조작 helpers
  // ----------------------------
  function setDraftResult(code, result) {
    setDraftMap((prev) => ({
      ...prev,
      [code]: { ...(prev[code] || {}), result },
    }));
  }

  function setDraftDetail(code, detail) {
    setDraftMap((prev) => ({
      ...prev,
      [code]: { ...(prev[code] || {}), detail },
    }));
  }

  /**
   * 저장 버튼 클릭 시에만 시트 반영
   * - result(양호/취약) + result_detail(사유) 함께 저장
   */
  async function saveRow(item) {
    const code = normalizeText(item.code).trim();
    if (!code) return;

    const draft = draftMap[code] || {};
    const draftResult = normalizeText(draft.result).trim();
    const draftDetail = normalizeText(draft.detail);

    // 결과는 반드시 양호/취약 중 하나여야 저장
    if (draftResult !== "양호" && draftResult !== "취약") return;

    setSavingCode(code);
    try {
      // ✅ 컬럼명 호환: result/vulnResult 둘 다 업데이트 시도
      // ✅ 사유 컬럼도 result_detail/vulnResult_detail 둘 다 시도
      await updateFields([
        {
          code,
          result: draftResult,
          vulnResult: draftResult,
          result_detail: draftDetail,
          vulnResult_detail: draftDetail,
        },
      ]);

      // 저장 성공 시 savedMap 갱신
      setSavedMap((prev) => ({
        ...prev,
        [code]: { result: draftResult, detail: draftDetail },
      }));

      // 저장 성공 후 onUpdated로 부모 재로딩 트리거
      if (typeof onUpdated === "function") onUpdated();
    } finally {
      setSavingCode(null);
    }
  }

  // ----------------------------
  // 렌더링
  // ----------------------------
  return (
    <div className="space-y-6">
      {/* 상단 헤더 + 진행률 */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-lg font-bold text-slate-900">2. 취약 도출</div>
          <div className="text-sm text-slate-600">
            통제 이행 점검의 현황(status)을 근거로 각 항목의 결과(양호/취약)와 사유를
            작성하여 저장합니다.
          </div>
        </div>

        <div className="w-[320px] max-w-full">
          <ProgressBar
            done={progress.done}
            total={progress.total}
            label="취약 도출 진행률 (전체 통제 기준)"
          />
        </div>
      </div>

      {/* 필터 영역 */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 md:flex-row md:items-end">
        {/* 분야 셀렉트 */}
        <div className="md:w-[280px]">
          <div className="text-xs font-semibold text-slate-700 mb-1">분야(domain)</div>
          <Select
            value={selectedDomain}
            onChange={(v) => setSelectedDomain(v)}
            options={[
              { value: "", label: "전체" },
              ...domains.map((d) => ({ value: d, label: d })),
            ]}
          />
        </div>

        {/* 검색 */}
        <div className="flex-1">
          <div className="text-xs font-semibold text-slate-700 mb-1">검색</div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            placeholder="유형/영역/분야/코드/항목/현황/결과/사유 검색"
          />
        </div>
      </div>

      {/* 섹션(분야) 단위 렌더 */}
      <div className="space-y-6">
        {sections.map((sec) => (
          <div
            key={sec.domain}
            className="rounded-2xl border border-slate-200 bg-white overflow-hidden"
          >
            {/* 전체 보기일 때만 domain 섹션 헤더가 의미가 큼 (선택 domain일 때도 동일하게 표시) */}
            <div className="flex items-center justify-between gap-3 px-5 py-3 bg-slate-50 border-b border-slate-200">
              <div className="text-sm font-bold text-slate-900">분야: {sec.domain}</div>
              <div className="text-xs text-slate-500">{sec.list.length}개 항목</div>
            </div>

            {/* 테이블 헤더
               - "유형/영역/코드"는 폭 최소화
               - "항목" + "현황"은 거의 동일한 넓이
               - "사유"는 그 다음
               - "결과"는 아주 좁게(가운데)
               - "저장"은 버튼 영역
            */}
            <div
              className="
                grid gap-3 px-5 py-3 text-xs font-semibold text-slate-600
                border-b border-slate-200 bg-white
                grid-cols-[64px_120px_92px_minmax(360px,1fr)_minmax(360px,1fr)_minmax(260px,1fr)_92px_88px]
              "
            >
              <div className="text-center">유형</div>
              <div className="truncate">영역</div>
              <div className="text-center">코드</div>
              <div>항목</div>
              <div>현황(status)</div>
              <div>사유(result_detail)</div>
              <div className="text-center">결과</div>
              <div className="text-center">저장</div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-slate-100">
              {sec.list.map((it, idx) => {
                const code = normalizeText(it.code).trim();
                const key = code || `${sec.domain}-${idx}`;

                const savedResult =
                  savedMap[code]?.result || getSavedResultFromItem(it);
                const savedDetail =
                  savedMap[code]?.detail || getSavedDetailFromItem(it);

                const draft = draftMap[code] || {};
                const draftResult = normalizeText(draft.result).trim();
                const draftDetail = normalizeText(draft.detail);

                // 화면 표시용:
                // - 저장 전 선택/입력도 보이게 하되
                // - "저장됨" 여부는 savedResult 기준으로 표시
                const effectiveResult = draftResult || savedResult;
                const effectiveDetail =
                  draftDetail !== "" ? draftDetail : savedDetail;

                const statusText = normalizeText(it.status);
                const itemText = normalizeText(it.itemCode); // ✅ 항목은 itemCode

                const canSave =
                  (draftResult === "양호" || draftResult === "취약") &&
                  savingCode !== code;

                return (
                  <div
                    key={key}
                    className="
                      grid gap-3 px-5 py-4 items-start
                      grid-cols-[64px_120px_92px_minmax(360px,1fr)_minmax(360px,1fr)_minmax(260px,1fr)_92px_88px]
                    "
                  >
                    {/* 유형 */}
                    <div className="text-sm text-slate-700 text-center">
                      {normalizeText(it.type)}
                    </div>

                    {/* 영역 */}
                    <div className="text-sm text-slate-700 truncate">
                      {normalizeText(it.area)}
                    </div>

                    {/* 코드 */}
                    <div className="flex justify-center">
                      <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
                        {code || "—"}
                      </span>
                    </div>

                    {/* 항목 (가장 중요: 넓게) */}
                    <div className="text-sm text-slate-900 leading-relaxed">
                      {itemText || "—"}
                    </div>

                    {/* 현황(status) (개행 유지 + 파란 강조 박스) */}
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                      <div className="text-xs font-semibold text-blue-700 mb-1">현황</div>
                      <div className="text-sm text-blue-900 whitespace-pre-wrap leading-relaxed">
                        {statusText || "—"}
                      </div>
                    </div>

                    {/* 사유(result_detail) 입력 (자동 높이) */}
                    <div>
                      <textarea
                        value={effectiveDetail}
                        onChange={(e) => {
                          setDraftDetail(code, e.target.value);
                          autoResizeTextarea(e.target);
                        }}
                        onInput={(e) => autoResizeTextarea(e.target)}
                        rows={1}
                        className="
                          w-full resize-none overflow-hidden
                          rounded-xl border border-slate-200 bg-white
                          px-3 py-2 text-sm text-slate-900
                          outline-none focus:ring-2 focus:ring-slate-200
                        "
                        placeholder="결과 사유를 입력하세요 (저장 시 반영)"
                      />
                      {/* 저장 상태(가볍게) */}
                      <div className="mt-1 text-[11px] text-slate-400">
                        {savedResult ? "저장된 값이 있음" : "아직 저장된 값 없음"}
                      </div>
                    </div>

                    {/* 결과 (폭 좁게, 가운데 정렬, 색상) */}
                    <div className="flex flex-col items-center justify-start gap-2 pt-1">
                      <ResultPill
                        label="양호"
                        tone="good"
                        active={effectiveResult === "양호"}
                        onClick={() => setDraftResult(code, "양호")}
                      />
                      <ResultPill
                        label="취약"
                        tone="bad"
                        active={effectiveResult === "취약"}
                        onClick={() => setDraftResult(code, "취약")}
                      />

                      {/* 저장 여부 표시(결과 색상과 동일 계열) */}
                      {savedResult ? (
                        <div
                          className={`text-[11px] font-semibold ${
                            savedResult === "취약" ? "text-red-600" : "text-blue-600"
                          }`}
                        >
                          저장됨
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-400">미저장</div>
                      )}
                    </div>

                    {/* 저장 버튼 (눌러야만 시트 반영) */}
                    <div className="flex justify-center pt-1">
                      <button
                        type="button"
                        onClick={() => saveRow(it)}
                        disabled={!canSave}
                        className="
                          rounded-xl px-4 py-2 text-sm font-semibold
                          bg-slate-900 text-white
                          disabled:opacity-40 disabled:cursor-not-allowed
                          hover:bg-slate-800
                        "
                        title="선택한 결과/사유를 저장"
                      >
                        {savingCode === code ? "저장중" : "저장"}
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* empty */}
              {sec.list.length === 0 && (
                <div className="px-5 py-10 text-center text-sm text-slate-500">
                  표시할 항목이 없습니다.
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
