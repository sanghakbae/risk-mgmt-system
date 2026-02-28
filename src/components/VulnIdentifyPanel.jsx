// src/components/VulnIdentifyPanel.jsx
// 취약 도출(2단계) 화면
//
// ✅ 요구사항(사용자 정리본 반영)
// 1) 진행률: "분야별"이 아니라 "전체 통제 개수 대비" (저장된 결과(양호/취약) 수 / 전체 항목 수)
// 2) 분야(domain): 상단 셀렉트로 필터링.
//    - "전체" 선택 시: 분야 섹션 헤더(구분선/제목)를 보여주고, 분야별로 그룹핑해서 표시
//    - 특정 분야 선택 시: 해당 분야만 보여주되, 섹션은 1개로 유지
// 3) 현황(status):
//    - 통제 이행 점검 페이지와 동일하게 "개행 유지" (white-space: pre-wrap)
//    - 파란색 강조 박스(가독성 향상)
// 4) 결과(양호/취약):
//    - 폭을 줄이고 가운데 정렬
//    - 양호 = 파랑, 취약 = 빨강
// 5) 저장:
//    - (양호/취약) 선택만으로는 시트에 반영되지 않음
//    - "사유(result_detail)" 입력 + 결과 선택 후 "저장" 클릭 시에만 시트 반영
// 6) 컬럼 폭:
//    - 항목(itemCode) / 현황(status) / 사유(result_detail)를 핵심으로 보고 폭을 크게
//    - 유형/영역/분야/코드는 최대한 폭을 줄임
//
// ✅ 구현 상 주의사항(실무용)
// - updateFields()는 "존재하는 컬럼명"만 업데이트 가능.
//   잘못된 컬럼 키를 보내면 Apps Script가 COLUMN_NOT_FOUND를 반환함.
//   -> 따라서 아래 save 로직은 "가능성이 있는 컬럼명" 후보를 순차적으로 시도하여,
//      첫 성공 컬럼명으로만 업데이트하도록 설계함(호환성/유지보수성).
//
// 데이터 계약(가정)
// - checklistItems: Checklist 시트에서 로드된 row 객체 배열
//   { code, type, area, domain, itemCode, status, result, result_detail, ... }
// - updateFields(sheetName, code, fields): code(통제 코드) 기준으로 특정 컬럼을 업데이트

import React, { useEffect, useMemo, useState } from "react";
import Select from "../ui/Select";
import { updateFields } from "../lib/sheetsApi";

