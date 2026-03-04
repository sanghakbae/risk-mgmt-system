// src/components/RiskEvaluatePanel.jsx
import React, { useMemo, useState } from "react";
import Button from "../ui/Button";
import { updateChecklistByCode } from "../api/checklist";

const PAGE_SIZE = 20;

const TYPE_ALL = "전체";
const TYPE_ISMS = "ISMS";
const TYPE_ISO = "ISO27001";

function normalizeType(v) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  if (s.toUpperCase().includes("ISO")) return TYPE_ISO;
  if (s.toUpperCase().includes("ISMS")) return TYPE_ISMS;
  return s;
}
function safeStr(v) {
  return v == null ? "" : String(v);
}

// ✅ UI 표기(문자열) ↔ DB 저장값(숫자) 매핑 (회사 정책 3x3)
const L_LABEL = { 1: "Unlikely", 2: "Likely", 3: "Highly Likely" };
const I_LABEL = { 1: "Low", 2: "Medium", 3: "High" };

// ✅ 회사 정책 Risk Matrix(스크린샷 동일)
function riskNumber(l, i) {
  const map = {
    "3-1": 6,
    "3-2": 3,
    "3-3": 1,
    "2-1": 8,
    "2-2": 5,
    "2-3": 2,
    "1-1": 9,
    "1-2": 7,
    "1-3": 4,
  };
  return map[`${l}-${i}`] ?? null;
}

function riskLabelFromNumber(n) {
  if (n == null) return "-";
  if (n <= 3) return `Risk ${n} · High`;
  if (n <= 6) return `Risk ${n} · Medium`;
  return `Risk ${n} · Low`;
}

function badgeClassFromRisk(n) {
  if (n == null) return "bg-slate-100 text-slate-700 border-slate-200";
  if (n <= 3) return "bg-rose-50 text-rose-700 border-rose-200";
  if (n <= 6) return "bg-amber-50 text-amber-800 border-amber-200";
  return "bg-blue-50 text-blue-700 border-blue-200";
}

function riskBg(n) {
  if (n == null) return "bg-slate-50";
  if (n <= 3) return "bg-rose-100";
  if (n <= 6) return "bg-amber-100";
  return "bg-blue-100";
}

function ProgressBar({ done, total, highCount, medCount, lowCount }) {
  const ratio = total <= 0 ? 0 : done / total;
  const pct = Math.round(ratio * 100);
  const notDone = Math.max(0, (total ?? 0) - (done ?? 0));

  // 100% 초록, 50% 미만 빨강, 그 외 amber (기존 톤 유지)
  const barClass = pct === 100 ? "bg-emerald-500" : pct < 50 ? "bg-rose-500" : "bg-amber-500";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between text-sm text-slate-700">
        <div className="font-semibold">평가 진행률</div>
        <div className="tabular-nums">
          {done}/{total} ({pct}%)
        </div>
      </div>
      <div className="mt-2 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full ${barClass}`} style={{ width: `${pct}%` }} />
      </div>

      {/* 휑함 개선: 요약 카드 */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        {/* 1행: 총 대상 / 완료 / 미완료 */}
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="text-xs text-slate-500 font-semibold">총 대상</div>
          <div className="text-lg font-bold text-slate-900 tabular-nums">{total}</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="text-xs text-slate-500 font-semibold">완료</div>
          <div className="text-lg font-bold text-slate-900 tabular-nums">{done}</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="text-xs text-slate-500 font-semibold">미완료</div>
          <div className="text-lg font-bold text-slate-900 tabular-nums">{notDone}</div>
        </div>

        {/* 2행: High / Medium / Low */}
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="text-xs text-rose-700 font-semibold">High</div>
          <div className="text-lg font-bold text-rose-700 tabular-nums">{highCount}</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="text-xs text-amber-800 font-semibold">Medium</div>
          <div className="text-lg font-bold text-amber-800 tabular-nums">{medCount}</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="text-xs text-blue-700 font-semibold">Low</div>
          <div className="text-lg font-bold text-blue-700 tabular-nums">{lowCount}</div>
        </div>
      </div>
    </div>
  );
}

