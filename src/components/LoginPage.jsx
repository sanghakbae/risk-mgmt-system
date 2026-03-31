import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        setLoading(false);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  async function handleGoogleLogin() {
    try {
      setLoading(true);

      const isGithubPages =
        window.location.hostname === "sanghakbae.github.io";

      const redirectTo = isGithubPages
        ? `${window.location.origin}/risk-mgmt-system/`
        : window.location.origin;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) {
        throw error;
      }

      if (!data?.url) {
        setLoading(false);
      }
    } catch (e) {
      console.error("Google login error:", e);
      alert(e.message || "Google 로그인에 실패했습니다.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#d8dce4] px-4">
      <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center">
        <div className="w-full max-w-[360px] rounded-[18px] border border-white/70 bg-white/92 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.10)] backdrop-blur-sm">
          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold tracking-[0.02em] text-slate-400">
            security activity monitoring system
          </div>

          <div className="mt-4 text-[20px] font-bold tracking-[-0.03em] text-slate-900">
            위험평가 관리 시스템
          </div>

          <div className="mt-1.5 text-[12px] leading-relaxed text-slate-400">
            허용된 Google 계정으로 로그인하세요.
          </div>

          <div className="mt-4 h-px w-full bg-slate-200" />

          <div className="mt-4 rounded-xl border border-slate-200 bg-[#f6f8fc] px-3 py-2.5">
            <div className="text-[11px] font-semibold text-slate-500">로그인 방식</div>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
              <span className="font-medium text-slate-700">Google OAuth</span>
              <span className="text-slate-300">•</span>
              <span>최소 권한</span>
              <span className="text-slate-300">•</span>
              <span className="truncate">muhayu.com</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#0b1230] px-4 text-[12px] font-semibold text-white shadow-[0_10px_18px_rgba(11,18,48,0.18)] transition hover:bg-[#0f173d] disabled:opacity-70"
          >
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-[#0b1230]">
              G
            </span>
            <span>{loading ? "Google 계정으로 로그인 중..." : "Google 계정으로 로그인"}</span>
          </button>

          <div className="mt-4 text-center text-[10px] leading-relaxed text-slate-400">
            로그인하면 접근 권한이 부여된 계정만 계속 진행할 수 있습니다.
          </div>
        </div>
      </div>
    </div>
  );
}
