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
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-b from-slate-100 via-slate-50 to-white px-4">
      <div className="pointer-events-none absolute -top-16 -left-16 h-56 w-56 rounded-full bg-sky-100/70 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-emerald-100/70 blur-3xl" />

      <div className="w-full max-w-sm rounded-2xl border border-slate-200/80 bg-white/90 px-7 py-8 shadow-[0_12px_30px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="text-center">
          <div className="mx-auto flex h-9 w-[220px] items-center justify-center rounded-xl border border-slate-500 bg-slate-700 text-xs font-semibold tracking-wide text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_6px_14px_rgba(15,23,42,0.24)]">
            Risk Management
          </div>

          <div className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
            위험평가 시스템
          </div>

          <div className="mt-2 text-sm text-slate-500">
            Google 계정으로 로그인하세요
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="mt-7 mx-auto flex h-10 w-[220px] items-center justify-center gap-2 rounded-xl border border-slate-900 bg-black px-6 py-2.5 text-sm font-semibold text-white shadow-[0_6px_14px_rgba(0,0,0,0.25)] transition hover:bg-slate-900 disabled:opacity-70"
        >
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/70 bg-white/10 text-[11px] font-bold text-white">
            G
          </span>
          <span>{loading ? "로그인 중..." : "Google로 로그인"}</span>
        </button>

        <div className="mt-5 text-center text-xs text-slate-400">
          <span className="font-semibold text-slate-600">muhayu.com</span>{" "}
          계정만 허용됩니다
        </div>
      </div>
    </div>
  );
}
