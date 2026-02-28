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
//
// NOTE
// - checklistItems는 상위에서 내려오는 데이터(시트 로드 결과)라고 가정.
// - updateFields는 code 기준으로 특정 컬럼을 업데이트하는 함수라고 가정.
// - 시트 컬럼명이 프로젝트마다 다를 수 있어, 안전하게 vulnResult / result 둘 다 써서 업데이트를 시도함.

import React, { useEffect, useMemo, useState } from "react";
import Select from "../ui/Select";
import { updateFields } from "../lib/sheetsApi";

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

function normalizeText(v) {
  if (v == null) return "";
  return String(v);
}

function getItemResult(item) {
  // 저장된 결과 컬럼명이 repo마다 다를 수 있어 둘 다 허용
  return normalizeText(item.vulnResult || item.result || "").trim();
}

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

export default function VulnIdentifyPanel({ checklistItems = [], onUpdated }) {
  // 분야(domain) 필터
  const [selectedDomain, setSelectedDomain] = useState("");

  // 검색
  const [q, setQ] = useState("");

  // code -> 저장된 결과
  const [savedMap, setSavedMap] = useState({});
  // code -> 임시 선택(저장 전)
  const [draftMap, setDraftMap] = useState({});
  const [savingCode, setSavingCode] = useState(null);

  // 초기/갱신 시 savedMap 동기화
  useEffect(() => {
    const m = {};
    (checklistItems || []).forEach((it) => {
      const code = normalizeText(it.code);
      if (!code) return;
      const r = getItemResult(it);
      if (r) m[code] = r; // "양호" | "취약"
    });
    setSavedMap(m);
    // draft는 사용자가 선택한 값만 유지하고 싶으면 여기서 초기화하지 않는 편이 안전함
  }, [checklistItems]);

  // 도메인 목록
  const domains = useMemo(() => {
    const set = new Set();
    (checklistItems || []).forEach((it) => {
      const d = normalizeText(it.domain);
      if (d) set.add(d);
    });
    return Array.from(set);
  }, [checklistItems]);

  // 전체 진행률(필터와 무관하게 전체 기준)
  const progress = useMemo(() => {
    const total = (checklistItems || []).length;
    let done = 0;
    (checklistItems || []).forEach((it) => {
      const code = normalizeText(it.code);
      if (!code) return;
      const r = savedMap[code] || getItemResult(it);
      if (r === "양호" || r === "취약") done += 1;
    });
    return { done, total };
  }, [checklistItems, savedMap]);

  // 검색/필터 적용된 items
  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return (checklistItems || []).filter((it) => {
      const domainOk = selectedDomain ? normalizeText(it.domain) === selectedDomain : true;
      if (!domainOk) return false;

      if (!query) return true;
      const hay = [
        it.type,
        it.area,
        it.domain,
        it.code,
        it.item,
        it.status,
        getItemResult(it),
      ]
        .map(normalizeText)
        .join(" ")
        .toLowerCase();
      return hay.includes(query);
    });
  }, [checklistItems, selectedDomain, q]);

  // "전체" 선택이면 domain별로 섹션 구분해서 보여줌
  const sections = useMemo(() => {
    if (selectedDomain) {
      return [{ domain: selectedDomain, list: filtered }];
    }
    return groupByDomain(filtered);
  }, [filtered, selectedDomain]);

  function setDraft(code, v) {
    setDraftMap((prev) => ({ ...prev, [code]: v }));
  }

  async function saveResult(item) {
    const code = normalizeText(item.code);
    if (!code) return;

    const draft = normalizeText(draftMap[code]).trim();
    if (draft !== "양호" && draft !== "취약") return;

    setSavingCode(code);
    try {
      // 시트 컬럼명이 "vulnResult" 또는 "result" 중 무엇이든 대응하도록 둘 다 전달
      await updateFields([{ code, vulnResult: draft, result: draft }]);

      setSavedMap((prev) => ({ ...prev, [code]: draft }));

      if (typeof onUpdated === "function") onUpdated();
    } finally {
      setSavingCode(null);
    }
  }

  function ResultPill({ label, color, active, onClick }) {
    const base =
      "px-3 py-1 rounded-full text-xs font-semibold border transition select-none";
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
    <div className="space-y-6">
      {/* 상단 헤더 + 진행률 */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-lg font-bold text-slate-900">2. 취약 도출</div>
          <div className="text-sm text-slate-600">
            통제 이행 점검의 현황(status)을 근거로 각 항목의 결과(양호/취약)를 저장합니다.
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

        <div className="flex-1">
          <div className="text-xs font-semibold text-slate-700 mb-1">검색</div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            placeholder="유형/영역/분야/코드/항목/현황/결과 검색"
          />
        </div>
      </div>

      {/* 결과 테이블 */}
      <div className="space-y-6">
        {sections.map((sec) => (
          <div key={sec.domain} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            {/* 분야 구분 */}
            <div className="flex items-center justify-between gap-3 px-5 py-3 bg-slate-50 border-b border-slate-200">
              <div className="text-sm font-bold text-slate-900">분야: {sec.domain}</div>
              <div className="text-xs text-slate-500">{sec.list.length}개 항목</div>
            </div>

            {/* 헤더 */}
            <div
              className="
                grid gap-3 px-5 py-3 text-xs font-semibold text-slate-600
                border-b border-slate-200 bg-white
                grid-cols-[72px_140px_96px_minmax(260px,1fr)_minmax(260px,1fr)_120px_88px]
              "
            >
              <div className="text-center">유형</div>
              <div className="truncate">영역</div>
              <div className="text-center">코드</div>
              <div>항목</div>
              <div>현황(status)</div>
              <div className="text-center">결과</div>
              <div className="text-center">저장</div>
            </div>

            {/* rows */}
            <div className="divide-y divide-slate-100">
              {sec.list.map((it) => {
                const code = normalizeText(it.code);
                const saved = savedMap[code] || getItemResult(it);
                const draft = draftMap[code] || "";
                const effective = draft || saved; // 화면 표시용(저장 전 선택도 보이게)
                const statusText = normalizeText(it.status);

                return (
                  <div
                    key={code || `${sec.domain}-${Math.random()}`}
                    className="
                      grid gap-3 px-5 py-4 items-start
                      grid-cols-[72px_140px_96px_minmax(260px,1fr)_minmax(260px,1fr)_120px_88px]
                    "
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

                    {/* 항목 */}
                    <div className="text-sm text-slate-900 leading-relaxed">
                      {normalizeText(it.item)}
                    </div>

                    {/* 현황(status) - 개행 유지 + 파란 강조 */}
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                      <div className="text-xs font-semibold text-blue-700 mb-1">현황</div>
                      <div className="text-sm text-blue-900 whitespace-pre-wrap leading-relaxed">
                        {statusText || "—"}
                      </div>
                    </div>

                    {/* 결과 버튼 */}
                    <div className="flex flex-col items-center justify-start gap-2 pt-1">
                      <ResultPill
                        label="양호"
                        color="blue"
                        active={effective === "양호"}
                        onClick={() => setDraft(code, "양호")}
                      />
                      <ResultPill
                        label="취약"
                        color="red"
                        active={effective === "취약"}
                        onClick={() => setDraft(code, "취약")}
                      />

                      {/* 저장 상태 표시 */}
                      {saved ? (
                        <div
                          className={`text-[11px] font-semibold ${
                            saved === "취약" ? "text-red-600" : "text-blue-600"
                          }`}
                        >
                          저장됨
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-400">미저장</div>
                      )}
                    </div>

                    {/* 저장 버튼 */}
                    <div className="flex justify-center pt-1">
                      <button
                        type="button"
                        onClick={() => saveResult(it)}
                        disabled={savingCode === code || (draftMap[code] !== "양호" && draftMap[code] !== "취약")}
                        className="
                          rounded-xl px-4 py-2 text-sm font-semibold
                          bg-slate-900 text-white disabled:opacity-40 disabled:cursor-not-allowed
                          hover:bg-slate-800
                        "
                        title="선택한 결과를 저장"
                      >
                        {savingCode === code ? "저장중" : "저장"}
                      </button>
                    </div>
                  </div>
                );
              })}

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
