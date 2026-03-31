import React, { useEffect, useMemo, useState } from "react";
import Button from "../ui/Button";
import { fetchSecuritySettings, upsertSecuritySetting, writeAuditLog } from "../api/admin";

const DEFAULT_ALLOWED_DOMAINS = ["muhayu.com"];
const DEFAULT_SESSION_TIMEOUT_MINUTES = 60;
const MIN_SESSION_TIMEOUT_MINUTES = 1;
const MAX_SESSION_TIMEOUT_MINUTES = 1440;
const DEFAULT_LOG_RETENTION_DAYS = 180;
const MIN_LOG_RETENTION_DAYS = 1;
const MAX_LOG_RETENTION_DAYS = 3650;
const STANDARD_OPTIONS = ["ISMS", "ISO27001"];
const DEFAULT_DOA_THRESHOLD = 6;

function cardClass() {
  return "rounded-2xl border border-slate-200 bg-white p-4";
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

function normalizePositiveInteger(value) {
  if (value === "" || value == null) return NaN;
  const n = Number(value);
  if (!Number.isFinite(n)) return NaN;
  if (!Number.isInteger(n)) return NaN;
  return n;
}

function normalizeRiskPolicyValue(value) {
  const raw = value ?? {};

  if (Number.isFinite(Number(raw?.doa_threshold))) {
    const normalized = {
      doa_threshold: parseNumber(raw.doa_threshold, DEFAULT_DOA_THRESHOLD),
    };
    return {
      ISMS: normalized,
      ISO27001: normalized,
    };
  }

  if (Number.isFinite(Number(raw?.high_max)) && Number.isFinite(Number(raw?.medium_max))) {
    const normalized = {
      doa_threshold: parseNumber(raw.medium_max, DEFAULT_DOA_THRESHOLD),
    };
    return {
      ISMS: normalized,
      ISO27001: normalized,
    };
  }

  return {
    ISMS: {
      doa_threshold: parseNumber(
        raw?.ISMS?.doa_threshold ?? raw?.ISMS?.medium_max,
        DEFAULT_DOA_THRESHOLD
      ),
    },
    ISO27001: {
      doa_threshold: parseNumber(
        raw?.ISO27001?.doa_threshold ?? raw?.ISO27001?.medium_max,
        DEFAULT_DOA_THRESHOLD
      ),
    },
  };
}

export default function AdminSecurityPanel({ session, reloadKey, onChanged, canManage = false }) {
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState("");
  const [error, setError] = useState("");

  const [allowedDomainsText, setAllowedDomainsText] = useState(DEFAULT_ALLOWED_DOMAINS.join(", "));
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(DEFAULT_SESSION_TIMEOUT_MINUTES);
  const [logRetentionDays, setLogRetentionDays] = useState(DEFAULT_LOG_RETENTION_DAYS);
  const [selectedStandard, setSelectedStandard] = useState("ISMS");
  const [doaThreshold, setDoaThreshold] = useState(DEFAULT_DOA_THRESHOLD);
  const [riskPolicyByStandard, setRiskPolicyByStandard] = useState(() =>
    normalizeRiskPolicyValue(null)
  );
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

        setSessionTimeoutMinutes(
          parseNumber(
            byKey.session_timeout_minutes?.value?.minutes,
            DEFAULT_SESSION_TIMEOUT_MINUTES
          )
        );
        setLogRetentionDays(
          parseNumber(
            byKey.log_retention_days?.value?.days,
            DEFAULT_LOG_RETENTION_DAYS
          )
        );
        const nextPolicy = normalizeRiskPolicyValue(byKey.risk_evaluation_policy?.value);
        setRiskPolicyByStandard(nextPolicy);
        setDoaThreshold(parseNumber(nextPolicy.ISMS?.doa_threshold, DEFAULT_DOA_THRESHOLD));
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

  useEffect(() => {
    const current = riskPolicyByStandard[selectedStandard] ?? {};
    setDoaThreshold(parseNumber(current.doa_threshold, DEFAULT_DOA_THRESHOLD));
  }, [selectedStandard, riskPolicyByStandard]);

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

    if (domains.length !== 1 || domains[0] !== "muhayu.com") {
      alert("현재는 muhayu.com 도메인만 허용됩니다.");
      return;
    }

    await saveSetting(
      "allowed_domain",
      { domains },
      "허용 이메일 도메인 목록"
    );
  }

  async function handleSaveSessionTimeout() {
    const minutes = normalizePositiveInteger(sessionTimeoutMinutes);

    if (!Number.isFinite(minutes)) {
      alert("세션 만료 시간은 정수로 입력해야 합니다.");
      return;
    }

    if (minutes < MIN_SESSION_TIMEOUT_MINUTES) {
      alert(`세션 만료 시간은 최소 ${MIN_SESSION_TIMEOUT_MINUTES}분 이상이어야 합니다.`);
      return;
    }

    if (minutes > MAX_SESSION_TIMEOUT_MINUTES) {
      alert(`세션 만료 시간은 최대 ${MAX_SESSION_TIMEOUT_MINUTES}분(24시간)까지 설정할 수 있습니다.`);
      return;
    }

    await saveSetting(
      "session_timeout_minutes",
      { minutes },
      "세션 만료 시간(분)"
    );
  }

  async function handleSaveLogRetentionDays() {
    const days = normalizePositiveInteger(logRetentionDays);

    if (!Number.isFinite(days)) {
      alert("감사 로그 보관 기간은 정수로 입력해야 합니다.");
      return;
    }

    if (days < MIN_LOG_RETENTION_DAYS) {
      alert(`감사 로그 보관 기간은 최소 ${MIN_LOG_RETENTION_DAYS}일 이상이어야 합니다.`);
      return;
    }

    if (days > MAX_LOG_RETENTION_DAYS) {
      alert(`감사 로그 보관 기간은 최대 ${MAX_LOG_RETENTION_DAYS}일까지 설정할 수 있습니다.`);
      return;
    }

    await saveSetting(
      "log_retention_days",
      { days },
      "감사 로그 보관 기간(일)"
    );
  }

  async function handleSaveRiskEvaluationPolicy() {
    const threshold = normalizePositiveInteger(doaThreshold);

    if (!Number.isFinite(threshold)) {
      alert("DoA 기준값은 정수로 입력해야 합니다.");
      return;
    }

    if (threshold < 1) {
      alert("DoA 기준값은 1 이상이어야 합니다.");
      return;
    }

    await saveSetting(
      "risk_evaluation_policy",
      {
        ...riskPolicyByStandard,
        [selectedStandard]: { doa_threshold: threshold },
      },
      "DoA 등급 기준"
    );
    setRiskPolicyByStandard((prev) => ({
      ...prev,
      [selectedStandard]: { doa_threshold: threshold },
    }));
  }

  const rawPreview = useMemo(
    () => rawRows.map((r) => ({ ...r, value: r.value ?? {} })),
    [rawRows]
  );

  if (loading) {
    return <div className="text-slate-600">보안 설정을 불러오는 중...</div>;
  }

  return (
    <div className="space-y-4">
      <div className={cardClass()}>
        <div className="panel-banner-title text-slate-900">보안 설정</div>
        <div className="panel-banner-body text-slate-500">
          {canManage
            ? "관리자만 수정할 수 있습니다. 저장 시 감사 로그에 기록됩니다."
            : "viewer는 열람만 가능합니다. 수정은 관리자만 할 수 있습니다."}
        </div>
        {error ? <div className="mt-3 text-sm text-rose-600">{error}</div> : null}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className={cardClass()}>
          <div className="text-sm font-semibold text-slate-900">허용 이메일 도메인</div>
          <div className="text-xs text-slate-500 mt-1">기본 정책: muhayu.com만 허용</div>

          <div className="mt-4 flex gap-2">
            <input
              className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              value={allowedDomainsText}
              onChange={(e) => setAllowedDomainsText(e.target.value)}
              placeholder="muhayu.com"
              disabled={!canManage}
            />
            <Button
              onClick={handleSaveAllowedDomains}
              disabled={!canManage || savingKey === "allowed_domain"}
            >
              저장
            </Button>
          </div>

          <div className="mt-2 text-xs text-slate-500">
            예: <span className="font-medium">muhayu.com</span>
          </div>
        </div>

        <div className={cardClass()}>
          <div className="text-sm font-semibold text-slate-900">세션 만료 시간</div>
          <div className="text-xs text-slate-500 mt-1">
            분 단위로 관리 · {MIN_SESSION_TIMEOUT_MINUTES}~{MAX_SESSION_TIMEOUT_MINUTES}분 입력
          </div>

          <div className="mt-4 flex gap-2">
            <input
              type="number"
              min={MIN_SESSION_TIMEOUT_MINUTES}
              max={MAX_SESSION_TIMEOUT_MINUTES}
              step="1"
              className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              value={sessionTimeoutMinutes}
              onChange={(e) => setSessionTimeoutMinutes(e.target.value)}
              disabled={!canManage}
            />
            <Button
              onClick={handleSaveSessionTimeout}
              disabled={!canManage || savingKey === "session_timeout_minutes"}
            >
              저장
            </Button>
          </div>

          <div className="mt-2 text-xs text-slate-500">
            권장값: <span className="font-medium">30</span>, <span className="font-medium">60</span>, <span className="font-medium">120</span>
          </div>
        </div>

        <div className={cardClass()}>
          <div className="text-sm font-semibold text-slate-900">감사 로그 보관 기간</div>
          <div className="text-xs text-slate-500 mt-1">
            일 단위 보관 정책 · {MIN_LOG_RETENTION_DAYS}~{MAX_LOG_RETENTION_DAYS}일 입력
          </div>

          <div className="mt-4 flex gap-2">
            <input
              type="number"
              min={MIN_LOG_RETENTION_DAYS}
              max={MAX_LOG_RETENTION_DAYS}
              step="1"
              className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              value={logRetentionDays}
              onChange={(e) => setLogRetentionDays(e.target.value)}
              disabled={!canManage}
            />
            <Button
              onClick={handleSaveLogRetentionDays}
              disabled={!canManage || savingKey === "log_retention_days"}
            >
              저장
            </Button>
          </div>
        </div>

        <div className={cardClass()}>
          <div className="text-sm font-semibold text-slate-900">DoA 기준</div>
          <div className="text-xs text-slate-500 mt-1">
            표준을 선택하면 해당 DoA 기준값 1개만 표시하고 저장합니다.
          </div>

          <div className="mt-4">
            <select
              value={selectedStandard}
              onChange={(e) => setSelectedStandard(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
              disabled={!canManage}
            >
              {STANDARD_OPTIONS.map((standard) => (
                <option key={standard} value={standard}>
                  {standard}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3">
            <input
              type="number"
              min="1"
              step="1"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              value={doaThreshold}
              onChange={(e) => setDoaThreshold(e.target.value)}
              disabled={!canManage}
              placeholder="DoA 기준값"
            />
          </div>

          <div className="mt-2 text-xs text-slate-500">
            {selectedStandard} 기준 예: Risk {doaThreshold || DEFAULT_DOA_THRESHOLD} 이하는 허용, 그 초과는 조치 필요
          </div>

          <div className="mt-4">
            <Button
              onClick={handleSaveRiskEvaluationPolicy}
              disabled={!canManage || savingKey === "risk_evaluation_policy"}
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
