// src/components/VulnIdentifyPanel.jsx
// 취약 도출(2단계) 화면
//
// ✅ 요구사항(요약)
// 1) 진행률: "분야별"이 아니라 "전체 통제 개수 대비" (저장된 결과 수 / 전체 항목 수)
// 2) 분야(domain): 상단 셀렉트로 필터링. (전체 선택 시에는 분야 구분 섹션도 보여줌)
// 3) 현황(status): 개행 유지(whitespace-pre-wrap) + 파란색 강조 박스
// 4) 결과(양호/취약): 폭 줄이고 가운데 정렬. 취약=빨강, 양호=파랑.
// 5) 저장: (양호/취약) 선택만으로는 반영되지 않고, "저장" 클릭 시에만 시트 반영
// 6) 항목/현황이 핵심: 폭 크게(항목/현황 거의 동일 폭) + 사유(result_detail) 입력 칸 추가
// 7) 사유 저장 오류(COLUMN_NOT_FOUND) 대응: 프로젝트마다 컬럼명이 다를 수 있어, 몇 가지 후보를 순차 시도
//
// ⚠️ 참고
// - 이 컴포넌트는 "2. 취약 도출" 화면(리스트/저장)만 담당합니다.
//   스크린샷의 상단 "1. 취약 도출" 카드(빨간 박스)는 보통 상위 페이지(App/라우트)에서 렌더링되는 별도 섹션입니다.
//   => 이 파일만 수정해선 그 카드가 사라지지 않습니다(상위 페이지에서 해당 섹션을 제거해야 함).
//
// - checklistItems: 상위에서 내려오는 시트 로드 결과 (Checklist 시트 로드 결과)라고 가정
//   필드 예: { type, area, domain, code, itemCode, status, vulnResult/result, result_detail/... }
//
// - updateFields(sheetName, code, patchObject): code 기준으로 특정 컬럼을 업데이트하는 함수라고 가정
//   (StatusWritePanel.jsx에서 updateFields("Checklist", code, { status: ... }) 형태로 사용)

// eslint-disable-next-line no-unused-vars
import React, { useEffect, useMemo, useRef, useState } from "react";
import Select from "../ui/Select";
import { updateFields } from "../lib/sheetsApi";

/** 값이 null/undefined여도 안정적으로 문자열화 */
function normalizeText(v) {
  if (v == null) return "";
  return String(v);
}

/** 결과 컬럼(repo마다 다를 수 있어 여러 후보를 허용) */
function getItemResult(item) {
  return normalizeText(item.vulnResult ?? item.result ?? "").trim();
}

/** 사유 컬럼(repo마다 다를 수 있어 여러 후보를 허용) */
function getItemDetail(item) {
  return normalizeText(
    item.result_detail ??
      item.resultDetail ??
      item.vuln_detail ??
      item.vulnDetail ??
      item.reason ??
      item.detail ??
      item["사유"] ??
      ""
  );
}

/** 도메인별 그룹핑(전체 선택 시 섹션 헤더 표시용) */
function groupByDomain(items) {
  const map = new Map();
  items.forEach((it) => {
    const d = normalizeText(it.domain || "미분류");
    if (!map.has(d)) map.set(d, []);
    map.get(d).push(it);
  });
  return Array.from(map.entries()).map(([domain, list]) => ({ domain, list }));
}

