function safeStr(v) {
  return v == null ? "" : String(v);
}

export const MAX_EVIDENCE_FILES = 3;

function normalizeUrlList(values) {
  return (values ?? [])
    .map((x) => safeStr(x).trim())
    .filter(Boolean)
    .slice(0, MAX_EVIDENCE_FILES);
}

export function parseEvidenceUrls(raw) {
  if (Array.isArray(raw)) return normalizeUrlList(raw);

  const text = safeStr(raw).trim();
  if (!text) return [];

  if (text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return normalizeUrlList(parsed);
    } catch {}
  }

  if (text.includes("\n")) {
    return normalizeUrlList(text.split(/\r?\n/g));
  }

  return [text];
}

export function serializeEvidenceUrls(urls) {
  const normalized = normalizeUrlList(urls);
  if (normalized.length === 0) return null;
  if (normalized.length === 1) return normalized[0];
  return JSON.stringify(normalized);
}
