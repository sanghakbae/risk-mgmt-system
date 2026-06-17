// App.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
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
  Settings,
  ScrollText,
  Users,
  Lock,
} from "lucide-react";

import DashboardPanel from "./components/DashboardPanel";
import ChecklistPanel from "./components/ChecklistPanel";
import StatusWritePanel from "./components/StatusWritePanel";
import VulnIdentifyPanel from "./components/VulnIdentifyPanel";
import RiskEvaluatePanel from "./components/RiskEvaluatePanel";
import RiskTreatmentPanel from "./components/RiskTreatmentPanel";
import ResidualRiskPanel from "./components/ResidualRiskPanel";
import ApprovePanel from "./components/ApprovePanel";
import AdminSecurityPanel from "./components/AdminSecurityPanel";
import AdminAuditLogsPanel from "./components/AdminAuditLogsPanel";
import AdminAccessPanel from "./components/AdminAccessPanel";

import Button from "./ui/Button";
import { fetchChecklistRows } from "./api/checklist";
import { firebaseBackend } from "./lib/firebaseClient";
import { fetchChecklistStandard, fetchMyRole, syncMyProfile, writeAuditLog } from "./api/admin";

const ALLOWED_EMAIL = "totoriverce@gmail.com";
const DEFAULT_ALLOWED_DOMAINS = [ALLOWED_EMAIL];
const AUTH_INIT_TIMEOUT_MS = 8000;
const AUTH_INIT_RETRY_TIMEOUT_MS = 12000;
const DEFAULT_SESSION_TIMEOUT_MINUTES = 60;
const SESSION_LOGIN_AT_KEY = "app_session_login_at_v1";
const ACTIVE_STEP_STORAGE_KEY = "app_active_step_v1";

const STEPS = [
  { key: "dashboard", title: "대시보드", desc: "평가 현황, 진행률, 도메인별 위험을 한눈에 확인합니다.", sidebarTitle: "Analytics", sidebarDesc: "전체 현황 요약", icon: <LayoutDashboard className="w-4 h-4" /> },
  { key: "checklist", title: "체크리스트", desc: "점검 대상 통제 항목을 조회하고 기준 데이터를 관리합니다.", sidebarTitle: "Checklist", sidebarDesc: "통제 항목 정의/관리", icon: <ListChecks className="w-4 h-4" /> },
  { key: "status", title: "이행 현황", desc: "각 통제 항목의 운영 현황과 증적 상태를 기록합니다.", sidebarTitle: "Status", sidebarDesc: "통제 이행 현황 기록", icon: <ClipboardCheck className="w-4 h-4" /> },
  { key: "vuln", title: "취약 식별", desc: "점검 결과를 바탕으로 취약 여부와 상세 내용을 정리합니다.", sidebarTitle: "Vulnerabilities", sidebarDesc: "취약 식별", icon: <ShieldAlert className="w-4 h-4" /> },
  { key: "risk_evaluate", title: "위험도 평가", desc: "영향도와 가능성을 입력해 위험 수준을 산정합니다.", sidebarTitle: "Risk Eval", sidebarDesc: "위험도 산정", icon: <Gauge className="w-4 h-4" /> },
  { key: "risk_treatment", title: "위험 대응", desc: "위험 처리 전략과 실행 계획을 수립하고 관리합니다.", sidebarTitle: "Treatment", sidebarDesc: "위험 대응/조치", icon: <Wrench className="w-4 h-4" /> },
  { key: "residual", title: "잔여 위험", desc: "조치 이후 남아 있는 위험을 다시 평가합니다.", sidebarTitle: "Residual", sidebarDesc: "잔여 위험 재평가", icon: <ShieldCheck className="w-4 h-4" /> },
  { key: "approve", title: "보고서", desc: "위험평가 결과를 보고서 형태로 확인합니다.", sidebarTitle: "Report", sidebarDesc: "승인/보고서", icon: <FileText className="w-4 h-4" /> },
];

const ADMIN_STEPS = [
  { key: "admin_security", title: "보안 설정", desc: "로그인 허용 정책, 세션 시간, 보안 옵션을 설정합니다.", sidebarTitle: "Admin Security", sidebarDesc: "보안 설정", icon: <Settings className="w-4 h-4" /> },
  { key: "admin_logs", title: "감사 로그", desc: "관리자 작업 이력과 주요 변경 사항을 조회합니다.", sidebarTitle: "Audit Logs", sidebarDesc: "감사 로그 조회", icon: <ScrollText className="w-4 h-4" /> },
  { key: "admin_access", title: "권한 관리", desc: "사용자 역할을 변경하고 접근 권한을 관리합니다.", sidebarTitle: "Access Control", sidebarDesc: "권한 관리", icon: <Users className="w-4 h-4" /> },
];

const GUEST_DEMO_DOMAIN_STATS = [
  ["취약점 점검 및 조치", 4, 3],
  ["관리체계 점검", 2, 1],
  ["인식제고 및 교육훈련", 5, 2],
  ["범위 설정", 3, 1],
  ["정보자산 식별", 3, 1],
  ["네트워크 접근", 3, 1],
  ["로그 및 접속기록 관리", 4, 0],
  ["보안시스템 운영", 3, 0],
  ["보조저장매체 관리", 2, 0],
  ["패치관리", 3, 0],
  ["정책 수립", 3, 0],
  ["보안 서약", 2, 0],
  ["보호구역 지정", 2, 0],
  ["반출입 기기 통제", 3, 0],
  ["업무환경 보안", 2, 0],
  ["정보시스템 접근", 3, 0],
  ["원격접근 통제", 2, 0],
  ["암호정책 적용", 2, 0],
  ["클라우드 보안", 3, 0],
  ["공개서버 보안", 2, 0],
  ["업무용 단말기 보안", 3, 0],
  ["악성코드 통제", 2, 0],
  ["사고 대응 및 복구", 3, 0],
  ["외부자 계약 시 보안", 2, 0],
  ["정보시스템 보호", 3, 0],
  ["사용자 계정 관리", 3, 0],
  ["패스워드 관리", 2, 0],
  ["인터넷 접속 통제", 2, 0],
  ["보안 요구사항 정의", 3, 0],
  ["소스 프로그램 관리", 2, 0],
  ["백업 및 복구관리", 3, 0],
  ["경영진의 참여", 2, 0],
  ["최고책임자의 지정", 2, 0],
  ["운영현황 관리", 3, 0],
  ["사용자 식별", 2, 0],
  ["사용자 인증", 3, 0],
  ["시험과 운영 환경 분리", 2, 0],
  ["시험 데이터 보안", 2, 0],
  ["변경관리", 3, 0],
  ["사고 예방 및 대응체계 구축", 2, 0],
  ["조직 구성", 2, 0],
];

