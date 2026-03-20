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

const DEFAULT_ALLOWED_DOMAINS = ["muhayu.com"];
const AUTH_INIT_TIMEOUT_MS = 8000;
const AUTH_INIT_RETRY_TIMEOUT_MS = 12000;
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
  const storedLoginAt = getStoredLoginAt();
  const sessionIssuedAt = getSessionIssuedAtMs(session);

  let loginAt = storedLoginAt ?? sessionIssuedAt ?? now;
  if (loginAt > now + 60 * 1000) {
    loginAt = now;
  }

  const appExpiry = loginAt + sessionTimeoutMinutes * 60 * 1000;

  const supabaseExpiry =
    Number.isFinite(session?.expires_at) && session.expires_at > 0
      ? session.expires_at * 1000
      : Number.MAX_SAFE_INTEGER;

  return Math.min(appExpiry, supabaseExpiry);
}

function TopBar({ title, subtitle, right }) {
  return (
    <div className="min-h-16 py-3 flex flex-wrap md:flex-nowrap md:items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-xl md:text-2xl font-bold text-slate-900 truncate">{title}</div>
        {subtitle ? <div className="text-sm text-slate-500 mt-0.5 truncate">{subtitle}</div> : null}
      </div>
      <div className="w-full md:w-auto shrink-0 flex items-center gap-2 flex-wrap md:flex-nowrap">{right}</div>
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
        "hidden md:block h-screen sticky top-0 border-r border-slate-200 bg-white transition-all",
        collapsed ? "w-[72px]" : "w-[260px]",
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
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold">R</div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900 truncate">위혐평가 시스템</div>
              <div className="text-xs text-slate-500 truncate">{role === "admin" ? "Administrator" : "User"}</div>
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
                <div key={s.key} className="relative group">
                  <button
                    type="button"
                    onClick={() => handleSelect(s)}
                    className={[
                      "w-full flex items-center rounded-xl",
                      collapsed ? "justify-center px-1 py-2.5" : "gap-3 px-3 py-2",
                      active ? "bg-slate-900 text-white" : locked ? "text-slate-400 hover:bg-slate-50" : "text-slate-700 hover:bg-slate-50",
                    ].join(" ")}
                    title={!collapsed ? locked ? `${s.title} (관리자 전용)` : s.title : undefined}
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
                        <div className={["text-xs truncate", active ? "text-slate-200" : locked ? "text-slate-400" : "text-slate-500"].join(" ")}>
                          {locked ? "관리자 전용" : s.desc}
                        </div>
                      </div>
                    ) : null}
                  </button>

                  {collapsed ? (
                    <div className="pointer-events-none absolute left-full top-1/2 z-20 ml-2 hidden -translate-y-1/2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 shadow group-hover:block">
                      {locked ? `${s.title} (관리자 전용)` : s.title}
                    </div>
                  ) : null}
                </div>
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

function MobileBottomNav({ activeKey, onSelect, role }) {
  const visibleSteps = [...STEPS, ...ADMIN_STEPS];

  function handleSelect(step) {
    if (isAdminMenuKey(step.key) && role !== "admin") {
      alert("관리자 메뉴는 관리자 계정만 접근할 수 있습니다.");
      return;
    }
    onSelect(step.key);
  }

  return (
    <div className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur">
      <div className="overflow-x-auto">
        <div className="flex min-w-max items-stretch gap-1 px-2 py-2">
          {visibleSteps.map((s) => {
            const active = s.key === activeKey;
            const locked = isAdminMenuKey(s.key) && role !== "admin";
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => handleSelect(s)}
                className={[
                  "h-14 min-w-[72px] rounded-lg border px-2 flex flex-col items-center justify-center gap-0.5",
                  active ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200",
                  locked && !active ? "text-slate-400" : "",
                ].join(" ")}
                title={locked ? `${s.title} (관리자 전용)` : s.title}
              >
                <span className={active ? "text-white" : locked ? "text-slate-400" : "text-slate-500"}>{s.icon}</span>
                <span className="text-[11px] font-semibold leading-none flex items-center gap-0.5">
                  <span>{s.title}</span>
                  {locked ? <Lock className="w-3 h-3" /> : null}
                </span>
              </button>
            );
          })}
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
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(DEFAULT_SESSION_TIMEOUT_MINUTES);
  const [clockNow, setClockNow] = useState(() => Date.now());

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


  const handleExtendSession = useCallback(async () => {
  try {
    const timeoutMinutes = await loadSessionTimeoutMinutes();
    setSessionTimeoutMinutes(timeoutMinutes);

    const { data, error } = await supabase.auth.refreshSession();

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
          supabase.auth.getSession(),
          AUTH_INIT_TIMEOUT_MS,
          { __timedOut: true }
        );

        if (result?.__timedOut) {
          result = await withTimeout(
            supabase.auth.getSession(),
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

      setSessionTimeoutMinutes(timeoutMinutes);

      if (newSession && !isAllowedDomain(newSession, domains)) {
        await forceLocalLogout(`${domains.join(", ")} 계정만 허용됩니다.`);
        return;
      }

      if (event === "SIGNED_IN" && newSession) {
        console.log("SIGNED_IN", newSession.user?.email);
        setStoredLoginAt(getSessionIssuedAtMs(newSession) ?? Date.now());
      }

      if (!newSession) {
        clearStoredLoginAt();
        setSession(null);
        setRole("user");
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
      loadRoleAndProfile(newSession);
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
  ]);

  useEffect(() => {
    if (!session) return;

    const timer = setInterval(async () => {
      setClockNow(Date.now());

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
    if (!session) return;

    const uiTimer = setInterval(() => {
      setClockNow(Date.now());
    }, 10000);

    return () => clearInterval(uiTimer);
  }, [session]);

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
  const remainMs = effectiveExpiry ? Math.max(0, effectiveExpiry - clockNow) : 0;
  const remainMin = Math.ceil(remainMs / 60000);




  const topInfoCardClass =
    "rounded-xl border border-slate-200 bg-white px-3 py-2 h-10 min-w-[156px]";

  const topRight = (
    <>
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

      <div className="hidden xl:flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 h-8 w-fit">
        <div className="text-sm text-slate-900 whitespace-nowrap">
          세션 만료:{" "}
          <span className={["font-bold", remainMin <= 10 ? "text-rose-600" : "text-slate-900"].join(" ")}>
            {remainMin}분
          </span>
        </div>
      </div>

      <Button
        variant="outline"
        onClick={handleExtendSession}
        className="h-8 rounded-xl px-3 text-sm !bg-amber-500 !text-slate-900 !border-amber-500 hover:!bg-amber-500 hover:!border-amber-500"
      >
        세션 연장
      </Button>

      <Button
        variant="primary"
        onClick={handleLogout}
        className="h-8 rounded-xl px-3 text-sm bg-black text-white border-black hover:bg-slate-900 hover:border-slate-900"
      >
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
          <div className="px-3 md:px-6">
            <TopBar
              title={activeMeta?.title || "Analytics"}
              subtitle={activeMeta?.desc || ""}
              right={topRight}
            />

            <div className="pt-3 md:pt-6 pb-24 md:pb-10">
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
      <MobileBottomNav activeKey={activeStep} onSelect={setActiveStep} role={role} />
    </div>
  );
}
