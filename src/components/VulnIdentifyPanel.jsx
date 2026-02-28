// src/components/VulnIdentifyPanel.jsx
// 취약 도출(2단계) 화면
//
// 요구사항 정리
// 1) 진행률: "분야별"이 아니라 "전체 통제 개수 대비" (결과가 저장된 항목 수 / 전체 항목 수)
// 2) 분야(domain): 상단 셀렉트로 필터링. (전체 선택 시에는 분야 구분(섹션 헤더)도 보여줌)
// 3) 현황(status): 통제 이행 점검 페이지처럼 "개행이 유지"되어 보이게(whitespace-pre-wrap) + 파란색 강조 박스
// 4) 결과(양호/취약): 폭 줄이고 가운데 정렬. 취약=빨강, 양호=파랑.
// 5) 저장: (양호/취약) 선택만으로는 반영되지 않고, "저장"을 눌렀을 때만 시트에 반영 + 저장표시(savedMap) 갱신
// 6) 항목/현황: 화면에서 가장 중요하니 폭을 크게. (항목과 현황을 거의 동일 폭으로)
// 7) 사유(result_detail): 항목/현황 다음에 입력 칸 제공. 사유 입력 + (양호/취약) 선택 + 저장 클릭 시에만 반영
//
// 데이터/함수 가정
// - checklistItems: 상위에서 내려오는 데이터(시트 로드 결과)
// - updateFields: code 기준으로 특정 컬럼을 업데이트하는 함수
// - 시트 컬럼명이 프로젝트마다 다를 수 있어 result/vulnResult, result_detail/resultDetail 모두 대응

import React, { useEffect, useMemo, useState } from "react";
import Select from "../ui/Select";
import { updateFields } from "../lib/sheetsApi";

/** StatusWritePanel 과 동일한 스타일의 진행률 바(텍스트 + 얇은 바) */
// 통제 이행 점검 페이지의 진행률 UI와 동일한 스타일(요구사항)
function ProgressBar({ done, total, label, helper }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-slate-600">
        <div className="font-semibold">{label}</div>
        <div>
          {done}/{total} ({pct}%)
        </div>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
        <div className="h-2 bg-slate-900" style={{ width: `${pct}%` }} />
      </div>
      {helper ? <div className="text-xs text-slate-600">{helper}</div> : null}
    </div>
  );
}

function normalizeText(v) {
  if (v == null) return "";
  return String(v);
}

/** 저장된 결과 컬럼명은 repo마다 다를 수 있어 둘 다 허용 */
function getItemResult(item) {
  return normalizeText(item.vulnResult || item.result || "").trim();
}

/** 저장된 사유 컬럼명은 repo마다 다를 수 있어 둘 다 허용 */
function getItemResultDetail(item) {
  return normalizeText(item.result_detail || item.resultDetail || "").trim();
}

function groupByDomain(items) {
  const map = new Map();
  items.forEach((it) => {
    const d = normalizeText(it.domain || "미분류").trim() || "미분류";
    if (!map.has(d)) map.set(d, []);
    map.get(d).push(it);
  });
  return Array.from(map.entries()).map(([domain, list]) => ({ domain, list }));
}

/** textarea 높이를 내용에 맞춰 자동 조정 */
function autoResizeTextarea(el) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

