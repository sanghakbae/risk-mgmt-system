// src/components/VulnIdentifyPanel.jsx
//
// 목적
// - "취약 도출" 화면: 통제(질문)별 현황(status)을 근거로 결과(양호/취약)를 확정하고 저장
// - 결과는 "저장"을 눌렀을 때만 Sheets에 반영되도록(=draft/commit 패턴)
// - 분야(domain) 구분(섹션 헤더) 제공
// - 항목(질문)과 현황(status) 영역을 넓게, 나머지(유형/영역/분야/코드/결과/저장)는 폭을 줄이고 가운데 정렬
// - 현황(status)은 개행을 보존하여 파란색으로 잘 보이게 표시
// - 결과 컬럼은 폭을 줄이고, 양호=파랑/취약=빨강으로 색상 표시
// - 진행률은 "전체 통제 개수 대비"로 계산 (분야별이 아닌 전체 기준)
//
// 주의
// - updateFields는 StatusWritePanel에서 사용하던 것과 동일한 시그니처를 가정합니다.
//   updateFields(sheetName, code, { field: value, ... })
// - 실제 시트 컬럼명이 다르면 RESULT_FIELD 값을 바꿔주세요.

import React, { useEffect, useMemo, useState } from "react";
import { updateFields } from "../lib/sheetsApi";

// ✅ 시트/필드명은 프로젝트에 맞게 조정하세요.
const SHEET_NAME = "Checklist";
// 결과 저장 컬럼(예: result, vuln_result 등)
const RESULT_FIELD = "result";

function normalizeResult(v) {
  if (!v) return "";
  const s = String(v).trim();
  if (s === "양호" || s.toLowerCase() === "good") return "양호";
  if (s === "취약" || s.toLowerCase() === "vuln" || s.toLowerCase() === "vulnerable") return "취약";
  return s; // 기타 값은 그대로
}

function getSavedResult(item) {
  // 다양한 데이터 모델을 방어적으로 지원
  // (기존 코드/시트 설계가 바뀌어도 화면이 깨지지 않게)
  const candidates = [
    item?.[RESULT_FIELD],
    item?.result,
    item?.vuln_result,
    item?.vulnResult,
    item?.finding,
    item?.assessment,
  ];
  for (const v of candidates) {
    const n = normalizeResult(v);
    if (n) return n;
  }
  return "";
}

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
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full bg-slate-900" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ResultPill({ value }) {
  // 결과 뱃지(폭 줄이고 가운데 정렬 + 색상)
  if (!value) {
    return (
      <span className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500">
        미선택
      </span>
    );
  }
  const isVuln = value === "취약";
  const cls = isVuln
    ? "border-red-200 bg-red-50 text-red-700"
    : "border-blue-200 bg-blue-50 text-blue-700";
  return <span className={`inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs font-semibold ${cls}`}>{value}</span>;
}

