import React, { useEffect, useMemo, useState } from "react";
import Button from "../ui/Button";
import { fetchSecuritySettings, upsertSecuritySetting, writeAuditLog } from "../api/admin";

const DEFAULT_ALLOWED_DOMAINS = ["muhayu.com", "gmail.com"];

function cardClass() {
  return "rounded-2xl border border-slate-200 bg-white p-5";
}

function safeJsonStringify(value) {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch (_e) {
    return "{}";
  }
}

function parseNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeDomainsInput(value) {
  const domains = String(value ?? "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);

  return [...new Set(domains)];
}

export default function AdminSecurityPanel({ session, reloadKey, onChanged }) {
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState("");
  const [error, setError] = useState("");

  const [allowedDomainsText, setAllowedDomainsText] = useState(DEFAULT_ALLOWED_DOMAINS.join(", "));
  const [adminMfaRequired, setAdminMfaRequired] = useState(true);
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(60);
  const [logRetentionDays, setLogRetentionDays] = useState(180);
  const [rawRows, setRawRows] = useState([]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const rows = await fetchSecuritySettings();
        if (!mounted) return;

        setRawRows(rows);

        const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
        const rawAllowed = byKey.allowed_domain?.value ?? {};
        const domains = Array.isArray(rawAllowed?.domains)
          ? rawAllowed.domains
          : rawAllowed?.domain
            ? [rawAllowed.domain]
            : DEFAULT_ALLOWED_DOMAINS;

        setAllowedDomainsText(
          domains
            .map((x) => String(x ?? "").trim().toLowerCase())
            .filter(Boolean)
            .join(", ")
        );

        setAdminMfaRequired(Boolean(byKey.admin_mfa_required?.value?.enabled ?? true));
        setSessionTimeoutMinutes(parseNumber(byKey.session_timeout_minutes?.value?.minutes, 60));
        setLogRetentionDays(parseNumber(byKey.log_retention_days?.value?.days, 180));
      } catch (e) {
        if (!mounted) return;
        console.error(e);
        setError(e.message || "보안 설정을 불러오지 못했습니다.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [reloadKey]);

  async function saveSetting(key, value, description) {
    try {
      setSavingKey(key);
      setError("");

      await upsertSecuritySetting({
        key,
        value,
        description,
        updatedBy: session?.user?.id ?? null,
      });

      await writeAuditLog({
        actorUserId: session?.user?.id,
        actorEmail: session?.user?.email,
        action: "security_setting_upsert",
        targetType: "security_settings",
        targetId: key,
        detail: { key, value },
      });

      onChanged?.();
      alert("저장되었습니다.");
    } catch (e) {
      console.error(e);
      setError(e.message || "저장에 실패했습니다.");
    } finally {
      setSavingKey("");
    }
  }

  async function handleSaveAllowedDomains() {
    const domains = normalizeDomainsInput(allowedDomainsText);

    if (domains.length === 0) {
      alert("허용 이메일 도메인을 1개 이상 입력해야 합니다.");
      return;
    }

    if (domains.length > 2) {
      alert("현재는 허용 도메인을 최대 2개까지 지원합니다.");
      return;
    }

    await saveSetting(
      "allowed_domain",
      { domains },
      "허용 이메일 도메인 목록"
    );
  }

  async function handleSaveAdminMfaRequired() {
    await saveSetting(
      "admin_mfa_required",
      { enabled: Boolean(adminMfaRequired) },
      "관리자 MFA 강제 여부"
    );
  }

  async function handleSaveSessionTimeout() {
    const minutes = parseNumber(sessionTimeoutMinutes, 60);
    await saveSetting(
      "session_timeout_minutes",
      { minutes },
      "세션 만료 시간(분)"
    );
  }

  async function handleSaveLogRetentionDays() {
    const days = parseNumber(logRetentionDays, 180);
    await saveSetting(
      "log_retention_days",
      { days },
      "감사 로그 보관 기간(일)"
    );
  }

  const rawPreview = useMemo(() => rawRows.map((r) => ({ ...r, value: r.value ?? {} })), [rawRows]);

  if (loading) {
    return <div className="text-slate-600">보안 설정을 불러오는 중...</div>;
  }

  return (
    <div className="space-y-5">
      <div className={cardClass()}>
        <div className="text-lg font-bold text-slate-900">보안 설정</div>
        <div className="text-sm text-slate-500 mt-1">
          관리자만 수정할 수 있습니다. 저장 시 감사 로그에 기록됩니다.
        </div>
        {error ? <div className="mt-3 text-sm text-rose-600">{error}</div> : null}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className={cardClass()}>
          <div className="text-sm font-semibold text-slate-900">허용 이메일 도메인</div>
          <div className="text-xs text-slate-500 mt-1">쉼표로 구분하여 최대 2개 입력</div>

          <div className="mt-4 flex gap-2">
            <input
              className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              value={allowedDomainsText}
              onChange={(e) => setAllowedDomainsText(e.target.value)}
              placeholder="muhayu.com, gmail.com"
            />
            <Button
              onClick={handleSaveAllowedDomains}
              disabled={savingKey === "allowed_domain"}
            >
              저장
            </Button>
          </div>

          <div className="mt-2 text-xs text-slate-500">
            예: <span className="font-medium">muhayu.com, gmail.com</span>
          </div>
        </div>

        <div className={cardClass()}>
          <div className="text-sm font-semibold text-slate-900">관리자 MFA 강제</div>
          <div className="text-xs text-slate-500 mt-1">관리자 추가 인증 요구 여부</div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={adminMfaRequired}
                onChange={(e) => setAdminMfaRequired(e.target.checked)}
              />
              MFA 필수
            </label>

            <Button
              onClick={handleSaveAdminMfaRequired}
              disabled={savingKey === "admin_mfa_required"}
            >
              저장
            </Button>
          </div>
        </div>

        <div className={cardClass()}>
          <div className="text-sm font-semibold text-slate-900">세션 만료 시간</div>
          <div className="text-xs text-slate-500 mt-1">분 단위로 관리</div>

          <div className="mt-4 flex gap-2">
            <input
              type="number"
              min="1"
              className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              value={sessionTimeoutMinutes}
              onChange={(e) => setSessionTimeoutMinutes(e.target.value)}
            />
            <Button
              onClick={handleSaveSessionTimeout}
              disabled={savingKey === "session_timeout_minutes"}
            >
              저장
            </Button>
          </div>
        </div>

        <div className={cardClass()}>
          <div className="text-sm font-semibold text-slate-900">감사 로그 보관 기간</div>
          <div className="text-xs text-slate-500 mt-1">일 단위 보관 정책</div>

          <div className="mt-4 flex gap-2">
            <input
              type="number"
              min="1"
              className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              value={logRetentionDays}
              onChange={(e) => setLogRetentionDays(e.target.value)}
            />
            <Button
              onClick={handleSaveLogRetentionDays}
              disabled={savingKey === "log_retention_days"}
            >
              저장
            </Button>
          </div>
        </div>
      </div>

      <div className={cardClass()}>
        <div className="text-sm font-semibold text-slate-900">현재 설정 원본(JSON)</div>
        <div className="text-xs text-slate-500 mt-1">DB에 저장된 값을 그대로 표시합니다.</div>

        <pre className="mt-4 rounded-2xl bg-slate-50 border border-slate-200 p-4 text-xs overflow-auto whitespace-pre-wrap">
          {safeJsonStringify(rawPreview)}
        </pre>
      </div>
    </div>
  );
}