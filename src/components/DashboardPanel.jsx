import React, { useMemo } from "react";
import MermaidChart from "./Mermaid";

const FLOW = 'flowchart LR A["Checklist Sheet [SSOT]"]-->B["Dashboard [KPI 요약]"] B-->C["통제 항목 관리 [통제 개수]"] C-->D["통제 이행 점검 [status 작성]"] D-->E["취약 도출 [result, result_detail 저장]"] E-->F["위험 평가 [impact, likelihood]"] F-->G["위험 처리 [treatment]"] A-->C A-->D A-->E A-->F A-->G';

export default function DashboardPanel({ checklistItems = [] }) {
  return (
    <div className="space-y-4">
      {/* 기존 KPI 카드들 ... */}
      <MermaidChart code={FLOW} />
    </div>
  );
}
/**
 * DashboardPanel.jsx
 * - "대시보드" 메뉴 전용 화면
 * - checklistItems(SSOT: Checklist 시트 로드 결과)만을 기준으로 KPI를 계산해서 보여줌
 *
 * KPI
 * 1) 통제 항목 관리: 통제 갯수
 * 2) 통제 이행 점검: 진행률 (status 입력된 항목 / 전체)
 * 3) 취약 도출: 진행률 (result=양호/취약 저장된 항목 / 전체)
 * 4) 위험 평가: 영향도(impact) 지정된 갯수
 * 5) 위험 처리: 위험(취약) 갯수 (result=취약)
 */

function toText(v) {
  return v == null ? "" : String(v);
}

function pct(done, total) {
  if (!total) return 0;
  return Math.round((done / total) * 100);
}

function KpiCard({ title, value, sub, barPct, tone = "default" }) {
  const toneCls =
    tone === "blue"
      ? "border-blue-200 bg-blue-50"
      : tone === "red"
      ? "border-red-200 bg-red-50"
      : "border-slate-200 bg-white";

  return (
    <div className={`rounded-2xl border p-4 ${toneCls}`}>
      <div className="text-xs font-semibold text-slate-600">{title}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
      {sub ? <div className="mt-1 text-xs text-slate-500">{sub}</div> : null}

      {typeof barPct === "number" ? (
        <div className="mt-3 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full bg-slate-900"
            style={{ width: `${Math.max(0, Math.min(100, barPct))}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

export default function DashboardPanel({ checklistItems = [] }) {
  const kpi = useMemo(() => {
    const total = Array.isArray(checklistItems) ? checklistItems.length : 0;

    // 2) 통제 이행 점검 진행률: status가 비어있지 않은 항목 수
    const statusDone = (checklistItems || []).filter((x) => toText(x.status).trim().length > 0).length;

    // 3) 취약 도출 진행률: result가 "양호" 또는 "취약"으로 저장된 항목 수
    const vulnDone = (checklistItems || []).filter((x) => {
      const r = toText(x.result || x.vulnResult).trim();
      return r === "양호" || r === "취약";
    }).length;

    // 4) 위험 평가: impact 지정된 항목 수
    const impactCount = (checklistItems || []).filter((x) => toText(x.impact).trim().length > 0).length;

    // 5) 위험 처리: 위험(취약) 갯수
    const riskCount = (checklistItems || []).filter((x) => toText(x.result || x.vulnResult).trim() === "취약").length;

    return {
      total,
      statusDone,
      statusPct: pct(statusDone, total),
      vulnDone,
      vulnPct: pct(vulnDone, total),
      impactCount,
      riskCount,
    };
  }, [checklistItems]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="text-sm font-semibold text-slate-900">대시보드</div>
        <div className="mt-1 text-xs text-slate-500">
          Checklist 시트(단일 기준 데이터)를 기반으로 전체 진행 현황을 요약합니다.
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <KpiCard title="통제 항목 관리" value={`${kpi.total}개`} sub="통제(항목) 총 개수" />
        <KpiCard
          title="통제 이행 점검"
          value={`${kpi.statusPct}%`}
          sub={`${kpi.statusDone}/${kpi.total} (status 입력 완료)`}
          barPct={kpi.statusPct}
        />
        <KpiCard
          title="취약 도출"
          value={`${kpi.vulnPct}%`}
          sub={`${kpi.vulnDone}/${kpi.total} (양호/취약 저장 완료)`}
          barPct={kpi.vulnPct}
        />
        <KpiCard title="위험 평가" value={`${kpi.impactCount}건`} sub="impact(영향도) 지정된 항목 수" tone="blue" />
        <KpiCard title="위험 처리" value={`${kpi.riskCount}건`} sub="result=취약 항목 수" tone="red" />
      </div>
    </div>
  );
}
