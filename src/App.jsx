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
import LoginPage from "./components/LoginPage";
import AdminSecurityPanel from "./components/AdminSecurityPanel";
import AdminAuditLogsPanel from "./components/AdminAuditLogsPanel";
import AdminAccessPanel from "./components/AdminAccessPanel";

import Button from "./ui/Button";
import { supabase } from "./lib/supabaseClient";
import { fetchMyRole, syncMyProfile } from "./api/admin";

const DEFAULT_ALLOWED_DOMAINS = ["muhayu.com", "gmail.com"];
const AUTH_INIT_TIMEOUT_MS = 5000;
const DEFAULT_SESSION_TIMEOUT_MINUTES = 60;
const SESSION_LOGIN_AT_KEY = "app_session_login_at_v1";
const LEGACY_AUTH_KEYS = ["sb-risk-mgmt-auth"];

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

const ADMIN_STEPS = [
  { key: "admin_security", title: "Admin Security", desc: "보안 설정", icon: <Settings className="w-4 h-4" /> },
  { key: "admin_logs", title: "Audit Logs", desc: "감사 로그 조회", icon: <ScrollText className="w-4 h-4" /> },
  { key: "admin_access", title: "Access Control", desc: "권한 관리", icon: <Users className="w-4 h-4" /> },
];

function normalizeChecklistRows(rows) {
  return (rows ?? []).map((r) => ({
    ...r,
    itemCode: r.itemCode ?? r.itemcode ?? "",
    Guide: r.Guide ?? r.guide ?? r["Guide"] ?? "",
  }));
}

function normalizeDomains(rawValue) {
  const rawArray = Array.isArray(rawValue?.domains)
    ? rawValue.domains
    : rawValue?.domain
      ? [rawValue.domain]
      : [];

  const normalized = rawArray
    .map((x) => String(x ?? "").trim().toLowerCase())
    .filter(Boolean);

  return normalized.length ? normalized : DEFAULT_ALLOWED_DOMAINS;
}

