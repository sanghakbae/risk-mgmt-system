import React, { useMemo, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import ChecklistPanel from "./components/ChecklistPanel";
import StatusWritePanel from "./components/StatusWritePanel";
import VulnIdentifyPanel from "./components/VulnIdentifyPanel";
import ScenarioPanel from "./components/ScenarioPanel";
import AnalysisPanel from "./components/AnalysisPanel";
import AcceptancePanel from "./components/AcceptancePanel";
import TreatmentPanel from "./components/TreatmentPanel";
import ResidualPanel from "./components/ResidualPanel";
import ApprovePanel from "./components/ApprovePanel";
import RiskEvaluatePanel from "./components/RiskEvaluatePanel";
import RiskTreatmentPanel from "./components/RiskTreatmentPanel";
import ResidualRiskPanel from "./components/ResidualRiskPanel";

import Card, { Badge } from "./ui/Card";
import Button from "./ui/Button";
import Select from "./ui/Select";
import { score, gradeFromScore } from "./utils/scoring";
import { readSheet } from "./lib/sheetsApi";

const STEPS = [
  { key: "checklist", title: "통제 항목 관리", desc: "통제 기준 및 항목 정의/관리" },
  { key: "status", title: "통제 이행 점검", desc: "통제 항목별 운영 현황 기록" },
  { key: "vuln", title: "취약 도출", desc: "이행 미흡 항목 기반 취약 식별" },
  { key: "analysis", title: "위험 평가", desc: "위험도 산정 및 허용 기준 비교" },
  { key: "treatment", title: "위험 처리", desc: "위험 대응 전략 수립 및 조치" },
  { key: "residual", title: "잔여 위험 평가", desc: "조치 후 잔여 위험 재평가" },
  { key: "approve", title: "승인 및 보고", desc: "최종 승인 및 보고서 출력" },
];

function MiniList({ title, items, empty }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-3 space-y-2">
        {items.length ? (
          items.map((x) => (
            <div key={x.id} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <div className="font-semibold">{x.id}</div>
              <div className="text-xs text-slate-500 mt-0.5">{x.sub}</div>
            </div>
          ))
        ) : (
          <div className="text-sm text-slate-500">{empty}</div>
        )}
      </div>
    </div>
  );
}

function autoImpactLikelihoodFromStatus(result) {
  if (result === "부적합") return { impact: 4, likelihood: 4 };
  if (result === "부분적합") return { impact: 3, likelihood: 3 };
  return { impact: 3, likelihood: 3 };
}

function applyResidualByTreatment(baseImpact, baseLikelihood, treatment) {
  const clamp = (n) => Math.min(5, Math.max(1, n));
  const map = {
    Mitigate: { di: -1, dl: -1 },
    Transfer: { di: 0, dl: -1 },
    Avoid: { di: -2, dl: 0 },
    Accept: { di: 0, dl: 0 },
  };
  const adj = map[treatment] ?? map.Mitigate;
  return {
    residualImpact: clamp(baseImpact + adj.di),
    residualLikelihood: clamp(baseLikelihood + adj.dl),
  };
}

