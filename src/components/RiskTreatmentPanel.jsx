import React, { useMemo, useState, useEffect } from "react";
import Select from "../ui/Select";
import Button from "../ui/Button";
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

// 점수 기반 기본 전략 추천(초기값)
function recommendStrategy(score) {
  if (score >= 16) return "Mitigate";
  if (score >= 9) return "Mitigate";
  return "Accept";
}

export default function RiskTreatmentPanel({ checklistItems, onUpdated }) {
  const [savingCode, setSavingCode] = useState(null);

  // ✅ 대상: 취약 + 위험평가 완료(impact/likelihood 존재)
  const rows = useMemo(() => {
    return (checklistItems || [])
      .filter((x) => String(x.result || "").trim() === "취약")
      .filter((x) => String(x.impact || "").trim() !== "" && String(x.likelihood || "").trim() !== "");
  }, [checklistItems]);

  // ✅ 로컬 편집값(저장 누르기 전까지는 시트 반영 안 함)
  // draft[code] = { treatment_strategy, treatment_plan, treatment_owner, treatment_due_date, treatment_status, accept_reason }
  const [draft, setDraft] = useState({});

  // ✅ rows가 바뀌면(재조회) draft를 시트값으로 채움 (단, 이미 draft에 수정본이 있으면 유지)
  useEffect(() => {
    setDraft((prev) => {
      const next = { ...prev };
      for (const r of rows) {
        const code = r.code;
        if (!code) continue;

        if (!next[code]) {
          const score = Number(r.impact) * Number(r.likelihood);
          const strategy = String(r.treatment_strategy || "").trim() || recommendStrategy(Number.isFinite(score) ? score : 0);

          next[code] = {
            treatment_strategy: strategy,
            treatment_plan: String(r.treatment_plan || ""),
            treatment_owner: String(r.treatment_owner || "").trim(),
            treatment_due_date: String(r.treatment_due_date || "").trim(),
            treatment_status: String(r.treatment_status || "").trim(), // Done/Planned/...
            accept_reason: String(r.accept_reason || ""),
          };
        }
      }
      return next;
    });
  }, [rows]);

  const strategyOptions = useMemo(
    () => [
      { value: "", label: "선택" },
      { value: "Mitigate", label: "감소(Mitigate)" },
      { value: "Transfer", label: "이전(Transfer)" },
      { value: "Avoid", label: "회피(Avoid)" },
      { value: "Accept", label: "수용(Accept)" },
    ],
    []
  );

  // (사용자가 직접 상태를 바꾸고 싶으면 열어두되, "저장" 누르면 Done으로 고정)
  const statusOptions = useMemo(
    () => [
      { value: "", label: "선택" },
      { value: "Planned", label: "계획 수립(Planned)" },
      { value: "InProgress", label: "진행 중(InProgress)" },
      { value: "Done", label: "완료(Done)" },
      { value: "OnHold", label: "보류(OnHold)" },
    ],
    []
  );

  // ✅ 진행률: treatment_status가 Done인 항목 수
  const progress = useMemo(() => {
    const total = rows.length;
    const done = rows.filter((x) => String(x.treatment_status || "").trim() === "Done").length;
    return { done, total };
  }, [rows]);

  function setField(code, key, value) {
    setDraft((prev) => ({
      ...prev,
      [code]: { ...(prev[code] || {}), [key]: value },
    }));
  }

  async function saveOne(code) {
    const cur = draft[code] || {};
    const strategy = String(cur.treatment_strategy || "").trim();

    // ✅ 검증: Accept면 accept_reason 필수
    if (strategy === "Accept" && String(cur.accept_reason || "").trim() === "") {
      alert("수용(Accept) 선택 시 수용 사유(accept_reason)는 필수입니다.");
      return;
    }

    // ✅ 저장 버튼을 누르면 완료로 간주 → treatment_status = Done 저장
    const payload = {
      treatment_strategy: String(cur.treatment_strategy || "").trim(),
      treatment_plan: String(cur.treatment_plan || ""),
      treatment_owner: String(cur.treatment_owner || "").trim(),
      treatment_due_date: String(cur.treatment_due_date || "").trim(),
      accept_reason: String(cur.accept_reason || ""),
      treatment_status: "Done",
    };

    try {
      setSavingCode(code);
      await updateFields("Checklist", code, payload);

      // 로컬 draft에도 Done 반영(즉시 버튼 변경)
      setDraft((prev) => ({
        ...prev,
        [code]: { ...(prev[code] || {}), treatment_status: "Done" },
      }));

      // 상위 재조회(선택)
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
        <ProgressBar done={progress.done} total={progress.total} label="위험 처리 진행률 (저장=완료)" />
        <div className="text-sm text-slate-600">
          저장 버튼을 누르면 해당 항목은 완료 처리되며(treatment_status=Done), 새로고침/재접속 후에도 완료로 유지됩니다.
        </div>
      </div>

      {rows.map((r) => {
        const code = r.code;
        const impact = String(r.impact || "").trim();
        const likelihood = String(r.likelihood || "").trim();
        const score = Number(impact) * Number(likelihood);

        const cur = draft[code] || {};
        const isDone = String(r.treatment_status || "").trim() === "Done" || String(cur.treatment_status || "").trim() === "Done";
        const strategy = String(cur.treatment_strategy || "").trim();

        return (
          <div key={code} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
            {/* 헤더 */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900">
                  {r.type} · {r.domain}
                </div>
                <div className="text-sm text-slate-800 mt-2 whitespace-normal break-words">
                  <span className="font-semibold mr-2">{r.code}</span>
                  {r.itemCode}
                </div>
                <div className="text-xs text-slate-500 mt-2 whitespace-normal break-words">
                  사유: {r.result_detail || "-"}
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs text-slate-500">Risk Score</div>
                <div className="text-2xl font-bold">{Number.isFinite(score) ? score : "-"}</div>

                {/* ✅ 저장 버튼: 검정(저장) → 파랑(완료) */}
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => saveOne(code)}
                    disabled={savingCode === code}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                      isDone
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "bg-slate-900 text-white hover:bg-slate-800"
                    } ${savingCode === code ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    {savingCode === code ? "저장 중..." : isDone ? "완료" : "저장"}
                  </button>
                </div>
              </div>
            </div>

            {/* 입력 폼 (완료여도 수정 가능하게 둘지 결정 필요) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div>
                <div className="text-xs font-semibold text-slate-700 mb-1">처리 전략 (treatment_strategy)</div>
                <Select
                  value={String(cur.treatment_strategy || "")}
                  onChange={(v) => setField(code, "treatment_strategy", v || "")}
                  options={strategyOptions}
                />
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-700 mb-1">처리 상태 (treatment_status)</div>
                <Select
                  value={String(cur.treatment_status || "")}
                  onChange={(v) => setField(code, "treatment_status", v || "")}
                  options={statusOptions}
                />
                <div className="text-xs text-slate-500 mt-1">
                  ※ 저장 버튼을 누르면 이 값은 서버에 Done으로 저장됩니다.
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-700 mb-1">책임자 (treatment_owner)</div>
                <input
                  value={String(cur.treatment_owner || "")}
                  onChange={(e) => setField(code, "treatment_owner", e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                  placeholder="예: SecOps / Infra / Dev"
                />
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-700 mb-1">목표 완료일 (treatment_due_date)</div>
                <input
                  type="date"
                  value={String(cur.treatment_due_date || "")}
                  onChange={(e) => setField(code, "treatment_due_date", e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div className="lg:col-span-2">
                <div className="text-xs font-semibold text-slate-700 mb-1">처리 방안 (treatment_plan)</div>
                <textarea
                  value={String(cur.treatment_plan || "")}
                  onChange={(e) => setField(code, "treatment_plan", e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                  placeholder="예: MFA 적용, 권한 재정의, 로그 모니터링 강화 등"
                />
              </div>

              {strategy === "Accept" ? (
                <div className="lg:col-span-2">
                  <div className="text-xs font-semibold text-slate-700 mb-1">수용 사유 (accept_reason) (필수)</div>
                  <textarea
                    value={String(cur.accept_reason || "")}
                    onChange={(e) => setField(code, "accept_reason", e.target.value)}
                    rows={2}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                    placeholder="예: 비용 대비 효과 낮음, 단기 내 개선 불가, 비즈니스 승인 완료 등"
                  />
                </div>
              ) : null}
            </div>
          </div>
        );
      })}

      {rows.length === 0 ? (
        <div className="text-sm text-slate-500">
          처리할 대상이 없습니다. (취약 + impact/likelihood 입력된 항목이 있어야 표시됩니다)
        </div>
      ) : null}
    </div>
  );
}