function isAllowedDomain(session, domains) {
  if (!session?.user?.email) return true;
  const email = String(session.user.email ?? "").trim().toLowerCase();
  const safeDomains = Array.isArray(domains) ? domains : DEFAULT_ALLOWED_DOMAINS;
  return safeDomains.some((domain) => email.endsWith(`@${domain}`));
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

function cleanupSupabaseStorage() {
  try {
    const localKeys = Object.keys(localStorage);
    for (const k of localKeys) {
      const lower = k.toLowerCase();

      if (
        lower.includes("supabase") ||
        lower.includes("-auth-token") ||
        LEGACY_AUTH_KEYS.includes(k) ||
        k === SESSION_LOGIN_AT_KEY
      ) {
        localStorage.removeItem(k);
      }
    }
  } catch {}

  try {
    const sessionKeys = Object.keys(sessionStorage);
    for (const k of sessionKeys) {
      const lower = k.toLowerCase();

      if (
        lower.includes("supabase") ||
        lower.includes("-auth-token") ||
        LEGACY_AUTH_KEYS.includes(k)
      ) {
        sessionStorage.removeItem(k);
      }
    }
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

function getStoredLoginAt() {
  try {
    const raw = localStorage.getItem(SESSION_LOGIN_AT_KEY);
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function setStoredLoginAt(ts) {
  try {
    localStorage.setItem(SESSION_LOGIN_AT_KEY, String(ts));
  } catch {}
}

function clearStoredLoginAt() {
  try {
    localStorage.removeItem(SESSION_LOGIN_AT_KEY);
  } catch {}
}

function computeEffectiveExpiry(session, sessionTimeoutMinutes) {
  if (!session) return null;

  const now = Date.now();
  const loginAt = getStoredLoginAt() ?? now;
  const appExpiry = loginAt + sessionTimeoutMinutes * 60 * 1000;

  const supabaseExpiry =
    Number.isFinite(session?.expires_at) && session.expires_at > 0
      ? session.expires_at * 1000
      : Number.MAX_SAFE_INTEGER;

  return Math.min(appExpiry, supabaseExpiry);
}

function TopBar({ title, subtitle, right }) {
  return (
    <div className="h-16 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="text-2xl font-bold text-slate-900 truncate">{title}</div>
        {subtitle ? <div className="text-sm text-slate-500 mt-0.5 truncate">{subtitle}</div> : null}
      </div>
      <div className="shrink-0 flex items-center gap-2">{right}</div>
    </div>
  );
}

function Sidebar({ collapsed, activeKey, onSelect, onToggle, role }) {
  const visibleSteps = [...STEPS, ...ADMIN_STEPS];

  function handleSelect(step) {
    if (isAdminMenuKey(step.key) && role !== "admin") {
      alert("관리자 메뉴는 관리자 계정만 접근할 수 있습니다.");
      return;
    }
    onSelect(step.key);
  }

  return (
    <div
      className={[
        "h-screen sticky top-0 border-r border-slate-200 bg-white transition-all",
        collapsed ? "w-[56px]" : "w-[260px]",
      ].join(" ")}
    >
      <div className="h-full flex flex-col">
        <div className={["py-4 flex items-center justify-between gap-2 border-b border-slate-200", collapsed ? "px-2" : "px-4"].join(" ")}>
          <div className={["flex items-center gap-2 min-w-0", collapsed ? "hidden" : ""].join(" ")}>
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold">R</div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900 truncate">위험평가 시스템</div>
              <div className="text-[11px] text-slate-500 truncate">{role === "admin" ? "Administrator" : "User"}</div>
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

        <div className={collapsed ? "px-1 py-3 flex-1 overflow-auto" : "px-2 py-3 flex-1 overflow-auto"}>
          <div className="space-y-1">
            {visibleSteps.map((s) => {
              const active = s.key === activeKey;
              const isAdminItem = isAdminMenuKey(s.key);
              const locked = isAdminItem && role !== "admin";

              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => handleSelect(s)}
                  className={[
                    "w-full flex items-center rounded-xl",
                    collapsed ? "justify-center px-2 py-2" : "gap-3 px-3 py-2",
                    active ? "bg-slate-900 text-white" : locked ? "text-slate-400 hover:bg-slate-50" : "text-slate-700 hover:bg-slate-50",
                  ].join(" ")}
                  title={locked ? `${s.title} (관리자 전용)` : s.title}
                >
                  <span className={active ? "text-white" : isAdminItem ? locked ? "text-slate-400" : "text-amber-600" : "text-slate-500"}>
                    {s.icon}
                  </span>

                  {!collapsed ? (
                    <div className="min-w-0 text-left flex-1">
                      <div className="text-sm font-semibold truncate flex items-center gap-1">
                        <span>{s.title}</span>
                        {locked ? <Lock className="w-3.5 h-3.5 shrink-0" /> : null}
                      </div>
                      <div className={["text-[11px] truncate", active ? "text-slate-200" : locked ? "text-slate-400" : "text-slate-500"].join(" ")}>
                        {locked ? "관리자 전용" : s.desc}
                      </div>
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-3 border-t border-slate-200">
          <div className={collapsed ? "hidden" : "text-xs text-slate-500"}>Risk Assessment System</div>
        </div>
      </div>
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

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [role, setRole] = useState("user");
  const [allowedDomains, setAllowedDomains] = useState(DEFAULT_ALLOWED_DOMAINS);
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(DEFAULT_SESSION_TIMEOUT_MINUTES);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeStep, setActiveStep] = useState("dashboard");

  const [checklistItems, setChecklistItems] = useState([]);
  const [checklistReloadKey, setChecklistReloadKey] = useState(0);
  const [adminReloadKey, setAdminReloadKey] = useState(0);
  const [risks, setRisks] = useState([]);

  const visibleSteps = [...STEPS, ...ADMIN_STEPS];

  const activeMeta = useMemo(
    () => visibleSteps.find((s) => s.key === activeStep),
    [activeStep]
  );

  const loadAllowedDomains = useCallback(async () => {
    try {
      const { data, error } = await withTimeout(
        supabase
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
        supabase
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
      setRole("user");
      return;
    }

    try {
      await syncMyProfile(nextSession.user);
    } catch (e) {
      console.error("profile sync error:", e);
    }

    try {
      const nextRole = await withTimeout(fetchMyRole(), 1200, "user");
      setRole(nextRole || "user");
    } catch (e) {
      console.error("role load error:", e);
      setRole("user");
    }
  }, []);

  const forceLocalLogout = useCallback(async (showAlertMessage = "") => {
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch (e) {
      console.error("signOut error:", e);
    }

    clearStoredLoginAt();
    cleanupSupabaseStorage();
    setSession(null);
    setRole("user");
    setAuthLoading(false);
    resetToAppRoot();

    if (showAlertMessage) {
      alert(showAlertMessage);
    }
  }, []);

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
    let mounted = true;

    const hardStop = setTimeout(() => {
      if (!mounted) return;
      setAuthLoading(false);
    }, AUTH_INIT_TIMEOUT_MS);

    async function bootstrap() {
      try {
        const [domains, timeoutMinutes] = await Promise.all([
          loadAllowedDomains(),
          loadSessionTimeoutMinutes(),
        ]);

        if (!mounted) return;

        setAllowedDomains(domains);
        setSessionTimeoutMinutes(timeoutMinutes);

        const result = await withTimeout(
          supabase.auth.getSession(),
          AUTH_INIT_TIMEOUT_MS,
          { data: { session: null }, error: null }
        );

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
          setStoredLoginAt(Date.now());
        }

        if (await enforceSessionPolicy(nextSession, timeoutMinutes)) {
          return;
        }

        setSession(nextSession);
        setAuthLoading(false);
        loadRoleAndProfile(nextSession);
      } catch (e) {
        console.error("auth bootstrap error:", e);
        if (!mounted) return;
        setSession(null);
        setRole("user");
        setAuthLoading(false);
      }
    }

    bootstrap();

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;

      setAuthLoading(false);

      const [domains, timeoutMinutes] = await Promise.all([
        loadAllowedDomains(),
        loadSessionTimeoutMinutes(),
      ]);

      if (!mounted) return;

      setAllowedDomains(domains);
      setSessionTimeoutMinutes(timeoutMinutes);

      if (newSession && !isAllowedDomain(newSession, domains)) {
        await forceLocalLogout(`${domains.join(", ")} 계정만 허용됩니다.`);
        return;
      }

      if (event === "SIGNED_IN" && newSession) {
        console.log("SIGNED_IN", newSession.user?.email);
        setStoredLoginAt(Date.now());
      }

      if (!newSession) {
        clearStoredLoginAt();
        setSession(null);
        setRole("user");
        resetToAppRoot();
        return;
      }

      if (!getStoredLoginAt()) {
        setStoredLoginAt(Date.now());
      }

      if (await enforceSessionPolicy(newSession, timeoutMinutes)) {
        return;
      }

      setSession(newSession);
      loadRoleAndProfile(newSession);
    });

    return () => {
      mounted = false;
      clearTimeout(hardStop);
      sub?.subscription?.unsubscribe?.();
    };
  }, [
    enforceSessionPolicy,
    forceLocalLogout,
    loadAllowedDomains,
    loadRoleAndProfile,
    loadSessionTimeoutMinutes,
  ]);

  useEffect(() => {
    if (!session) return;

    const timer = setInterval(async () => {
      const timeoutMinutes = await loadSessionTimeoutMinutes();
      setSessionTimeoutMinutes(timeoutMinutes);

      const { data } = await supabase.auth.getSession();
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
    const CACHE_KEY = "checklist_cache_v1";

    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (Array.isArray(cached) && cached.length) {
        setChecklistItems(cached);
      }
    } catch (e) {
      console.warn("cache parse error", e);
    }

    (async () => {
      try {
        const { data, error } = await supabase
          .from("checklist")
          .select("*")
          .order("code", { ascending: true });

        if (error) throw error;

        const normalized = normalizeChecklistRows(data);
        setChecklistItems(normalized);
        localStorage.setItem(CACHE_KEY, JSON.stringify(normalized));
      } catch (e) {
        console.error("Checklist load error:", e);
      }
    })();
  }, [checklistReloadKey]);

  function approveAll() {
    setRisks((prev) => prev.map((r) => ({ ...r, status: "Approved" })));
  }

  async function handleLogout() {
    await forceLocalLogout();
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-600">
        로그인 상태 확인 중...
      </div>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  const effectiveExpiry = computeEffectiveExpiry(session, sessionTimeoutMinutes);
  const remainMs = effectiveExpiry ? Math.max(0, effectiveExpiry - Date.now()) : 0;
  const remainMin = Math.ceil(remainMs / 60000);

  const topRight = (
    <>
      <div className="hidden md:flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
        <div className="text-xs text-slate-500">로그인</div>
        <div className="text-sm font-semibold text-slate-900">{session.user.email}</div>
        <div
          className={[
            "ml-1 px-2 py-1 rounded-full text-[11px] font-semibold border",
            role === "admin"
              ? "bg-amber-50 text-amber-700 border-amber-200"
              : "bg-slate-50 text-slate-600 border-slate-200",
          ].join(" ")}
        >
          {role}
        </div>
      </div>

      <div className="hidden lg:flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
        허용 도메인
        <span className="font-semibold text-slate-900">{allowedDomains.join(", ")}</span>
      </div>

      <div className="hidden xl:flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
        세션 만료까지
        <span className="font-semibold text-slate-900">{remainMin}분</span>
      </div>

      <Button variant="outline" onClick={handleLogout}>
        로그아웃
      </Button>
    </>
  );

  const isAdminMenu = isAdminMenuKey(activeStep);
  const isAdminUser = role === "admin";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex">
        <Sidebar
          collapsed={sidebarCollapsed}
          activeKey={activeStep}
          onSelect={setActiveStep}
          onToggle={() => setSidebarCollapsed((v) => !v)}
          role={role}
        />

        <div className="flex-1 min-w-0">
          <div className="px-6">
            <TopBar
              title={activeMeta?.title || "Analytics"}
              subtitle={activeMeta?.desc || ""}
              right={topRight}
            />

            <div className="pt-6 pb-10">
              {activeStep === "dashboard" && <DashboardPanel checklistItems={checklistItems} />}

              {activeStep === "checklist" && (
                <ChecklistPanel
                  checklistItems={checklistItems}
                  setChecklistItems={setChecklistItems}
                  onReload={() => {
                    localStorage.removeItem("checklist_cache_v1");
                    setChecklistReloadKey((k) => k + 1);
                  }}
                />
              )}

              {activeStep === "status" && (
                <StatusWritePanel
                  checklistItems={checklistItems}
                  onUpdated={() => setChecklistReloadKey((k) => k + 1)}
                />
              )}

              {activeStep === "vuln" && (
                <VulnIdentifyPanel
                  checklistItems={checklistItems}
                  onUpdated={() => setChecklistReloadKey((k) => k + 1)}
                />
              )}

              {activeStep === "risk_evaluate" && (
                <RiskEvaluatePanel
                  checklistItems={checklistItems}
                  onUpdated={() => setChecklistReloadKey((k) => k + 1)}
                />
              )}

              {activeStep === "risk_treatment" && (
                <RiskTreatmentPanel
                  checklistItems={checklistItems}
                  onUpdated={() => setChecklistReloadKey((k) => k + 1)}
                />
              )}

              {activeStep === "residual" && (
                <ResidualRiskPanel
                  checklistItems={checklistItems}
                  onUpdated={() => setChecklistReloadKey((k) => k + 1)}
                />
              )}

              {activeStep === "approve" && (
                <ApprovePanel
                  checklistItems={checklistItems}
                  onApproveAll={approveAll}
                />
              )}

              {activeStep === "admin_security" && (
                isAdminUser ? (
                  <AdminSecurityPanel
                    session={session}
                    reloadKey={adminReloadKey}
                    onChanged={() => setAdminReloadKey((k) => k + 1)}
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
                  />
                ) : (
                  <AdminBlockedPanel />
                )
              )}

              {isAdminMenu && !activeMeta && <AdminBlockedPanel />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}