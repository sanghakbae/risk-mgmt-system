// src/components/VulnIdentifyPanel.jsx
// 취약 도출(2단계)
//
// ✅ 요구사항 반영 요약
// 1) 진행률: (저장된 결과 수 / 전체 통제 수) = 필터와 무관하게 '전체 기준'
// 2) 분야(domain): 상단 Select로 필터링
//    - 전체("") 선택 시: 분야별 섹션 헤더(구분) 표시
//    - 특정 분야 선택 시: 해당 분야만 표시(섹션 1개)
// 3) 현황(status): 통제 이행 점검 페이지처럼 개행 유지(whitespace-pre-wrap) + 파란 강조 박스
// 4) 결과(양호/취약): 폭 좁게 + 가운데 정렬, 색상(양호=파랑 / 취약=빨강)
// 5) 저장: (양호/취약/사유) 입력만으로는 시트 반영 X, "저장" 클릭 시에만 updateFields 호출
// 6) 항목(itemCode) / 현황(status): 가장 중요 → 넓게(거의 동일 폭)
// 7) 사유(result_detail): 입력칸 추가 + 자동 높이 조절(내용에 맞춰 auto-resize)
//
// ⚠️ 중요: updateFields 시그니처는 StatusWritePanel 기준으로
//   updateFields(sheetName, code, { colName: value, ... }) 형태로 사용한다.
//
// ⚠️ COLUMN_NOT_FOUND 대응
// - 시트 컬럼명이 환경마다 다를 수 있어, 결과/사유 컬럼은 후보군을 순차 시도한다.
// - updateFields가 "전달된 컬럼 중 하나라도 없으면 예외"를 던지는 구현일 가능성이 크므로,
//   여러 컬럼을 한 번에 보내지 않고 '하나씩' 시도한다.

import React, { useEffect, useMemo, useRef, useState } from "react";
import Select from "../ui/Select";
import { updateFields } from "../lib/sheetsApi";

/** 통제 이행 점검 화면과 동일한 스타일의 진행률 카드 */
function ProgressCard({ done, total, title, desc }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm font-bold text-slate-900">{title}</div>
        <div className="text-xs font-semibold text-slate-500">
          {done}/{total} ({pct}%)
        </div>
      </div>
      {desc ? <div className="mt-2 text-sm text-slate-600">{desc}</div> : null}
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full bg-slate-900" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function normalizeText(v) {
  if (v == null) return "";
  return String(v);
}

function getSavedResultFromItem(item) {
  // 저장된 결과 컬럼명이 repo/시트마다 다를 수 있어 둘 다 허용
  return normalizeText(item.vulnResult || item.result || "").trim();
}

function getSavedReasonFromItem(item) {
  // 사유 컬럼도 환경에 따라 다를 수 있어 후보를 넓게
  return normalizeText(
    item.result_detail || item.resultDetail || item.reason || item.detail || ""
  );
}

function groupByDomain(items) {
  const map = new Map();
  items.forEach((it) => {
    const d = normalizeText(it.domain || "미분류");
    if (!map.has(d)) map.set(d, []);
    map.get(d).push(it);
  });
  return Array.from(map.entries()).map(([domain, list]) => ({ domain, list }));
}

/** textarea auto-resize (내용에 맞춰 높이 자동) */
function useAutoResizeTextarea(value) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // 높이 재계산: 먼저 auto로 줄였다가 scrollHeight만큼 확장
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return ref;
}

/**
 * COLUMN_NOT_FOUND 발생을 피하기 위한 "후보 컬럼명" 순차 업데이트
 * @param {string} sheetName - 시트명(예: "Checklist")
 * @param {string} code - 항목 키(코드)
 * @param {{result?: string, reason?: string}} payload
 * @param {{result: string[], reason: string[]}} candidates
 */
