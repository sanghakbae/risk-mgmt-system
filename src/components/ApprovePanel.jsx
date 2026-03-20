// src/components/ApprovePanel.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import Button from "../ui/Button";
import EvidenceModalTrigger from "./EvidenceModalTrigger";
import { parseEvidenceUrls } from "../utils/evidence";

function safeStr(v) {
  return v == null ? "" : String(v);
}

function normalizeType(v) {
  const s = safeStr(v).trim();
  if (!s) return "";
  if (s.toUpperCase().includes("ISO")) return "ISO27001";
  if (s.toUpperCase().includes("ISMS")) return "ISMS";
  return s;
}

function badgeClassByResult(result) {
  if (result === "취약") return "bg-rose-50 text-rose-700 border-rose-200";
  if (result === "양호") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

function domainCounts(items) {
  const map = new Map();
  for (const x of items) {
    const d = safeStr(x.domain).trim() || "미지정";
    map.set(d, (map.get(d) || 0) + 1);
  }
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
}

function formatDateTimeNow() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function buildSummaryChips(summary) {
  const chips = [
    {
      key: "vuln",
      label: "취약",
      value: summary?.vuln ?? 0,
      className: "bg-rose-50 text-rose-700 border-rose-200",
    },
    {
      key: "ok",
      label: "양호",
      value: summary?.ok ?? 0,
      className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
  ];

  if ((summary?.empty ?? 0) > 0) {
    chips.push({
      key: "empty",
      label: "미입력",
      value: summary.empty,
      className: "bg-amber-50 text-amber-700 border-amber-200",
    });
  }

  return chips;
}

/* -----------------------------
  Modal
------------------------------ */
function Modal({ open, title, onClose, children, footer }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000] report-modal-root">
      <div className="absolute inset-0 bg-black/40 report-modal-backdrop" onClick={onClose} />
      <div className="absolute inset-0 p-4 report-modal-viewport">
        <div className="w-full h-full rounded-2xl bg-white shadow-xl border border-slate-200 overflow-hidden flex flex-col report-modal-frame">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0 report-modal-header">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900 truncate">{title}</div>
              <div className="text-xs text-slate-500">보고서 내용만 인쇄(PDF 저장)됩니다.</div>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <Button variant="outline" onClick={onClose}>
                닫기
              </Button>
              {footer}
            </div>
          </div>
          <div className="p-5 overflow-auto flex-1 min-h-0 report-modal-body">{children}</div>
        </div>
      </div>
    </div>
  );
}

