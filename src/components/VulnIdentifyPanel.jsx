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

export default function VulnIdentifyPanel({ checklistItems }) {
  const [domain, setDomain] = useState("");
  const [draft, setDraft] = useState({}); // code -> { result, result_detail }
  const [savingCode, setSavingCode] = useState(null);

  const domainOptions = useMemo(() => {
    const set = new Set((checklistItems || []).map((x) => x.domain));
    return Array.from(set)
      .filter(Boolean)
      .map((d) => ({ value: d, label: d }));
  }, [checklistItems]);

  useEffect(() => {
    if (domainOptions.length === 0) return;
    const exists = domainOptions.some((d) => d.value === domain);
    if (!domain || !exists) setDomain(domainOptions[0].value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domainOptions]);

  const rows = useMemo(() => {
    return (checklistItems || []).filter((x) => x.domain === domain);
  }, [checklistItems, domain]);

  // 도메인 변경 시 draft 초기화(현재 시트값으로 채움)
  useEffect(() => {
    const next = {};
    for (const r of rows) {
      if (!r.code) continue;
      next[r.code] = {
        result: String(r.result ?? "").trim(),
        result_detail: String(r.result_detail ?? ""),
      };
    }
    setDraft(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain]);

  // ✅ 진행률: "전체 통제 항목 중 result가 채워진 수"
  const progress = useMemo(() => {
    const all = checklistItems || [];
    const done = all.filter((x) => String(x.result || "").trim() !== "").length;
    return { done, total: all.length };
  }, [checklistItems]);

  async function saveOne(code) {
    try {
      setSavingCode(code);
      const payload = draft[code] || { result: "", result_detail: "" };

      await updateFields("Checklist", code, {
        result: payload.result || "",
        result_detail: payload.result_detail || "",
      });
    } catch (e) {
      alert("저장 실패: " + String(e.message || e));
    } finally {
      setSavingCode(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* 상단: 진행률 + 도메인 선택 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
        <ProgressBar done={progress.done} total={progress.total} label="취약 도출 진행률 (result 선택)" />
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm text-slate-600">표시: 유형/분야/항목/현황 · 입력: 결과(양호/취약), 사유 저장</div>
          <div className="min-w-[260px]">
            <Select value={domain} onChange={setDomain} options={domainOptions} placeholder="분야 선택" />
          </div>
        </div>
      </div>

      {rows.map((r) => {
        const code = r.code;
        const cur = draft[code] || { result: "", result_detail: "" };

        return (
          <div key={code} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900">
                  {r.type} · {r.domain}
                </div>
                <div className="text-xs text-slate-500 mt-1">현황: {r.status || "-"}</div>
                <div className="text-sm text-slate-800 mt-2 whitespace-normal break-words">
                  <span className="font-semibold mr-2">{r.code}</span>
                  {r.itemCode}
                </div>
              </div>

              <Button onClick={() => saveOne(code)} disabled={savingCode === code}>
                {savingCode === code ? "저장 중..." : "저장"}
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div>
                <div className="text-xs font-semibold text-slate-700 mb-1">결과 (result)</div>
                <Select
                  value={cur.result}
                  onChange={(v) =>
                    setDraft((prev) => ({
                      ...prev,
                      [code]: { ...(prev[code] || {}), result: v },
                    }))
                  }
                  options={[
                    { value: "", label: "선택" },
                    { value: "양호", label: "양호" },
                    { value: "취약", label: "취약" },
                  ]}
                />
              </div>

              <div className="lg:col-span-2">
                <div className="text-xs font-semibold text-slate-700 mb-1">사유 (result_detail)</div>
                <textarea
                  value={cur.result_detail}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      [code]: { ...(prev[code] || {}), result_detail: e.target.value },
                    }))
                  }
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                  placeholder="취약/양호 판단 근거, 증적 위치, 개선 필요사항 등"
                />
              </div>
            </div>
          </div>
        );
      })}

      {domain && rows.length === 0 ? <div className="text-sm text-slate-500">선택한 분야에 항목이 없습니다.</div> : null}
    </div>
  );
}