async function updateWithFallbackColumns(sheetName, code, payload, candidates) {
  const { result, reason } = payload;

  // 1) 결과 저장
  if (result != null) {
    let ok = false;
    let lastErr = null;
    for (const col of candidates.result) {
      try {
        await updateFields(sheetName, code, { [col]: result });
        ok = true;
        break;
      } catch (e) {
        lastErr = e;
        const msg = normalizeText(e?.message || e);
        if (!msg.includes("COLUMN_NOT_FOUND")) throw e; // 다른 에러면 즉시 중단
      }
    }
    if (!ok) throw lastErr || new Error("COLUMN_NOT_FOUND");
  }

  // 2) 사유 저장
  if (reason != null) {
    let ok = false;
    let lastErr = null;
    for (const col of candidates.reason) {
      try {
        await updateFields(sheetName, code, { [col]: reason });
        ok = true;
        break;
      } catch (e) {
        lastErr = e;
        const msg = normalizeText(e?.message || e);
        if (!msg.includes("COLUMN_NOT_FOUND")) throw e;
      }
    }
    if (!ok) throw lastErr || new Error("COLUMN_NOT_FOUND");
  }
}

export default function VulnIdentifyPanel({ checklistItems = [], onUpdated }) {
  // ✅ 통제 이행 점검과 동일하게 Checklist 시트를 대상으로 업데이트
  const SHEET_NAME = "Checklist";

  // 분야 필터
  const [selectedDomain, setSelectedDomain] = useState("");
  // 검색
  const [q, setQ] = useState("");

  // code -> 저장된 결과/사유 (시트 기준)
  const [savedMap, setSavedMap] = useState({}); // { [code]: { result, reason } }
  // code -> 저장 전 임시 입력 (클라이언트 기준)
  const [draftMap, setDraftMap] = useState({}); // { [code]: { result, reason } }

  const [savingCode, setSavingCode] = useState(null);
  const [error, setError] = useState("");

  // 초기/갱신 시 savedMap 동기화
  useEffect(() => {
    const m = {};
    (checklistItems || []).forEach((it) => {
      const code = normalizeText(it.code).trim();
      if (!code) return;
      const result = getSavedResultFromItem(it);
      const reason = getSavedReasonFromItem(it);
      if (result || reason) m[code] = { result, reason };
    });
    setSavedMap(m);
  }, [checklistItems]);

  // 도메인 목록
  const domains = useMemo(() => {
    const set = new Set();
    (checklistItems || []).forEach((it) => {
      const d = normalizeText(it.domain).trim();
      if (d) set.add(d);
    });
    return Array.from(set);
  }, [checklistItems]);

  // 전체 진행률(필터 무관)
  const progress = useMemo(() => {
    const total = (checklistItems || []).length;
    let done = 0;
    (checklistItems || []).forEach((it) => {
      const code = normalizeText(it.code).trim();
      if (!code) return;
      const savedResult = savedMap[code]?.result || getSavedResultFromItem(it);
      if (savedResult === "양호" || savedResult === "취약") done += 1;
    });
    return { done, total };
  }, [checklistItems, savedMap]);

  // 검색/필터 적용
  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return (checklistItems || []).filter((it) => {
      const domainOk = selectedDomain
        ? normalizeText(it.domain).trim() === selectedDomain
        : true;
      if (!domainOk) return false;

      if (!query) return true;
      const hay = [
        it.type,
        it.area,
        it.domain,
        it.code,
        it.itemCode,
        it.status,
        getSavedResultFromItem(it),
        getSavedReasonFromItem(it),
      ]
        .map(normalizeText)
        .join(" ")
        .toLowerCase();
      return hay.includes(query);
    });
  }, [checklistItems, selectedDomain, q]);

  // 전체 선택이면 domain 섹션 구분
  const sections = useMemo(() => {
    if (selectedDomain) return [{ domain: selectedDomain, list: filtered }];
    return groupByDomain(filtered);
  }, [filtered, selectedDomain]);

  function setDraft(code, patch) {
    setDraftMap((prev) => ({
      ...prev,
      [code]: {
        ...(prev[code] || {}),
        ...patch,
      },
    }));
  }

  function ResultButton({ label, tone, active, onClick }) {
    // tone: 'blue' | 'red'
    const base =
      "w-[64px] text-center rounded-full px-3 py-1 text-xs font-bold border transition select-none";
    const activeCls =
      tone === "red"
        ? "bg-red-600 border-red-600 text-white"
        : "bg-blue-600 border-blue-600 text-white";
    const idleCls =
      tone === "red"
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

  async function onSave(item) {
    const code = normalizeText(item.code).trim();
    if (!code) return;

    setError("");
    setSavingCode(code);

    try {
      const draft = draftMap[code] || {};
      const draftResult = normalizeText(draft.result).trim();
      const draftReason = normalizeText(draft.reason);

      // 결과는 양호/취약만 허용
      if (draftResult !== "양호" && draftResult !== "취약") {
        setError("저장 실패: 결과(양호/취약)를 선택하세요.");
        return;
      }

      // 후보 컬럼명(시트마다 다를 수 있어 최대한 안전하게)
      const candidates = {
        result: ["vulnResult", "result", "vuln_result", "취약결과", "결과"],
        reason: [
          "result_detail",
          "resultDetail",
          "reason",
          "detail",
          "사유",
          "비고",
        ],
      };

      await updateWithFallbackColumns(
        SHEET_NAME,
        code,
        { result: draftResult, reason: draftReason },
        candidates
      );

      // UI 반영: 저장 성공 시 savedMap 갱신 + draft 제거
      setSavedMap((prev) => ({
        ...prev,
        [code]: { result: draftResult, reason: draftReason },
      }));
      setDraftMap((prev) => {
        const next = { ...prev };
        delete next[code];
        return next;
      });

      if (typeof onUpdated === "function") onUpdated();
    } catch (e) {
      const msg = normalizeText(e?.message || e);
      if (msg.includes("COLUMN_NOT_FOUND")) {
        setError("저장 실패: COLUMN_NOT_FOUND");
      } else {
        setError(`저장 실패: ${msg}`);
      }
    } finally {
      setSavingCode(null);
    }
  }

  return (
    <div className="space-y-4">
      {/*
        ✅ 요구사항: 빨간 박스(상단 "1. 취약 도출")는 이 컴포넌트에서 만든 것이 아니고
        외부 레이아웃(상위 페이지/탭/스텝 래퍼)에서 생성된 것으로 보인다.
        따라서 이 컴포넌트에서는 추가 헤더를 만들지 않는다.
      */}

      {/* 진행률 (통제 이행 점검과 동일한 카드 스타일) */}
      <ProgressCard
        done={progress.done}
        total={progress.total}
        title="취약 도출 진행률 (전체 통제 기준)"
        desc="분야(domain) 필터와 무관하게 전체 통제 개수 대비 저장된 결과(양호/취약) 기준으로 계산합니다."
      />

      {/* 필터 */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 md:flex-row md:items-end">
        <div className="md:w-[280px]">
          <div className="mb-1 text-xs font-semibold text-slate-700">분야(domain)</div>
          <Select
            value={selectedDomain}
            onChange={(v) => setSelectedDomain(v)}
            options={[{ value: "", label: "전체" }, ...domains.map((d) => ({ value: d, label: d }))]}
          />
        </div>
        <div className="flex-1">
          <div className="mb-1 text-xs font-semibold text-slate-700">검색</div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            placeholder="유형/영역/분야/코드/항목/현황/결과/사유 검색"
          />
        </div>
      </div>

      {/* 에러 표시 */}
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      {/* 결과 리스트 */}
      <div className="space-y-6">
        {sections.map((sec) => (
          <div key={sec.domain} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {/* 분야 헤더(전체 선택일 때 의미 있음) */}
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3">
              <div className="text-sm font-bold text-slate-900">분야: {sec.domain}</div>
              <div className="text-xs text-slate-500">{sec.list.length}개 항목</div>
            </div>

            {/* 테이블 헤더 */}
            <div
              className={
                "grid grid-cols-[72px_140px_96px_minmax(320px,1fr)_minmax(320px,1fr)_minmax(260px,1fr)_120px_96px] " +
                "gap-3 border-b border-slate-200 bg-white px-5 py-3 text-xs font-semibold text-slate-600"
              }
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

                // 저장된 값(시트 기준)
                const savedResult = savedMap[code]?.result || getSavedResultFromItem(it);
                const savedReason =
                  savedMap[code]?.reason != null ? savedMap[code].reason : getSavedReasonFromItem(it);

                // 임시 값(사용자 입력)
                const draft = draftMap[code] || {};
                const effectiveResult = normalizeText(draft.result || savedResult).trim();
                const effectiveReason = normalizeText(draft.reason != null ? draft.reason : savedReason);
                const statusText = normalizeText(it.status);

                const reasonRef = useAutoResizeTextarea(effectiveReason);

                // 저장 버튼 활성화 조건
                const canSave =
                  (effectiveResult === "양호" || effectiveResult === "취약") &&
                  (effectiveResult !== savedResult || effectiveReason !== savedReason);

                return (
                  <div
                    key={key}
                    className={
                      "grid grid-cols-[72px_140px_96px_minmax(320px,1fr)_minmax(320px,1fr)_minmax(260px,1fr)_120px_96px] " +
                      "gap-3 px-5 py-4 items-start"
                    }
                  >
                    {/* 유형 */}
                    <div className="text-center text-sm text-slate-700">{normalizeText(it.type)}</div>

                    {/* 영역 */}
                    <div className="truncate text-sm text-slate-700">{normalizeText(it.area)}</div>

                    {/* 코드 */}
                    <div className="flex justify-center">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        {normalizeText(it.code)}
                      </span>
                    </div>

                    {/* 항목: itemCode */}
                    <div className="text-sm leading-relaxed text-slate-900">
                      {normalizeText(it.itemCode) || "—"}
                    </div>

                    {/* 현황(status): 개행 유지 + 파란 박스 */}
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                      <div className="mb-1 text-xs font-semibold text-blue-700">현황</div>
                      <div className="whitespace-pre-wrap text-sm leading-relaxed text-blue-900">
                        {statusText || "—"}
                      </div>
                    </div>

                    {/* 사유(result_detail): textarea + auto-resize */}
                    <div>
                      <div className="mb-1 text-xs font-semibold text-slate-700">사유</div>
                      <textarea
                        ref={reasonRef}
                        value={effectiveReason}
                        onChange={(e) => setDraft(code, { reason: e.target.value })}
                        className={
                          "w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm " +
                          "leading-relaxed outline-none focus:ring-2 focus:ring-slate-200"
                        }
                        placeholder="취약/양호 판단 사유를 입력하세요"
                      />
                    </div>

                    {/* 결과 */}
                    <div className="flex flex-col items-center justify-start gap-2 pt-6">
                      <ResultButton
                        label="양호"
                        tone="blue"
                        active={effectiveResult === "양호"}
                        onClick={() => setDraft(code, { result: "양호" })}
                      />
                      <ResultButton
                        label="취약"
                        tone="red"
                        active={effectiveResult === "취약"}
                        onClick={() => setDraft(code, { result: "취약" })}
                      />

                      {/* 저장됨 표시 */}
                      {savedResult ? (
                        <div
                          className={
                            "text-[11px] font-semibold " +
                            (savedResult === "취약" ? "text-red-600" : "text-blue-600")
                          }
                        >
                          저장됨
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-400">미저장</div>
                      )}
                    </div>

                    {/* 저장 버튼 */}
                    <div className="flex justify-center pt-6">
                      <button
                        type="button"
                        onClick={() => onSave(it)}
                        disabled={!canSave || savingCode === code}
                        className={
                          "rounded-xl px-4 py-2 text-sm font-semibold " +
                          "bg-slate-900 text-white hover:bg-slate-800 " +
                          "disabled:cursor-not-allowed disabled:opacity-40"
                        }
                        title="선택한 결과/사유를 저장"
                      >
                        {savingCode === code ? "저장중" : "저장"}
                      </button>
                    </div>
                  </div>
                );
              })}

              {sec.list.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-slate-500">표시할 항목이 없습니다.</div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
