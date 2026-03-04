// src/components/ApprovePanel.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import Button from "../ui/Button";
import { updateChecklistByCode } from "../api/checklist"; // (기존 유지)

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
  return "bg-slate-50 text-slate-600 border-slate-200";
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
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
              <Button variant="outline" onClick={onClose}>닫기</Button>
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
  Report Content
------------------------------ */
function ReportContent({ id, vulnerableItems, summary, createdAt }) {
  const doms = useMemo(() => domainCounts(vulnerableItems), [vulnerableItems]);

  return (
    <div id={id} className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-bold text-slate-900">체크리스트 기반 위험평가 결과보고서</div>
            <div className="mt-1 text-xs text-slate-500">생성일시: {createdAt}</div>
          </div>
          <div className="text-xs text-slate-500 text-right">
            대상: 취약 항목<br />총 {vulnerableItems.length}건
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-sm font-semibold text-slate-900">결과 요약</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="px-3 py-1 rounded-full border text-xs font-semibold bg-rose-50 text-rose-700 border-rose-200">
              취약: {summary.vuln}
            </span>
            <span className="px-3 py-1 rounded-full border text-xs font-semibold bg-emerald-50 text-emerald-700 border-emerald-200">
              양호: {summary.ok}
            </span>
            <span className="px-3 py-1 rounded-full border text-xs font-semibold bg-slate-50 text-slate-600 border-slate-200">
              미입력: {summary.empty}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-sm font-semibold text-slate-900">취약 도메인 분포</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {doms.length ? (
              doms.slice(0, 20).map(([d, c]) => (
                <span key={d} className="px-3 py-1 rounded-full border text-xs font-semibold bg-white text-slate-700 border-slate-200">
                  {d} <span className="text-slate-500">{c}</span>
                </span>
              ))
            ) : (
              <div className="text-xs text-slate-500">취약 항목이 없습니다.</div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="text-sm font-semibold text-slate-900">취약 상세 목록</div>

        <div className="mt-4 space-y-3">
          {vulnerableItems.map((row) => {
            const code = safeStr(row.code);
            const title = safeStr(row.itemCode || row.itemcode || "");
            const statusText = safeStr(row.status).trim();

            return (
              <div key={code} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-slate-500">
                      {normalizeType(row.type)} · {safeStr(row.domain)} · {safeStr(row.area)}
                    </div>
                    <div className="text-sm font-semibold text-slate-900 whitespace-pre-wrap">
                      [{code}] {title}
                    </div>
                  </div>
                  <span className={["px-3 py-1 rounded-full border text-xs font-semibold", badgeClassByResult("취약")].join(" ")}>
                    취약
                  </span>
                </div>

                {statusText ? (
                  <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold text-slate-700 mb-1">현황</div>
                    <div className="text-sm text-slate-800 whitespace-pre-wrap">{statusText}</div>
                  </div>
                ) : null}

                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="text-xs font-semibold text-slate-700">상세</div>
                    <div className="mt-1 text-sm text-slate-800 whitespace-pre-wrap">
                      {safeStr(row.result_detail).trim() || "—"}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3">
                    <div className="text-xs font-semibold text-rose-700">사유</div>
                    <div className="mt-1 text-sm text-rose-700 whitespace-pre-wrap">
                      {safeStr(row.reason || row.result_detail || "").trim() || "—"}
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-xs text-slate-500">
                  증적:{" "}
                  {row.evidence_url ? (
                    <a className="text-blue-600 underline" href={row.evidence_url} target="_blank" rel="noopener noreferrer">
                      링크
                    </a>
                  ) : (
                    "—"
                  )}
                </div>
              </div>
            );
          })}

          {vulnerableItems.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">취약 항목이 없습니다.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* -----------------------------
  Main
------------------------------ */
export default function ApprovePanel({ checklistItems = [], onUpdated, onApproveAll }) {
  const [openReport, setOpenReport] = useState(false);
  const createdAt = useMemo(() => formatDateTimeNow(), []);

  // 화면용 보고서 DOM ref
  const screenReportRef = useRef(null);

  const summary = useMemo(() => {
    let vuln = 0, ok = 0, empty = 0;
    for (const x of checklistItems) {
      const r = safeStr(x.result).trim();
      if (r === "취약") vuln += 1;
      else if (r === "양호") ok += 1;
      else empty += 1;
    }
    return { vuln, ok, empty, total: checklistItems.length };
  }, [checklistItems]);

  const vulnerableItems = useMemo(() => {
    return checklistItems.filter((x) => safeStr(x.result).trim() === "취약");
  }, [checklistItems]);

  useEffect(() => {
    const after = () => {
      // print DOM 제거
      const root = document.getElementById("print-root");
      if (root) root.remove();
      document.body.classList.remove("report-printing");
    };
    window.addEventListener("afterprint", after);
    return () => window.removeEventListener("afterprint", after);
  }, []);

  async function handleApproveAll() {
    try {
      if (typeof onApproveAll === "function") {
        await onApproveAll();
        return;
      }
      alert("전체 승인 처리는 현재 콜백이 연결되지 않았습니다.");
    } catch (e) {
      alert(e?.message || "전체 승인 처리 실패");
    }
  }

  function openAndFocusReport() {
    setOpenReport(true);
  }

  function handlePrintReport() {
    // ✅ 화면용 리포트(#report-screen-area)만 "복제"해서 print-root에 1개만 붙임
    requestAnimationFrame(() => {
      const src = document.getElementById("report-screen-area");
      if (!src) {
        // 모달이 안 열려있을 경우를 대비: 잠깐 열고 다음 프레임에 시도
        setOpenReport(true);
        requestAnimationFrame(() => {
          const src2 = document.getElementById("report-screen-area");
          if (!src2) {
            alert("보고서 DOM을 찾지 못했습니다.");
            return;
          }
          doPrintFromNode(src2);
        });
        return;
      }
      doPrintFromNode(src);
    });
  }

  function doPrintFromNode(node) {
    // 기존 print-root 있으면 제거
    const old = document.getElementById("print-root");
    if (old) old.remove();

    // print-root 생성
    const root = document.createElement("div");
    root.id = "print-root";
    root.className = "print-root";
    document.body.appendChild(root);

    const clone = node.cloneNode(true);
    clone.id = "report-print-area"; // 인쇄 대상 id로 강제 단일화
    root.appendChild(clone);

    document.body.classList.add("report-printing");
    window.print();
  }

  return (
    <div className="w-full max-w-none space-y-4">
      <style>{`
        @media print {
          /* ✅ 기본: 전부 안 찍히게 */
          body.report-printing > *:not(#print-root) {
            display: none !important;
          }

          /* ✅ 인쇄용만 찍히게 */
          #print-root {
            display: block !important;
            width: 100% !important;
          }

          #report-print-area {
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          @page { size: A4 landscape; margin: 8mm; }
        }
      `}</style>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900">승인 및 보고</div>
            <div className="text-xs text-slate-500 mt-1">현재 승인 완료: 0 / {summary.vuln}</div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" onClick={openAndFocusReport}>보고서 보기</Button>
            <Button variant="outline" onClick={handlePrintReport}>PDF로 저장(인쇄)</Button>
            <Button onClick={handleApproveAll}>전체 승인 처리</Button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="text-sm font-semibold text-slate-900">결과 요약</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="px-3 py-1 rounded-full border text-xs font-semibold bg-rose-50 text-rose-700 border-rose-200">
            취약 : {summary.vuln}
          </span>
          <span className="px-3 py-1 rounded-full border text-xs font-semibold bg-emerald-50 text-emerald-700 border-emerald-200">
            양호 : {summary.ok}
          </span>
          <span className="px-3 py-1 rounded-full border text-xs font-semibold bg-slate-50 text-slate-600 border-slate-200">
            미입력 : {summary.empty}
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <div className="text-sm font-semibold text-slate-900">상세 목록</div>
            <div className="text-xs text-slate-500 mt-1">결과가 ‘취약’인 항목만 표시됩니다.</div>
          </div>
          <div className="text-xs text-slate-500">총 {vulnerableItems.length}건</div>
        </div>

        <div className="mt-4 space-y-3">
          {vulnerableItems.map((row) => {
            const code = safeStr(row.code);
            const title = safeStr(row.itemCode || row.itemcode || "");
            const statusText = safeStr(row.status).trim();

            return (
              <div key={code} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-slate-500">
                      {normalizeType(row.type)} · {safeStr(row.domain)} · {safeStr(row.area)}
                    </div>
                    <div className="text-sm font-semibold text-slate-900 whitespace-pre-wrap">
                      [{code}] {title}
                    </div>
                  </div>
                  <span className={["px-3 py-1 rounded-full border text-xs font-semibold", badgeClassByResult("취약")].join(" ")}>
                    취약
                  </span>
                </div>

                {statusText ? (
                  <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold text-slate-700 mb-1">현황</div>
                    <div className="text-sm text-slate-800 whitespace-pre-wrap">{statusText}</div>
                  </div>
                ) : null}

                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="text-xs font-semibold text-slate-700">상세</div>
                    <div className="mt-1 text-sm text-slate-800 whitespace-pre-wrap">
                      {safeStr(row.result_detail).trim() || "—"}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3">
                    <div className="text-xs font-semibold text-rose-700">사유</div>
                    <div className="mt-1 text-sm text-rose-700 whitespace-pre-wrap">
                      {safeStr(row.reason || row.result_detail || "").trim() || "—"}
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-xs text-slate-500">
                  증적:{" "}
                  {row.evidence_url ? (
                    <a className="text-blue-600 underline" href={row.evidence_url} target="_blank" rel="noopener noreferrer">
                      링크
                    </a>
                  ) : (
                    "—"
                  )}
                </div>
              </div>
            );
          })}

          {vulnerableItems.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">취약 항목이 없습니다.</div>
          ) : null}
        </div>
      </div>

      {/* ✅ 화면용 모달(미리보기) */}
      <Modal
        open={openReport}
        title="체크리스트 기반 위험평가 결과보고서"
        onClose={() => setOpenReport(false)}
        footer={<Button onClick={handlePrintReport}>PDF로 저장(인쇄)</Button>}
      >
        <div ref={screenReportRef}>
          <ReportContent
            id="report-screen-area"
            vulnerableItems={vulnerableItems}
            summary={summary}
            createdAt={createdAt}
          />
        </div>
      </Modal>
    </div>
  );
}