export default function VulnIdentifyPanel({ checklistItems = [], onUpdated }) {
  // draft: code -> { resultDraft }
  const [draftMap, setDraftMap] = useState({});
  // save 중 표시(UX)
  const [savingCode, setSavingCode] = useState(null);
  // 검색
  const [q, setQ] = useState("");

  // 초기 draft 세팅: 서버/시트에 저장된 값을 기준으로 시작
  useEffect(() => {
    const next = {};
    (checklistItems || []).forEach((it) => {
      const code = String(it?.code ?? "");
      if (!code) return;
      next[code] = { resultDraft: getSavedResult(it) };
    });
    setDraftMap(next);
  }, [checklistItems]);

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    if (!text) return checklistItems || [];
    return (checklistItems || []).filter((it) => {
      const blob = [it?.type, it?.area, it?.domain, it?.code, it?.item, it?.status, getSavedResult(it)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(text);
    });
  }, [checklistItems, q]);

  // ✅ 진행률(전체 통제 기준)
  const progress = useMemo(() => {
    const total = (checklistItems || []).length;
    const done = (checklistItems || []).filter((it) => {
      const v = normalizeResult(getSavedResult(it));
      return v === "양호" || v === "취약";
    }).length;
    return { total, done };
  }, [checklistItems]);

  // ✅ 분야(domain)별 그룹핑 (구분 유지)
  const groupedByDomain = useMemo(() => {
    const m = new Map();
    (filtered || []).forEach((it) => {
      const key = (it?.domain ?? "미분류").toString().trim() || "미분류";
      if (!m.has(key)) m.set(key, []);
      m.get(key).push(it);
    });
    return Array.from(m.entries());
  }, [filtered]);

  function setDraftResult(code, value) {
    setDraftMap((prev) => ({
      ...prev,
      [code]: {
        ...(prev[code] || {}),
        resultDraft: value,
      },
    }));
  }

  async function saveResult(item) {
    const code = String(item?.code ?? "");
    if (!code) return;

    const draft = draftMap?.[code]?.resultDraft ?? "";
    const normalized = normalizeResult(draft);

    // "저장"을 눌렀을 때만 반영
    try {
      setSavingCode(code);
      await updateFields(SHEET_NAME, code, { [RESULT_FIELD]: normalized });

      // 저장 성공 후: 부모가 재조회하도록 콜백 (혹은 optimistic 반영)
      onUpdated && onUpdated();
    } finally {
      setSavingCode(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* 헤더 + 진행률 */}
      <div className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-lg font-bold text-slate-900">2. 취약 도출</div>
            <div className="text-sm text-slate-600">통제 이행 점검의 현황(status)을 근거로 각 항목의 결과(양호/취약)를 확정하여 저장합니다.</div>
          </div>
          <div className="w-72">
            <ProgressBar done={progress.done} total={progress.total} label="취약 도출 진행률 (전체 통제 기준)" />
          </div>
        </div>

        {/* 검색 */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="text-sm font-semibold text-slate-900">검색</div>
            <input
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              placeholder="유형/영역/분야/코드/항목/현황/결과 검색"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* 목록: 분야(domain) 구분 */}
      <div className="space-y-6">
        {groupedByDomain.map(([domain, items]) => (
          <div key={domain} className="rounded-2xl border border-slate-200 bg-white">
            {/* Domain 헤더 */}
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="text-sm font-bold text-slate-900">분야: {domain}</div>
              <div className="text-xs text-slate-500">{items.length}개 항목</div>
            </div>

            {/* 테이블 헤더 */}
            <div className="grid grid-cols-12 gap-3 px-4 py-3 text-xs font-semibold text-slate-600">
              <div className="col-span-1 text-center">유형</div>
              <div className="col-span-1 text-center">영역</div>
              <div className="col-span-1 text-center">코드</div>
              {/* 항목/현황은 가장 중요: 거의 같은 폭으로 */}
              <div className="col-span-4">항목</div>
              <div className="col-span-4">현황(status)</div>
              <div className="col-span-1 text-center">결과</div>
              <div className="col-span-1 text-center">저장</div>
            </div>

            {/* 행 */}
            <div className="divide-y divide-slate-100">
              {items.map((it) => {
                const code = String(it?.code ?? "");
                const saved = getSavedResult(it);
                const draft = normalizeResult(draftMap?.[code]?.resultDraft ?? saved);

                return (
                  <div key={code || Math.random()} className="grid grid-cols-12 gap-3 px-4 py-4">
                    {/* 유형/영역/코드: 폭 줄이고 가운데 정렬 */}
                    <div className="col-span-1 flex items-start justify-center">
                      <span className="text-xs text-slate-700">{it?.type || "-"}</span>
                    </div>
                    <div className="col-span-1 flex items-start justify-center">
                      <span className="text-xs text-slate-700">{it?.area || "-"}</span>
                    </div>
                    <div className="col-span-1 flex items-start justify-center">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-700">{it?.code || "-"}</span>
                    </div>

                    {/* 항목(질문) */}
                    <div className="col-span-4">
                      <div className="text-sm font-semibold text-slate-900">{it?.item || ""}</div>
                    </div>

                    {/* 현황(status): 개행 보존 + 파란색 강조 */}
                    <div className="col-span-4">
                      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3">
                        <div className="text-[11px] font-semibold text-blue-800">현황</div>
                        <pre className="mt-1 whitespace-pre-wrap break-words text-sm text-blue-900">{it?.status || "(현황 없음)"}</pre>
                      </div>
                    </div>

                    {/* 결과: 폭 줄이고 가운데 정렬 + 색상 */}
                    <div className="col-span-1 flex flex-col items-center gap-2">
                      <div className="flex items-center justify-center">
                        <ResultPill value={draft} />
                      </div>
                      {/* 선택 UI: draft만 변경(=저장 전 반영 X) */}
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          className={`rounded-lg px-2 py-1 text-xs font-semibold transition ${
                            draft === "양호" ? "bg-blue-600 text-white" : "border border-blue-200 bg-white text-blue-700"
                          }`}
                          onClick={() => setDraftResult(code, "양호")}
                        >
                          양호
                        </button>
                        <button
                          type="button"
                          className={`rounded-lg px-2 py-1 text-xs font-semibold transition ${
                            draft === "취약" ? "bg-red-600 text-white" : "border border-red-200 bg-white text-red-700"
                          }`}
                          onClick={() => setDraftResult(code, "취약")}
                        >
                          취약
                        </button>
                      </div>
                    </div>

                    {/* 저장: 누를 때만 Sheets 반영 */}
                    <div className="col-span-1 flex items-start justify-center">
                      <button
                        type="button"
                        onClick={() => saveResult(it)}
                        disabled={savingCode === code}
                        className={`rounded-xl px-3 py-2 text-xs font-bold text-white ${
                          savingCode === code ? "bg-slate-400" : "bg-slate-900 hover:bg-slate-800"
                        }`}
                      >
                        {savingCode === code ? "저장중" : "저장"}
                      </button>
                    </div>
                  </div>
                );
              })}

              {items.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-slate-500">표시할 항목이 없습니다.</div>
              )}
            </div>
          </div>
        ))}

        {groupedByDomain.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">표시할 항목이 없습니다.</div>
        )}
      </div>
    </div>
  );
}
