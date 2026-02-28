import React, { useMemo, useState } from "react";
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

export default function RiskEvaluatePanel({ checklistItems, onUpdated }) {
  const [savingCode, setSavingCode] = useState(null);

  // ✅ 취약만 전체 목록화
  const vulnRows = useMemo(() => {
    return (checklistItems || []).filter((x) => String(x.result || "").trim() === "취약");
  }, [checklistItems]);

  // ✅ 진행률: "취약 항목 중 impact&likelihood 둘 다 입력된 수"
  const progress = useMemo(() => {
    const total = vulnRows.length;
    const done = vulnRows.filter((x) => String(x.impact || "").trim() !== "" && String(x.likelihood || "").trim() !== "").length;
    return { done, total };
  }, [vulnRows]);

  const impactOptions = useMemo(
    () => ["", "1", "2", "3", "4", "5"].map((v) => ({ value: v, label: v === "" ? "선택" : v })),
    []
  );
  const likelihoodOptions = impactOptions;

  async function autoSave(code, fields) {
    try {
      setSavingCode(code);
      await updateFields("Checklist", code, fields);
      if (typeof onUpdated === "function") onUpdated();
    } catch (e) {
      alert("저장 실패: " + String(e.message || e));
    } finally {
      setSavingCode(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* 상단: 진행률 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
        <ProgressBar done={progress.done} total={progress.total} label="위험 평가 진행률 (취약 항목 중 impact/likelihood 입력)" />
        <div className="text-sm text-slate-600">
          취약(result=취약) 항목 전체를 표시합니다. Impact/Likelihood 선택 시 자동 저장됩니다.
        </div>
      </div>

      {vulnRows.map((r) => {
        const code = r.code;

        return (
          <div key={code} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
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

              <div className="text-xs text-slate-500">{savingCode === code ? "저장 중..." : ""}</div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div>
                <div className="text-xs font-semibold text-slate-700 mb-1">Impact (사고 발생 시 피해 수준)</div>
                <Select
                  value={String(r.impact ?? "").trim()}
                  onChange={(v) => autoSave(code, { impact: v || "" })}
                  options={impactOptions}
                />
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-700 mb-1">Likelihood (현실적 발생 가능성)</div>
                <Select
                  value={String(r.likelihood ?? "").trim()}
                  onChange={(v) => autoSave(code, { likelihood: v || "" })}
                  options={likelihoodOptions}
                />
              </div>
            </div>
          </div>
        );
      })}

      {vulnRows.length === 0 ? <div className="text-sm text-slate-500">취약으로 분류된 항목이 없습니다.</div> : null}
    </div>
  );
}
