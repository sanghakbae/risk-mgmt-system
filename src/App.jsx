// src/App.jsx
import React, { useMemo, useState, useEffect } from "react";
import {
  LayoutDashboard,
  ListChecks,
  ClipboardCheck,
  ShieldAlert,
  Gauge,
  Wrench,
  ShieldCheck,
  FileText,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import DashboardPanel from "./components/DashboardPanel";
import ChecklistPanel from "./components/ChecklistPanel";
import StatusWritePanel from "./components/StatusWritePanel";
import VulnIdentifyPanel from "./components/VulnIdentifyPanel";
import RiskEvaluatePanel from "./components/RiskEvaluatePanel";
import RiskTreatmentPanel from "./components/RiskTreatmentPanel";
import ResidualRiskPanel from "./components/ResidualRiskPanel";
import ApprovePanel from "./components/ApprovePanel";

import Button from "./ui/Button";
import { Badge } from "./ui/Card";
import { supabase } from "./lib/supabaseClient";
import LoginButton from "./components/LoginButton";

const STEPS = [
  { key: "dashboard", title: "Analytics", desc: "전체 현황 요약", icon: <LayoutDashboard className="w-4 h-4" /> },
  { key: "checklist", title: "Checklist", desc: "통제 항목 정의/관리", icon: <ListChecks className="w-4 h-4" /> },
  { key: "status", title: "Status", desc: "통제 이행 현황 기록", icon: <ClipboardCheck className="w-4 h-4" /> },
  { key: "vuln", title: "Vulnerabilities", desc: "취약 식별", icon: <ShieldAlert className="w-4 h-4" /> },
  { key: "risk_evaluate", title: "Risk Eval", desc: "위험도 산정", icon: <Gauge className="w-4 h-4" /> },
  { key: "risk_treatment", title: "Treatment", desc: "위험 대응/조치", icon: <Wrench className="w-4 h-4" /> },
  { key: "residual", title: "Residual", desc: "잔여 위험 재평가", icon: <ShieldCheck className="w-4 h-4" /> },
  { key: "approve", title: "Report", desc: "승인/보고서", icon: <FileText className="w-4 h-4" /> },
];

function normalizeChecklistRows(rows) {
  return (rows ?? []).map((r) => ({
    ...r,
    itemCode: r.itemCode ?? r.itemcode ?? "",
    Guide: r.Guide ?? r.guide ?? r["Guide"] ?? "",
  }));
}

function LoginGate({ onSignedIn }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-4">
        <div>
          <div className="text-lg font-bold text-slate-900">로그인이 필요합니다</div>
          <div className="text-sm text-slate-500 mt-1">muhayu.com 계정만 허용</div>
        </div>
        <div className="pt-2">
          <LoginButton onSignedIn={onSignedIn} />
        </div>
      </div>
    </div>
  );
}

function TopBar({ title, breadcrumb, right }) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div className="min-w-0">
        <div className="text-xs text-slate-500 truncate">{breadcrumb}</div>
        <div className="text-2xl font-bold text-slate-900 truncate">{title}</div>
      </div>
      <div className="shrink-0 flex items-center gap-2">{right}</div>
    </div>
  );
}

