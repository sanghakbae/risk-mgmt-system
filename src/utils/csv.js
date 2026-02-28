// Minimal CSV helpers (UTF-8 with BOM for Excel/Korean)

export function toCsv(rows, headers) {
  const escape = (v) => {
    const s = v == null ? "" : String(v);
    const needs = /[\n\r",]/.test(s);
    const quoted = s.replaceAll('"', '""');
    return needs ? `"${quoted}"` : quoted;
  };

  const lines = [];
  lines.push(headers.map((h) => escape(h.label)).join(","));
  for (const r of rows) {
    lines.push(headers.map((h) => escape(r[h.key])).join(","));
  }
  // BOM + LF
  return "\ufeff" + lines.join("\n");
}

export function downloadCsv(filename, csvText) {
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Very small CSV parser (handles quoted fields)
export function parseCsv(text) {
  const input = String(text || "").replace(/^\ufeff/, "");
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  const pushCell = () => {
    row.push(cur);
    cur = "";
  };
  const pushRow = () => {
    // skip empty trailing row
    if (row.length === 1 && row[0] === "") {
      row = [];
      return;
    }
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const next = input[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      pushCell();
      continue;
    }
    if (ch === "\n") {
      pushCell();
      pushRow();
      continue;
    }
    if (ch === "\r") {
      // ignore CR (Windows)
      continue;
    }
    cur += ch;
  }
  pushCell();
  pushRow();

  if (!rows.length) return { headers: [], rows: [] };
  const headers = rows[0].map((h) => h.trim());
  const data = rows.slice(1).filter((r) => r.some((c) => String(c).trim() !== ""));
  return { headers, rows: data };
}

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file, "utf-8");
  });
}