function buildGuestDemoChecklistItems() {
  let codeNo = 1;
  return GUEST_DEMO_DOMAIN_STATS.flatMap(([domain, total, vulnerable], domainIdx) =>
    Array.from({ length: total }, (_, itemIdx) => {
      const isVulnerable = itemIdx < vulnerable;
      const code = `G.${String(codeNo++).padStart(3, "0")}`;
      return {
        id: `guest-${code}`,
        type: "ISMS",
        area: domainIdx < 6 ? "관리체계" : "보호대책",
        domain,
        code,
        itemcode: code,
        guide: `${domain} 점검 기준`,
        status: "운영 중",
        result: isVulnerable ? "취약" : "양호",
        result_detail: isVulnerable
          ? "게스트 모드 표시용 샘플 취약 항목입니다."
          : "게스트 모드 표시용 샘플 양호 항목입니다.",
        likelihood: isVulnerable ? "3" : "1",
        impact: isVulnerable ? "3" : "1",
        risk: isVulnerable ? "높음" : "낮음",
        treatment_strategy: isVulnerable ? "완화" : "수용",
        treatment_plan: isVulnerable ? "담당자 지정 후 개선 조치 수행" : "",
        treatment_owner: isVulnerable ? "보안담당자" : "",
        treatment_status: isVulnerable ? "진행 중" : "완료",
        residual_likelihood: isVulnerable ? "2" : "1",
        residual_impact: isVulnerable ? "2" : "1",
        residual_status: isVulnerable ? "조치 후 재평가 필요" : "수용 가능",
      };
    })
  );
}

function safeStr(v) {
  return v == null ? "" : String(v);
}

function compareChecklistCode(a, b) {
  const aa = safeStr(a).split(".").map((x) => Number(x));
  const bb = safeStr(b).split(".").map((x) => Number(x));
  const len = Math.max(aa.length, bb.length);

  for (let i = 0; i < len; i += 1) {
    const av = Number.isFinite(aa[i]) ? aa[i] : -1;
    const bv = Number.isFinite(bb[i]) ? bb[i] : -1;
    if (av !== bv) return av - bv;
  }

  return safeStr(a).localeCompare(safeStr(b));
}

function normalizeChecklistRows(rows) {
  return (rows ?? [])
    .map((r) => ({
      ...r,
      itemCode: r.itemCode ?? r.itemcode ?? "",
      Guide: r.Guide ?? r.guide ?? r["Guide"] ?? "",
    }))
    .sort((a, b) => compareChecklistCode(a?.code, b?.code));
}

function normalizeChecklistType(value) {
  const raw = safeStr(value).trim().toUpperCase();
  if (raw.includes("ISO")) return "ISO27001";
  if (raw.includes("ISMS")) return "ISMS";
  return "";
}

function mergeChecklistPatch(rows, code, patch) {
  return (rows ?? []).map((row) => {
    if (safeStr(row?.code) !== safeStr(code)) return row;
    return normalizeChecklistRows([{ ...row, ...patch }])[0] ?? { ...row, ...patch };
  });
}

function normalizeDomains(rawValue) {
  return DEFAULT_ALLOWED_DOMAINS;
}

function isAllowedDomain(session, domains) {
  if (!session?.user?.email) return true;
  const email = String(session.user.email ?? "").trim().toLowerCase();
  const allowed = Array.isArray(domains) ? domains : DEFAULT_ALLOWED_DOMAINS;
  return allowed.some((value) => {
    const normalized = safeStr(value).trim().toLowerCase();
    if (!normalized) return false;
    if (normalized.includes("@")) return email === normalized;
    return email.endsWith(`@${normalized}`);
  });
}

function isAdminMenuKey(key) {
  return String(key).startsWith("admin_");
}

function withTimeout(promise, ms, fallbackValue) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallbackValue), ms)),
  ]);
}

function cleanupAppSessionStorage() {
  try {
    localStorage.removeItem(SESSION_LOGIN_AT_KEY);
  } catch {}

  try {
    sessionStorage.removeItem(SESSION_LOGIN_AT_KEY);
  } catch {}
}

function resetToAppRoot() {
  const base = `${window.location.origin}${window.location.pathname}`;
  window.history.replaceState({}, "", base);
  window.location.hash = "";
}

function parseSessionTimeoutMinutes(rawValue) {
  const minutes = Number(rawValue?.minutes);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : DEFAULT_SESSION_TIMEOUT_MINUTES;
}