/* -----------------------------
  Evidence
------------------------------ */
function EvidenceBlock({ urls = [] }) {
  const list = Array.isArray(urls) ? urls : [];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
      <div className="text-sm font-bold text-slate-900">증적</div>

      <div className="mt-2">
        {!list.length ? (
          <div className="text-sm text-slate-800 whitespace-pre-wrap break-words">—</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {list.map((u, idx) => (
              <EvidenceModalTrigger
                key={`${u}-${idx}`}
                url={u}
                imageClassName="max-h-[640px] rounded-xl border border-slate-200 object-contain hover:opacity-90"
                linkClassName="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                fit="contain"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryImageBlock({ url }) {
  const u = safeStr(url).trim();
  if (!u) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="text-sm font-semibold text-slate-900">대시보드 요약 이미지</div>
      <div className="mt-3">
        <a
          href={u}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block"
          title="원본 새 탭으로 열기"
        >
          <img
            src={u}
            alt="dashboard-summary"
            className="w-full max-h-[560px] rounded-xl border border-slate-200 object-contain"
            loading="eager"
          />
        </a>
      </div>
    </div>
  );
}

/* -----------------------------
  Report Content
------------------------------ */
function ReportContent({ id, reportItems, summary, createdAt, summaryImageUrl }) {
  const vulnerableItems = useMemo(
    () => reportItems.filter((x) => safeStr(x.result).trim() === "취약"),
    [reportItems]
  );
  const doms = useMemo(() => domainCounts(vulnerableItems), [vulnerableItems]);
  const summaryChips = useMemo(() => buildSummaryChips(summary), [summary]);

  return (
    <div id={id} className="space-y-4">
      <div className="report-first-page space-y-4">
        <div className="relative px-1">
          <div className="text-center text-2xl md:text-3xl font-extrabold text-slate-900">
            체크리스트 기반 위험평가 결과보고서
          </div>
          <div className="mt-2 text-xs text-slate-500 text-right">생성일시: {createdAt}</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-8 gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 md:col-span-2">
            <div className="text-sm font-semibold text-slate-900">결과 요약</div>
            <div
              className="mt-3 grid gap-2"
              style={{ gridTemplateColumns: `repeat(${Math.max(1, summaryChips.length)}, minmax(0, 1fr))` }}
            >
              {summaryChips.map((chip) => (
                <span
                  key={`report-summary-${chip.key}`}
                  className={`w-full text-center px-2 py-2 rounded-lg border text-sm font-semibold ${chip.className}`}
                >
                  {chip.label}: {chip.value}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 md:col-span-6">
            <div className="text-sm font-semibold text-slate-900">상세 취약점 도메인</div>
            <div className="mt-1 text-xs text-slate-500">취약 항목 기준 도메인별 건수</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {doms.length ? (
                doms.slice(0, 20).map(([d, c]) => (
                  <span
                    key={d}
                    className="px-3 py-1 rounded-full border text-xs font-semibold bg-white text-slate-700 border-slate-200"
                  >
                    {d} <span className="text-slate-500">{c}</span>
                  </span>
                ))
              ) : (
                <div className="text-xs text-slate-500">표시할 항목이 없습니다.</div>
              )}
            </div>
          </div>
        </div>

        <SummaryImageBlock url={summaryImageUrl} />
      </div>

      <div className="p-1">
        <div className="text-sm font-semibold text-slate-900">상세 목록</div>

        <div className="mt-4 space-y-3">
          {reportItems.map((row) => {
            const code = safeStr(row.code);
            const title = safeStr(row.itemCode || row.itemcode || "");
            const statusText = safeStr(row.status).trim();
            const evidenceUrls = parseEvidenceUrls(row.evidence_url);
            const resultText = safeStr(row.result).trim() || "미입력";
            const isOk = resultText === "양호";
            const isVuln = resultText === "취약";
            const guideText = safeStr(row.guide ?? row.Guide).trim();
            const vulnDetailText = safeStr(row.result_detail).trim();

            return (
              <div
                key={code}
                className="rounded-2xl border border-slate-200 bg-white p-4 report-item-page"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-slate-500">
                      {normalizeType(row.type)} · {safeStr(row.domain)} · {safeStr(row.area)}
                    </div>
                    <div className="text-sm font-semibold text-slate-900 whitespace-pre-wrap">
                      [{code}] {title}
                    </div>
                  </div>
                  <span
                    className={[
                      "px-3 py-1 rounded-full border text-xs font-semibold",
                      badgeClassByResult(resultText),
                    ].join(" ")}
                  >
                    {resultText}
                  </span>
                </div>

                {isOk ? (
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="text-sm font-bold text-slate-900">현황</div>
                      <div className="mt-1 text-sm text-slate-800 whitespace-pre-wrap break-words">
                        {statusText || "—"}
                      </div>
                    </div>
                    <EvidenceBlock urls={evidenceUrls} />
                  </div>
                ) : isVuln ? (
                  <>
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="text-sm font-bold text-slate-900">현황</div>
                        <div className="mt-1 text-sm text-slate-800 whitespace-pre-wrap break-words">
                          {statusText || "—"}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2">
                        <div className="text-sm font-bold text-sky-800">가이드</div>
                        <div className="mt-1 text-sm text-sky-800 whitespace-pre-wrap break-words">
                          {guideText || "—"}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2">
                      <div className="text-sm font-bold text-rose-700">취약점</div>
                      <div className="mt-1 text-sm text-rose-700 whitespace-pre-wrap break-words">
                        {vulnDetailText || "—"}
                      </div>
                    </div>

                    <div className="mt-3">
                      <EvidenceBlock urls={evidenceUrls} />
                    </div>
                  </>
                ) : (
                  <>
                    {statusText ? (
                      <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="text-sm font-bold text-slate-900">현황</div>
                        <div className="mt-1 text-sm text-slate-800 whitespace-pre-wrap break-words">
                          {statusText}
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
                        <div className="text-sm font-bold text-slate-900">상세</div>
                        <div className="mt-1 text-sm text-slate-800 whitespace-pre-wrap break-words">
                          {safeStr(row.result_detail).trim() || "—"}
                        </div>
                      </div>

                      <div
                        className={[
                          "rounded-2xl px-3 py-2 border",
                          resultText === "취약"
                            ? "border-rose-200 bg-rose-50"
                            : resultText === "양호"
                              ? "border-emerald-200 bg-emerald-50"
                              : "border-amber-200 bg-amber-50",
                        ].join(" ")}
                      >
                        <div
                          className={[
                            "text-sm font-bold",
                            resultText === "취약"
                              ? "text-rose-700"
                              : resultText === "양호"
                                ? "text-emerald-700"
                                : "text-amber-700",
                          ].join(" ")}
                        >
                          사유
                        </div>
                        <div
                          className={[
                            "mt-1 text-sm whitespace-pre-wrap break-words",
                            resultText === "취약"
                              ? "text-rose-700"
                              : resultText === "양호"
                                ? "text-emerald-700"
                                : "text-amber-700",
                          ].join(" ")}
                        >
                          {safeStr(row.reason || row.result_detail || "").trim() || "—"}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3">
                      <EvidenceBlock urls={evidenceUrls} />
                    </div>
                  </>
                )}
              </div>
            );
          })}

          {reportItems.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">선택된 항목이 없습니다.</div>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="text-sm font-semibold text-slate-900">승인자 서명</div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="text-xs text-slate-500">승인 일자</div>
            <div className="mt-3 h-7 border-b border-slate-300" />
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="text-xs text-slate-500">승인자</div>
            <div className="mt-3 h-7 border-b border-slate-300" />
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="text-xs text-slate-500">서명</div>
            <div className="mt-3 h-7 border-b border-slate-300" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* -----------------------------
  Main
------------------------------ */
export default function ApprovePanel({
  checklistItems = [],
  onUpdated,
  onApproveAll,
  summaryImageUrl = "",
}) {
  const [openReport, setOpenReport] = useState(false);
  const [selectedCodes, setSelectedCodes] = useState([]);
  const [selectionMode, setSelectionMode] = useState("all");
  const createdAt = useMemo(() => formatDateTimeNow(), []);
  const screenReportRef = useRef(null);

  const summary = useMemo(() => {
    let vuln = 0;
    let ok = 0;
    let empty = 0;

    for (const x of checklistItems) {
      const r = safeStr(x.result).trim();
      if (r === "취약") vuln += 1;
      else if (r === "양호") ok += 1;
      else empty += 1;
    }

    return { vuln, ok, empty, total: checklistItems.length };
  }, [checklistItems]);

  const reportItems = useMemo(() => {
    return Array.isArray(checklistItems) ? checklistItems : [];
  }, [checklistItems]);

  const vulnerableReportItems = useMemo(
    () => reportItems.filter((x) => safeStr(x.result).trim() === "취약"),
    [reportItems]
  );

  const vulnerableDomains = useMemo(
    () => domainCounts(vulnerableReportItems),
    [vulnerableReportItems]
  );

  useEffect(() => {
    setSelectedCodes(reportItems.map((x) => safeStr(x.code)));
  }, [reportItems]);

  const selectedReportItems = useMemo(() => {
    const selectedSet = new Set(selectedCodes.map((x) => safeStr(x)));
    return reportItems.filter((x) => selectedSet.has(safeStr(x.code)));
  }, [reportItems, selectedCodes]);

  const selectedSummary = useMemo(() => {
    let vuln = 0;
    let ok = 0;
    let empty = 0;

    for (const x of selectedReportItems) {
      const r = safeStr(x.result).trim();
      if (r === "취약") vuln += 1;
      else if (r === "양호") ok += 1;
      else empty += 1;
    }

    return {
      vuln,
      ok,
      empty,
      total: selectedReportItems.length,
    };
  }, [selectedReportItems]);
  const summaryChips = useMemo(() => buildSummaryChips(summary), [summary]);

  useEffect(() => {
    const after = () => {
      const root = document.getElementById("print-root");
      if (root) root.remove();
      document.body.classList.remove("report-printing");
    };
    window.addEventListener("afterprint", after);
    return () => window.removeEventListener("afterprint", after);
  }, []);

  function waitForImages(container) {
    const images = Array.from(container.querySelectorAll("img"));
    if (!images.length) return Promise.resolve();

    return Promise.all(
      images.map(
        (img) =>
          new Promise((resolve) => {
            if (img.complete && img.naturalWidth > 0) {
              resolve();
              return;
            }

            const done = () => resolve();
            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });

            setTimeout(resolve, 4000);
          })
      )
    );
  }

  async function handleApproveAll() {
    try {
      if (typeof onApproveAll === "function") {
        await onApproveAll();
        onUpdated?.();
        return;
      }
      alert("전체 승인 처리는 현재 콜백이 연결되지 않았습니다.");
    } catch (e) {
      alert(e?.message || "전체 승인 처리 실패");
    }
  }

  function toggleSelect(code) {
    const key = safeStr(code);
    setSelectedCodes((prev) =>
      prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]
    );
  }

  function handleSelectAll() {
    setSelectedCodes(reportItems.map((x) => safeStr(x.code)));
  }

  function handleSelectVulnerable() {
    setSelectedCodes(
      reportItems
        .filter((x) => safeStr(x.result).trim() === "취약")
        .map((x) => safeStr(x.code))
    );
  }

  function handleChangeSelectionMode(mode) {
    setSelectionMode(mode);
    if (mode === "vuln") {
      handleSelectVulnerable();
      return;
    }
    handleSelectAll();
  }

  async function handlePrintReport() {
    if (selectedReportItems.length === 0) {
      alert("출력할 항목을 1개 이상 선택하세요.");
      return;
    }

    const printFrom = async (node) => {
      await doPrintFromNode(node);
    };

    requestAnimationFrame(async () => {
      let src = document.getElementById("report-screen-area");

      if (!src) {
        setOpenReport(true);

        requestAnimationFrame(async () => {
          const src2 = document.getElementById("report-screen-area");
          if (!src2) {
            alert("보고서 DOM을 찾지 못했습니다.");
            return;
          }
          await printFrom(src2);
        });

        return;
      }

      await printFrom(src);
    });
  }

  async function doPrintFromNode(node) {
    const old = document.getElementById("print-root");
    if (old) old.remove();

    const root = document.createElement("div");
    root.id = "print-root";
    root.className = "print-root";
    document.body.appendChild(root);

    const clone = node.cloneNode(true);
    clone.id = "report-print-area";
    root.appendChild(clone);

    await waitForImages(root);

    document.body.classList.add("report-printing");
    window.print();
  }

  function handleOpenReport() {
    if (selectedReportItems.length === 0) {
      alert("보고서에 포함할 항목을 1개 이상 선택하세요.");
      return;
    }
    setOpenReport(true);
  }

  return (
    <div className="h-[calc(100vh-180px)] flex flex-col gap-4">
      <style>{`
        @media print {
          html, body {
            width: 100%;
            height: auto;
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          body.report-printing > *:not(#print-root) {
            display: none !important;
          }

          #print-root,
          #print-root * {
            box-shadow: none !important;
          }

          #print-root {
            display: block !important;
            width: 100% !important;
            border: 0 !important;
            outline: 0 !important;
            background: white !important;
          }

          #report-print-area,
          #report-print-area * {
            outline: 0 !important;
          }

          #report-print-area {
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            font-size: 11px !important;
            line-height: 1.35 !important;
          }

          .report-modal-root,
          .report-modal-backdrop,
          .report-modal-viewport,
          .report-modal-frame,
          .report-modal-header,
          .report-modal-body {
            border: 0 !important;
            box-shadow: none !important;
          }

          #report-print-area img {
            max-width: 100% !important;
            max-height: 260px !important;
            object-fit: contain !important;
          }

          #report-print-area .report-first-page {
            page-break-after: always !important;
            break-after: page !important;
          }

          #report-print-area .report-item-page {
            page-break-before: always !important;
            break-before: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          #report-print-area .rounded-2xl,
          #report-print-area .rounded-xl,
          #report-print-area .grid,
          #report-print-area .space-y-3 > *,
          #report-print-area .space-y-4 > * {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          @page {
            size: A4 portrait;
            margin: 6mm;
          }
        }
      `}</style>

      <div className="panel-sticky">
        <div className="panel-header-stack">
          <div className="panel-filter-card rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="panel-banner-title text-slate-900">승인 및 보고</div>
                <div className="panel-banner-body text-slate-600">
                  리포트 선택 항목만: {selectedReportItems.length} / 전체: {summary.total}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={selectionMode}
                  onChange={(e) => handleChangeSelectionMode(e.target.value)}
                  className="h-8 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-slate-200"
                >
                  <option value="all">전체 선택</option>
                  <option value="vuln">취약점 선택</option>
                </select>
                <Button variant="outline" onClick={handleOpenReport} className="h-8 px-3 text-xs">
                  보고서 보기
                </Button>
                <Button
                  variant="outline"
                  onClick={handlePrintReport}
                  className="h-8 px-3 text-xs bg-black text-white border-black hover:bg-slate-900 hover:border-slate-900"
                >
                  PDF로 저장(인쇄)
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 xl:col-span-2">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-sm font-semibold text-slate-900">결과 요약</div>
                <div className="text-sm text-slate-600">총 {summary.total}건</div>
              </div>

              <div
                className="mt-3 grid gap-2"
                style={{ gridTemplateColumns: `repeat(${Math.max(1, summaryChips.length)}, minmax(0, 1fr))` }}
              >
                {summaryChips.map((chip) => (
                  <span
                    key={`main-summary-${chip.key}`}
                    className={`w-full text-center px-2 py-2 rounded-lg border text-sm font-semibold ${chip.className}`}
                  >
                    {chip.label}: {chip.value}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 xl:col-span-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-sm font-semibold text-slate-900">상세 취약점 도메인</div>
                <div className="text-sm text-slate-600">취약 {vulnerableReportItems.length}건</div>
              </div>

              <div className="mt-1 text-xs text-slate-500">취약 항목 기준 도메인별 건수</div>

              <div className="mt-3 flex flex-wrap gap-2">
                {vulnerableDomains.length ? (
                  vulnerableDomains.slice(0, 20).map(([d, c]) => (
                    <span
                      key={`main-vuln-domain-${d}`}
                      className="px-3 py-1 rounded-full border text-xs font-semibold bg-white text-slate-700 border-slate-200"
                    >
                      {d} <span className="text-slate-500">{c}</span>
                    </span>
                  ))
                ) : (
                  <div className="text-xs text-slate-500">표시할 취약 도메인이 없습니다.</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 border-b border-slate-200" />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1 pb-6">
        {reportItems.map((row) => {
          const code = safeStr(row.code);
          const title = safeStr(row.itemCode || row.itemcode || "");
          const statusText = safeStr(row.status).trim();
          const evidenceUrls = parseEvidenceUrls(row.evidence_url);
          const checked = selectedCodes.includes(code);
          const resultText = safeStr(row.result).trim() || "미입력";
          const isOk = resultText === "양호";
          const isVuln = resultText === "취약";
          const guideText = safeStr(row.guide ?? row.Guide).trim();
          const vulnDetailText = safeStr(row.result_detail).trim();

          return (
            <div key={code} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex items-start gap-3">
                  <label className="mt-0.5 inline-flex items-center">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSelect(code)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                  </label>

                  <div className="min-w-0">
                    <div className="text-xs text-slate-500">
                      {normalizeType(row.type)} · {safeStr(row.domain)} · {safeStr(row.area)}
                    </div>
                    <div className="text-sm font-semibold text-slate-900 whitespace-pre-wrap">
                      [{code}] {title}
                    </div>
                  </div>
                </div>

                <span
                  className={[
                    "px-3 py-1 rounded-full border text-xs font-semibold",
                    badgeClassByResult(resultText),
                  ].join(" ")}
                >
                  {resultText}
                </span>
              </div>

              {isOk ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="text-sm font-bold text-slate-900">현황</div>
                    <div className="mt-1 text-sm text-slate-800 whitespace-pre-wrap break-words">
                      {statusText || "—"}
                    </div>
                  </div>
                  <EvidenceBlock urls={evidenceUrls} />
                </div>
              ) : isVuln ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="text-sm font-bold text-slate-900">현황</div>
                      <div className="mt-1 text-sm text-slate-800 whitespace-pre-wrap break-words">
                        {statusText || "—"}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2">
                      <div className="text-sm font-bold text-sky-800">가이드</div>
                      <div className="mt-1 text-sm text-sky-800 whitespace-pre-wrap break-words">
                        {guideText || "—"}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2">
                    <div className="text-sm font-bold text-rose-700">취약점</div>
                    <div className="mt-1 text-sm text-rose-700 whitespace-pre-wrap break-words">
                      {vulnDetailText || "—"}
                    </div>
                  </div>

                  <EvidenceBlock urls={evidenceUrls} />
                </>
              ) : (
                <>
                  {statusText ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="text-sm font-bold text-slate-900">현황</div>
                      <div className="mt-1 text-sm text-slate-800 whitespace-pre-wrap break-words">
                        {statusText}
                      </div>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
                      <div className="text-sm font-bold text-slate-900">상세</div>
                      <div className="mt-1 text-sm text-slate-800 whitespace-pre-wrap break-words">
                        {safeStr(row.result_detail).trim() || "—"}
                      </div>
                    </div>

                    <div
                      className={[
                        "rounded-2xl px-3 py-2 border",
                        resultText === "취약"
                          ? "border-rose-200 bg-rose-50"
                          : resultText === "양호"
                            ? "border-emerald-200 bg-emerald-50"
                            : "border-amber-200 bg-amber-50",
                      ].join(" ")}
                    >
                      <div
                        className={[
                          "text-sm font-bold",
                          resultText === "취약"
                            ? "text-rose-700"
                            : resultText === "양호"
                              ? "text-emerald-700"
                              : "text-amber-700",
                        ].join(" ")}
                      >
                        사유
                      </div>
                      <div
                        className={[
                          "mt-1 text-sm whitespace-pre-wrap break-words",
                          resultText === "취약"
                            ? "text-rose-700"
                            : resultText === "양호"
                              ? "text-emerald-700"
                              : "text-amber-700",
                        ].join(" ")}
                      >
                        {safeStr(row.reason || row.result_detail || "").trim() || "—"}
                      </div>
                    </div>
                  </div>

                  <EvidenceBlock urls={evidenceUrls} />
                </>
              )}
            </div>
          );
        })}

        {reportItems.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">표시할 항목이 없습니다.</div>
        ) : null}

        <Modal
          open={openReport}
          title="체크리스트 기반 위험평가 결과보고서"
          onClose={() => setOpenReport(false)}
          footer={
            <Button
              variant="outline"
              onClick={handlePrintReport}
              className="bg-black text-white border-black hover:bg-slate-900 hover:border-slate-900"
            >
              PDF로 저장(인쇄)
            </Button>
          }
        >
          <div ref={screenReportRef}>
            <ReportContent
              id="report-screen-area"
              reportItems={selectedReportItems}
              summary={selectedSummary}
              createdAt={createdAt}
              summaryImageUrl={summaryImageUrl}
            />
          </div>
        </Modal>
      </div>
    </div>
  );
}