/** 진행률 바(통제 이행 점검과 동일한 스타일: 1줄 헤더 + 막대) */
function ProgressBar({ done, total, label, helper }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">{label}</div>
          {helper ? (
            <div className="mt-1 text-xs text-slate-500">{helper}</div>
          ) : null}
        </div>
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

/** textarea 자동 높이 조정(입력 내용에 맞게 늘어남) */
function autosizeTextarea(el) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

/** 결과 pill 버튼 */
function ResultPill({ label, color, active, onClick }) {
  const base =
    "w-[64px] px-0 py-1 rounded-full text-xs font-semibold border transition select-none text-center";
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

export default function VulnIdentifyPanel({ checklistItems = [] /*, onUpdated*/ }) {
  // 분야(domain) 필터
  const [selectedDomain, setSelectedDomain] = useState("");

  // 검색
  const [q, setQ] = useState("");

  // code -> 저장된 결과 / 사유
  const [savedResultMap, setSavedResultMap] = useState({});
  const [savedDetailMap, setSavedDetailMap] = useState({});

  // code -> 임시 선택(저장 전)
  const [draftResultMap, setDraftResultMap] = useState({});
  const [draftDetailMap, setDraftDetailMap] = useState({});

  // 저장 진행중(code)
  const [savingCode, setSavingCode] = useState(null);

  // 초기/갱신 시 저장 값 동기화
  useEffect(() => {
    const rMap = {};
    const dMap = {};
    (checklistItems || []).forEach((it) => {
      const code = normalizeText(it.code).trim();
      if (!code) return;

      const r = getItemResult(it);
      const d = getItemDetail(it);

      if (r) rMap[code] = r;
      if (d) dMap[code] = d;
    });
    setSavedResultMap(rMap);
    setSavedDetailMap(dMap);

    // ⚠ draft는 사용자 입력 중일 수 있어 여기서 강제 초기화하지 않습니다.
  }, [checklistItems]);

  // 도메인 목록(Select 옵션)
  const domains = useMemo(() => {
    const set = new Set();
    (checklistItems || []).forEach((it) => {
      const d = normalizeText(it.domain).trim();
      if (d) set.add(d);
    });
    return Array.from(set);
  }, [checklistItems]);

  // 전체 진행률(필터와 무관하게 전체 통제 기준)
  const progress = useMemo(() => {
    const total = (checklistItems || []).length;
    let done = 0;

    (checklistItems || []).forEach((it) => {
      const code = normalizeText(it.code).trim();
      if (!code) return;

      // 저장된 결과 우선, 없으면 item에 있는 값 사용
      const r = normalizeText(savedResultMap[code] ?? getItemResult(it)).trim();
      if (r === "양호" || r === "취약") done += 1;
    });

    return { done, total };
  }, [checklistItems, savedResultMap]);

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
        getItemResult(it),
        getItemDetail(it),
      ]
        .map(normalizeText)
        .join(" ")
        .toLowerCase();

      return hay.includes(query);
    });
  }, [checklistItems, selectedDomain, q]);

  // "전체" 선택이면 domain별로 섹션 구분
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
   * 컬럼명이 제각각인 경우를 위해 "후보 패치"를 순차 시도한다.
   * - sheetsApi 구현이 "알 수 없는 컬럼이 포함되면 전체 실패" 형태일 때(COLUMN_NOT_FOUND),
   *   한 번에 여러 키를 보내면 실패하므로, 가장 가능성 높은 조합부터 단일/소수 키로 재시도한다.
   */
  async function tryUpdateWithFallbacks(code, resultValue, detailValue) {
    const result = normalizeText(resultValue).trim();
    const detail = normalizeText(detailValue);

    // 가장 가능성이 높은 조합부터 시도
    const patches = [
      // 1) result + result_detail (snake_case)
      { result, result_detail: detail },
      // 2) vulnResult + result_detail
      { vulnResult: result, result_detail: detail },
      // 3) result + resultDetail (camelCase)
      { result, resultDetail: detail },
      // 4) vulnResult + vuln_detail
      { vulnResult: result, vuln_detail: detail },
      // 5) result + reason
      { result, reason: detail },
      // 6) result + "사유"(헤더가 한글인 경우)
      { result, "사유": detail },
    ];

    let lastErr = null;

    // eslint-disable-next-line no-restricted-syntax
    for (const patch of patches) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await updateFields("Checklist", code, patch);
        return;
      } catch (e) {
        lastErr = e;

        const msg = String(e?.message || e);
        if (!msg.includes("COLUMN_NOT_FOUND")) throw e;
      }
    }

    throw lastErr || new Error("COLUMN_NOT_FOUND");
  }

  async function saveRow(it) {
    const code = normalizeText(it.code).trim();
    if (!code) return;

    const draftResult = normalizeText(draftResultMap[code]).trim();
    if (draftResult !== "양호" && draftResult !== "취약") {
      alert("결과(양호/취약)를 먼저 선택하세요.");
      return;
    }

    const draftDetail = draftDetailMap[code] ?? savedDetailMap[code] ?? "";

    setSavingCode(code);

    try {
      await tryUpdateWithFallbacks(code, draftResult, draftDetail);

      // UI 즉시 반영
      setSavedResultMap((prev) => ({ ...prev, [code]: draftResult }));
      setSavedDetailMap((prev) => ({ ...prev, [code]: draftDetail }));

      // draft result만 정리 (사유는 유지)
      setDraftResultMap((prev) => {
        const next = { ...prev };
        delete next[code];
        return next;
      });

      alert("저장 완료");
    } catch (e) {
      alert("저장 실패: " + String(e?.message || e));
    } finally {
      setSavingCode(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div>
            <div className="text-lg font-bold text-slate-900">2. 취약 도출</div>
            <div className="text-sm text-slate-600">
              통제 이행 점검의 현황(status)을 근거로 각 항목의 결과(양호/취약)와 사유를 저장합니다.
            </div>
          </div>
        </div>

        <div className="px-6 py-5">
          <ProgressBar
            done={progress.done}
            total={progress.total}
            label="취약 도출 진행률 (전체 통제 기준)"
            helper="분야(domain) 필터와 무관하게 전체 통제 개수 대비 저장된 결과(양호/취약) 기준으로 계산합니다."
          />
        </div>
      </div>

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
            placeholder="유형/영역/분야/코드/항목/현황/사유/결과 검색"
          />
        </div>
      </div>

      <div className="space-y-6">
        {sections.map((sec) => (
          <div key={sec.domain} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {!selectedDomain ? (
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3">
                <div className="text-sm font-bold text-slate-900">분야: {sec.domain}</div>
                <div className="text-xs text-slate-500">{sec.list.length}개 항목</div>
              </div>
            ) : null}

            <div
              className="
                grid gap-3 border-b border-slate-200 bg-white px-5 py-3
                text-xs font-semibold text-slate-600
                grid-cols-[72px_140px_96px_minmax(260px,1fr)_minmax(260px,1fr)_minmax(260px,1fr)_120px_88px]
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
                const code = normalizeText(it.code).trim() || `${sec.domain}-${Math.random()}`;

                const savedResult = savedResultMap[code] ?? getItemResult(it);
                const savedDetail = savedDetailMap[code] ?? getItemDetail(it);

                const draftResult = draftResultMap[code] ?? "";
                const draftDetail = draftDetailMap[code];

                const effectiveResult = draftResult || savedResult;
                const effectiveDetail = draftDetail != null ? draftDetail : savedDetail;

                const statusText = normalizeText(it.status);

                return (
                  <div
                    key={code}
                    className="
                      grid gap-3 px-5 py-4 items-start
                      grid-cols-[72px_140px_96px_minmax(260px,1fr)_minmax(260px,1fr)_minmax(260px,1fr)_120px_88px]
                    "
                  >
                    <div className="text-center text-sm text-slate-700">{normalizeText(it.type)}</div>
                    <div className="truncate text-sm text-slate-700">{normalizeText(it.area)}</div>

                    <div className="flex justify-center">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        {normalizeText(it.code)}
                      </span>
                    </div>

                    <div className="text-sm leading-relaxed text-slate-900">{normalizeText(it.itemCode)}</div>

                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                      <div className="mb-1 text-xs font-semibold text-blue-700">현황</div>
                      <div className="whitespace-pre-wrap text-sm leading-relaxed text-blue-900">
                        {statusText || "—"}
                      </div>
                    </div>

                    <div>
                      <textarea
                        value={effectiveDetail}
                        onChange={(e) => setDraftDetail(code, e.target.value)}
                        onInput={(e) => autosizeTextarea(e.currentTarget)}
                        className="
                          w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2
                          text-sm leading-relaxed outline-none focus:ring-2 focus:ring-slate-200
                        "
                        placeholder="사유를 입력하세요 (예: 취약 판단 근거 / 개선 필요사항 등)"
                        rows={3}
                      />
                      <div className="mt-1 text-[11px] text-slate-400">
                        * 사유는 저장 버튼을 눌렀을 때만 시트에 반영됩니다.
                      </div>
                    </div>

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

                    <div className="flex justify-center pt-1">
                      <button
                        type="button"
                        onClick={() => saveRow(it)}
                        disabled={savingCode === code || (draftResultMap[code] !== "양호" && draftResultMap[code] !== "취약")}
                        className="
                          rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white
                          hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40
                        "
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