function ResultPill({ label, color, active, onClick }) {
  // ✅ 폭 줄이고 가운데 정렬(요구사항)
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

export default function VulnIdentifyPanel({ checklistItems = [], onUpdated }) {
  // 분야(domain) 필터
  const [selectedDomain, setSelectedDomain] = useState("");

  // 검색
  const [q, setQ] = useState("");

  // code -> 저장된 결과/사유 (서버/시트 기준 스냅샷)
  // 예: { "1.1.2.1": { result: "양호", detail: "..." } }
  const [savedMap, setSavedMap] = useState({});

  // code -> 임시 입력(저장 전)
  const [draftResultMap, setDraftResultMap] = useState({});
  const [draftDetailMap, setDraftDetailMap] = useState({});

  const [savingCode, setSavingCode] = useState(null);

  // ✅ checklistItems가 바뀌면 savedMap을 다시 동기화(시트에 저장된 값 기준)
  useEffect(() => {
    const m = {};
    (checklistItems || []).forEach((it) => {
      const code = normalizeText(it.code).trim();
      if (!code) return;
      const r = getItemResult(it);
      const d = getItemResultDetail(it);
      if (r || d) m[code] = { result: r, detail: d };
    });
    setSavedMap(m);
    // ⚠ draft는 사용자가 입력 중인 값이 있을 수 있으므로 강제 초기화하지 않음(유지보수 측면에서 안전)
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

  // ✅ 전체 진행률(필터/검색과 무관하게 "전체 통제" 기준)
  const progress = useMemo(() => {
    const total = (checklistItems || []).length;
    let done = 0;
    (checklistItems || []).forEach((it) => {
      const code = normalizeText(it.code).trim();
      if (!code) return;
      const saved = savedMap[code]?.result || getItemResult(it);
      if (saved === "양호" || saved === "취약") done += 1;
    });
    return { done, total };
  }, [checklistItems, savedMap]);

  // 검색/필터 적용된 items
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
        it.itemCode, // ✅ 항목은 itemCode 컬럼
        it.status,
        getItemResult(it),
        getItemResultDetail(it),
      ]
        .map(normalizeText)
        .join(" ")
        .toLowerCase();
      return hay.includes(query);
    });
  }, [checklistItems, selectedDomain, q]);

  // "전체" 선택이면 domain별 섹션으로 구분, 특정 domain 선택이면 단일 섹션
  const sections = useMemo(() => {
    if (selectedDomain) return [{ domain: selectedDomain, list: filtered }];
    return groupByDomain(filtered);
  }, [filtered, selectedDomain]);

  function setDraftResult(code, v) {
    setDraftResultMap((prev) => ({ ...prev, [code]: v }));
  }

  function setDraftDetail(code, v) {
    setDraftDetailMap((prev) => ({ ...prev, [code]: v }));
  }

  /**
   * 한 항목 저장
   * - "저장" 버튼을 눌렀을 때만 시트에 반영되게 해야 함(요구사항)
   * - sheetsApi.updateFields 시그니처는 StatusWritePanel과 동일하게 사용:
   *     updateFields(sheetName, code, fields)
   */
  async function saveOne(item) {
    const code = normalizeText(item.code).trim();
    if (!code) return;

    // 저장 시점에만 반영되도록 draft를 사용
    const draftResult = normalizeText(draftResultMap[code]).trim();
    const draftDetail = normalizeText(draftDetailMap[code]);

    // 결과는 반드시 양호/취약 중 하나여야 저장 가능
    if (draftResult !== "양호" && draftResult !== "취약") return;

    setSavingCode(code);
    try {
      // ✅ Checklist 시트에 결과/사유 저장
      // - 결과 컬럼: result / vulnResult / vuln_result 중 존재하는 컬럼에 반영
      // - 사유 컬럼: result_detail / resultDetail 중 존재하는 컬럼에 반영
      await updateFields("Checklist", code, {
        // 결과(양호/취약)
        result: draftResult,
        vulnResult: draftResult,
        vuln_result: draftResult,

        // 사유
        result_detail: draftDetail,
        resultDetail: draftDetail,
      });

      // 저장 성공 시 savedMap 갱신
      setSavedMap((prev) => ({
        ...prev,
        [code]: { result: draftResult, detail: draftDetail },
      }));

      if (typeof onUpdated === "function") onUpdated();
    } catch (e) {
      alert("저장 실패: " + String(e?.message || e));
    } finally {
      setSavingCode(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* 헤더 + 진행률(통제 이행 점검과 동일한 레이아웃) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
        <div>
          <div className="text-lg font-bold text-slate-900">취약 도출</div>
          <div className="text-sm text-slate-600">
            통제 이행 점검의 현황(status)을 근거로 각 항목의 결과(양호/취약)와 사유를 작성하여 저장합니다.
          </div>
        </div>

        <ProgressBar
          done={progress.done}
          total={progress.total}
          label="취약 도출 진행률 (전체 통제 기준)"
          helper="분야(domain) 필터와 무관하게 전체 통제 개수 대비 저장된 결과(양호/취약) 기준으로 계산합니다."
        />
      </div>

      {/* 필터 */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 md:flex-row md:items-end">
        <div className="md:w-[280px]">
          <div className="text-xs font-semibold text-slate-700 mb-1">분야(domain)</div>
          <Select
            value={selectedDomain}
            onChange={(v) => setSelectedDomain(v)}
            options={[{ value: "", label: "전체" }, ...domains.map((d) => ({ value: d, label: d }))]}
          />
        </div>

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

      {/* 섹션(분야별) */}
      <div className="space-y-6">
        {sections.map((sec) => (
          <div key={sec.domain} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            {/* 분야 헤더 */}
            <div className="flex items-center justify-between gap-3 px-5 py-3 bg-slate-50 border-b border-slate-200">
              <div className="text-sm font-bold text-slate-900">분야: {sec.domain}</div>
              <div className="text-xs text-slate-500">{sec.list.length}개 항목</div>
            </div>

            {/* 컬럼 헤더 */}
            <div
              className="grid gap-3 px-5 py-3 text-xs font-semibold text-slate-600 border-b border-slate-200 bg-white"
              style={{
                // ✅ 유형/영역/코드 폭 최소화, 항목/현황(그리고 사유) 폭 확대
                gridTemplateColumns:
                  "64px 120px 92px minmax(260px,1fr) minmax(260px,1fr) minmax(220px,1fr) 96px 88px",
              }}
            >
              <div className="text-center">유형</div>
              <div className="truncate">영역</div>
              <div className="text-center">코드</div>
              <div>항목</div>
              <div>현황(status)</div>
              <div>사유</div>
              <div className="text-center">결과</div>
              <div className="text-center">저장</div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-slate-100">
              {sec.list.map((it) => {
                const code = normalizeText(it.code).trim();
                const statusText = normalizeText(it.status);

                // ✅ 저장된 값(시트 기준)
                const savedResult = savedMap[code]?.result || getItemResult(it);
                const savedDetail = savedMap[code]?.detail || getItemResultDetail(it);

                // ✅ 드래프트(저장 전)
                const draftResult = draftResultMap[code];
                const draftDetail = draftDetailMap[code];

                // 화면 표시용: 사용자가 무엇을 선택했는지 보이도록 draft를 우선 표시
                const effectiveResult = draftResult || savedResult;

                // 저장 가능 조건: 결과(양호/취약) 선택됨
                const canSave = draftResult === "양호" || draftResult === "취약";

                return (
                  <div
                    key={code || `${sec.domain}-${Math.random()}`}
                    className="grid gap-3 px-5 py-4 items-start"
                    style={{
                      gridTemplateColumns:
                        "64px 120px 92px minmax(260px,1fr) minmax(260px,1fr) minmax(220px,1fr) 96px 88px",
                    }}
                  >
                    {/* 유형 */}
                    <div className="text-sm text-slate-700 text-center">{normalizeText(it.type)}</div>

                    {/* 영역 */}
                    <div className="text-sm text-slate-700 truncate">{normalizeText(it.area)}</div>

                    {/* 코드 */}
                    <div className="flex justify-center">
                      <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
                        {normalizeText(it.code)}
                      </span>
                    </div>

                    {/* ✅ 항목: itemCode 컬럼 */}
                    <div className="text-sm text-slate-900 leading-relaxed">{normalizeText(it.itemCode)}</div>

                    {/* ✅ 현황(status) - 개행 유지 + 파란 강조 */}
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                      <div className="text-xs font-semibold text-blue-700 mb-1">현황</div>
                      <div className="text-sm text-blue-900 whitespace-pre-wrap leading-relaxed">
                        {statusText || "—"}
                      </div>
                    </div>

                    {/* ✅ 사유(result_detail) - 자동 높이 조절 */}
                    <div>
                      <textarea
                        className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-200 resize-none"
                        placeholder="사유를 입력하세요 (저장 시 반영)"
                        value={draftDetail != null ? draftDetail : savedDetail}
                        onChange={(e) => {
                          setDraftDetail(code, e.target.value);
                          autoResizeTextarea(e.target);
                        }}
                        onInput={(e) => autoResizeTextarea(e.currentTarget)}
                        rows={3}
                      />
                      <div className="mt-1 text-[11px] text-slate-400">
                        저장 전 입력은 임시값이며, "저장" 클릭 시에만 시트에 반영됩니다.
                      </div>
                    </div>

                    {/* ✅ 결과: 폭 축소 + 가운데 정렬 + 색상 */}
                    <div className="flex flex-col items-center justify-start gap-2 pt-1">
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

                      {/* 저장 상태(시트 기준) */}
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

                    {/* ✅ 저장 버튼 */}
                    <div className="flex justify-center pt-1">
                      <button
                        type="button"
                        onClick={() => saveOne(it)}
                        disabled={!canSave || savingCode === code}
                        className="rounded-xl px-4 py-2 text-sm font-semibold bg-slate-900 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800"
                        title="선택한 결과(양호/취약)와 사유를 저장"
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
