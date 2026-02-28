// 001
const API_URL =
  "https://script.google.com/macros/s/AKfycbzlnApi136R2uqIps0_x8jKZaug5phV1VhgNowg4aclL34zZbwaivByVO6tokNPed5J/exec";
// 002
const API_KEY = "CHANGE_ME_LONG_RANDOM";

// 010
export async function readSheet(sheetName) {
  const url =
    `${API_URL}?action=read` +
    `&sheet=${encodeURIComponent(sheetName)}` +
    `&key=${encodeURIComponent(API_KEY)}`;

  const res = await fetch(url);
  const json = await res.json();

  if (!json.ok) throw new Error(json.error || json.message || "readSheet failed");
  return Array.isArray(json.data) ? json.data : [];
}

// 035
export async function updateStatus(sheetName, code, status) {
  const res = await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "updateStatus",
      sheet: sheetName,
      key: API_KEY,
      code,
      status,
    }),
  });

  const json = await res.json();
  if (!json.ok) throw new Error(json.error || json.message || "updateStatus failed");
  return true;
}

// 060
export async function updateFields(sheetName, code, fields) {
  const res = await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "updateFields",
      sheet: sheetName,
      key: API_KEY,
      code,
      fields,
    }),
  });

  const json = await res.json();
  if (!json.ok) throw new Error(json.error || json.message || "updateFields failed");
  return true;
}
