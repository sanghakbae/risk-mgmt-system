const PROJECT_ID = "risk-assessment-mgmt-system";
const ALLOWED_EMAIL = "totoriverce@gmail.com";
const CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, X-File-Name",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function base64UrlToBytes(value) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function decodeJwtPart(value) {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(value)));
}

function pemToArrayBuffer(pem) {
  const base64 = pem
    .replace("-----BEGIN CERTIFICATE-----", "")
    .replace("-----END CERTIFICATE-----", "")
    .replaceAll(/\s/g, "");
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0)).buffer;
}

async function verifyFirebaseToken(request) {
  const header = request.headers.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new Error("missing_token");

  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("invalid_token");

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const jwtHeader = decodeJwtPart(encodedHeader);
  const payload = decodeJwtPart(encodedPayload);

  if (payload.aud !== PROJECT_ID) throw new Error("invalid_audience");
  if (payload.iss !== `https://securetoken.google.com/${PROJECT_ID}`) throw new Error("invalid_issuer");
  if (payload.email !== ALLOWED_EMAIL) throw new Error("invalid_email");
  if (!payload.exp || payload.exp * 1000 < Date.now()) throw new Error("expired_token");

  const certsResponse = await fetch(CERTS_URL);
  const certs = await certsResponse.json();
  const cert = certs[jwtHeader.kid];
  if (!cert) throw new Error("unknown_key");

  const key = await crypto.subtle.importKey(
    "spki",
    pemToArrayBuffer(cert),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    base64UrlToBytes(encodedSignature),
    new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
  );

  if (!valid) throw new Error("invalid_signature");
  return payload;
}

function normalizeKey(rawKey) {
  const key = decodeURIComponent(rawKey || "").replace(/^\/+/, "");
  if (!key || key.includes("..")) return "";
  return key.startsWith("evidence/") ? key : `evidence/${key}`;
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const key = normalizeKey(url.pathname);
    if (!key) return json({ error: "invalid_key" }, 400);

    if (request.method === "GET") {
      const object = await env.EVIDENCE_BUCKET.get(key);
      if (!object) return json({ error: "not_found" }, 404);

      return new Response(object.body, {
        headers: {
          ...corsHeaders,
          "Content-Type": object.httpMetadata?.contentType || "application/octet-stream",
          "Cache-Control": object.httpMetadata?.cacheControl || "public, max-age=31536000, immutable",
        },
      });
    }

    try {
      await verifyFirebaseToken(request);
    } catch (error) {
      return json({ error: "unauthorized", reason: error.message }, 401);
    }

    if (request.method === "PUT") {
      const contentType = request.headers.get("Content-Type") || "application/octet-stream";
      await env.EVIDENCE_BUCKET.put(key, request.body, {
        httpMetadata: {
          contentType,
          cacheControl: "public, max-age=31536000, immutable",
        },
      });
      return json({ key, url: `${url.origin}/${key}` });
    }

    if (request.method === "DELETE") {
      await env.EVIDENCE_BUCKET.delete(key);
      return json({ key, deleted: true });
    }

    return json({ error: "method_not_allowed" }, 405);
  },
};
