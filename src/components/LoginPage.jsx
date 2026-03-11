import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        setLoading(false);
      }
    });

    return () => {
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  async function handleGoogleLogin() {
    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}${window.location.pathname}`,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) {
        throw error;
      }

      // redirect 방식이면 여기까지 오더라도 페이지가 이동할 수 있음
      // url이 없으면 로딩을 풀어준다
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
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white px-8 py-10 shadow-sm">
        <div className="text-center">
          <div className="text-3xl font-bold tracking-tight text-slate-900">
            위험평가 시스템 로그인
          </div>
          <div className="mt-3 text-slate-500">
            Google 계정으로 로그인하세요
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="mt-8 w-full rounded-xl bg-slate-400 px-4 py-3 text-white font-semibold disabled:opacity-70"
        >
          {loading ? "로그인 중..." : "Google로 로그인"}
        </button>

        <div className="mt-5 text-center text-sm text-slate-400">
          <span className="font-semibold text-slate-500">muhayu.com</span> 계정만 허용됩니다
        </div>
      </div>
    </div>
  );
}