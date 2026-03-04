// src/utils/reportHtml.js

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function numOrBlank(v) {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : "";
}

function riskScore(impact, likelihood) {
  const i = Number(impact);
  const l = Number(likelihood);
  if (!Number.isFinite(i) || !Number.isFinite(l)) return "";
  return String(i * l);
}

function groupBy(items, keyFn) {
  const m = new Map();
  for (const it of items) {
    const k = keyFn(it);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(it);
  }
  return m;
}

function fmtDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * checklistItems: checklist 테이블에서 읽어온 "전체" rows
 * 옵션:
 * - title: 보고서 제목
 * - orgName: 회사/조직명(선택)
 * - matrix: "3x3" | "5x5"(표시용)
 * - acceptThreshold: 수용 기준(표시용)
 */
export function buildApprovalReportHtml({
  checklistItems = [],
  title = "체크리스트 기반 위험평가 보고서",
  orgName = "",
  matrix = "",
  acceptThreshold = "",
} = {}) {
  const all = Array.isArray(checklistItems) ? checklistItems : [];
  const total = all.length;

  const vuln = all.filter((r) => String(r.result ?? "") === "취약");
  const vulnCount = vuln.length;

  const evaluated = vuln.filter((r) => numOrBlank(r.impact) && numOrBlank(r.likelihood));
  const evaluatedCount = evaluated.length;

  const treated = vuln.filter((r) => String(r.treatment_strategy ?? "").trim());
  const treatedCount = treated.length;

  const residualDone = vuln.filter((r) => numOrBlank(r.residual_impact) && numOrBlank(r.residual_likelihood));
  const residualDoneCount = residualDone.length;

  // type / domain 집계
  const typeMap = groupBy(all, (r) => String(r.type ?? "UNKNOWN"));
  const domainMap = groupBy(all, (r) => String(r.domain ?? "UNKNOWN"));

  function summaryTableFromMap(map) {
    const rows = Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0], "ko"))
      .map(([k, items]) => {
        const t = items.length;
        const v = items.filter((x) => String(x.result ?? "") === "취약").length;
        const sDone = items.filter((x) => String(x.status ?? "").trim()).length;
        return { k, t, v, sDone };
      });

    return `
      <table class="tbl">
        <thead>
          <tr>
            <th style="width:42%;">구분</th>
            <th style="width:19%;">전체</th>
            <th style="width:19%;">취약</th>
            <th style="width:20%;">현황작성</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (r) => `
              <tr>
                <td class="mono">${esc(r.k)}</td>
                <td class="num">${esc(r.t)}</td>
                <td class="num ${r.v ? "bad" : ""}">${esc(r.v)}</td>
                <td class="num">${esc(r.sDone)}</td>
              </tr>
            `
            )
            .join("")}
        </tbody>
      </table>
    `;
  }

  function vulnTable(items) {
    const rows = [...items].sort((a, b) => String(a.code ?? "").localeCompare(String(b.code ?? ""), "en"));
    return `
      <table class="tbl">
        <thead>
          <tr>
            <th style="width:10%;">유형</th>
            <th style="width:20%;">분야</th>
            <th style="width:10%;">코드</th>
            <th>항목</th>
            <th style="width:10%;">결과</th>
            <th style="width:8%;">I</th>
            <th style="width:8%;">L</th>
            <th style="width:8%;">점수</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map((r) => {
              const i = numOrBlank(r.impact);
              const l = numOrBlank(r.likelihood);
              const score = riskScore(i, l);
              return `
                <tr>
                  <td class="mono">${esc(r.type)}</td>
                  <td>${esc(r.domain)}</td>
                  <td class="mono">${esc(r.code)}</td>
                  <td>${esc(r.itemCode ?? r.itemcode ?? "")}</td>
                  <td class="${String(r.result) === "취약" ? "bad" : ""}">${esc(r.result)}</td>
                  <td class="num">${esc(i)}</td>
                  <td class="num">${esc(l)}</td>
                  <td class="num">${esc(score)}</td>
                </tr>
                ${
                  String(r.reason ?? "").trim()
                    ? `<tr class="subrow"><td></td><td colspan="7"><span class="tag bad">사유</span> <span class="reason">${esc(
                        r.reason
                      )}</span></td></tr>`
                    : ""
                }
                ${
                  String(r.result_detail ?? "").trim()
                    ? `<tr class="subrow"><td></td><td colspan="7"><span class="tag">상세</span> ${esc(r.result_detail)}</td></tr>`
                    : ""
                }
              `;
            })
            .join("")}
        </tbody>
      </table>
    `;
  }

  function treatmentTable(items) {
    const rows = [...items].sort((a, b) => String(a.code ?? "").localeCompare(String(b.code ?? ""), "en"));
    return `
      <table class="tbl">
        <thead>
          <tr>
            <th style="width:10%;">유형</th>
            <th style="width:20%;">분야</th>
            <th style="width:10%;">코드</th>
            <th>항목</th>
            <th style="width:18%;">처리전략</th>
            <th style="width:20%;">담당</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (r) => `
              <tr>
                <td class="mono">${esc(r.type)}</td>
                <td>${esc(r.domain)}</td>
                <td class="mono">${esc(r.code)}</td>
                <td>${esc(r.itemCode ?? r.itemcode ?? "")}</td>
                <td>${esc(r.treatment_strategy ?? "")}</td>
                <td>${esc(r.treatment_owner ?? "")}</td>
              </tr>
              ${
                String(r.treatment_plan ?? "").trim()
                  ? `<tr class="subrow"><td></td><td colspan="5"><span class="tag">계획</span> ${esc(r.treatment_plan)}</td></tr>`
                  : ""
              }
            `
            )
            .join("")}
        </tbody>
      </table>
    `;
  }

  function residualTable(items) {
    const rows = [...items].sort((a, b) => String(a.code ?? "").localeCompare(String(b.code ?? ""), "en"));
    return `
      <table class="tbl">
        <thead>
          <tr>
            <th style="width:10%;">유형</th>
            <th style="width:20%;">분야</th>
            <th style="width:10%;">코드</th>
            <th>항목</th>
            <th style="width:8%;">I</th>
            <th style="width:8%;">L</th>
            <th style="width:10%;">상태</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map((r) => {
              const i = numOrBlank(r.residual_impact);
              const l = numOrBlank(r.residual_likelihood);
              return `
                <tr>
                  <td class="mono">${esc(r.type)}</td>
                  <td>${esc(r.domain)}</td>
                  <td class="mono">${esc(r.code)}</td>
                  <td>${esc(r.itemCode ?? r.itemcode ?? "")}</td>
                  <td class="num">${esc(i)}</td>
                  <td class="num">${esc(l)}</td>
                  <td>${esc(r.residual_status ?? "")}</td>
                </tr>
                ${
                  String(r.residual_detail ?? "").trim()
                    ? `<tr class="subrow"><td></td><td colspan="6"><span class="tag">설명</span> ${esc(r.residual_detail)}</td></tr>`
                    : ""
                }
              `;
            })
            .join("")}
        </tbody>
      </table>
    `;
  }

  const now = fmtDate(new Date());

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title>
  <style>
    :root{
      --bg:#ffffff;
      --ink:#0f172a;
      --muted:#475569;
      --line:#e2e8f0;
      --chip:#f1f5f9;
      --bad:#dc2626;
      --good:#16a34a;
      --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    }
    *{ box-sizing:border-box; }
    body{ margin:0; background:var(--bg); color:var(--ink); font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Apple SD Gothic Neo, Noto Sans KR, Arial, "Apple Color Emoji", "Segoe UI Emoji"; }
    .page{ width:100%; max-width:none; margin:0; padding:32px 20px 60px; }
    .topbar{ display:flex; align-items:flex-start; justify-content:space-between; gap:16px; }
    .conf{ border:3px solid var(--bad); color:var(--bad); padding:10px 14px; font-weight:800; border-radius:10px; letter-spacing:.3px; }
    h1{ margin:10px 0 6px; font-size:28px; }
    .meta{ color:var(--muted); font-size:13px; line-height:1.6; }
    .hr{ height:1px; background:var(--line); margin:18px 0 22px; }
    .grid{ display:grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap:12px; }
    .card{ border:1px solid var(--line); border-radius:14px; padding:14px; background:#fff; }
    .k{ color:var(--muted); font-size:12px; }
    .v{ font-size:18px; font-weight:800; margin-top:4px; }
    .mono{ font-family:var(--mono); }
    .btnrow{ display:flex; gap:8px; align-items:center; margin-top:10px; }
    .btn{ appearance:none; border:1px solid var(--line); background:var(--chip); padding:8px 10px; border-radius:10px; font-weight:700; cursor:pointer; }
    .btn.primary{ background:#0f172a; color:#fff; border-color:#0f172a; }
    .sec{ margin-top:18px; }
    .sec h2{ font-size:16px; margin:0 0 10px; }
    .tbl{ width:100%; border-collapse:separate; border-spacing:0; border:1px solid var(--line); border-radius:14px; overflow:hidden; }
    .tbl thead th{ background:#f8fafc; border-bottom:1px solid var(--line); padding:10px 10px; font-size:12px; color:var(--muted); text-align:left; }
    .tbl td{ border-bottom:1px solid #f1f5f9; padding:10px 10px; font-size:13px; vertical-align:top; }
    .tbl tr:last-child td{ border-bottom:none; }
    .num{ text-align:right; font-variant-numeric: tabular-nums; }
    .tag{ display:inline-block; padding:2px 8px; border-radius:999px; background:var(--chip); border:1px solid var(--line); font-size:12px; font-weight:800; margin-right:8px; }
    .tag.bad{ background:#fee2e2; border-color:#fecaca; color:var(--bad); }
    .bad{ color:var(--bad); font-weight:800; }
    .good{ color:var(--good); font-weight:800; }
    .reason{ color:var(--bad); font-weight:700; }
    .subrow td{ background:#fff; padding-top:0; }
    @media print{
      .btnrow{ display:none; }
      .page{ max-width:none; padding:0; }
      body{ -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .card, .tbl{ break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="topbar">
      <div>
        <div class="meta">2. 위험분석 결과</div>
        <h1>${esc(title)}</h1>
        <div class="meta">
          ${orgName ? `<div><b>조직</b>: ${esc(orgName)}</div>` : ""}
          <div><b>작성일</b>: ${esc(now)}</div>
          ${matrix ? `<div><b>정성 매트릭스</b>: ${esc(matrix)}</div>` : ""}
          ${acceptThreshold !== "" ? `<div><b>수용 기준(ARL)</b>: ${esc(acceptThreshold)}</div>` : ""}
        </div>
        <div class="btnrow">
          <button class="btn primary" onclick="window.print()">인쇄/PDF 저장</button>
          <button class="btn" onclick="navigator.clipboard.writeText(location.href).catch(()=>{}); alert('이 창은 로컬 생성 문서라 URL 복사는 의미가 없을 수 있어요. 필요하면 PDF로 저장하세요.');">안내</button>
        </div>
      </div>
      <div class="conf">Confidential</div>
    </div>

    <div class="hr"></div>

    <div class="grid">
      <div class="card">
        <div class="k">Checklist 전체</div>
        <div class="v mono">${esc(total)}</div>
      </div>
      <div class="card">
        <div class="k">취약(결과=취약)</div>
        <div class="v mono ${vulnCount ? "bad" : ""}">${esc(vulnCount)}</div>
      </div>
      <div class="card">
        <div class="k">위험평가 완료(I/L)</div>
        <div class="v mono">${esc(evaluatedCount)} <span class="k">/ ${esc(vulnCount)}</span></div>
      </div>
      <div class="card">
        <div class="k">위험처리 작성</div>
        <div class="v mono">${esc(treatedCount)} <span class="k">/ ${esc(vulnCount)}</span></div>
      </div>
    </div>

    <div class="sec">
      <h2>1) 통제 항목 요약(유형별)</h2>
      ${summaryTableFromMap(typeMap)}
    </div>

    <div class="sec">
      <h2>2) 통제 항목 요약(분야별)</h2>
      ${summaryTableFromMap(domainMap)}
    </div>

    <div class="sec">
      <h2>3) 취약 도출 결과(취약 항목)</h2>
      ${vulnCount ? vulnTable(vuln) : `<div class="meta">취약으로 판정된 항목이 없습니다.</div>`}
    </div>

    <div class="sec">
      <h2>4) 위험 처리(처리 전략/계획)</h2>
      ${treatedCount ? treatmentTable(treated) : `<div class="meta">처리 전략이 입력된 취약 항목이 없습니다.</div>`}
    </div>

    <div class="sec">
      <h2>5) 잔여 위험 평가(Residual)</h2>
      ${
        residualDoneCount
          ? residualTable(residualDone)
          : `<div class="meta">잔여 위험(I/L)이 입력된 항목이 없습니다.</div>`
      }
    </div>

    <div class="hr"></div>
    <div class="meta">
      <div>※ 본 보고서는 시스템 내 checklist 데이터(통제 현황/취약/위험평가/처리/잔여위험)를 기반으로 자동 생성되었습니다.</div>
      <div>※ “인쇄/PDF 저장” 버튼으로 PDF로 보관하세요.</div>
    </div>
  </div>
</body>
</html>`;
}