function Sidebar({ collapsed, activeKey, onSelect, onToggle }) {
  return (
    <div
      className={[
        "h-screen sticky top-0",
        "border-r border-slate-200 bg-white",
        // ✅ 접힘 폭 축소 (72px → 56px)
        collapsed ? "w-[56px]" : "w-[260px]",
        "transition-all",
      ].join(" ")}
    >
      <div className="h-full flex flex-col">
        {/* brand */}
        <div
          className={[
            "py-4 flex items-center justify-between gap-2 border-b border-slate-200",
            // ✅ 접힘이면 padding 줄이고 가운데 느낌
            collapsed ? "px-2" : "px-4",
          ].join(" ")}
        >
          <div
            className={[
              "flex items-center gap-2 min-w-0",
              // ✅ 접힘이면 브랜드 영역 자체를 가운데로(로고 숨김이라 빈공간 방지)
              collapsed ? "hidden" : "",
            ].join(" ")}
          >
            {/* ✅ 접힘이면 R 안보이게 */}
            {!collapsed ? (
              <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold">
                R
              </div>
            ) : null}

            {!collapsed ? (
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900 truncate">
                  위험평가 시스템
                </div>
              </div>
            ) : null}
          </div>

          {/* 토글 버튼: 접힘/펼침 모두 보이게 */}
          <button
            type="button"
            onClick={onToggle}
            className="w-8 h-8 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center justify-center"
            title={collapsed ? "펼치기" : "접기"}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* nav */}
        <div className={collapsed ? "px-1 py-3 flex-1 overflow-auto" : "px-2 py-3 flex-1 overflow-auto"}>
          <div className="text-[11px] text-slate-500 px-3 mb-2">
            {collapsed ? "" : "General"}
          </div>

          <div className="space-y-1">
            {STEPS.map((s) => {
              const active = s.key === activeKey;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => onSelect(s.key)}
                  className={[
                    "w-full flex items-center rounded-xl",
                    collapsed
                      ? "justify-center px-2 py-2"
                      : "gap-3 px-3 py-2",
                    active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50",
                  ].join(" ")}
                  // ✅ 접힘일 때도 툴팁으로 제목 보이게
                  title={s.title}
                >
                  <span className={active ? "text-white" : "text-slate-500"}>{s.icon}</span>
                  {!collapsed ? <span className="text-sm font-semibold truncate">{s.title}</span> : null}
                </button>
              );
            })}
          </div>
        </div>

        {/* footer */}
        <div className="p-3 border-t border-slate-200">
          <div className={collapsed ? "hidden" : "text-xs text-slate-500"}>
            UI: Analytics Shell
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  // Auth
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  function enforceDomain(s) {
    const email = s?.user?.email ?? "";
    if (s && !email.endsWith("@muhayu.com")) {
      setSession(null);
      supabase.auth.signOut();
      alert("muhayu.com 계정만 허용됩니다.");
      return false;
    }
    return true;
  }

  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) console.error("getSession error:", error);

        const s = data?.session ?? null;
        const ok = enforceDomain(s);
        setSession(ok ? s : null);
        setAuthLoading(false);
      })
      .catch((e) => {
        if (!mounted) return;
        console.error("getSession catch:", e);
        setSession(null);
        setAuthLoading(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      const ok = enforceDomain(newSession);
      setSession(ok ? (newSession ?? null) : null);
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  // App state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeStep, setActiveStep] = useState("dashboard");

  const [checklistItems, setChecklistItems] = useState([]);
  const [checklistReloadKey, setChecklistReloadKey] = useState(0);

  // ApprovePanel 호환
  const [risks, setRisks] = useState([]);
  function approveAll() {
    setRisks((prev) => prev.map((r) => ({ ...r, status: "Approved" })));
  }

  // Checklist Load
  useEffect(() => {
    const CACHE_KEY = "checklist_cache_v1";

    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (Array.isArray(cached) && cached.length) setChecklistItems(cached);
    } catch (e) {
      console.warn("cache parse error", e);
    }

    (async () => {
      try {
        const { data, error } = await supabase.from("checklist").select("*").order("code", { ascending: true });
        if (error) throw error;

        const normalized = normalizeChecklistRows(data);
        setChecklistItems(normalized);
        localStorage.setItem(CACHE_KEY, JSON.stringify(normalized));
      } catch (e) {
        console.error("Checklist load error:", e);
      }
    })();
  }, [checklistReloadKey]);

  const activeMeta = useMemo(() => STEPS.find((s) => s.key === activeStep), [activeStep]);

  // Auth gate render
  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-600">로그인 상태 확인 중...</div>;
  }
  if (!session) {
    return <LoginGate onSignedIn={() => setChecklistReloadKey((k) => k + 1)} />;
  }

  // Right top controls
  const topRight = (
    <>
      <div className="hidden md:flex items-center gap-2">
        <div className="text-xs text-slate-500">LAST 30 DAYS</div>
        <select className="text-xs rounded-xl border border-slate-200 bg-white px-3 py-2">
          <option>최근 30일</option>
          <option>최근 7일</option>
          <option>이번 달</option>
        </select>
      </div>

      <Badge variant="ok">Local MVP</Badge>

      <Button
        variant="outline"
        onClick={async () => {
          await supabase.auth.signOut();
          setSession(null);
        }}
      >
        로그아웃
      </Button>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex">
        <Sidebar
          collapsed={sidebarCollapsed}
          activeKey={activeStep}
          onSelect={setActiveStep}
          onToggle={() => setSidebarCollapsed((v) => !v)}
        />

        <div className="flex-1 min-w-0">
          <div className="px-6">
            <TopBar
              title={activeMeta?.title || "Analytics"}
              breadcrumb={`Dashboard / Widgets / ${activeMeta?.title || ""}`}
              right={topRight}
            />

            {/* page body container */}
            <div className="pb-10">
              {activeStep === "dashboard" ? <DashboardPanel checklistItems={checklistItems} /> : null}

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
                <StatusWritePanel checklistItems={checklistItems} onUpdated={() => setChecklistReloadKey((k) => k + 1)} />
              ) : null}

              {activeStep === "vuln" ? (
                <VulnIdentifyPanel checklistItems={checklistItems} onUpdated={() => setChecklistReloadKey((k) => k + 1)} />
              ) : null}

              {activeStep === "risk_evaluate" ? (
                <RiskEvaluatePanel checklistItems={checklistItems} onUpdated={() => setChecklistReloadKey((k) => k + 1)} />
              ) : null}

              {activeStep === "risk_treatment" ? (
                <RiskTreatmentPanel checklistItems={checklistItems} onUpdated={() => setChecklistReloadKey((k) => k + 1)} />
              ) : null}

              {activeStep === "residual" ? (
                <ResidualRiskPanel checklistItems={checklistItems} onUpdated={() => setChecklistReloadKey((k) => k + 1)} />
              ) : null}

              {activeStep === "approve" ? <ApprovePanel checklistItems={checklistItems} onApproveAll={approveAll} /> : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}