function decodeJwtPayload(token) {
  try {
    const parts = String(token ?? "").split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function getSessionIssuedAtMs(session) {
  const payload = decodeJwtPayload(session?.access_token);
  const iat = Number(payload?.iat ?? payload?.auth_time);
  return Number.isFinite(iat) && iat > 0 ? iat * 1000 : null;
}

function getStoredLoginAt() {
  try {
    const raw = sessionStorage.getItem(SESSION_LOGIN_AT_KEY);
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function setStoredLoginAt(ts) {
  try {
    sessionStorage.setItem(SESSION_LOGIN_AT_KEY, String(ts));
  } catch {}
}

function clearStoredLoginAt() {
  try {
    sessionStorage.removeItem(SESSION_LOGIN_AT_KEY);
  } catch {}
}

function getStoredActiveStep() {
  try {
    return sessionStorage.getItem(ACTIVE_STEP_STORAGE_KEY) || "dashboard";
  } catch {
    return "dashboard";
  }
}

function getPortalEmbeddedState(embeddedContext) {
  return Boolean(embeddedContext?.embedded);
}

function setStoredActiveStep(step) {
  try {
    sessionStorage.setItem(ACTIVE_STEP_STORAGE_KEY, String(step || "dashboard"));
  } catch {}
}

function clearStoredActiveStep() {
  try {
    sessionStorage.removeItem(ACTIVE_STEP_STORAGE_KEY);
  } catch {}
}

function computeEffectiveExpiry(session, sessionTimeoutMinutes) {
  if (!session) return null;

  const now = Date.now();
  const storedLoginAt = getStoredLoginAt();
  const sessionIssuedAt = getSessionIssuedAtMs(session);

  let loginAt = storedLoginAt ?? sessionIssuedAt ?? now;
  if (sessionIssuedAt && storedLoginAt && storedLoginAt < sessionIssuedAt) {
    loginAt = sessionIssuedAt;
    setStoredLoginAt(sessionIssuedAt);
  }
  if (loginAt > now + 60 * 1000) {
    loginAt = now;
  }

  const appExpiry = loginAt + sessionTimeoutMinutes * 60 * 1000;

  return appExpiry;
}

function TopBar({ title, subtitle, right }) {
  return (
    <div className="min-h-20 py-3.5 flex flex-wrap md:flex-nowrap md:items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[24px] md:text-[28px] font-bold tracking-[-0.02em] text-slate-950 truncate">{title}</div>
        {subtitle ? <div className="mt-1 text-[14px] md:text-[15px] leading-relaxed text-slate-600 truncate">{subtitle}</div> : null}
      </div>
      <div className="w-full md:w-auto shrink-0 flex items-center gap-2 flex-wrap md:flex-nowrap">{right}</div>
    </div>
  );
}

function Sidebar({ collapsed, activeKey, onSelect, onToggle, role, stepStates = {} }) {
  const workflowSteps = STEPS.filter((s) => s.key !== "approve");
  const groupedSteps = [
    STEPS.find((s) => s.key === "approve"),
    ...ADMIN_STEPS,
  ].filter(Boolean);

  function handleSelect(step) {
    const adminLocked = isAdminMenuKey(step.key) && role !== "admin";
    if (adminLocked) {
      alert("관리자 메뉴는 관리자 계정만 접근할 수 있습니다.");
      return;
    }
    onSelect(step.key);
  }

  return (
    <div
      className={[
        "hidden md:block h-screen sticky top-0 border-r border-slate-200 bg-white transition-all",
        collapsed ? "w-[80px]" : "w-[320px]",
      ].join(" ")}
    >
      <div className="h-full flex flex-col">
        <div
          className={[
            "py-4 flex items-center border-b border-slate-200",
            collapsed ? "justify-center px-2" : "justify-between gap-2 px-4",
          ].join(" ")}
        >
          <div className={["flex items-center gap-2 min-w-0", collapsed ? "hidden" : ""].join(" ")}>
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center text-sm font-bold">R</div>
            <div className="min-w-0">
              <div className="text-[15px] font-bold text-slate-900 leading-tight truncate">위험평가 시스템</div>
              <div className="text-xs text-slate-600 truncate">{role === "admin" ? "관리자 모드" : "사용자 모드"}</div>
            </div>
          </div>

          <button
            type="button"
            onClick={onToggle}
            className="w-8 h-8 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center justify-center"
            title={collapsed ? "펼치기" : "접기"}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        <div className={collapsed ? "px-1 py-3 flex-1 overflow-auto" : "px-4 py-5 flex-1 overflow-auto"}>
          <div className="space-y-4">
            <div className="space-y-1.5">
              {workflowSteps.map((s) => {
                const active = s.key === activeKey;
                const isAdminItem = isAdminMenuKey(s.key);
                const adminLocked = isAdminItem && role !== "admin";
                const workflowLocked = Boolean(stepStates[s.key]?.workflowLocked);
                const locked = adminLocked || workflowLocked;
                const lockLabel = adminLocked ? "관리자 전용" : workflowLocked ? "단계 잠금" : "";

                return (
                  <div key={s.key} className="relative group">
                    {!collapsed ? (
                      <span
                        className={[
                          "absolute left-0 top-2 bottom-2 w-1 rounded-r-full transition-colors",
                          locked ? "bg-rose-500" : active ? "bg-emerald-500" : "bg-transparent",
                        ].join(" ")}
                      />
                    ) : null}
                    <button
                      type="button"
                      onClick={() => handleSelect(s)}
                      className={[
                        "w-full flex items-center rounded-xl border transition-colors",
                        collapsed ? "justify-center px-1 py-3.5" : "gap-3 pl-5 pr-4 py-4",
                        locked
                          ? active
                            ? "bg-rose-100 text-slate-900 border-rose-300 border-dashed"
                            : "bg-white text-slate-900 border-rose-300 border-dashed hover:bg-rose-50"
                          : active
                            ? "bg-emerald-100 text-slate-900 border-emerald-300 shadow-sm"
                            : "bg-white text-black border-transparent hover:bg-slate-50 hover:border-slate-200",
                      ].join(" ")}
                      title={!collapsed ? locked ? `${s.sidebarTitle ?? s.title} (${lockLabel})` : s.sidebarTitle ?? s.title : undefined}
                    >
                      <span
                        className={[
                          "shrink-0",
                          locked
                            ? "text-rose-600"
                            : active
                              ? "text-emerald-700"
                              : isAdminItem
                                ? "text-amber-600"
                                : "text-slate-600",
                        ].join(" ")}
                      >
                        {s.icon}
                      </span>

                      {!collapsed ? (
                        <div className="min-w-0 text-left flex-1">
                          <div className="text-[16px] font-extrabold leading-tight truncate flex items-center gap-1.5">
                            <span>{s.sidebarTitle ?? s.title}</span>
                            {locked ? <Lock className="w-3.5 h-3.5 shrink-0" /> : null}
                            {locked ? (
                              <span className="inline-flex items-center rounded-sm border border-rose-300 bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold leading-none text-rose-700">
                                잠금
                              </span>
                            ) : null}
                          </div>
                          {locked ? (
                            <div className="mt-1 text-[12px] font-semibold leading-[1.35] text-rose-700 truncate">
                              {lockLabel}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </button>

                    {collapsed ? (
                      <div className="pointer-events-none absolute left-full top-1/2 z-20 ml-2 hidden -translate-y-1/2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 shadow group-hover:block">
                        {locked ? `${s.sidebarTitle ?? s.title} (${lockLabel})` : s.sidebarTitle ?? s.title}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className={collapsed ? "space-y-1.5" : "rounded-2xl border border-slate-300 bg-slate-50 p-3.5 space-y-1.5"}>
              {!collapsed ? (
                <div className="px-2 pt-1 pb-2.5">
                  <div className="text-[13px] font-extrabold tracking-[0.12em] text-slate-800">REPORT & ADMIN</div>
                  <div className="mt-1 text-[12px] font-medium text-slate-700">보고서 및 운영 설정</div>
                </div>
              ) : null}
              {groupedSteps.map((s) => {
              const active = s.key === activeKey;
              const isAdminItem = isAdminMenuKey(s.key);
              const adminLocked = isAdminItem && role !== "admin";
              const workflowLocked = Boolean(stepStates[s.key]?.workflowLocked);
              const locked = adminLocked || workflowLocked;
              const lockLabel = adminLocked ? "관리자 전용" : workflowLocked ? "단계 잠금" : "";
              const isReportLead = s.key === "approve";

              return (
                <div key={s.key} className="relative group">
                  {!collapsed ? (
                    <span
                      className={[
                        "absolute left-0 top-2 bottom-2 w-1 rounded-r-full transition-colors",
                        locked ? "bg-rose-500" : active ? "bg-emerald-500" : "bg-transparent",
                      ].join(" ")}
                    />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => handleSelect(s)}
                      className={[
                      "w-full flex items-center rounded-xl border transition-colors",
                      collapsed ? "justify-center px-1 py-3.5" : "gap-3 pl-5 pr-4 py-4",
                      isReportLead
                        ? active
                          ? "bg-slate-100 text-slate-900 border-slate-300 shadow-sm"
                          : "bg-slate-50 text-slate-900 border-slate-200 hover:bg-slate-100"
                        : locked
                        ? active
                          ? "bg-rose-100 text-slate-900 border-rose-300 border-dashed"
                          : "bg-white text-slate-900 border-rose-300 border-dashed hover:bg-rose-50"
                        : active
                          ? "bg-emerald-100 text-slate-900 border-emerald-300 shadow-sm"
                          : "bg-white text-black border-transparent hover:bg-slate-50 hover:border-slate-200",
                    ].join(" ")}
                    title={!collapsed ? locked ? `${s.sidebarTitle ?? s.title} (${lockLabel})` : s.sidebarTitle ?? s.title : undefined}
                  >
                      <span
                        className={[
                          "shrink-0",
                          isReportLead
                            ? "text-slate-700"
                            : locked
                            ? "text-rose-600"
                            : active
                              ? "text-emerald-700"
                            : isAdminItem
                            ? locked
                              ? "text-rose-600"
                              : "text-amber-600"
                            : "text-slate-600",
                      ].join(" ")}
                    >
                      {s.icon}
                    </span>

                    {!collapsed ? (
                      <div className="min-w-0 text-left flex-1">
                          <div className="text-[16px] font-extrabold leading-tight truncate flex items-center gap-1.5">
                            <span>{s.sidebarTitle ?? s.title}</span>
                            {!isReportLead && locked ? <Lock className="w-3.5 h-3.5 shrink-0" /> : null}
                            {!isReportLead && locked ? (
                              <span className="inline-flex items-center rounded-sm border border-rose-300 bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold leading-none text-rose-700">
                                잠금
                              </span>
                          ) : null}
                        </div>
                          {isReportLead ? (
                            <div className="mt-1 text-[12px] font-semibold text-slate-700 truncate">승인/보고서</div>
                          ) : locked ? (
                            <div className="mt-1 text-[12px] font-semibold text-rose-700 truncate">{lockLabel}</div>
                          ) : null}
                      </div>
                    ) : null}
                  </button>

                  {collapsed ? (
                    <div className="pointer-events-none absolute left-full top-1/2 z-20 ml-2 hidden -translate-y-1/2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 shadow group-hover:block">
                      {locked ? `${s.sidebarTitle ?? s.title} (${lockLabel})` : s.sidebarTitle ?? s.title}
                    </div>
                  ) : null}
                </div>
              );
            })}
            </div>
          </div>
        </div>

        <div className="p-3 border-t border-slate-200">
          <div className={collapsed ? "hidden" : "text-xs text-slate-600"}>Risk Assessment System</div>
        </div>
      </div>
    </div>
  );
}

function useIsMobileViewport() {
  const getMatches = () => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 767px)").matches;
  };

  const [isMobile, setIsMobile] = useState(getMatches);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const handleChange = () => setIsMobile(mediaQuery.matches);

    handleChange();
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return isMobile;
}

const MOBILE_PRIMARY_STEP_KEYS = ["dashboard", "checklist", "status", "vuln"];

function MobileStepButton({ step, active, locked, onClick, compact = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex items-center justify-center border font-bold transition-colors",
        compact
          ? "relative h-14 w-full min-w-0 flex-col gap-0.5 overflow-hidden rounded-lg px-1 text-[10px]"
          : "h-10 gap-1.5 rounded-full px-2 text-[11px]",
        locked
          ? active
            ? "border-rose-300 bg-rose-100 text-rose-700"
            : "border-rose-200 bg-white text-rose-700"
          : active
            ? "border-slate-950 bg-slate-950 text-white"
            : "border-slate-200 bg-slate-50 text-slate-700",
      ].join(" ")}
    >
      {compact ? (
        <span
          className={[
            "absolute inset-x-0 top-0 h-1",
            locked ? "bg-rose-500" : active ? "bg-emerald-500" : "bg-transparent",
          ].join(" ")}
        />
      ) : null}
      <span className="shrink-0">{step.icon}</span>
      <span className="whitespace-nowrap">{step.title}</span>
      {locked ? <Lock className="h-3 w-3 shrink-0" /> : null}
    </button>
  );
}

function MobileMoreSheet({ open, activeKey, onClose, onSelect, role, stepStates = {} }) {
  if (!open) return null;

  const visibleInBottomNav = new Set(MOBILE_PRIMARY_STEP_KEYS);
  const allSteps = [...STEPS, ...ADMIN_STEPS].filter((step) => !visibleInBottomNav.has(step.key));

  function handleSelect(step) {
    const adminLocked = isAdminMenuKey(step.key) && role !== "admin";
    if (adminLocked) {
      alert("관리자 메뉴는 관리자 계정만 접근할 수 있습니다.");
      return;
    }
    onSelect(step.key);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <button
        type="button"
        aria-label="메뉴 닫기"
        className="absolute inset-0 bg-slate-950/35"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 rounded-t-[16px] border border-slate-200 bg-white p-2 shadow-2xl">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <div className="text-[16px] font-extrabold text-slate-950">전체 메뉴</div>
            <div className="mt-0.5 text-[11px] font-semibold text-slate-500">필요한 단계로 바로 이동합니다.</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold text-slate-700"
          >
            닫기
          </button>
        </div>
        <div className="grid max-h-[62vh] grid-cols-4 gap-1.5 overflow-y-auto pb-2">
          {allSteps.map((step) => {
            const active = step.key === activeKey;
            const adminLocked = isAdminMenuKey(step.key) && role !== "admin";
            const workflowLocked = Boolean(stepStates[step.key]?.workflowLocked);
            const locked = adminLocked || workflowLocked;

            return (
              <MobileStepButton
                key={step.key}
                step={step}
                active={active}
                locked={locked}
                compact
                onClick={() => handleSelect(step)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MobilePrimaryNav({ activeKey, onSelect, onOpenMore, role, stepStates = {} }) {
  const primarySteps = STEPS.filter((step) => MOBILE_PRIMARY_STEP_KEYS.includes(step.key));
  const isMoreActive = !MOBILE_PRIMARY_STEP_KEYS.includes(activeKey);

  function handleSelect(step) {
    const workflowLocked = Boolean(stepStates[step.key]?.workflowLocked);
    if (workflowLocked) {
      alert("이전 단계를 완료해야 접근할 수 있습니다.");
      return;
    }
    onSelect(step.key);
  }

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden">
      <div className="overflow-x-auto">
        <div className="grid w-full grid-cols-5 gap-1 px-2 py-2">
          {primarySteps.map((step) => {
            const active = step.key === activeKey;
            const workflowLocked = Boolean(stepStates[step.key]?.workflowLocked);
            const locked = workflowLocked;

            return (
              <MobileStepButton
                key={step.key}
                step={step}
                active={active}
                locked={locked}
                compact
                onClick={() => handleSelect(step)}
              />
            );
          })}
          <button
            type="button"
            onClick={onOpenMore}
            className={[
              "relative flex h-14 w-full min-w-0 flex-col items-center justify-center gap-0.5 overflow-hidden rounded-lg border px-1 text-[10px] font-bold transition-colors",
              isMoreActive
                ? "border-slate-950 bg-slate-950 text-white"
                : "border-slate-200 bg-slate-50 text-slate-700",
            ].join(" ")}
          >
            <span className={["absolute inset-x-0 top-0 h-1", isMoreActive ? "bg-slate-400" : "bg-transparent"].join(" ")} />
            <span className="text-[16px] leading-none">•••</span>
            <span>더보기</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function MobileAppShell({
  activeMeta,
  activeKey,
  onSelect,
  role,
  stepStates,
  session,
  remainMin,
  sessionTimeoutMinutes,
  onLogin,
  onLogout,
  onExtendSession,
  children,
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 md:hidden">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-slate-50/95 px-3 pt-3 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[11px] font-bold tracking-[0.08em] text-slate-500">위험평가 관리 시스템</div>
            <div className="mt-0.5 truncate text-[14px] font-extrabold tracking-[-0.03em] text-slate-950">
              {activeMeta?.title || "대시보드"}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {!session ? (
              <span className="inline-flex h-8 items-center rounded-full border border-slate-200 bg-white px-2.5 text-[10px] font-bold leading-none text-slate-600">
                게스트 모드
              </span>
            ) : null}
            <Button
              variant="primary"
              onClick={session ? onLogout : onLogin}
              className="h-8 shrink-0 rounded-full bg-black px-2.5 text-[10px] leading-none text-white"
            >
              {session ? "로그아웃" : "로그인"}
            </Button>
          </div>
        </div>

        {session ? (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
            <div className="min-w-0">
              <div className="truncate text-[11px] font-bold text-slate-900">
                {session.user?.email}
              </div>
              <div className="mt-0.5 text-[10px] font-semibold text-slate-500">
                {role} · 세션 {Math.min(sessionTimeoutMinutes, remainMin)}분
              </div>
            </div>

            <button
              type="button"
              onClick={onExtendSession}
              className="shrink-0 rounded-full border border-amber-300 bg-amber-100 px-2.5 py-1.5 text-[10px] font-bold text-amber-800"
            >
              연장
            </button>
          </div>
        ) : null}

        {activeMeta?.desc ? (
          <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-slate-600">{activeMeta.desc}</p>
        ) : null}

      </header>

      <main className="px-3 py-3 pb-24">
        {children}
      </main>

      <MobilePrimaryNav
        activeKey={activeKey}
        onSelect={onSelect}
        onOpenMore={() => setMenuOpen(true)}
        role={role}
        stepStates={stepStates}
      />
      <MobileMoreSheet
        open={menuOpen}
        activeKey={activeKey}
        onClose={() => setMenuOpen(false)}
        onSelect={onSelect}
        role={role}
        stepStates={stepStates}
      />
    </div>
  );
}

function AdminBlockedPanel() {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-8">
      <div className="text-lg font-semibold text-rose-700">접근 불가</div>
      <div className="mt-2 text-sm text-rose-700">이 메뉴는 관리자 계정만 접근할 수 있습니다.</div>
    </div>
  );
}

export default function App({ embeddedContext } = {}) {
  const isPortalEmbedded = getPortalEmbeddedState(embeddedContext);
  const isMobileViewport = useIsMobileViewport();
  const [session, setSession] = useState(
    isPortalEmbedded
      ? {
          user: {
            id: "portal-guest",
            email: "portal@local",
          },
        }
      : null,
  );
  const [authLoading, setAuthLoading] = useState(!isPortalEmbedded);
  const [role, setRole] = useState(isPortalEmbedded ? "admin" : "viewer");
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(DEFAULT_SESSION_TIMEOUT_MINUTES);
  const [clockNow, setClockNow] = useState(() => Date.now());

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeStep, setActiveStep] = useState(() => getStoredActiveStep());

  const [checklistItems, setChecklistItems] = useState([]);
  const [checklistStandard, setChecklistStandard] = useState("ISMS");
  const [checklistReloadKey, setChecklistReloadKey] = useState(0);
  const [adminReloadKey, setAdminReloadKey] = useState(0);
  const [risks, setRisks] = useState([]);

  const visibleChecklistItems = useMemo(() => {
    if (!checklistStandard || checklistStandard === "전체") return checklistItems;
    return checklistItems.filter((row) => normalizeChecklistType(row?.type) === checklistStandard);
  }, [checklistItems, checklistStandard]);

  const isGuestMode = !isPortalEmbedded && !session;
  const guestDemoChecklistItems = useMemo(() => buildGuestDemoChecklistItems(), []);
  const displayChecklistItems = isGuestMode ? guestDemoChecklistItems : visibleChecklistItems;

  const totalChecklistCount = displayChecklistItems.length;
  const statusDoneCount = useMemo(
    () =>
      displayChecklistItems.filter((x) => safeStr(x?.status ?? x?.current_status ?? x?.state).trim() !== "")
        .length,
    [displayChecklistItems]
  );
  const vulnDoneCount = useMemo(
    () =>
      displayChecklistItems.filter((x) => {
        const resultText = safeStr(x?.result ?? x?.vulnResult).trim();
        return resultText === "양호" || resultText === "취약";
      }).length,
    [displayChecklistItems]
  );
  const riskDoneCount = useMemo(
    () =>
      displayChecklistItems.filter((x) => safeStr(x?.likelihood).trim() !== "" && safeStr(x?.impact).trim() !== "")
        .length,
    [displayChecklistItems]
  );
  const treatmentDoneCount = useMemo(
    () =>
      displayChecklistItems.filter((x) => {
        const strategy = safeStr(x?.strategy).trim();
        const mitigation = safeStr(x?.mitigation).trim();
        const acceptance = safeStr(x?.acceptance_reason).trim();
        return strategy !== "" || mitigation !== "" || acceptance !== "";
      }).length,
    [displayChecklistItems]
  );

  const stepStates = useMemo(
    () => ({
      vuln: { workflowLocked: !(totalChecklistCount > 0 && statusDoneCount === totalChecklistCount) },
      risk_evaluate: { workflowLocked: !(totalChecklistCount > 0 && vulnDoneCount === totalChecklistCount) },
      risk_treatment: {
        workflowLocked: !(
          totalChecklistCount > 0 &&
          statusDoneCount === totalChecklistCount &&
          vulnDoneCount === totalChecklistCount &&
          riskDoneCount === totalChecklistCount
        ),
      },
      residual: {
        workflowLocked: !(
          totalChecklistCount > 0 &&
          statusDoneCount === totalChecklistCount &&
          vulnDoneCount === totalChecklistCount &&
          riskDoneCount === totalChecklistCount &&
          treatmentDoneCount === totalChecklistCount
        ),
      },
    }),
    [totalChecklistCount, statusDoneCount, vulnDoneCount, riskDoneCount, treatmentDoneCount]
  );

  const visibleSteps = [...STEPS, ...ADMIN_STEPS];

  const activeMeta = useMemo(
    () => visibleSteps.find((s) => s.key === activeStep),
    [activeStep]
  );

  useEffect(() => {
    const validStep = visibleSteps.some((s) => s.key === activeStep);
    if (!validStep) {
      setActiveStep("dashboard");
      return;
    }

    if (isAdminMenuKey(activeStep) && role !== "admin") {
      setActiveStep("dashboard");
      return;
    }

    setStoredActiveStep(activeStep);
  }, [activeStep, role, visibleSteps]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const standard = await withTimeout(fetchChecklistStandard(), 1500, "ISMS");
        if (!mounted) return;
        setChecklistStandard(standard || "ISMS");
      } catch (e) {
        console.error("Checklist standard load error:", e);
        if (!mounted) return;
        setChecklistStandard("ISMS");
      }
    })();

    return () => {
      mounted = false;
    };
  }, [adminReloadKey]);

  const loadAllowedDomains = useCallback(async () => {
    try {
      const { data, error } = await withTimeout(
        firebaseBackend
          .from("security_settings")
          .select("value")
          .eq("key", "allowed_domain")
          .maybeSingle(),
        1200,
        { data: null, error: null }
      );

      if (error) {
        console.error("allowed_domain load error:", error);
        return DEFAULT_ALLOWED_DOMAINS;
      }

      return normalizeDomains(data?.value ?? {});
    } catch (e) {
      console.error("allowed_domain load catch:", e);
      return DEFAULT_ALLOWED_DOMAINS;
    }
  }, []);

  const loadSessionTimeoutMinutes = useCallback(async () => {
    try {
      const { data, error } = await withTimeout(
        firebaseBackend
          .from("security_settings")
          .select("value")
          .eq("key", "session_timeout_minutes")
          .maybeSingle(),
        1200,
        { data: null, error: null }
      );

      if (error) {
        console.error("session_timeout_minutes load error:", error);
        return DEFAULT_SESSION_TIMEOUT_MINUTES;
      }

      return parseSessionTimeoutMinutes(data?.value ?? {});
    } catch (e) {
      console.error("session_timeout_minutes load catch:", e);
      return DEFAULT_SESSION_TIMEOUT_MINUTES;
    }
  }, []);

  const loadRoleAndProfile = useCallback(async (nextSession) => {
    if (!nextSession?.user) {
      setRole("viewer");
      return;
    }

    try {
      await syncMyProfile(nextSession.user);
    } catch (e) {
      console.error("profile sync error:", e);
    }

    try {
      const nextRole = await fetchMyRole();
      setRole(nextRole || "viewer");
    } catch (e) {
      console.error("role load error:", e);
      setRole("viewer");
    }
  }, []);

  const logAuditEvent = useCallback(async ({ session: auditSession, action, detail = {} }) => {
    if (!auditSession?.user?.id) return;

    try {
      await writeAuditLog({
        actorUserId: auditSession.user.id,
        actorEmail: auditSession.user.email ?? null,
        action,
        targetType: "auth",
        targetId: auditSession.user.id,
        detail,
      });
    } catch (e) {
      console.error("audit log write error:", e);
    }
  }, []);

  const forceLocalLogout = useCallback(async (showAlertMessage = "") => {
    const currentSession = session;

    if (currentSession?.user?.id) {
      await logAuditEvent({
        session: currentSession,
        action: "user_signed_out",
        detail: {
          reason: showAlertMessage ? "forced_logout" : "manual_logout",
        },
      });
    }

    try {
      await firebaseBackend.auth.signOut({ scope: "local" });
    } catch (e) {
      console.error("signOut error:", e);
    }

    clearStoredLoginAt();
    clearStoredActiveStep();
    cleanupAppSessionStorage();
    setSession(null);
    setRole("viewer");
    setAuthLoading(false);
    setActiveStep("dashboard");
    resetToAppRoot();

    if (showAlertMessage) {
      alert(showAlertMessage);
    }
  }, [logAuditEvent, session]);


  const handleExtendSession = useCallback(async () => {
  try {
    const timeoutMinutes = await loadSessionTimeoutMinutes();
    setSessionTimeoutMinutes(timeoutMinutes);

    const { data, error } = await firebaseBackend.auth.refreshSession();

    if (error) {
      console.error("refreshSession error:", error);
      alert("세션 연장에 실패했습니다. 다시 로그인해주세요.");
      await forceLocalLogout();
      return;
    }

    const refreshedSession = data?.session ?? null;

    if (!refreshedSession) {
      alert("세션 정보가 없어 다시 로그인해야 합니다.");
      await forceLocalLogout();
      return;
    }

      setStoredLoginAt(Date.now());
      setSession(refreshedSession);

      await loadRoleAndProfile(refreshedSession);

      alert(`세션이 ${timeoutMinutes}분 기준으로 연장되었습니다.`);
    } catch (e) {
      console.error("handleExtendSession error:", e);
      alert("세션 연장 중 오류가 발생했습니다.");
    }
  }, [forceLocalLogout, loadRoleAndProfile, loadSessionTimeoutMinutes]);

  const enforceSessionPolicy = useCallback(
    async (nextSession, timeoutMinutes) => {
      if (!nextSession) return false;

      const effectiveExpiry = computeEffectiveExpiry(nextSession, timeoutMinutes);
      if (!effectiveExpiry) return false;

      if (Date.now() >= effectiveExpiry) {
        await forceLocalLogout("세션이 만료되었습니다. 다시 로그인해주세요.");
        return true;
      }

      return false;
    },
    [forceLocalLogout]
  );

  useEffect(() => {
    if (isPortalEmbedded) {
      setAuthLoading(false);
      setSession({
        user: {
          id: "portal-guest",
          email: "portal@local",
        },
      });
      setRole("admin");
      return;
    }

    let mounted = true;

    async function bootstrap() {
      try {
        const [domains, timeoutMinutes] = await Promise.all([
          loadAllowedDomains(),
          loadSessionTimeoutMinutes(),
        ]);

        if (!mounted) return;

        setSessionTimeoutMinutes(timeoutMinutes);

        let result = await withTimeout(
          firebaseBackend.auth.getSession(),
          AUTH_INIT_TIMEOUT_MS,
          { __timedOut: true }
        );

        if (result?.__timedOut) {
          result = await withTimeout(
            firebaseBackend.auth.getSession(),
            AUTH_INIT_RETRY_TIMEOUT_MS,
            { data: { session: null }, error: null }
          );
        }

        if (!mounted) return;

        const nextSession = result?.data?.session ?? null;
        const authError = result?.error ?? null;

        if (authError) {
          console.error("getSession error:", authError);
        }

        if (nextSession && !isAllowedDomain(nextSession, domains)) {
          await forceLocalLogout(`${domains.join(", ")} 계정만 허용됩니다.`);
          return;
        }

        if (nextSession && !getStoredLoginAt()) {
          setStoredLoginAt(getSessionIssuedAtMs(nextSession) ?? Date.now());
        }

        if (await enforceSessionPolicy(nextSession, timeoutMinutes)) {
          return;
        }

        setSession(nextSession);
        setAuthLoading(false);
        void loadRoleAndProfile(nextSession);
      } catch (e) {
        console.error("auth bootstrap error:", e);
        if (!mounted) return;
        setSession(null);
        setRole("viewer");
        setAuthLoading(false);
      }
    }

    bootstrap();

    const { data: sub } = firebaseBackend.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;

      try {
        if (!newSession) {
          setAuthLoading(false);
        }

        const [domains, timeoutMinutes] = await Promise.all([
          loadAllowedDomains(),
          loadSessionTimeoutMinutes(),
        ]);

        if (!mounted) return;

        setSessionTimeoutMinutes(timeoutMinutes);

        if (newSession && !isAllowedDomain(newSession, domains)) {
          await forceLocalLogout(`${domains.join(", ")} 계정만 허용됩니다.`);
          return;
        }

        if (event === "SIGNED_IN" && newSession) {
          console.log("SIGNED_IN", newSession.user?.email);
          setStoredLoginAt(getSessionIssuedAtMs(newSession) ?? Date.now());
          void logAuditEvent({
            session: newSession,
            action: "user_signed_in",
            detail: {
              provider: "google",
              email: newSession.user?.email ?? null,
            },
          });
        }

        if (!newSession) {
          clearStoredLoginAt();
          setSession(null);
          setRole("viewer");
          resetToAppRoot();
          return;
        }

        if (!getStoredLoginAt()) {
          setStoredLoginAt(getSessionIssuedAtMs(newSession) ?? Date.now());
        }

        if (await enforceSessionPolicy(newSession, timeoutMinutes)) {
          return;
        }

        setSession(newSession);
        setAuthLoading(false);
        void loadRoleAndProfile(newSession);
      } catch (e) {
        console.error("auth state change error:", e);
        if (!mounted) return;
        setSession(newSession ?? null);
        if (!newSession) {
          setRole("viewer");
        }
      } finally {
        if (mounted) {
          setAuthLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, [
    enforceSessionPolicy,
    forceLocalLogout,
    loadAllowedDomains,
    loadRoleAndProfile,
    loadSessionTimeoutMinutes,
    isPortalEmbedded,
  ]);

  useEffect(() => {
    if (!session) return;

    const timer = setInterval(async () => {
      setClockNow(Date.now());

      const timeoutMinutes = await loadSessionTimeoutMinutes();
      setSessionTimeoutMinutes(timeoutMinutes);

      const { data } = await firebaseBackend.auth.getSession();
      const currentSession = data?.session ?? null;

      if (!currentSession) {
        await forceLocalLogout();
        return;
      }

      await enforceSessionPolicy(currentSession, timeoutMinutes);
    }, 30000);

    return () => clearInterval(timer);
  }, [session, loadSessionTimeoutMinutes, enforceSessionPolicy, forceLocalLogout]);

  useEffect(() => {
    if (!session) return;

    const effectiveExpiry = computeEffectiveExpiry(session, sessionTimeoutMinutes);
    if (!effectiveExpiry) return;

    const delay = Math.max(0, effectiveExpiry - Date.now());
    const timer = setTimeout(async () => {
      await forceLocalLogout("세션이 만료되었습니다. 다시 로그인해주세요.");
    }, delay);

    return () => clearTimeout(timer);
  }, [session, sessionTimeoutMinutes, forceLocalLogout]);

  useEffect(() => {
    if (!session) return;

    const uiTimer = setInterval(() => {
      setClockNow(Date.now());
    }, 10000);

    return () => clearInterval(uiTimer);
  }, [session]);

  useEffect(() => {
    const CACHE_KEY = "checklist_cache_v1";

    (async () => {
      try {
        const data = await fetchChecklistRows();
        const normalized = normalizeChecklistRows(data);
        setChecklistItems(normalized);
      } catch (e) {
        console.error("Checklist load error:", e);
        setChecklistItems([]);
        try {
          localStorage.removeItem(CACHE_KEY);
        } catch (cacheError) {
          console.warn("checklist cache remove error", cacheError);
        }
      }
    })();
  }, [checklistReloadKey]);

  useEffect(() => {
    const CACHE_KEY = "checklist_cache_v1";
    try {
      if (checklistItems.length > 0) {
        localStorage.setItem(CACHE_KEY, JSON.stringify(checklistItems));
      } else {
        localStorage.removeItem(CACHE_KEY);
      }
    } catch (e) {
      console.warn("checklist cache save error", e);
    }
  }, [checklistItems]);

  const applyChecklistUpdate = useCallback((updates) => {
    if (!updates) return;

    const list = Array.isArray(updates) ? updates : [updates];
    setChecklistItems((prev) => {
      let next = prev;
      for (const update of list) {
        const code = safeStr(update?.code);
        if (!code) continue;
        next = mergeChecklistPatch(next, code, update.patch ?? {});
      }
      return next;
    });
  }, []);

  function approveAll() {
    setRisks((prev) => prev.map((r) => ({ ...r, status: "Approved" })));
  }

  async function handleLogout() {
    await forceLocalLogout();
  }

  async function handleLogin() {
    try {
      setAuthLoading(true);
      clearStoredLoginAt();
      const { error } = await firebaseBackend.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) {
        throw error;
      }
    } catch (e) {
      console.error("Google login error:", e);
      alert(e.message || "Google 로그인에 실패했습니다.");
      setAuthLoading(false);
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-600">
        로그인 상태 확인 중...
      </div>
    );
  }

  const effectiveExpiry = session ? computeEffectiveExpiry(session, sessionTimeoutMinutes) : null;
  const remainMs = effectiveExpiry ? Math.max(0, effectiveExpiry - clockNow) : 0;
  // Cap at the configured timeout: loginAt can sit a fraction ahead of clockNow
  // right after login, which would otherwise round 60min up to 61 via ceil.
  const remainMin = Math.min(sessionTimeoutMinutes, Math.ceil(remainMs / 60000));




  const topInfoCardClass =
    "rounded-xl border border-slate-200 bg-white px-3 py-2 h-10 min-w-[156px]";

  const topRight = (
    <>
      {session ? (
        <div className={`hidden md:flex items-center justify-between gap-2 ${topInfoCardClass}`}>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900 truncate leading-tight">{session.user.email}</div>
          </div>
          <div
            className={[
              "shrink-0 px-2 py-0.5 rounded-xl text-xs font-semibold border",
              role === "admin"
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-slate-50 text-slate-600 border-slate-200",
            ].join(" ")}
          >
            {role}
          </div>
        </div>
      ) : (
        <div
          className={`hidden md:flex items-center justify-center ${topInfoCardClass} text-sm font-semibold text-slate-500`}
        >
          게스트 모드
        </div>
      )}

      {session ? (
        <div className="hidden xl:flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 h-8 w-fit">
          <div className="text-sm text-slate-900 whitespace-nowrap">
            세션 만료:{" "}
            <span className={["font-bold", remainMin <= 10 ? "text-rose-600" : "text-slate-900"].join(" ")}>
              {remainMin}분
            </span>
          </div>
        </div>
      ) : null}

      {session ? (
        <Button
          variant="outline"
          onClick={handleExtendSession}
          className="h-8 rounded-xl px-3 text-sm !bg-amber-500 !text-slate-900 !border-amber-500 hover:!bg-amber-500 hover:!border-amber-500"
        >
          세션 연장
        </Button>
      ) : null}

      <Button
        variant="primary"
        onClick={session ? handleLogout : handleLogin}
        className="h-8 rounded-xl px-3 text-sm bg-black text-white border-black hover:bg-slate-900 hover:border-slate-900"
      >
        {session ? "로그아웃" : "Google 로그인"}
      </Button>
    </>
  );

  const isAdminMenu = isAdminMenuKey(activeStep);
  const isAdminUser = role === "admin";

  const activeContent = (
    <>
      {activeStep === "dashboard" && <DashboardPanel checklistItems={displayChecklistItems} />}

      {activeStep === "checklist" && (
        <ChecklistPanel
          checklistItems={visibleChecklistItems}
          setChecklistItems={setChecklistItems}
          onReload={() => {
            localStorage.removeItem("checklist_cache_v1");
            setChecklistReloadKey((k) => k + 1);
          }}
        />
      )}

      {activeStep === "status" && (
        <StatusWritePanel
          checklistItems={displayChecklistItems}
          onUpdated={applyChecklistUpdate}
        />
      )}

      {activeStep === "vuln" && (
        <VulnIdentifyPanel
          checklistItems={displayChecklistItems}
          onUpdated={applyChecklistUpdate}
        />
      )}

      {activeStep === "risk_evaluate" && (
        <RiskEvaluatePanel
          checklistItems={displayChecklistItems}
          onUpdated={applyChecklistUpdate}
        />
      )}

      {activeStep === "risk_treatment" && (
        <RiskTreatmentPanel
          checklistItems={displayChecklistItems}
          checklistStandard={checklistStandard}
          onUpdated={applyChecklistUpdate}
        />
      )}

      {activeStep === "residual" && (
        <ResidualRiskPanel
          checklistItems={displayChecklistItems}
          onUpdated={applyChecklistUpdate}
        />
      )}

      {activeStep === "approve" && (
        <ApprovePanel
          checklistItems={displayChecklistItems}
          onApproveAll={approveAll}
        />
      )}

      {activeStep === "admin_security" && (
        isAdminUser ? (
          <AdminSecurityPanel
            session={session}
            reloadKey={adminReloadKey}
            onChanged={() => setAdminReloadKey((k) => k + 1)}
            canManage={isAdminUser}
          />
        ) : (
          <AdminBlockedPanel />
        )
      )}

      {activeStep === "admin_logs" && (
        isAdminUser ? (
          <AdminAuditLogsPanel reloadKey={adminReloadKey} />
        ) : (
          <AdminBlockedPanel />
        )
      )}

      {activeStep === "admin_access" && (
        isAdminUser ? (
          <AdminAccessPanel
            session={session}
            reloadKey={adminReloadKey}
            onChanged={() => setAdminReloadKey((k) => k + 1)}
            canManage={isAdminUser}
          />
        ) : (
          <AdminBlockedPanel />
        )
      )}

      {isAdminMenu && !activeMeta && <AdminBlockedPanel />}
    </>
  );

  if (isMobileViewport) {
    return (
      <MobileAppShell
        activeMeta={activeMeta}
        activeKey={activeStep}
        onSelect={setActiveStep}
        role={role}
        stepStates={stepStates}
        session={session}
        remainMin={remainMin}
        sessionTimeoutMinutes={sessionTimeoutMinutes}
        onLogin={handleLogin}
        onLogout={handleLogout}
        onExtendSession={handleExtendSession}
      >
        {activeContent}
      </MobileAppShell>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex">
        <Sidebar
          collapsed={sidebarCollapsed}
          activeKey={activeStep}
          onSelect={setActiveStep}
          onToggle={() => setSidebarCollapsed((v) => !v)}
          role={role}
          stepStates={stepStates}
        />

        <div className="flex-1 min-w-0">
          <div className="px-3 md:px-6">
            <TopBar
              title={activeMeta?.title || "Analytics"}
              subtitle={activeMeta?.desc || ""}
              right={topRight}
            />

            <div className="pt-1.5 md:pt-3 pb-24 md:pb-10">
              {activeContent}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