function RiskMatrixMini() {
  const cells = [
    [{ l: 3, i: 1 }, { l: 3, i: 2 }, { l: 3, i: 3 }],
    [{ l: 2, i: 1 }, { l: 2, i: 2 }, { l: 2, i: 3 }],
    [{ l: 1, i: 1 }, { l: 1, i: 2 }, { l: 1, i: 3 }],
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-sm font-semibold text-slate-800 mb-3">
        정성적 위험분석 행렬 (Qualitative Risk Matrix)
      </div>

      <div className="grid grid-cols-[160px_1fr] gap-3">
        <div />
        <div className="grid grid-cols-3 text-xs font-semibold text-slate-700">
          <div className="text-center">Low</div>
          <div className="text-center">Medium</div>
          <div className="text-center">High</div>
        </div>

        <div className="space-y-2 text-xs font-semibold text-slate-700">
          <div className="h-12 flex items-center justify-end pr-2">Highly Likely</div>
          <div className="h-12 flex items-center justify-end pr-2">Likely</div>
          <div className="h-12 flex items-center justify-end pr-2">Unlikely</div>
        </div>

        <div className="grid grid-rows-3 gap-2">
          {cells.map((row, rIdx) => (
            <div key={rIdx} className="grid grid-cols-3 gap-2">
              {row.map((c, cIdx) => {
                const n = riskNumber(c.l, c.i);
                return (
                  <div
                    key={`${rIdx}-${cIdx}`}
                    className={[
                      "h-12 rounded-xl border border-slate-200 flex items-center justify-center",
                      riskBg(n),
                    ].join(" ")}
                  >
                    <div className="text-sm font-bold text-slate-900 tabular-nums">{n}</div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 text-xs text-slate-500">
        * Likelihood/Impact는 DB에는 1~3 정수로 저장됩니다.
      </div>
    </div>
  );
}

function RiskCard({ row, isSaving, onSave }) {
  const [l, setL] = useState(row.likelihood ?? "");
  const [i, setI] = useState(row.impact ?? "");

  const n = useMemo(() => {
    const ll = l === "" ? null : Number(l);
    const ii = i === "" ? null : Number(i);
    if (!ll || !ii) return null;
    return riskNumber(ll, ii);
  }, [l, i]);

  const reasonText = useMemo(() => {
    // 취약 사유: reason 우선, 없으면 result_detail
    const r = safeStr(row.reason).trim();
    const d = safeStr(row.result_detail).trim();
    return r || d;
  }, [row.reason, row.result_detail]);

  async function handleSave() {
    const payload = {
      // ✅ 항상 숫자/NULL만 저장 (문자열 "Medium" 같은거 절대 금지)
      likelihood: l === "" ? null : Number(l),
      impact: i === "" ? null : Number(i),
    };
    await onSave(row.code, payload);
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-slate-500">
            {normalizeType(row.type)} · {row.domain} · {row.area}
          </div>
          <div className="text-sm font-semibold text-slate-900 whitespace-pre-wrap">
            [{row.code}] {safeStr(row.itemCode ?? row.itemcode)}
          </div>
          {/* 현황(통제 이행 점검 결과) */}
          {safeStr(row.status).trim() ? (
            <div className="mt-2 text-sm text-slate-700">
              <span className="font-semibold text-slate-800">현황</span>{" "}
              <span className="text-slate-700">{safeStr(row.status)}</span>
            </div>
          ) : null}
        </div>

        <div className="shrink-0 flex items-center gap-2">
          <span className={["px-3 py-1 rounded-full border text-xs font-semibold", badgeClassFromRisk(n)].join(" ")}>
            {riskLabelFromNumber(n)}
          </span>
        </div>
      </div>

      {/* 사유 붉은 박스 */}
      {reasonText ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <div className="text-sm font-semibold text-rose-700 mb-1">사유</div>
          <div className="text-sm text-rose-700 whitespace-pre-wrap">{reasonText}</div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <div className="text-xs font-semibold text-slate-700 mb-1">Likelihood</div>
          <select
            value={l}
            onChange={(e) => setL(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
          >
            <option value="">선택</option>
            <option value="1">{L_LABEL[1]}</option>
            <option value="2">{L_LABEL[2]}</option>
            <option value="3">{L_LABEL[3]}</option>
          </select>
        </div>

        <div>
          <div className="text-xs font-semibold text-slate-700 mb-1">Impact</div>
          <select
            value={i}
            onChange={(e) => setI(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
          >
            <option value="">선택</option>
            <option value="1">{I_LABEL[1]}</option>
            <option value="2">{I_LABEL[2]}</option>
            <option value="3">{I_LABEL[3]}</option>
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500">{isSaving ? "저장 중..." : "* 두 값 모두 선택 후 저장하세요."}</div>
        <Button onClick={handleSave} disabled={isSaving || l === "" || i === ""}>
          저장
        </Button>
      </div>
    </div>
  );
}

export default function RiskEvaluatePanel({ checklistItems = [], onUpdated }) {
  const [typeFilter, setTypeFilter] = useState(TYPE_ALL);
  const [domainFilter, setDomainFilter] = useState("");
  const [page, setPage] = useState(1);
  const [savingCode, setSavingCode] = useState(null);

  const typeOptions = useMemo(() => [TYPE_ALL, TYPE_ISMS, TYPE_ISO], []);

  const domainOptions = useMemo(() => {
    const set = new Set();
    for (const x of checklistItems) {
      const t = normalizeType(x.type);
      if (typeFilter !== TYPE_ALL && t !== typeFilter) continue;
      const d = safeStr(x.domain).trim();
      if (d) set.add(d);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [checklistItems, typeFilter]);

  // ✅ 위험평가 대상: result='취약'만
  const targets = useMemo(() => {
    return checklistItems.filter((x) => {
      if (safeStr(x.result).trim() !== "취약") return false;

      const t = normalizeType(x.type);
      if (typeFilter !== TYPE_ALL && t !== typeFilter) return false;

      if (domainFilter && safeStr(x.domain).trim() !== domainFilter) return false;

      return true;
    });
  }, [checklistItems, typeFilter, domainFilter]);

  // ✅ 완료 기준: impact/likelihood 둘 다 존재
  const doneCount = useMemo(() => {
    return targets.filter((x) => x.likelihood != null && x.impact != null).length;
  }, [targets]);

  // ✅ High/Medium/Low 집계(선택된 값 기준)
  const { highCount, medCount, lowCount } = useMemo(() => {
    let h = 0,
      m = 0,
      l = 0;
    for (const x of targets) {
      const ll = x.likelihood == null ? null : Number(x.likelihood);
      const ii = x.impact == null ? null : Number(x.impact);
      if (!ll || !ii) continue;
      const rn = riskNumber(ll, ii);
      if (rn == null) continue;
      if (rn <= 3) h += 1;
      else if (rn <= 6) m += 1;
      else l += 1;
    }
    return { highCount: h, medCount: m, lowCount: l };
  }, [targets]);

  const totalPages = Math.max(1, Math.ceil(targets.length / PAGE_SIZE));
  const pageSafe = Math.min(Math.max(1, page), totalPages);

  const paged = useMemo(() => {
    const start = (pageSafe - 1) * PAGE_SIZE;
    return targets.slice(start, start + PAGE_SIZE);
  }, [targets, pageSafe]);

  async function onSave(code, payload) {
    try {
      setSavingCode(code);
      await updateChecklistByCode(code, payload);
      onUpdated?.();
    } catch (e) {
      alert("저장 실패: " + e.message);
    } finally {
      setSavingCode(null);
    }
  }

  function onChangeType(v) {
    setTypeFilter(v);
    setDomainFilter("");
    setPage(1);
  }

  function onChangeDomain(v) {
    setDomainFilter(v);
    setPage(1);
  }

  return (
    <div className="w-full max-w-none space-y-4">
      {/* 진행률 + 매트릭스(잔여 위험 평가와 동일 모양) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <ProgressBar
          done={doneCount}
          total={targets.length}
          highCount={highCount}
          medCount={medCount}
          lowCount={lowCount}
        />
        <RiskMatrixMini />
      </div>

      {/* 필터 바 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={typeFilter}
            onChange={(e) => onChangeType(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
          >
            {typeOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          {typeFilter !== TYPE_ALL ? (
            <select
              value={domainFilter}
              onChange={(e) => onChangeDomain(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            >
              <option value="">분야(전체)</option>
              {domainOptions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          ) : null}

          <div className="text-sm text-slate-600 ml-auto">
            표시 {targets.length}건 · {pageSafe}/{totalPages} 페이지
          </div>
        </div>
      </div>

      {/* 리스트 */}
      <div className="space-y-3">
        {paged.map((row) => (
          <RiskCard key={row.code} row={row} isSaving={savingCode === row.code} onSave={onSave} />
        ))}

        {paged.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">
            위험 평가 대상(결과=취약)이 없습니다.
          </div>
        ) : null}
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 ? (
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {Array.from({ length: totalPages }).map((_, i) => {
            const n = i + 1;
            const active = n === pageSafe;
            return (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                className={[
                  "px-3 py-1.5 rounded-xl border text-sm font-semibold",
                  active
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
                ].join(" ")}
              >
                {n}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}