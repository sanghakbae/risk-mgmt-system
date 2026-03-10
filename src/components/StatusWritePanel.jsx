// src/components/StatusWritePanel.jsx
import React, { useMemo, useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { updateChecklistByCode } from "../api/checklist";
import Button from "../ui/Button";

function safeStr(v) {
  return v == null ? "" : String(v);
}

function normalizeType(v) {
  const s = safeStr(v).trim();
  if (!s) return "";
  const u = s.toUpperCase();
  if (u.includes("ISO")) return "ISO27001";
  if (u.includes("ISMS")) return "ISMS";
  return s;
}

function sanitizePathSegment(s) {
  return safeStr(s)
    .trim()
    .replace(/\./g, "_")
    .replace(/[^a-zA-Z0-9_-]/g, "_");
}

function sanitizeFileName(name) {
  const s = safeStr(name).trim();
  return s.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function isImageUrl(url) {
  const u = safeStr(url).trim().toLowerCase();
  return /\.(png|jpg|jpeg|gif|webp|bmp|svg)(\?.*)?$/.test(u);
}

// Supabase public url에서 bucket 내 object path 뽑기
// 예: https://xxxx.supabase.co/storage/v1/object/public/evidence/AAA/123_file.png
function extractEvidencePathFromPublicUrl(publicUrl) {
  const url = safeStr(publicUrl).trim();
  if (!url) return "";

  // 흔한 형태: /storage/v1/object/public/<bucket>/<path>
  const m = url.match(/\/storage\/v1\/object\/public\/evidence\/(.+)$/);
  if (m?.[1]) return decodeURIComponent(m[1]);

  // 혹시 다른 형태가 섞여도 마지막 /evidence/ 이후를 최대한 추출
  const idx = url.toLowerCase().indexOf("/evidence/");
  if (idx >= 0) return decodeURIComponent(url.slice(idx + "/evidence/".length));

  return "";
}

export default function StatusWritePanel({ checklistItems = [], onUpdated }) {
  const rows = useMemo(() => (Array.isArray(checklistItems) ? checklistItems : []), [checklistItems]);

  // ✅ 상단 필터 상태
  const [typeFilter, setTypeFilter] = useState("전체");
  const [domainFilter, setDomainFilter] = useState("전체");
  const [areaFilter, setAreaFilter] = useState("전체");
  const [statusFilter, setStatusFilter] = useState("전체"); // 입력됨/미입력
  const [keyword, setKeyword] = useState("");

  // ✅ pagination (요청: 최대 5개)
  const pageSize = 5;
  const [page, setPage] = useState(1);

  // code별 입력값/파일 상태 관리
  const [draftByCode, setDraftByCode] = useState(() => ({}));
  const [fileByCode, setFileByCode] = useState(() => ({}));
  const [savingCode, setSavingCode] = useState(null);
  const [uploadingCode, setUploadingCode] = useState(null);
  const [deletingCode, setDeletingCode] = useState(null);

  const textareasRef = useRef({});

  function autoResizeTextarea(el) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  function setTextareaRef(code, el) {
    if (!el) return;
    textareasRef.current[code] = el;
    autoResizeTextarea(el);
  }

  function getDraft(code, row) {
    const key = safeStr(code);
    const d = draftByCode[key];
    if (d) return d;
    return { status: safeStr(row.status) };
  }

  function setDraft(code, patch) {
    const key = safeStr(code);
    setDraftByCode((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || {}), ...patch },
    }));
  }

  function setFile(code, file) {
    const key = safeStr(code);
    setFileByCode((prev) => ({ ...prev, [key]: file || null }));
  }

  // ✅ 옵션들
  const typeOptions = useMemo(() => {
    const set = new Set();
    for (const x of rows) {
      const t = normalizeType(x.type);
      if (t) set.add(t);
    }
    return ["전체", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [rows]);

  const domainOptions = useMemo(() => {
    const set = new Set();
    for (const x of rows) {
      const d = safeStr(x.domain).trim();
      if (d) set.add(d);
    }
    return ["전체", ...Array.from(set)];
  }, [rows]);

  const areaOptions = useMemo(() => {
    const set = new Set();
    for (const x of rows) {
      const a = safeStr(x.area).trim();
      if (a) set.add(a);
    }
    return ["전체", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [rows]);

  // ✅ 필터 적용
  const filteredRows = useMemo(() => {
    const kw = safeStr(keyword).trim().toLowerCase();

    return rows.filter((x) => {
      if (typeFilter !== "전체" && normalizeType(x.type) !== typeFilter) return false;
      if (domainFilter !== "전체" && safeStr(x.domain).trim() !== domainFilter) return false;
      if (areaFilter !== "전체" && safeStr(x.area).trim() !== areaFilter) return false;

      const hasStatus = safeStr(x.status).trim().length > 0;
      if (statusFilter === "입력됨" && !hasStatus) return false;
      if (statusFilter === "미입력" && hasStatus) return false;

      if (!kw) return true;

      const hay = [
        x.code,
        x.itemCode,
        x.itemcode,
        x.domain,
        x.area,
        x.type,
        x.status,
        x.reason,
        x.result_detail,
        x.evidence_url,
      ]
        .map((v) => safeStr(v).toLowerCase())
        .join(" | ");

      return hay.includes(kw);
    });
  }, [rows, typeFilter, domainFilter, areaFilter, statusFilter, keyword]);

  const totalPages = useMemo(() => {
    const n = Math.ceil(filteredRows.length / pageSize);
    return n <= 0 ? 1 : n;
  }, [filteredRows.length]);

  useEffect(() => {
    setPage(1);
  }, [typeFilter, domainFilter, areaFilter, statusFilter, keyword]);

  useEffect(() => {
    setPage((p) => clamp(p, 1, totalPages));
  }, [totalPages]);

  const pageSafe = clamp(page, 1, totalPages);

  const pageRows = useMemo(() => {
    const start = (pageSafe - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, pageSafe]);

  // ✅ 페이지 버튼(최대 10개)
  const maxPageButtons = 10;
  const pageNumbers = useMemo(() => {
    const tp = totalPages || 1;
    const cur = clamp(pageSafe, 1, tp);

    if (tp <= maxPageButtons) return Array.from({ length: tp }, (_, i) => i + 1);

    const half = Math.floor(maxPageButtons / 2);
    let start = cur - half;
    let end = start + maxPageButtons - 1;

    if (start < 1) {
      start = 1;
      end = maxPageButtons;
    }
    if (end > tp) {
      end = tp;
      start = tp - maxPageButtons + 1;
    }

    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [pageSafe, totalPages]);

  async function uploadEvidenceIfAny(row) {
    const code = safeStr(row.code);
    const file = fileByCode[code];

    if (!file) return safeStr(row.evidence_url || "");

    const safeCode = sanitizePathSegment(code);
    const safeName = sanitizeFileName(file.name);
    const filePath = `${safeCode}/${Date.now()}_${safeName}`;

    setUploadingCode(code);

    const { error: uploadError } = await supabase.storage.from("evidence").upload(filePath, file, {
      upsert: true,
      cacheControl: "3600",
      contentType: file.type || "application/octet-stream",
    });

    if (uploadError) throw new Error("업로드 실패: " + uploadError.message);

    const { data } = supabase.storage.from("evidence").getPublicUrl(filePath);
    const url = data?.publicUrl || "";
    if (!url) throw new Error("업로드는 성공했지만 public URL 생성 실패");

    // 업로드 후 선택 파일 제거
    setFile(code, null);
    return url;
  }

  async function handleSave(row) {
    const code = safeStr(row.code);

    try {
      setSavingCode(code);
      console.log("[SAVE] start", code);

      const draft = getDraft(code, row);
      const statusValue = safeStr(draft.status).trim();
      console.log("[SAVE] draft ready", { code, statusValue });

      console.log("[SAVE] before uploadEvidenceIfAny");
      const evidenceUrl = await uploadEvidenceIfAny(row);
      console.log("[SAVE] after uploadEvidenceIfAny", evidenceUrl);

      console.log("[SAVE] before updateChecklistByCode");
      await updateChecklistByCode(code, {
        status: statusValue === "" ? null : statusValue,
        evidence_url: evidenceUrl === "" ? null : evidenceUrl,
      });
      console.log("[SAVE] after updateChecklistByCode");

      onUpdated?.();
      alert("저장 완료");
    } catch (e) {
      console.error("[SAVE] error", e);
      alert(e?.message || "저장 실패");
    } finally {
      console.log("[SAVE] finally");
      setSavingCode(null);
      setUploadingCode(null);
    }
  }

  // ✅ 업로드 전 선택 파일 "X" (선택 취소)
  function clearSelectedFile(code) {
    setFile(code, null);
  }

  // ✅ 업로드된 증적 삭제 "X" (스토리지 제거 + DB null)
  async function deleteUploadedEvidence(row) {
    const code = safeStr(row.code);
    const url = safeStr(row.evidence_url).trim();
    if (!url) return;

    if (!confirm("업로드된 증적을 삭제할까요? (스토리지/DB에서 제거됩니다)")) return;

    try {
      setDeletingCode(code);

      const path = extractEvidencePathFromPublicUrl(url);

      // 1) Storage 파일 삭제(경로 추출 실패하면 DB만 비움)
      if (path) {
        const { error: rmErr } = await supabase.storage.from("evidence").remove([path]);
        if (rmErr) throw new Error("스토리지 삭제 실패: " + rmErr.message);
      }

      // 2) DB evidence_url null
      await updateChecklistByCode(code, { evidence_url: null });

      onUpdated?.();
      alert("증적 삭제 완료");
    } catch (e) {
      alert(e?.message || "삭제 실패");
    } finally {
      setDeletingCode(null);
    }
  }

  // ✅ 라벨/텍스트 폰트 통일 규칙:
  // - 질문(체크리스트 항목): bold + text-sm
  // - 섹션 라벨(현황, 증적 업로드): bold + text-sm
  // - 본문 텍스트: text-sm
  const labelCls = "text-sm font-bold text-slate-900";
  const bodyCls = "text-sm text-slate-800 whitespace-pre-wrap break-words";

  return (
    // ✅ 상단(필터) 고정 + 하단(리스트/페이지)만 스크롤
    <div className="h-[calc(100vh-180px)] flex flex-col gap-4 w-full max-w-none">
      {/* ✅ 여기까지 고정 */}
      <div className="sticky top-0 z-10 -mx-6 px-6 bg-slate-50/95 backdrop-blur pt-1">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            >
              {typeOptions.map((t) => (
                <option key={t} value={t}>
                  {t === "전체" ? "유형(전체)" : t}
                </option>
              ))}
            </select>

            <select
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            >
              {domainOptions.map((d) => (
                <option key={d} value={d}>
                  {d === "전체" ? "도메인(전체)" : d}
                </option>
              ))}
            </select>

            <select
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            >
              {areaOptions.map((a) => (
                <option key={a} value={a}>
                  {a === "전체" ? "영역(전체)" : a}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            >
              <option value="전체">현황(전체)</option>
              <option value="입력됨">현황(입력됨)</option>
              <option value="미입력">현황(미입력)</option>
            </select>

            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="min-w-[240px] flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              placeholder="검색(코드/항목/현황/도메인/영역 등)"
            />

            <div className="text-sm text-slate-600 ml-auto">
              표시 {filteredRows.length}건 · {pageSafe}/{totalPages} 페이지
            </div>
          </div>
        </div>

        {/* 고정영역 하단 경계 */}
        <div className="mt-4 border-b border-slate-200" />
      </div>

      {/* ✅ 아래만 스크롤 */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 pb-6 space-y-3">
        {pageRows.map((row) => {
          const code = safeStr(row.code);
          const title = `[${code}] ${safeStr(row.itemCode ?? row.itemcode)}`; // ✅ 체크리스트 질문(항목)
          const draft = getDraft(code, row);
          const selectedFile = fileByCode[code];
          const busy = savingCode === code || uploadingCode === code || deletingCode === code;

          const evidenceUrl = safeStr(row.evidence_url).trim();
          const isImg = evidenceUrl && isImageUrl(evidenceUrl);

          return (
            <div key={code} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
              {/* ✅ 체크리스트 질문: 볼드 + text-sm */}
              <div className="text-sm font-bold text-slate-900 whitespace-pre-wrap">{title}</div>

              {/* ✅ 현황: 라벨/내용 폰트 동일 (text-sm), 라벨만 볼드 */}
              <div className="space-y-1">
                <div className={labelCls}>현황</div>
                <textarea
                  ref={(el) => setTextareaRef(code, el)}
                  value={draft.status}
                  onChange={(e) => {
                    setDraft(code, { status: e.target.value });
                    autoResizeTextarea(e.target);
                  }}
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200 resize-none overflow-hidden"
                  placeholder="통제 이행 현황을 입력하세요"
                />
              </div>

              {/* ✅ 증적 업로드: 라벨 볼드 + text-sm */}
              <div className="space-y-1">
                <div className={labelCls}>증적 업로드</div>

                <div className="flex items-center gap-3 flex-wrap">
                  <input type="file" onChange={(e) => setFile(code, e.target.files?.[0] || null)} className="text-sm" />

                  {/* ✅ 선택 파일 표시 + 선택 취소 X */}
                  <div className="flex items-center gap-2">
                    <div className="text-sm text-slate-700">
                      {selectedFile ? `선택됨: ${selectedFile.name}` : "선택된 파일 없음"}
                    </div>

                    {selectedFile ? (
                      <button
                        type="button"
                        onClick={() => clearSelectedFile(code)}
                        className="h-6 w-6 rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 flex items-center justify-center"
                        title="선택한 파일 제거"
                      >
                        ✕
                      </button>
                    ) : null}
                  </div>

                  {/* ✅ 업로드된 증적: 이미지면 썸네일 + 클릭 새탭, 아니면 링크 */}
                  {evidenceUrl ? (
                    <div className="flex items-center gap-2">
                      {isImg ? (
                        <a
                          href={evidenceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block"
                          title="원본 새 탭으로 열기"
                        >
                          <img
                            src={evidenceUrl}
                            alt="evidence"
                            className="h-12 w-12 rounded-lg border border-slate-200 object-cover hover:opacity-90"
                          />
                        </a>
                      ) : (
                        <a
                          href={evidenceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 underline"
                        >
                          업로드된 증적 보기
                        </a>
                      )}

                      {/* ✅ 업로드된 증적 삭제 X */}
                      <button
                        type="button"
                        onClick={() => deleteUploadedEvidence(row)}
                        disabled={deletingCode === code}
                        className="h-6 w-6 rounded-full border border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 flex items-center justify-center disabled:opacity-50"
                        title="업로드된 증적 삭제"
                      >
                        ✕
                      </button>
                    </div>
                  ) : null}

                  <div className="ml-auto">
                    <Button onClick={() => handleSave(row)} disabled={busy}>
                      {busy ? "처리 중..." : "저장"}
                    </Button>
                  </div>
                </div>

                <div className="text-sm text-slate-400">
                  * 파일을 선택한 뒤 <b>저장</b>을 누르면 업로드 + 링크 저장까지 함께 처리됩니다.
                </div>
              </div>
            </div>
          );
        })}

        {pageRows.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">표시할 항목이 없습니다.</div>
        ) : null}

        {/* 페이지네이션 */}
        {totalPages > 1 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <Button variant="outline" onClick={() => setPage((p) => clamp(p - 1, 1, totalPages))} disabled={pageSafe <= 1}>
                이전
              </Button>

              {totalPages > 10 && pageNumbers[0] > 1 ? (
                <>
                  <button
                    onClick={() => setPage(1)}
                    className="h-9 min-w-[36px] px-3 rounded-xl border text-sm font-semibold bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  >
                    1
                  </button>
                  <span className="text-slate-400 px-1">…</span>
                </>
              ) : null}

              {pageNumbers.map((p) => {
                const active = p === pageSafe;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={[
                      "h-9 min-w-[36px] px-3 rounded-xl border text-sm font-semibold",
                      active ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    {p}
                  </button>
                );
              })}

              {totalPages > 10 && pageNumbers[pageNumbers.length - 1] < totalPages ? (
                <>
                  <span className="text-slate-400 px-1">…</span>
                  <button
                    onClick={() => setPage(totalPages)}
                    className="h-9 min-w-[36px] px-3 rounded-xl border text-sm font-semibold bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  >
                    {totalPages}
                  </button>
                </>
              ) : null}

              <Button variant="outline" onClick={() => setPage((p) => clamp(p + 1, 1, totalPages))} disabled={pageSafe >= totalPages}>
                다음
              </Button>
            </div>

            <div className="mt-2 text-center text-sm text-slate-500">
              총 {filteredRows.length}건 · 페이지당 {pageSize}건 · {pageSafe}/{totalPages} 페이지
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}