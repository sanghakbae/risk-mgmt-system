//import React, { useMemo, useState, useEffect } from "react";
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

export default function StatusWritePanel({ checklistItems = [], onUpdated }) {
  const rows = useMemo(() => (Array.isArray(checklistItems) ? checklistItems : []), [checklistItems]);

  // ✅ VulnIdentifyPanel 스타일: 상단 필터 상태
  const [typeFilter, setTypeFilter] = useState("전체");
  const [domainFilter, setDomainFilter] = useState("전체");
  const [areaFilter, setAreaFilter] = useState("전체");
  const [statusFilter, setStatusFilter] = useState("전체"); // 현황 입력 여부
  const [keyword, setKeyword] = useState("");

  // ✅ pagination
  const pageSize = 3;
  const [page, setPage] = useState(1);

  // code별 입력값/파일 상태 관리
  const [draftByCode, setDraftByCode] = useState(() => ({}));
  const [fileByCode, setFileByCode] = useState(() => ({}));
  const [savingCode, setSavingCode] = useState(null);
  const [uploadingCode, setUploadingCode] = useState(null);

  const textareasRef = useRef({});

  function autoResizeTextarea(el) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  function setTextareaRef(code, el) {
    if (!el) return;
    // 코드별로 ref 저장 + 초기 높이 1회 적용
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

  // ✅ 필터 옵션(타입/도메인/영역)
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
    return ["전체", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [rows]);

  const areaOptions = useMemo(() => {
    const set = new Set();
    for (const x of rows) {
      const a = safeStr(x.area).trim();
      if (a) set.add(a);
    }
    return ["전체", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [rows]);

  // ✅ 필터 적용된 목록
  const filteredRows = useMemo(() => {
    const kw = safeStr(keyword).trim().toLowerCase();

    return rows.filter((x) => {
      // type
      if (typeFilter !== "전체" && normalizeType(x.type) !== typeFilter) return false;

      // domain
      if (domainFilter !== "전체" && safeStr(x.domain).trim() !== domainFilter) return false;

      // area
      if (areaFilter !== "전체" && safeStr(x.area).trim() !== areaFilter) return false;

      // status 입력 여부
      const hasStatus = safeStr(x.status).trim().length > 0;
      if (statusFilter === "입력됨" && !hasStatus) return false;
      if (statusFilter === "미입력" && hasStatus) return false;

      // keyword
      if (kw) {
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
        ]
          .map((v) => safeStr(v).toLowerCase())
          .join(" | ");
        if (!hay.includes(kw)) return false;
      }

      return true;
    });
  }, [rows, typeFilter, domainFilter, areaFilter, statusFilter, keyword]);

  // ✅ 페이지 수 계산 + 현재 페이지 보정
  const totalPages = useMemo(() => {
    const n = Math.ceil(filteredRows.length / pageSize);
    return n <= 0 ? 1 : n;
  }, [filteredRows.length]);

  useEffect(() => {
    // 필터 바뀌면 1페이지로
    setPage(1);
  }, [typeFilter, domainFilter, areaFilter, statusFilter, keyword]);

  useEffect(() => {
    // filteredRows 줄어들어 page가 넘어가면 보정
    setPage((p) => clamp(p, 1, totalPages));
  }, [totalPages]);

  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page]);


  const maxPageButtons = 10;

  const pageNumbers = useMemo(() => {
    const tp = totalPages || 1;
    const cur = clamp(page, 1, tp);

    if (tp <= maxPageButtons) {
      return Array.from({ length: tp }, (_, i) => i + 1);
    }

    const half = Math.floor(maxPageButtons / 2); // 5
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
  }, [page, totalPages]);



  async function uploadEvidenceIfAny(row) {
    const code = safeStr(row.code);
    const file = fileByCode[code];

    if (!file) {
      return safeStr(row.evidence_url || "");
    }

    const safeCode = sanitizePathSegment(code);
    const safeName = sanitizeFileName(file.name);
    const filePath = `${safeCode}/${Date.now()}_${safeName}`;

    setUploadingCode(code);

    const { error: uploadError } = await supabase.storage
      .from("evidence")
      .upload(filePath, file, {
        upsert: true,
        cacheControl: "3600",
        contentType: file.type || "application/octet-stream",
      });

    if (uploadError) {
      throw new Error("업로드 실패: " + uploadError.message);
    }

    const { data } = supabase.storage.from("evidence").getPublicUrl(filePath);
    const url = data?.publicUrl || "";

    if (!url) {
      throw new Error("업로드는 성공했지만 public URL 생성 실패");
    }

    setFile(code, null);
    return url;
  }

  async function handleSave(row) {
    const code = safeStr(row.code);
    try {
      setSavingCode(code);

      const draft = getDraft(code, row);
      const statusValue = safeStr(draft.status).trim();

      const evidenceUrl = await uploadEvidenceIfAny(row);

      await updateChecklistByCode(code, {
        status: statusValue === "" ? null : statusValue,
        evidence_url: evidenceUrl === "" ? null : evidenceUrl,
      });

      onUpdated?.();
      alert("저장 완료");
    } catch (e) {
      alert(e?.message || "저장 실패");
    } finally {
      setSavingCode(null);
      setUploadingCode(null);
    }
  }

  return (
    <div className="space-y-4 w-full max-w-none">
      {/* ✅ 상단 필터(= VulnIdentifyPanel 느낌으로) */}
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
            표시 {filteredRows.length}건 · {page}/{totalPages} 페이지
          </div>
        </div>
      </div>

      {/* ✅ 목록: 최대 3개(pageSize=3) */}
      {pageRows.map((row) => {
        const code = safeStr(row.code);
        const title = `[${code}] ${safeStr(row.itemCode)}`;

        const draft = getDraft(code, row);
        const selectedFile = fileByCode[code];
        const busy = savingCode === code || uploadingCode === code;

        return (
          <div key={code} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="text-sm font-semibold text-slate-900 whitespace-pre-wrap">{title}</div>

            <div className="space-y-1">
              <div className="text-xs font-semibold text-slate-700">현황</div>
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

            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-700">증적 업로드</div>

              <div className="flex items-center gap-3 flex-wrap">
                <input
                  type="file"
                  onChange={(e) => setFile(code, e.target.files?.[0] || null)}
                  className="text-sm"
                />

                <div className="text-xs text-slate-500">
                  {selectedFile ? `선택됨: ${selectedFile.name}` : "선택된 파일 없음"}
                </div>

                {row.evidence_url ? (
                  <a
                    href={row.evidence_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 underline"
                  >
                    업로드된 증적 보기
                  </a>
                ) : null}

                <div className="ml-auto">
                  <Button onClick={() => handleSave(row)} disabled={busy}>
                    {busy ? "처리 중..." : "저장"}
                  </Button>
                </div>
              </div>

              <div className="text-xs text-slate-400">
                * 파일을 선택한 뒤 <b>저장</b>을 누르면 업로드 + 링크 저장까지 함께 처리됩니다.
              </div>
            </div>
          </div>
        );
      })}

      {/* ✅ 페이지 번호(맨 밑) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => setPage((p) => clamp(p - 1, 1, totalPages))}
            disabled={page <= 1}
          >
            이전
          </Button>

        {/* 첫 페이지/생략 */}
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

        {/* ✅ 최대 10개만 */}
        {pageNumbers.map((p) => {
          const active = p === page;
          return (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={[
                "h-9 min-w-[36px] px-3 rounded-xl border text-sm font-semibold",
                active
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
              ].join(" ")}
            >
              {p}
            </button>
          );
        })}

        {/* 마지막 페이지/생략 */}
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

          <Button
            variant="outline"
            onClick={() => setPage((p) => clamp(p + 1, 1, totalPages))}
            disabled={page >= totalPages}
          >
            다음
          </Button>
        </div>

        <div className="mt-2 text-center text-xs text-slate-500">
          총 {filteredRows.length}건 · 페이지당 {pageSize}건
        </div>
      </div>
    </div>
  );
}