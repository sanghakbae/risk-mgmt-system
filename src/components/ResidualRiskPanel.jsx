import React, { useMemo, useState, useEffect } from "react";
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

export default function ResidualRiskPanel({ checklistItems, onUpdated }) {
  const [savingCode, setSavingCode] = useState(null);
  const [draft, setDraft] = useState({}); // code -> { residual_impact, residual_likelihood, residual_detail, residual_status }

  // ✅ 대상: 취약 + 위험평가 완료 + 위험처리 완료(Done)
  const rows = useMemo(() => {
    return (checklistItems || [])
      .filter((x) => String(x.result || "").trim() === "취약")
      .filter((x) => String(x.impact || "").trim() !== "" && String(x.likelihood || "").trim() !== "")
      .filter((x) => String(x.treatment_status || "").trim() === "Done");
  }, [checklistItems]);

  // draft 초기 채우기(재조회 값 반영)
  useEffect(() => {
    setDraft((prev) => {
      const next = { ...prev };
      for (const r of rows) {
        const code = r.code;
        if (!code) continue;
        if (!next[code]) {
          next[code] = {
            residual_impact: String(r.residual_impact || "").trim(),
            residual_likelihood: String(r.residual_likelihood || "").trim(),
            residual_detail: String(r.residual_detail || ""),
            residual_status: String(r.residual_status || "").trim(),
          };
        }
      }
      return next;
    });
  }, [rows]);

  // ✅ 진행률: residual_status = Done
  const progress = useMemo(() => {
    const total = rows.length;
    const done = rows.filter((x) => String(x.residual_status || "").trim() === "Done").length;
    return { done, total };
  }, [rows]);

  const levelOptions = useMemo(
    () => ["", "1", "2", "3", "4", "5"].map((v) => ({ value: v, label: v === "" ? "선택" : v })),
    []
  );

  function setField(code, key, value) {
    setDraft((prev) => ({
      ...prev,
      [code]: { ...(prev[code] || {}), [key]: value },
    }));
  }

  async function saveOne(code) {
    const cur = draft[code] || {};
    const ri = String(cur.residual_impact || "").trim();
    const rl = String(cur.residual_likelihood || "").trim();

    if (!ri || !rl) {
      alert("잔여 Impact / 잔여 Likelihood는 필수입니다.");
      return;
    }

    const payload = {
      residual_impact: ri,
      residual_likelihood: rl,
      residual_detail: String(cur.residual_detail || ""),
      residual_status: "Done",
    };

    try {
      setSavingCode(code);
      await updateFields("Checklist", code, payload);

      // 로컬에도 Done 반영
      setDraft((prev) => ({
        ...prev,
        [code]: { ...(prev[code] || {}), residual_status: "Done" },
      }));

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
        <ProgressBar done={progress.done} total={progress.total} label="잔여 위험 평가 진행률 (저장=완료)" />
        <div className="text-sm text-slate-600">
          대상: 위험 처리 완료(Done) 항목 · 조치 후 잔여 Impact/Likelihood를 기록하고 저장하면 residual_status=Done으로 완료 처리됩니다.
        </div>
      </div>

      {rows.map((r) => {
        const code = r.code;

        const baseScore = Number(r.impact) * Number(r.likelihood);
        const cur = draft[code] || {};
        const ri = String(cur.residual_impact || "").trim();
        const rl = String(cur.residual_likelihood || "").trim();
        const residualScore = (Number(ri) || 0) * (Number(rl) || 0);

        const isDone =
          String(r.residual_status || "").trim() === "Done" || String(cur.residual_status || "").trim() === "Done";

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
                <div className="text-xs text-slate-500">Base Score</div>
                <div className="text-2xl font-bold">{Number.isFinite(baseScore) ? baseScore : "-"}</div>

                <div className="mt-2 text-xs text-slate-500">Residual Score</div>
                <div className="text-xl font-bold">{ri && rl ? residualScore : "-"}</div>

                {/* ✅ 저장 버튼: 검정 → 파랑 완료 */}
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => saveOne(code)}
                    disabled={savingCode === code}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                      isDone ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-slate-900 text-white hover:bg-slate-800"
                    } ${savingCode === code ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    {savingCode === code ? "저장 중..." : isDone ? "완료" : "저장"}
                  </button>
                </div>
              </div>
            </div>

            {/* 입력 폼 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div>
                <div className="text-xs font-semibold text-slate-700 mb-1">잔여 Impact (residual_impact)</div>
                <Select value={ri} onChange={(v) => setField(code, "residual_impact", v || "")} options={levelOptions} />
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-700 mb-1">잔여 Likelihood (residual_likelihood)</div>
                <Select value={rl} onChange={(v) => setField(code, "residual_likelihood", v || "")} options={levelOptions} />
              </div>

              <div className="lg:col-span-2">
                <div className="text-xs font-semibold text-slate-700 mb-1">비고/근거 (residual_detail)</div>
                <textarea
                  value={String(cur.residual_detail || "")}
                  onChange={(e) => setField(code, "residual_detail", e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                  placeholder="예: 조치 후 접근통제 개선 확인, 운영 절차 변경 반영 완료 등"
                />
              </div>
            </div>
          </div>
        );
      })}

      {rows.length === 0 ? (
        <div className="text-sm text-slate-500">
          잔여 위험 평가 대상이 없습니다. (위험 처리 완료(Done) 항목이 있어야 합니다)
        </div>
      ) : null}
    </div>
  );
}
