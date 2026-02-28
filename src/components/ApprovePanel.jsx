import React from "react";
import Button from "../ui/Button";
import { CheckCircle2 } from "lucide-react";

export default function ApprovePanel({ risks, onApproveAll }) {
  const done = risks.filter((r) => r.status === "Approved").length;
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-sm font-semibold">승인 및 보고</div>
          <div className="text-sm text-slate-600 mt-1">현재 승인 완료: {done} / {risks.length}</div>
        </div>
        <Button onClick={onApproveAll} iconLeft={<CheckCircle2 className="w-4 h-4" />}>전체 승인 처리</Button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-sm font-semibold">보고서 출력(추후)</div>
        <div className="text-sm text-slate-600 mt-1">PDF/엑셀 출력은 UI/UX 확정 후 연결하세요.</div>
      </div>
    </div>
  );
}