/** 통제 이행 점검(1단계)과 동일한 진행률 UI를 만들기 위한 ProgressBar */
function ProgressBar({ done, total, label }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-slate-900">{label}</div>
        <div className="text-xs text-slate-500">
          {done}/{total} ({pct}%)
        </div>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full bg-slate-900" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** undefined/null 안전 문자열 변환 */
function normalizeText(v) {
  if (v == null) return "";
  return String(v);
}

/** "결과" 컬럼명은 프로젝트마다 다를 수 있어, 대표 후보들을 모두 허용 */
function getSavedResult(item) {
  return normalizeText(item.result || item.vulnResult || item.vuln_result || "").trim();
}

/** "사유" 컬럼명도 프로젝트/시트마다 다를 수 있어 후보를 허용 */
function getSavedDetail(item) {
  return normalizeText(
    item.result_detail ||
      item.vulnResultDetail ||
      item.vuln_result_detail ||
      item.reason ||
      item.detail ||
      ""
  );
}

/** domain 기준 그룹핑(전체 보기에서만 사용) */
function groupByDomain(items) {
  const map = new Map();
  items.forEach((it) => {
    const d = normalizeText(it.domain || "미분류");
    if (!map.has(d)) map.set(d, []);
    map.get(d).push(it);
  });
  return Array.from(map.entries()).map(([domain, list]) => ({ domain, list }));
}

/**
 * textarea 자동 높이 조정 (입력 내용에 따라 높이를 자연스럽게 확장)
 * - 성능을 위해 onInput에서만 수행
 * - maxHeight를 둬서 지나치게 커지는 것을 방지
 */
function autoResizeTextarea(el) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, 260)}px`;
}

/**
 * Apps Script가 COLUMN_NOT_FOUND를 반환할 때를 대비한 "컬럼 후보 순차 업데이트"
 * - fieldsCandidateList: [{ colName1: value }, { colName2: value }, ...]
 * - 첫 번째로 성공하는 컬럼만 업데이트하고 종료
 */
async function updateWithFallback(sheetName, code, fieldsCandidateList) {
  let lastErr = null;
  for (const fields of fieldsCandidateList) {
    try {
      await updateFields(sheetName, code, fields);
      return { ok: true, used: Object.keys(fields)[0] };
    } catch (e) {
      lastErr = e;
      const msg = normalizeText(e?.message);
      // COLUMN_NOT_FOUND인 경우에만 다음 후보로 넘어감
      if (msg.includes("COLUMN_NOT_FOUND")) continue;
      // 그 외(권한, 네트워크 등)는 즉시 중단
      throw e;
    }
  }
  // 후보를 다 시도했는데도 실패(전부 COLUMN_NOT_FOUND)면 마지막 에러를 던짐
  throw lastErr || new Error("저장 실패");
}

export default function VulnIdentifyPanel({ checklistItems = [], onUpdated }) {
  // ====== UI 상태 ======
  const [selectedDomain, setSelectedDomain] = useState(""); // 분야 필터(빈 문자열=전체)
  const [q, setQ] = useState(""); // 검색어

  // ====== 저장/임시 상태 ======
  // code -> 저장된 결과(양호/취약)
  const [savedResultMap, setSavedResultMap] = useState({});
  // code -> 저장된 사유
  const [savedDetailMap, setSavedDetailMap] = useState({});

  // code -> 저장 전 임시 선택값(양호/취약)
  const [draftResultMap, setDraftResultMap] = useState({});
  // code -> 저장 전 임시 사유
  const [draftDetailMap, setDraftDetailMap] = useState({});

  const [savingCode, setSavingCode] = useState(null);

  // 체크리스트 로드/갱신 시: 서버(시트) 기준 저장값을 map에 동기화
  useEffect(() => {
    const rMap = {};
    const dMap = {};
    (checklistItems || []).forEach((it) => {
      const code = normalizeText(it.code).trim();
      if (!code) return;

      const r = getSavedResult(it);
      if (r) rMap[code] = r;

      const d = getSavedDetail(it);
      if (d) dMap[code] = d;
    });

    setSavedResultMap(rMap);
    setSavedDetailMap(dMap);

    // draft는 사용자가 입력 중일 수 있으니 자동 초기화하지 않음(UX 보호)
  }, [checklistItems]);

  // 분야(domain) 목록(셀렉트 옵션)
  const domains = useMemo(() => {
    const set = new Set();
    (checklistItems || []).forEach((it) => {
      const d = normalizeText(it.domain).trim();
      if (d) set.add(d);
    });
    return Array.from(set);
  }, [checklistItems]);

  // 전체 진행률(필터/검색과 무관하게 전체 기준)
  const progress = useMemo(() => {
    const total = (checklistItems || []).length;
    let done = 0;

    (checklistItems || []).forEach((it) => {
      const code = normalizeText(it.code).trim();
      if (!code) return;

      // 저장된 값 기준(로컬 map 우선, 없으면 item 값)
      const saved = normalizeText(savedResultMap[code] || getSavedResult(it)).trim();
      if (saved === "양호" || saved === "취약") done += 1;
    });

    return { done, total };
  }, [checklistItems, savedResultMap]);

  // 검색/필터 적용
  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();

    return (checklistItems || []).filter((it) => {
      const domainOk = selectedDomain ? normalizeText(it.domain).trim() === selectedDomain : true;
      if (!domainOk) return false;

      if (!query) return true;

      const hay = [
        it.type,
        it.area,
        it.domain,
        it.code,
        it.itemCode,
        it.status,
        getSavedResult(it),
        getSavedDetail(it),
      ]
        .map(normalizeText)
        .join(" ")
        .toLowerCase();

      return hay.includes(query);
    });
  }, [checklistItems, selectedDomain, q]);

  // 전체 보기일 때만 domain별 섹션으로 나눠서 보여줌
  const sections = useMemo(() => {
    if (selectedDomain) return [{ domain: selectedDomain, list: filtered }];
    return groupByDomain(filtered);
  }, [filtered, selectedDomain]);

  // ====== Draft setters ======
  function setDraftResult(code, v) {
    setDraftResultMap((prev) => ({ ...prev, [code]: v }));
  }
  function setDraftDetail(code, v) {
    setDraftDetailMap((prev) => ({ ...prev, [code]: v }));
  }

  // ====== 저장 로직 ======
  async function saveRow(item) {
    const code = normalizeText(item.code).trim();
    if (!code) return;

    const draftResult = normalizeText(draftResultMap[code]).trim();
    const draftDetail = normalizeText(draftDetailMap[code]);

    // 결과는 필수(양호/취약). 사유는 필수로 강제하지 않되(현업에서 빈 값 허용 케이스 존재),
    // 필요하면 아래 주석 해제하여 필수로 만들 수 있음.
    if (draftResult !== "양호" && draftResult !== "취약") return;
    // if (!draftDetail.trim()) return;

    setSavingCode(code);
    try {
      // 1) 결과 저장: 컬럼명이 환경마다 달라 COLUMN_NOT_FOUND가 날 수 있어 후보를 순차 시도
      await updateWithFallback("Checklist", code, [
        { result: draftResult },
        { vulnResult: draftResult },
        { vuln_result: draftResult },
      ]);

      // 2) 사유 저장: 마찬가지로 후보를 순차 시도
      //    ※ "result_detail"이 실제 시트 헤더에 존재해야 정상 저장됩니다.
      await updateWithFallback("Checklist", code, [
        { result_detail: draftDetail },
        { vulnResultDetail: draftDetail },
        { vuln_result_detail: draftDetail },
        { reason: draftDetail },
        { detail: draftDetail },
      ]);

      // 로컬 상태 반영(저장 완료 표기/진행률 반영)
      setSavedResultMap((prev) => ({ ...prev, [code]: draftResult }));
      setSavedDetailMap((prev) => ({ ...prev, [code]: draftDetail }));

      // 저장 성공 후 draft를 남겨둘지/비울지 정책 선택 가능.
      // - 남겨두면 사용자가 "저장된 값"을 그대로 확인/추가 수정 가능
      // - 비우면 "저장됨" 표시만 남고 입력칸은 저장된 값(savedMap)으로 다시 렌더됨
      // 여기서는 UX 단순화를 위해 draft를 비웁니다.
      setDraftResultMap((prev) => {
        const { [code]: _, ...rest } = prev;
        return rest;
      });
      setDraftDetailMap((prev) => {
        const { [code]: _, ...rest } = prev;
        return rest;
      });

      if (typeof onUpdated === "function") onUpdated();
    } finally {
      setSavingCode(null);
    }
  }

  // ====== UI 컴포넌트 ======
  function ResultPill({ label, color, active, onClick }) {
    const base =
      "w-[72px] px-3 py-1 rounded-full text-xs font-semibold border transition select-none text-center";
    const activeCls =
      color === "red"
        ? "bg-red-600 border-red-600 text-white"
        : "bg-blue-600 border-blue-600 text-white";
    const idleCls =
      color === "red"
        ? "bg-white border-red-200 text-red-600 hover:bg-red-50"
        : "bg-white border-blue-200 text-blue-600 hover:bg-blue-50";

    return (
      <button type="button" className={`${base} ${active ? activeCls : idleCls}`} onClick={onClick}>
        {label}
      </button>
    );
  }

  return (
    <div className="space-y-4">
      {/* 진행률(통제 이행 점검과 동일한 스타일) */}
      <ProgressBar
        done={progress.done}
        total={progress.total}
        label="취약 도출 진행률 (전체 통제 기준)"
      />

      {/* 필터 */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 md:flex-row md:items-end">
        <div className="md:w-[280px]">
          <div className="mb-1 text-xs font-semibold text-slate-700">분야(domain)</div>
          <Select
            value={selectedDomain}
            onChange={(v) => setSelectedDomain(v)}
            options={[
              { value: "", label: "전체" },
              ...domains.map((d) => ({ value: d, label: d })),
            ]}
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

      {/* 섹션(분야별) */}
      <div className="space-y-6">
        {sections.map((sec) => (
          <div key={sec.domain} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {/* 전체 보기일 때만 분야 헤더를 보여주고, 특정 분야 필터일 때는 헤더를 간단히 */}
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3">
              <div className="text-sm font-bold text-slate-900">분야: {sec.domain}</div>
              <div className="text-xs text-slate-500">{sec.list.length}개 항목</div>
            </div>

            {/* 표 헤더: 폭 최소화(유형/영역/코드) + 핵심 컬럼(항목/현황/사유) 크게 */}
            <div
              className="
                grid gap-3 border-b border-slate-200 bg-white px-5 py-3 text-xs font-semibold text-slate-600
                grid-cols-[72px_120px_92px_minmax(260px,1fr)_minmax(260px,1fr)_minmax(260px,1fr)_96px_88px]
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

            <div className="divide-y divide-slate-100">
              {sec.list.map((it) => {
                const code = normalizeText(it.code).trim();

                // 화면에 보이는 값은 "draft 우선" (저장 전에도 사용자가 선택한 값이 보여야 함)
                const savedResult = normalizeText(savedResultMap[code] || getSavedResult(it)).trim();
                const draftResult = normalizeText(draftResultMap[code]).trim();
                const effectiveResult = draftResult || savedResult;

                const savedDetail = normalizeText(savedDetailMap[code] ?? getSavedDetail(it));
                const draftDetail = draftDetailMap[code];
                const effectiveDetail = draftDetail != null ? draftDetail : savedDetail;

                return (
                  <div
                    key={code || `${sec.domain}-${Math.random()}`}
                    className="
                      grid gap-3 px-5 py-4 items-start
                      grid-cols-[72px_120px_92px_minmax(260px,1fr)_minmax(260px,1fr)_minmax(260px,1fr)_96px_88px]
                    "
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

                    {/* 항목 (가장 중요) */}
                    <div className="text-sm leading-relaxed text-slate-900">
                      {normalizeText(it.itemCode)}
                    </div>

                    {/* 현황(status): 개행 유지 + 파란 강조 */}
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                      <div className="mb-1 text-xs font-semibold text-blue-700">현황</div>
                      <div className="whitespace-pre-wrap text-sm leading-relaxed text-blue-900">
                        {normalizeText(it.status) || "—"}
                      </div>
                    </div>

                    {/* 사유(result_detail): 입력(자동 높이) */}
                    <div>
                      <textarea
                        value={effectiveDetail}
                        onChange={(e) => setDraftDetail(code, e.target.value)}
                        onInput={(e) => autoResizeTextarea(e.currentTarget)}
                        ref={(el) => autoResizeTextarea(el)}
                        className="
                          w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm
                          outline-none focus:ring-2 focus:ring-slate-200
                          whitespace-pre-wrap
                        "
                        placeholder="취약/양호 판단 사유를 입력하세요(필요 시 근거/증적 포함)"
                        rows={3}
                      />
                    </div>

                    {/* 결과: 폭 줄이고 가운데 정렬 + 색상 */}
                    <div className="flex flex-col items-center gap-2 pt-1">
                      <ResultPill
                        label="양호"
                        color="blue"
                        active={effectiveResult === "양호"}
                        onClick={() => setDraftResult(code, "양호")}
                      />
                      <ResultPill
                        label="취약"
                        color="red"
                        active={effectiveResult === "취약"}
                        onClick={() => setDraftResult(code, "취약")}
                      />

                      {/* 저장 상태(저장된 결과 기준) */}
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

                    {/* 저장 버튼: 결과 선택이 있어야 활성화 */}
                    <div className="flex justify-center pt-1">
                      <button
                        type="button"
                        onClick={() => saveRow(it)}
                        disabled={savingCode === code || (draftResultMap[code] !== "양호" && draftResultMap[code] !== "취약")}
                        className="
                          rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white
                          hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40
                        "
                        title="결과/사유를 저장"
                      >
                        {savingCode === code ? "저장중" : "저장"}
                      </button>
                    </div>
                  </div>
                );
              })}

              {sec.list.length === 0 && (
                <div className="px-5 py-10 text-center text-sm text-slate-500">표시할 항목이 없습니다.</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
