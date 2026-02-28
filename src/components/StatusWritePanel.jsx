import React, { useEffect, useMemo, useRef, useState } from "react";
import Select from "../ui/Select";
import { updateFields } from "../lib/sheetsApi";

function ProgressBar({ done, total, label }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-slate-600">
        <div className="font-semibold">{label}</div>
        <div>
          {done}/{total} ({pct}%)
        </div>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
        <div className="h-2 bg-slate-900" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function StatusWritePanel({ checklistItems, onUpdated }) {
  const [selectedDomain, setSelectedDomain] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const [draft, setDraft] = useState({}); // code -> status text
  const [savingCode, setSavingCode] = useState(null);

  /**
   * ✅ textarea 자동 높이 조절(가독성 개선)
   * - 현황(status)은 길어질 수 있으므로, 입력값에 따라 높이를 자동으로 늘린다.
   * - rows 고정이 아니라 scrollHeight 기반으로 늘리고, overflow는 숨긴다.
   * - 페이지 전환/초기 렌더에서도 즉시 높이가 맞도록 ref + effect를 사용한다.
   */
  const textareaRefs = useRef({}); // code -> textarea element
  const autoResize = (el) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  // 도메인 목록
  const domains = useMemo(() => {
    const set = new Set();
    (checklistItems || []).forEach((x) => {
      const d = String(x.domain || "").trim();
      if (d) set.add(d);
    });
    return Array.from(set);
  }, [checklistItems]);

  // ✅ 메뉴 진입/데이터 로드 시 첫 도메인 자동 선택
  useEffect(() => {
    if (selectedDomain) return;
    if (domains.length) setSelectedDomain(domains[0]);
  }, [domains, selectedDomain]);

  /**
   * 선택 도메인 + 검색 필터
   * - 화면에 보여줄 "행"을 결정하는 필터
   * - 진행률(progress)은 "전체 통제" 기준으로 계산해야 하므로(요구사항)
   *   여기의 filtered는 진행률 계산에 사용하지 않는다.
   */
  const filtered = useMemo(() => {
    const needle = String(q || "")
      .trim()
      .toLowerCase();
    return (checklistItems || [])
      .filter((x) => {
        if (!selectedDomain) return true;
        return String(x.domain || "").trim() === selectedDomain;
      })
      .filter((x) => {
        if (!needle) return true;
        const hay = [x.type, x.area, x.domain, x.code, x.itemCode, x.status]
          .map((v) => String(v || "").toLowerCase())
          .join(" ");
        return hay.includes(needle);
      });
  }, [checklistItems, selectedDomain, q]);

  /**
   * ✅ 진행률(중요): "전체 통제 갯수" 대비 status 작성률
   * - 분야(domain)별 진행률이 아니라, 모든 통제 항목을 모수로 삼아야 한다.
   * - 검색/페이지네이션/도메인 필터는 화면 표시를 위한 것이고, 진행률에는 영향 주지 않음.
   * - 기준: Checklist 시트의 status 컬럼이 공백이 아닌 항목 수
   */
  const progress = useMemo(() => {
    const all = checklistItems || [];
    const total = all.length;
    const done = all.filter((x) => String(x.status || "").trim() !== "").length;
    return { done, total };
  }, [checklistItems]);

  // pagination
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  // draft 초기화(현재 페이지의 status를 draft에 채움. 기존 draft 있으면 유지)
  useEffect(() => {
    setDraft((prev) => {
      const next = { ...prev };
      for (const r of pageRows) {
        const code = String(r.code || "").trim();
        if (!code) continue;
        if (next[code] == null) next[code] = String(r.status || "");
      }
      return next;
    });
  }, [pageRows]);

  // ✅ 페이지 전환/초기 렌더 시 textarea 높이 재계산
  useEffect(() => {
    for (const r of pageRows) {
      const code = String(r.code || "").trim();
      if (!code) continue;
      autoResize(textareaRefs.current[code]);
    }
  }, [pageRows]);

  // domain 바뀌면 1페이지로
  useEffect(() => {
    setPage(1);
  }, [selectedDomain, q]);

  async function saveOne(code) {
    const text = String(draft[code] ?? "");
    try {
      setSavingCode(code);
      await updateFields("Checklist", code, { status: text });
      if (typeof onUpdated === "function") onUpdated();
    } catch (e) {
      alert("저장 실패: " + String(e.message || e));
    } finally {
      setSavingCode(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* 상단 진행률 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
        <ProgressBar
          done={progress.done}
          total={progress.total}
          label="통제 이행 점검 진행률 (status 작성 기준)"
        />
        <div className="text-sm text-slate-600">
          도메인(분야) 선택 → 각 통제 항목의 현황을 입력 → 저장 시 Checklist 시트의{" "}
          <b>status</b> 컬럼에 반영됩니다.
        </div>
      </div>

      {/* 필터 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col lg:flex-row gap-3 lg:items-end">
        <div className="flex-1">
          <div className="text-xs font-semibold text-slate-700 mb-1">
            분야(domain)
          </div>
          <Select
            value={selectedDomain}
            onChange={(v) => setSelectedDomain(v)}
            options={domains.map((d) => ({ value: d, label: d }))}
          />
        </div>

        <div className="flex-1">
          <div className="text-xs font-semibold text-slate-700 mb-1">검색</div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            placeholder="유형/영역/분야/코드/항목/status 검색"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <div className="min-w-[1100px]">
            {/* header */}
            <div className="grid grid-cols-[64px_88px_120px_86px_minmax(360px,1fr)_minmax(360px,1fr)_88px] bg-slate-50 text-xs font-semibold text-slate-700">
              <div className="px-2 py-3 text-center">유형</div>
              <div className="px-2 py-3 text-center">영역</div>
              <div className="px-2 py-3 text-center">분야</div>
              <div className="px-2 py-3 text-center">코드</div>
              <div className="px-3 py-3 text-center">항목</div>
              <div className="px-3 py-3 text-center">현황(status)</div>
              <div className="px-3 py-3 text-center">저장</div>
            </div>

            {/* rows */}
            <div className="divide-y">
              {pageRows.map((r) => {
                const code = String(r.code || "").trim();
                const done = String(r.status || "").trim() !== "";
                return (
                  <div
                    key={code}
                    className="grid grid-cols-[64px_88px_120px_86px_minmax(360px,1fr)_minmax(360px,1fr)_88px] items-stretch"
                  >
                    <div className="px-2 py-3 text-xs text-slate-800 text-center whitespace-nowrap overflow-hidden text-ellipsis">
                      {r.type || "-"}
                    </div>
                    <div className="px-2 py-3 text-xs text-slate-800 text-center whitespace-nowrap overflow-hidden text-ellipsis">
                      {r.area || "-"}
                    </div>
                    <div className="px-2 py-3 text-xs text-slate-800 text-center whitespace-nowrap overflow-hidden text-ellipsis">
                      {r.domain || "-"}
                    </div>
                    <div className="px-2 py-3 text-xs text-slate-800 text-center whitespace-nowrap overflow-hidden text-ellipsis">
                      {code || "-"}
                    </div>

                    <div className="px-3 py-3 text-sm text-slate-800 text-left whitespace-pre-wrap break-words">
                      {r.itemCode || "-"}
                    </div>

                    <div className="px-3 py-2">
                      <textarea
                        ref={(el) => {
                          textareaRefs.current[code] = el;
                          autoResize(el);
                        }}
                        value={String(draft[code] ?? "")}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            [code]: e.target.value,
                          }))
                        }
                        onInput={(e) => autoResize(e.currentTarget)}
                        rows={1}
                        className="w-full min-h-[44px] resize-none overflow-hidden rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                        placeholder="운영현황/미흡사항/예외 등"
                      />
                    </div>

                    <div className="px-3 py-3 flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => saveOne(code)}
                        disabled={savingCode === code}
                        className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                          done
                            ? "bg-blue-600 text-white hover:bg-blue-700"
                            : "bg-slate-900 text-white hover:bg-slate-800"
                        } ${
                          savingCode === code
                            ? "opacity-60 cursor-not-allowed"
                            : ""
                        }`}
                      >
                        {savingCode === code ? "저장중" : done ? "완료" : "저장"}
                      </button>
                    </div>
                  </div>
                );
              })}

              {pageRows.length === 0 ? (
                <div className="px-4 py-10 text-sm text-slate-500 text-center">
                  데이터가 없습니다.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* 페이지네이션 */}
      {pageCount > 1 ? (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: pageCount }).map((_, i) => {
            const p = i + 1;
            const active = p === page;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                className={`w-9 h-9 rounded-xl border text-sm font-semibold ${
                  active
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white border-slate-200 hover:bg-slate-50"
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
