// src/components/StatusWritePanel.jsx
import React, { useMemo, useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { updateChecklistByCode } from "../api/checklist";
import Button from "../ui/Button";
import EvidenceModalTrigger from "./EvidenceModalTrigger";
import TopProgressBar from "./TopProgressBar";
import { MAX_EVIDENCE_FILES, parseEvidenceUrls, serializeEvidenceUrls } from "../utils/evidence";

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

function compareCode(a, b) {
  const aa = safeStr(a).split(".").map((x) => Number(x));
  const bb = safeStr(b).split(".").map((x) => Number(x));
  const len = Math.max(aa.length, bb.length);

  for (let i = 0; i < len; i += 1) {
    const av = Number.isFinite(aa[i]) ? aa[i] : -1;
    const bv = Number.isFinite(bb[i]) ? bb[i] : -1;
    if (av !== bv) return av - bv;
  }

  return safeStr(a).localeCompare(safeStr(b));
}

function buildOrderedUniqueOptions(rows, valueGetter) {
  const sorted = [...rows].sort((a, b) => compareCode(a.code, b.code));
  const seen = new Set();
  const out = [];

  for (const row of sorted) {
    const value = safeStr(valueGetter(row)).trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }

  return out;
}

function isImageUrl(url) {
  const u = safeStr(url).trim().toLowerCase();
  return /\.(png|jpg|jpeg|gif|webp|bmp|svg)(\?.*)?$/.test(u);
}

function isStatusCompleted(row) {
  return safeStr(row?.status ?? row?.current_status ?? row?.state).trim() !== "";
}

// Supabase public url에서 bucket 내 object path 뽑기
// 예: https://xxxx.supabase.co/storage/v1/object/public/evidence/AAA/123_file.png
function extractEvidencePathFromPublicUrl(publicUrl) {
  const url = safeStr(publicUrl).trim();
  if (!url) return "";

  const m = url.match(/\/storage\/v1\/object\/public\/evidence\/(.+)$/);
  if (m?.[1]) return decodeURIComponent(m[1]);

  const idx = url.toLowerCase().indexOf("/evidence/");
  if (idx >= 0) return decodeURIComponent(url.slice(idx + "/evidence/".length));

  return "";
}

export default function StatusWritePanel({ checklistItems = [], onUpdated }) {
  const rows = useMemo(() => (Array.isArray(checklistItems) ? checklistItems : []), [checklistItems]);

  // ✅ 상단 필터 상태: 유형 → 영역 → 도메인
  const [typeFilter, setTypeFilter] = useState("ISMS");
  const [areaFilter, setAreaFilter] = useState("전체");
  const [domainFilter, setDomainFilter] = useState("전체");
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
  const fileInputRefs = useRef({});

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

  function setFiles(code, files) {
    const key = safeStr(code);
    setFileByCode((prev) => ({ ...prev, [key]: files || [] }));
  }

  function setFileInputRef(code, el) {
    if (!el) return;
    fileInputRefs.current[safeStr(code)] = el;
  }

  function openFilePicker(code) {
    fileInputRefs.current[safeStr(code)]?.click();
  }

  function addSelectedFiles(code, fileList, row) {
    const key = safeStr(code);
    const selected = Array.from(fileList || []);
    if (!selected.length) return;

    const uploadedCount = parseEvidenceUrls(row?.evidence_url).length;
    setFileByCode((prev) => {
      const existing = Array.isArray(prev[key]) ? prev[key] : [];
      const remain = Math.max(0, MAX_EVIDENCE_FILES - uploadedCount - existing.length);
      const addable = selected.slice(0, remain);

      if (selected.length > addable.length) {
        alert(`증적 파일은 최대 ${MAX_EVIDENCE_FILES}개까지 추가할 수 있습니다.`);
      }

      return { ...prev, [key]: [...existing, ...addable] };
    });
  }

  function removeSelectedFile(code, index) {
    const key = safeStr(code);
    setFileByCode((prev) => {
      const existing = Array.isArray(prev[key]) ? prev[key] : [];
      return {
        ...prev,
        [key]: existing.filter((_, i) => i !== index),
      };
    });
  }

  // ✅ 옵션들: 코드 순서 기준 첫 등장 순서
  const typeOptions = useMemo(() => {
    const types = buildOrderedUniqueOptions(rows, (x) => normalizeType(x.type));
    return ["전체", ...types];
  }, [rows]);

  const areaOptions = useMemo(() => {
    const scoped = rows.filter((x) => {
      const t = normalizeType(x.type);
      if (typeFilter !== "전체" && t !== typeFilter) return false;
      return true;
    });

    return ["전체", ...buildOrderedUniqueOptions(scoped, (x) => x.area)];
  }, [rows, typeFilter]);

  const domainOptions = useMemo(() => {
    const scoped = rows.filter((x) => {
      const t = normalizeType(x.type);
      if (typeFilter !== "전체" && t !== typeFilter) return false;

      const a = safeStr(x.area).trim();
      if (areaFilter !== "전체" && a !== areaFilter) return false;

      return true;
    });

    return ["전체", ...buildOrderedUniqueOptions(scoped, (x) => x.domain)];
  }, [rows, typeFilter, areaFilter]);

  // ✅ 필터 적용: 유형 → 영역 → 도메인
  const filteredRows = useMemo(() => {
    const kw = safeStr(keyword).trim().toLowerCase();

    return rows.filter((x) => {
      if (typeFilter !== "전체" && normalizeType(x.type) !== typeFilter) return false;
      if (areaFilter !== "전체" && safeStr(x.area).trim() !== areaFilter) return false;
      if (domainFilter !== "전체" && safeStr(x.domain).trim() !== domainFilter) return false;

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
        ...parseEvidenceUrls(x.evidence_url),
      ]
        .map((v) => safeStr(v).toLowerCase())
        .join(" | ");

      return hay.includes(kw);
    });
  }, [rows, typeFilter, areaFilter, domainFilter, statusFilter, keyword]);

  const progressRows = useMemo(() => {
    return rows.filter((x) => {
      const t = normalizeType(x.type);
      if (typeFilter !== "전체" && t !== typeFilter) return false;
      return true;
    });
  }, [rows, typeFilter]);

  const totalPages = useMemo(() => {
    const n = Math.ceil(filteredRows.length / pageSize);
    return n <= 0 ? 1 : n;
  }, [filteredRows.length]);

  useEffect(() => {
    setPage(1);
  }, [typeFilter, areaFilter, domainFilter, statusFilter, keyword]);

  useEffect(() => {
    setPage((p) => clamp(p, 1, totalPages));
  }, [totalPages]);

  const pageSafe = clamp(page, 1, totalPages);

  const pageRows = useMemo(() => {
    const start = (pageSafe - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, pageSafe]);

  const statusDoneCount = useMemo(
    () => progressRows.filter(isStatusCompleted).length,
    [progressRows]
  );

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
    const selectedFiles = Array.isArray(fileByCode[code]) ? fileByCode[code] : [];
    const existingUrls = parseEvidenceUrls(row.evidence_url);

    if (!selectedFiles.length) return existingUrls;

    const remain = Math.max(0, MAX_EVIDENCE_FILES - existingUrls.length);
    if (remain <= 0) {
      alert(`증적 파일은 최대 ${MAX_EVIDENCE_FILES}개까지 저장됩니다.`);
      return existingUrls;
    }

    const uploadingFiles = selectedFiles.slice(0, remain);
    if (selectedFiles.length > uploadingFiles.length) {
      alert(`최대 ${MAX_EVIDENCE_FILES}개만 저장되며 초과 파일은 제외됩니다.`);
    }

    setUploadingCode(code);
    const uploadedUrls = [];

    for (const file of uploadingFiles) {
      const safeCode = sanitizePathSegment(code);
      const safeName = sanitizeFileName(file.name);
      const filePath = `${safeCode}/${Date.now()}_${safeName}`;

      const { error: uploadError } = await supabase.storage.from("evidence").upload(filePath, file, {
        upsert: true,
        cacheControl: "3600",
        contentType: file.type || "application/octet-stream",
      });

      if (uploadError) throw new Error("업로드 실패: " + uploadError.message);

      const { data } = supabase.storage.from("evidence").getPublicUrl(filePath);
      const url = data?.publicUrl || "";
      if (!url) throw new Error("업로드는 성공했지만 public URL 생성 실패");
      uploadedUrls.push(url);
    }

    setFiles(code, []);
    return [...existingUrls, ...uploadedUrls].slice(0, MAX_EVIDENCE_FILES);
  }

  async function handleSave(row) {
    const code = safeStr(row.code);

    try {
      setSavingCode(code);

      const draft = getDraft(code, row);
      const statusValue = safeStr(draft.status).trim();

      const evidenceUrls = await uploadEvidenceIfAny(row);
      const serializedEvidence = serializeEvidenceUrls(evidenceUrls);

      await updateChecklistByCode(code, {
        status: statusValue === "" ? null : statusValue,
        evidence_url: serializedEvidence,
      });

      onUpdated?.();
      alert("저장 완료");
    } catch (e) {
      console.error("save error", e);
      alert(e?.message || "저장 실패");
    } finally {
      setSavingCode(null);
      setUploadingCode(null);
    }
  }

  async function deleteUploadedEvidence(row, targetUrl) {
    const code = safeStr(row.code);
    const url = safeStr(targetUrl).trim();
    if (!url) return;

    if (!confirm("업로드된 증적을 삭제할까요? (스토리지/DB에서 제거됩니다)")) return;

    try {
      setDeletingCode(code);

      const path = extractEvidencePathFromPublicUrl(url);

      if (path) {
        const { error: rmErr } = await supabase.storage.from("evidence").remove([path]);
        if (rmErr) throw new Error("스토리지 삭제 실패: " + rmErr.message);
      }

      const remained = parseEvidenceUrls(row.evidence_url).filter((x) => x !== url);
      await updateChecklistByCode(code, { evidence_url: serializeEvidenceUrls(remained) });

      onUpdated?.();
      alert("증적 삭제 완료");
    } catch (e) {
      alert(e?.message || "삭제 실패");
    } finally {
      setDeletingCode(null);
    }
  }

  const labelCls = "text-sm font-bold text-slate-900";
  const bodyCls = "text-sm text-slate-800 whitespace-pre-wrap break-words";

  return (
    <div className="panel-shell flex flex-col gap-4 w-full max-w-none">
      <div className="panel-sticky">
        <div className="mb-4">
          <TopProgressBar
            title="Status 작성 진행률"
            done={statusDoneCount}
            total={progressRows.length}
          />
        </div>

        <div className="panel-filter-card rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setAreaFilter("전체");
                setDomainFilter("전체");
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            >
              {typeOptions.map((t) => (
                <option key={t} value={t}>
                  {t === "전체" ? "유형(전체)" : t}
                </option>
              ))}
            </select>

            <select
              value={areaFilter}
              onChange={(e) => {
                setAreaFilter(e.target.value);
                setDomainFilter("전체");
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            >
              {areaOptions.map((a) => (
                <option key={a} value={a}>
                  {a === "전체" ? "영역(전체)" : a}
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

        <div className="mt-4 border-b border-slate-200" />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-1 pb-6 space-y-3">
        {pageRows.map((row) => {
          const code = safeStr(row.code);
          const typeText = normalizeType(row.type);
          const areaText = safeStr(row.area).trim();
          const domainText = safeStr(row.domain).trim();
          const metaLine = [typeText, areaText, domainText].filter(Boolean).join(" · ");
          const title = `[${code}] ${safeStr(row.itemCode ?? row.itemcode)}`;
          const draft = getDraft(code, row);
          const guideText = safeStr(row.guide ?? row.Guide).trim();
          const selectedFiles = Array.isArray(fileByCode[code]) ? fileByCode[code] : [];
          const busy = savingCode === code || uploadingCode === code || deletingCode === code;

          const evidenceUrls = parseEvidenceUrls(row.evidence_url);

          return (
            <div
              key={code}
              className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4"
            >
              <div className="space-y-1">
                {metaLine ? (
                  <div className="text-xs text-slate-500 break-words">{metaLine}</div>
                ) : null}
                <div className="text-sm font-bold text-slate-900 break-words whitespace-pre-wrap">{title}</div>
              </div>

              {guideText ? (
                <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-sm border border-sky-400 bg-sky-300" />
                    <span className="text-sm leading-[1.35] font-bold text-sky-800">가이드</span>
                  </div>
                  <div className="text-sm leading-[1.35] font-bold text-sky-800 whitespace-pre-wrap break-words">{guideText}</div>
                </div>
              ) : null}

              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                <div className="mb-2 flex items-center gap-2">
                  <span className="inline-block h-3 w-3 rounded-sm border border-slate-400 bg-slate-300" />
                  <span className="text-sm leading-[1.35] font-bold text-slate-800">현황</span>
                </div>
                <textarea
                  ref={(el) => setTextareaRef(code, el)}
                  value={draft.status}
                  onChange={(e) => {
                    setDraft(code, { status: e.target.value });
                    autoResizeTextarea(e.target);
                  }}
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm leading-[1.35] outline-none focus:ring-2 focus:ring-slate-200 resize-none overflow-hidden"
                  style={{ lineHeight: 1.35 }}
                  placeholder="통제 이행 현황을 입력하세요"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <input
                    ref={(el) => setFileInputRef(code, el)}
                    type="file"
                    multiple
                    onChange={(e) => {
                      addSelectedFiles(code, e.target.files, row);
                      e.target.value = "";
                    }}
                    className="hidden"
                    hidden
                  />
                  <Button
                    variant="outline"
                    onClick={() => openFilePicker(code)}
                    className="h-8 px-3 text-sm"
                    disabled={evidenceUrls.length + selectedFiles.length >= MAX_EVIDENCE_FILES}
                  >
                    파일 추가
                  </Button>

                  <div className="text-xs text-slate-500">
                    {evidenceUrls.length === 0 && selectedFiles.length === 0
                      ? "선택된 파일 없음"
                      : `최대 ${MAX_EVIDENCE_FILES}개 (저장됨 ${evidenceUrls.length} / 선택됨 ${selectedFiles.length})`}
                  </div>

                  <div className="ml-auto shrink-0">
                    <Button onClick={() => handleSave(row)} disabled={busy}>
                      {busy ? "처리 중..." : "저장"}
                    </Button>
                  </div>
                </div>

                {selectedFiles.length ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedFiles.map((file, idx) => (
                      <div key={`${file.name}-${idx}`} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1">
                        <span className="max-w-[220px] truncate text-xs text-slate-700">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => removeSelectedFile(code, idx)}
                          className="h-5 w-5 rounded-full border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700 flex items-center justify-center"
                          title="선택한 파일 제거"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                {evidenceUrls.length ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {evidenceUrls.map((url, idx) => {
                      const isImg = isImageUrl(url);
                      return (
                        <div key={`${url}-${idx}`} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1">
                          <EvidenceModalTrigger
                            url={url}
                            imageClassName="h-14 w-14 rounded-lg border border-slate-200 object-cover hover:opacity-90"
                            linkClassName="text-sm text-blue-600 underline whitespace-nowrap"
                            fit={isImg ? "cover" : "contain"}
                          />
                          <button
                            type="button"
                            onClick={() => deleteUploadedEvidence(row, url)}
                            disabled={deletingCode === code}
                            className="h-6 w-6 rounded-full border border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 flex items-center justify-center disabled:opacity-50"
                            title="업로드된 증적 삭제"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                <div className="text-xs leading-[1.35] text-slate-400">
                  * 파일을 추가한 뒤 <b>저장</b>을 누르면 업로드 + 링크 저장이 처리됩니다.
                </div>
              </div>
            </div>
          );
        })}

        {pageRows.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">표시할 항목이 없습니다.</div>
        ) : null}

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
