import React, { useEffect, useState } from "react";
import Button from "../ui/Button";

const LS_KEY = "isms_risk_mgmt_settings_v1";

function safeNum(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default function SettingsPanel({ onSettingsChanged }) {
  const [sessionTimeout, setSessionTimeout] = useState(60);
  const [savedMsg, setSavedMsg] = useState("");

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(LS_KEY) || "null");
      const v = safeNum(s?.session_timeout_minutes, 60);
      setSessionTimeout(v > 0 ? v : 60);
      onSettingsChanged?.({ session_timeout_minutes: v > 0 ? v : 60 });
    } catch {
      setSessionTimeout(60);
      onSettingsChanged?.({ session_timeout_minutes: 60 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function save() {
    const v = safeNum(sessionTimeout, 60);
    const fixed = v > 0 ? v : 60;

    const payload = {
      session_timeout_minutes: fixed,
      // TODO: ARL 값, IP ACL, 로그(첨부) 설정값도 여기에 추가
    };

    localStorage.setItem(LS_KEY, JSON.stringify(payload));
    onSettingsChanged?.(payload);

    setSavedMsg("저장 완료");
    setTimeout(() => setSavedMsg(""), 1500);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="text-sm font-semibold text-slate-900">세션 타임아웃(비활동)</div>
        <div className="text-xs text-slate-500 mt-1">
          사용자가 아무 입력/스크롤/마우스 이동이 없을 때, 설정 시간 이후 자동 로그아웃됩니다.
        </div>

        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <label className="text-xs font-semibold text-slate-700">분(min)</label>
          <input
            value={sessionTimeout}
            onChange={(e) => setSessionTimeout(e.target.value)}
            type="number"
            min={1}
            className="w-[160px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
          />
          <Button onClick={save}>저장</Button>
          {savedMsg ? <div className="text-xs text-emerald-700 font-semibold">{savedMsg}</div> : null}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="text-sm font-semibold text-slate-900">추가 설정(예정)</div>
        <div className="mt-2 text-sm text-slate-600 leading-relaxed">
          - ARL 값(기준) 관리<br />
          - IP ACL 관리<br />
          - 로그(첨부) 저장소 설정(현재: 로그만 private, evidence는 누구나 업로드)<br />
          <span className="text-xs text-slate-500">
            ※ 다음 단계에서 Supabase 테이블 + RLS로 “admin만 수정, 나머지는 select만”까지 붙입니다.
          </span>
        </div>
      </div>
    </div>
  );
}