export default function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    // 모바일/좁은 화면에서는 기본으로 사이드바를 접어 콘텐츠 영역을 우선합니다.
    if (typeof window === "undefined") return false;
    return window.innerWidth < 768;
  });
  const [activeStep, setActiveStep] = useState("status");
  const [checklistReloadKey, setChecklistReloadKey] = useState(0);

  const [matrix, setMatrix] = useState("5x5");
  const bound = matrix === "3x3" ? 3 : 5;
  const [acceptThreshold, setAcceptThreshold] = useState(7);

  const [assets, setAssets] = useState([
    {
      id: "SVR-001",
      assetCode: "SVR-001",
      hostname: "db-prd-01",
      ipAddress: "10.0.0.10",
      type: "DBMS",
      purpose: "운영 DB",
      location: "KT-IDC",
      dept: "Infra",
      owner: "Infra",
      admin: "SecOps",
      confidentiality: 3,
      integrity: 3,
      availability: 3,
      criticality: 9,
      status: "Active",
    },
  ]);

  // ✅ 단일 진실원천: Checklist 시트
  const [checklistItems, setChecklistItems] = useState([]);

  // ✅ 어느 메뉴든 동일하게 "시트→동일 데이터"를 보게 하기:
  // - 캐시 즉시 표시
  // - 백그라운드 최신 갱신
  // - checklistReloadKey 변화 시 무조건 재조회
  useEffect(() => {
    const CACHE_KEY = "checklist_cache_v1";

    // 1) 캐시 즉시 표시
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (Array.isArray(cached) && cached.length) {
        setChecklistItems(cached);
      }
    } catch (e) {
      console.warn("cache parse error", e);
    }

    // 2) 최신 데이터 로드
    (async () => {
      try {
        const data = await readSheet("Checklist");
        if (!Array.isArray(data)) return;

        const mapped = data
          .map((r) => ({
            type: String(r.type ?? "ISMS").trim(),
            area: String(r.area ?? "").trim(),
            domain: String(r.domain ?? "").trim(),
            code: String(r.code ?? "").trim(),
            itemCode: String(r.itemCode ?? "").trim(),

            status: String(r.status ?? "").trim(),
            result: String(r.result ?? "").trim(),
            result_detail: String(r.result_detail ?? "").trim(),

            impact: String(r.impact ?? "").trim(),
            likelihood: String(r.likelihood ?? "").trim(),

            treatment_strategy: String(r.treatment_strategy ?? "").trim(),
            treatment_plan: String(r.treatment_plan ?? ""),
            treatment_owner: String(r.treatment_owner ?? "").trim(),
            treatment_due_date: String(r.treatment_due_date ?? "").trim(),
            treatment_status: String(r.treatment_status ?? "").trim(),
            accept_reason: String(r.accept_reason ?? ""),

            residual_impact: String(r.residual_impact ?? "").trim(),
            residual_likelihood: String(r.residual_likelihood ?? "").trim(),
            residual_status: String(r.residual_status ?? "").trim(),
            residual_detail: String(r.residual_detail ?? ""),
          }))
          .filter((x) => x.code); // ✅ code가 PK

        setChecklistItems(mapped);
        localStorage.setItem(CACHE_KEY, JSON.stringify(mapped));
      } catch (e) {
        console.error("Checklist load error:", e);
      }
    })();
  }, [checklistReloadKey]);

  // (아래 legacy 영역은 지금 UI에서 쓰지 않지만 남겨둠)
  const [assessments, setAssessments] = useState([
    {
      id: "AS-001",
      checklistItemId: "1.1.1.1",
      result: "부적합",
      date: "2026-02-26",
      riskGenerated: false,
      evidence: "",
      notes: "",
    },
  ]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState("AS-001");
  const [vulnerabilities, setVulnerabilities] = useState([]);
  const [risks, setRisks] = useState([]);
  const [selectedRiskId, setSelectedRiskId] = useState(null);

  const selectedAssessment = useMemo(
    () => assessments.find((a) => a.id === selectedAssessmentId) ?? null,
    [assessments, selectedAssessmentId]
  );

  const selectedChecklistItem = useMemo(
    () => checklistItems.find((i) => i.id === selectedAssessment?.checklistItemId) ?? null,
    [checklistItems, selectedAssessment]
  );

  const selectedRisk = useMemo(() => risks.find((r) => r.id === selectedRiskId) ?? null, [risks, selectedRiskId]);

  const suggestedScenario = useMemo(() => {
    if (!selectedAssessment || !selectedChecklistItem) return "";
    const itemLabel = `${selectedChecklistItem.detailCode ?? selectedChecklistItem.id} ${selectedChecklistItem.itemTitle ?? ""}`.trim();
    return `체크리스트 항목(${itemLabel})이(가) '${selectedAssessment.result}' 상태로 확인되어, 통제가 미흡할 경우 위협이 악용되어 정보 유출/서비스 중단/컴플라이언스 위반 등의 사고로 이어질 수 있다.`;
  }, [selectedAssessment, selectedChecklistItem]);

  const [scenarioText, setScenarioText] = useState("");
  const canGenerate = Boolean(selectedAssessment && selectedChecklistItem);

  function onChangeAssessmentResult(id, result) {
    setAssessments((prev) => prev.map((a) => (a.id === id ? { ...a, result } : a)));
  }

  const autoIL = useMemo(() => {
    if (!selectedAssessment) return { impact: 3, likelihood: 3 };
    const base = autoImpactLikelihoodFromStatus(selectedAssessment.result);
    return { impact: Math.min(bound, base.impact), likelihood: Math.min(bound, base.likelihood) };
  }, [selectedAssessment, bound]);

  const computedScore = score(autoIL.impact, autoIL.likelihood);
  const grade = gradeFromScore(computedScore);
  const acceptable = computedScore <= acceptThreshold;

  function generateRisk() {
    if (!canGenerate) return;
    const vulnerable = selectedAssessment.result === "부분적합" || selectedAssessment.result === "부적합";
    if (!vulnerable) return;

    const text = (scenarioText || suggestedScenario).trim();
    if (!text) return;

    const riskId = `R-${String(risks.length + 1).padStart(3, "0")}`;
    const itemLabel = `${selectedChecklistItem.detailCode ?? selectedChecklistItem.id}`;
    const itemTitle = `${selectedChecklistItem.itemTitle ?? ""}`;

    const r = {
      id: riskId,
      assessmentId: selectedAssessment.id,
      asset: itemLabel,
      itemTitle,
      scenario: text,
      impact: autoIL.impact,
      likelihood: autoIL.likelihood,
      score: score(autoIL.impact, autoIL.likelihood),
      grade: gradeFromScore(score(autoIL.impact, autoIL.likelihood)).g,
      status: "Generated",
      treatment: "Mitigate",
      residualStatus: "Pending",
    };

    const residual = applyResidualByTreatment(r.impact, r.likelihood, r.treatment);
    r.residualImpact = residual.residualImpact;
    r.residualLikelihood = residual.residualLikelihood;
    r.residualScore = score(r.residualImpact, r.residualLikelihood);
    r.residualGrade = gradeFromScore(r.residualScore).g;

    setRisks((prev) => [r, ...prev]);
    setSelectedRiskId(riskId);
    setAssessments((prev) => prev.map((x) => (x.id === selectedAssessment.id ? { ...x, riskGenerated: true } : x)));
    setScenarioText("");
    setActiveStep("analysis");
  }

  function assessRisk() {
    if (!selectedRisk) return;
    setRisks((prev) =>
      prev.map((r) =>
        r.id === selectedRisk.id
          ? { ...r, score: score(r.impact, r.likelihood), grade: gradeFromScore(score(r.impact, r.likelihood)).g, status: "Assessed" }
          : r
      )
    );
  }

  function approveAll() {
    setRisks((prev) => prev.map((r) => ({ ...r, status: "Approved" })));
  }

  function setRisksWithResidual(updater) {
    setRisks((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      return next.map((r) => {
        const baseI = Math.min(bound, Math.max(1, r.impact ?? 3));
        const baseL = Math.min(bound, Math.max(1, r.likelihood ?? 3));
        const res = applyResidualByTreatment(baseI, baseL, r.treatment ?? "Mitigate");
        const residualImpact = Math.min(bound, res.residualImpact);
        const residualLikelihood = Math.min(bound, res.residualLikelihood);
        const residualScore = score(residualImpact, residualLikelihood);
        const residualGrade = gradeFromScore(residualScore).g;
        return { ...r, residualImpact, residualLikelihood, residualScore, residualGrade };
      });
    });
  }

  const doneCounts = useMemo(() => {
    const total = risks.length;
    const mitigated = risks.filter((r) => r.treatment === "Mitigate").length;
    const vh = risks.filter((r) => r.grade === "VH").length;
    const ml = risks.filter((r) => r.grade === "M" || r.grade === "L").length;
    return { total, mitigated, vh, ml };
  }, [risks]);

  const headerRight = (
    <div className="flex items-center gap-2 flex-wrap justify-end">
      <Badge variant="ok">Local MVP</Badge>
      <Badge variant="warn">Accept ≤ {acceptThreshold}</Badge>
      <Button
        variant="outline"
        onClick={() => setSidebarCollapsed((v) => !v)}
        iconLeft={sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      >
        좌측 {sidebarCollapsed ? "펼치기" : "접기"}
      </Button>
    </div>
  );

  const panelTitle = STEPS.find((s) => s.key === activeStep)?.title ?? "";
  const panelDesc = STEPS.find((s) => s.key === activeStep)?.desc ?? "";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="w-full px-4 py-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-bold text-slate-900">체크리스트 기반 위험평가 시스템</div>
            <div className="text-sm text-slate-500">Checklist 시트가 모든 메뉴의 단일 기준(SSOT)입니다.</div>
          </div>
          {headerRight}
        </div>

        <div className="mt-5 flex gap-4">
          {/* Left Sidebar */}
          <div className={`${sidebarCollapsed ? "w-0" : "w-[192px]"} transition-all overflow-hidden shrink-0`}>
            <div className="space-y-4">
              <Card title="프로세스 단계" desc="왼쪽 단계는 그대로 따라가도록 설계" right={<Badge>Matrix {matrix}</Badge>}>
                <div className="space-y-2">
                  {STEPS.map((s, idx) => {
                    const active = s.key === activeStep;
                    const done = idx < STEPS.findIndex((x) => x.key === activeStep);
                    return (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => setActiveStep(s.key)}
                        className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                          active ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold flex items-center gap-2">
                              <span
                                className={`inline-flex items-center justify-center w-5 h-5 rounded-full border text-xs ${
                                  active ? "border-white/30" : "border-slate-200"
                                }`}
                              >
                                {done ? "✓" : String(idx + 1)}
                              </span>
                              {s.title}
                            </div>
                            <div className={`text-xs mt-1 ${active ? "text-white/70" : "text-slate-500"}`}>{s.desc}</div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <Button
                    variant="outline"
                    onClick={() => {
                      const i = STEPS.findIndex((s) => s.key === activeStep);
                      setActiveStep(STEPS[Math.max(0, i - 1)].key);
                    }}
                  >
                    이전
                  </Button>
                  <Button
                    onClick={() => {
                      const i = STEPS.findIndex((s) => s.key === activeStep);
                      setActiveStep(STEPS[Math.min(STEPS.length - 1, i + 1)].key);
                    }}
                  >
                    다음
                  </Button>
                </div>
              </Card>

              <Card title="설정" desc="허용기준/매트릭스">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs font-semibold text-slate-700">평가 매트릭스</div>
                    <div className="mt-1">
                      <Select value={matrix} onChange={setMatrix} options={["3x3", "5x5"].map((x) => ({ value: x, label: x }))} />
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-700">허용기준 (≤)</div>
                    <div className="mt-1">
                      <input
                        type="number"
                        min={1}
                        max={25}
                        value={acceptThreshold}
                        onChange={(e) => setAcceptThreshold(Number(e.target.value || 0))}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                      />
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* Right Body */}
          <div className="flex-1 w-full">
            <Card title={`${panelTitle}`} desc={panelDesc} right={<Badge>Work-in-Progress</Badge>}>
              
              {activeStep === "checklist" ? (
                <ChecklistPanel
                  checklistItems={checklistItems}
                  setChecklistItems={setChecklistItems}
                  onReload={() => {
                    localStorage.removeItem("checklist_cache_v1");
                    setChecklistReloadKey((k) => k + 1);
                  }}
                />
              ) : null}

              {activeStep === "status" ? (
                <StatusWritePanel
                  checklistItems={checklistItems}
                  onUpdated={() => setChecklistReloadKey((k) => k + 1)}
                />
              ) : null}

              {activeStep === "vuln" ? (
                <VulnIdentifyPanel
                  checklistItems={checklistItems}
                  onUpdated={() => setChecklistReloadKey((k) => k + 1)}
                />
              ) : null}

              {activeStep === "analysis" ? (
                <RiskEvaluatePanel
                  checklistItems={checklistItems}
                  onUpdated={() => setChecklistReloadKey((k) => k + 1)}
                />
              ) : null}

              {activeStep === "treatment" ? (
                <RiskTreatmentPanel
                  checklistItems={checklistItems}
                  onUpdated={() => setChecklistReloadKey((k) => k + 1)}
                />
              ) : null}

              {activeStep === "residual" ? (
                <ResidualRiskPanel
                  checklistItems={checklistItems}
                  onUpdated={() => setChecklistReloadKey((k) => k + 1)}
                />
              ) : null}

              {activeStep === "approve" ? <ApprovePanel risks={risks} onApproveAll={approveAll} /> : null}

              {/* 아래 legacy 패널들(Scenario/Analysis 등)은 현재 STEPS에 없어서 렌더되지 않음 */}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
