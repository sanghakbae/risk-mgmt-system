import React, { useEffect, useMemo, useState } from "react";
import Button from "../ui/Button";
import { fetchVulnerableChecklist, updateRiskByCode } from "../api/checklist";

/** 문자열 정규화 */
function t(v) {
  return v == null ? "" : String(v);
}

/** 1~5 정수 변환 */
function to15(v) {
  const n = Number(t(v).trim());
  if (!Number.isFinite(n)) return null;
  if (n < 1 || n > 5) return null;
  return n;
}

/** 위험도 표시 */
function riskScore(impact, likelihood) {
  const i = to15(impact);
  const l = to15(likelihood);
  if (i == null || l == null) return null;
  return i * l;
}

function riskLabel(score) {
  if (score == null) return { label: "—", cls: "bg-slate-50 text-slate-700 border-slate-200" };
  if (score >= 20) return { label: `Critical ${score}`, cls: "bg-rose-50 text-rose-700 border-rose-200" };
  if (score >= 12) return { label: `High ${score}`, cls: "bg-orange-50 text-orange-700 border-orange-200" };
  if (score >= 6) return { label: `Medium ${score}`, cls: "bg-amber-50 text-amber-800 border-amber-200" };
  return { label: `Low ${score}`, cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
}

/**
 * ✅ I/L 1차 추천(휴리스틱)
 * - 규칙은 "일단 초안" 목적 (사용자가 수정 가능)
 * - 근거 텍스트: area/domain/item/status/result_detail/code
 */
function suggestIL(row) {
  const text = [
    row.type,
    row.area,
    row.domain,
    row.code,
    row.itemCode,
    row.status,
    row.result_detail,
  ]
    .map(t)
    .join(" ")
    .toLowerCase();

  // 기본값
  let impact = 3;
  let likelihood = 3;

  // 영향(Impact) 상향 키워드
  const highImpact = [
    "개인정보",
    "pii",
    "주민등록",
    "신용",
    "결제",
    "card",
    "금융",
    "계정",
    "권한",
    "관리자",
    "root",
    "암호",
    "password",
    "키",
    "secret",
    "token",
    "로그인",
    "인증",
    "인가",
    "access control",
    "접근통제",
    "네트워크",
    "방화벽",
    "침해",
    "유출",
    "데이터",
    "백업",
    "복구",
    "가용성",
    "장애",
  ];

  // 가능성(Likelihood) 상향 키워드
  const highLikelihood = [
    "미작성",
    "없음",
    "미흡",
    "미이행",
    "부적합",
    "상시",
    "공유",
    "public",
    "외부",
    "인터넷",
    "원격",
    "미사용",
    "미적용",
    "미설정",
    "기본",
    "default",
    "전체",
    "everyone",
  ];

  // 아주 높은 위험 신호
  const criticalSignals = ["admin", "root", "token", "secret", "개인정보", "결제", "금융", "외부공개", "public"];

  if (highImpact.some((k) => text.includes(k))) impact = 4;
  if (highLikelihood.some((k) => text.includes(k))) likelihood = 4;

  if (criticalSignals.some((k) => text.includes(k))) {
    impact = Math.max(impact, 4);
    likelihood = Math.max(likelihood, 4);
  }

  // "단순 문서/절차/교육" 류는 impact 조금 낮게 시작
  const lowImpactHints = ["교육", "훈련", "절차", "문서", "정의", "정책", "지침", "매뉴얼"];
  if (lowImpactHints.some((k) => text.includes(k))) {
    impact = Math.max(impact - 1, 2);
  }

  // 운영/기술 통제(접근/로그/암호/네트워크)는 기본적으로 영향 높게
  const techControl = ["접근", "로그", "암호", "네트워크", "방화벽", "취약점", "패치", "백업", "복구"];
  if (techControl.some((k) => text.includes(k))) {
    impact = Math.max(impact, 4);
  }

  return { impact, likelihood };
}

export default function RiskAssessmentPanel() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // 필터
  const [typeFilter, setTypeFilter] = useState("");
  const [domainFilter, setDomainFilter] = useState("");

  // 편집
  const [draft, setDraft] = useState({}); // code -> {impact, likelihood}
  const [savingCode, setSavingCode] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const data = await fetchVulnerableChecklist({ type: typeFilter, domain: domainFilter, limit: 5000 });
      setRows(Array.isArray(data) ? data : []);

      // draft에 추천값 주입(impact/likelihood가 비어있는 것만)
      setDraft((prev) => {
        const next = { ...prev };
        for (const r of data || []) {
          const code = t(r.code).trim();
          if (!code) continue;

          const hasI = to15(r.impact) != null;
          const hasL = to15(r.likelihood) != null;

          if (hasI && hasL) continue;

          const sug = suggestIL(r);

          next[code] = {
            ...(next[code] || {}),
            impact: to15(next[code]?.impact) != null ? next[code].impact : (hasI ? r.impact : sug.impact),
            likelihood: to15(next[code]?.likelihood) != null ? next[code].likelihood : (hasL ? r.likelihood : sug.likelihood),
          };
        }
        return next;
      });
    } catch (e) {
      alert("로드 실패: " + String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, domainFilter]);

  const domains = useMemo(() => {
    const set = new Set();
    for (const r of rows) {
      const d = t(r.domain).trim();
      if (d) set.add(d);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  function getDraft(code, field, fallback) {
    return draft[code]?.[field] ?? fallback;
  }

  function setDraftField(code, field, value) {
    setDraft((prev) => ({
      ...prev,
      [code]: { ...(prev[code] || {}), [field]: value },
    }));
  }

  async function saveOne(row) {
    const code = t(row.code).trim();
    if (!code) return;

    const impact = getDraft(code, "impact", row.impact ?? "");
    const likelihood = getDraft(code, "likelihood", row.likelihood ?? "");

    setSavingCode(code);
    try {
      await updateRiskByCode(code, { impact, likelihood });

      // 로컬 반영
      setRows((prev) =>
        prev.map((r) =>
          t(r.code).trim() === code ? { ...r, impact: Number(impact), likelihood: Number(likelihood) } : r
        )
      );
    } catch (e) {
      alert("저장 실패: " + String(e?.message || e));
    } finally {
      setSavingCode(null);
    }
  }

  const counts = useMemo(() => {
    let filled = 0;
    for (const r of rows) {
      const score = riskScore(r.impact, r.likelihood);
      if (score != null) filled += 1;
    }
    return { total: rows.length, filled };
  }, [rows]);

  return (
    // 상단 고정 + 리스트만 스크롤 (부모 높이가 애매해도 viewport 기준으로 강제)
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* 상단 고정 */}
      <div className="shrink-0 bg-white border-b p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-lg font-semibold text-slate-900">위험 평가</div>
            <div className="text-xs text-slate-500 mt-1">
              취약 도출에서 <b>결과=취약</b>으로 저장된 항목만 표시됩니다. (I/L은 1차 추천값 자동 입력)
            </div>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            {loading ? "로딩중" : "새로고침"}
          </Button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-600">
            총 <b className="text-slate-900">{counts.total}</b>건 / I·L 입력완료{" "}
            <b className="text-slate-900">{counts.filled}</b>건
          </span>

          <div className="ml-auto flex items-center gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">전체</option>
              <option value="ISMS">ISMS</option>
              <option value="ISO27001">ISO27001</option>
            </select>

            <select
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm max-w-[420px]"
            >
              <option value="">분야(전체)</option>
              {domains.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 리스트 스크롤 */}
      <div className="flex-1 min-h-0 overflow-y-auto bg-slate-50 p-6">
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))" }}
        >
          {rows.map((r) => {
            const code = t(r.code).trim();

            const impact = getDraft(code, "impact", r.impact ?? "");
            const likelihood = getDraft(code, "likelihood", r.likelihood ?? "");

            const score = riskScore(impact, likelihood);
            const badge = riskLabel(score);

            return (
              <div key={code} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
                {/* 헤더 */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900">
                      [{code}] {t(r.area)} / {t(r.domain)}
                    </div>
                    <div className="mt-2 text-sm whitespace-pre-wrap break-words text-slate-900">
                      {t(r.itemCode)}
                    </div>
                  </div>

                  <span className={["shrink-0 rounded-full border px-3 py-1 text-xs font-semibold", badge.cls].join(" ")}>
                    {badge.label}
                  </span>
                </div>

                {/* 현황 */}
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <div className="text-xs font-semibold text-blue-700 mb-1">현황</div>
                  <div className="text-sm whitespace-pre-wrap text-slate-900">{t(r.status) || "—"}</div>
                </div>

                {/* 사유: 빨간색 + 항목과 동일 폰트 크기(text-sm) */}
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                  <div className="text-xs font-semibold text-rose-700 mb-1">사유</div>
                  <div className="text-sm whitespace-pre-wrap text-rose-700">
                    {t(r.result_detail) || "—"}
                  </div>
                </div>

                {/* I/L 입력(추천값 반영) */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-700">Impact</span>
                    <select
                      value={impact ?? ""}
                      onChange={(e) => setDraftField(code, "impact", e.target.value)}
                      className="rounded-lg border border-slate-200 px-2 py-2 text-sm"
                    >
                      <option value="">—</option>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-700">Likelihood</span>
                    <select
                      value={likelihood ?? ""}
                      onChange={(e) => setDraftField(code, "likelihood", e.target.value)}
                      className="rounded-lg border border-slate-200 px-2 py-2 text-sm"
                    >
                      <option value="">—</option>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="ml-auto">
                    <Button onClick={() => saveOne(r)} disabled={savingCode === code}>
                      {savingCode === code ? "저장중" : "저장"}
                    </Button>
                  </div>
                </div>

                {/* 추천 안내(미관 해치지 않게 작은 텍스트) */}
                <div className="text-xs text-slate-500">
                  * I/L은 1차 추천값입니다. 항목/현황/사유를 보고 조정하세요.
                </div>
              </div>
            );
          })}
        </div>

        {rows.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            표시할 취약 항목이 없습니다. (취약 도출에서 결과=취약 저장 필요)
          </div>
        ) : null}
      </div>
    </div>
  );
}