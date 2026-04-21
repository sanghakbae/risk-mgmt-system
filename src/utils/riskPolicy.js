export const TYPE_ISMS = "ISMS";
export const TYPE_ISO = "ISO27001";
export const DEFAULT_DOA_THRESHOLD = 6;
export const DEFAULT_RISK_HIGH_MIN = 7;
export const DEFAULT_RISK_MEDIUM_MIN = 4;
export const ACCEPTANCE_THRESHOLD_OPTIONS = [1, 2, 3, 4, 6, 9];
export const RISK_MIN = 1;
export const RISK_MAX = 9;

function safeStr(v) {
  return v == null ? "" : String(v);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function normalizeType(v) {
  const s = safeStr(v).trim();
  const u = s.toUpperCase();
  if (u.includes("ISO")) return TYPE_ISO;
  if (u.includes("ISMS")) return TYPE_ISMS;
  return TYPE_ISMS;
}

function normalizeThreshold(value, fallback = DEFAULT_DOA_THRESHOLD) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const rounded = clamp(Math.round(n), RISK_MIN, RISK_MAX);
  return ACCEPTANCE_THRESHOLD_OPTIONS.includes(rounded) ? rounded : fallback;
}

export function getRiskAcceptanceMetric(standard) {
  return normalizeType(standard) === TYPE_ISO
    ? { key: "arl_threshold", label: "ARL", name: "Acceptable Risk Level" }
    : { key: "doa_threshold", label: "DoA", name: "Degree of Assurance" };
}

function normalizeOnePolicy(raw, standard = TYPE_ISMS, fallbackThreshold = DEFAULT_DOA_THRESHOLD) {
  const metric = getRiskAcceptanceMetric(standard);
  const doaThreshold = normalizeThreshold(
    raw?.[metric.key] ?? raw?.arl_threshold ?? raw?.doa_threshold ?? raw?.medium_max ?? raw?.mediumMax,
    fallbackThreshold
  );

  return {
    doaThreshold,
    acceptanceThreshold: doaThreshold,
    metricKey: metric.key,
    metricLabel: metric.label,
    metricName: metric.name,
    highMin: DEFAULT_RISK_HIGH_MIN,
    mediumMin: DEFAULT_RISK_MEDIUM_MIN,
  };
}

export function normalizeRiskPolicyValue(raw) {
  if (!raw || typeof raw !== "object") {
    return {
      ISMS: normalizeOnePolicy(null, TYPE_ISMS),
      ISO27001: normalizeOnePolicy(null, TYPE_ISO),
    };
  }

  if (
    raw?.doa_threshold != null ||
    raw?.arl_threshold != null ||
    raw?.medium_max != null ||
    raw?.mediumMax != null ||
    raw?.high_max != null
  ) {
    return {
      ISMS: normalizeOnePolicy(raw, TYPE_ISMS),
      ISO27001: normalizeOnePolicy(raw, TYPE_ISO),
    };
  }

  return {
    ISMS: normalizeOnePolicy(raw?.ISMS, TYPE_ISMS),
    ISO27001: normalizeOnePolicy(raw?.ISO27001, TYPE_ISO),
  };
}

export function getRiskPolicyForType(policyByStandard, type) {
  const standard = normalizeType(type);
  const fallback = normalizeRiskPolicyValue(null).ISMS;
  return policyByStandard?.[standard] ?? fallback;
}

export function isRiskAccepted(riskNumber, policy) {
  if (riskNumber == null) return false;
  const threshold = normalizeThreshold(
    policy?.acceptanceThreshold ?? policy?.doaThreshold ?? policy?.mediumMax
  );
  return Number(riskNumber) <= threshold;
}
