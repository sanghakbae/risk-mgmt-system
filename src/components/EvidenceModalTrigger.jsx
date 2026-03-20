import React, { useState } from "react";

function isImageUrl(url) {
  const u = String(url ?? "").trim().toLowerCase();
  return /\.(png|jpg|jpeg|gif|webp|bmp|svg)(\?.*)?$/.test(u);
}

export default function EvidenceModalTrigger({
  url,
  imageClassName = "h-16 w-16 rounded-lg border border-slate-200 object-cover hover:opacity-90",
  linkClassName = "text-sm text-blue-600 underline whitespace-nowrap",
  hint = "",
  fit = "contain",
}) {
  const [open, setOpen] = useState(false);
  const safeUrl = String(url ?? "").trim();

  if (!safeUrl) return null;

  const img = isImageUrl(safeUrl);

  return (
    <>
      {img ? (
        <button type="button" onClick={() => setOpen(true)} className="block text-left">
          <img src={safeUrl} alt="evidence" className={imageClassName} loading="lazy" />
          {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
        </button>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className={linkClassName}>
          업로드된 증적 보기
        </button>
      )}

      {open ? (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/50"
            aria-label="증적 팝업 닫기"
          />
          <div
            className="relative z-10 rounded-xl border border-slate-200 bg-white p-4 shadow-xl"
            style={{ width: "80vw", height: "80vh" }}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-sm font-bold text-slate-900">증적 보기</div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                닫기
              </button>
            </div>

            <div className="h-[calc(100%-52px)] overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
              {img ? (
                <img
                  src={safeUrl}
                  alt="evidence-full"
                  className={[
                    "mx-auto h-full max-w-full",
                    fit === "cover" ? "w-full object-cover" : "w-auto object-contain",
                  ].join(" ")}
                />
              ) : (
                <iframe title="evidence-file" src={safeUrl} className="h-full w-full rounded-lg bg-white" />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
