import React, { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  async function handleGoogleLogin() {
    try {
      setLoading(true);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
          queryParams: {
            prompt: "select_account"
          }
        }
      });

      if (error) throw error;
    } catch (e) {
      alert("로그인 실패: " + e.message);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 w-[360px] text-center">
        <h1 className="text-lg font-bold mb-2">
          위험관리 시스템 로그인
        </h1>

        <p className="text-sm text-slate-500 mb-6">
          Google 계정으로 로그인하세요
        </p>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full h-[42px] rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
        >
          {loading ? "로그인 중..." : "Google 로그인"}
        </button>

        <div className="text-xs text-slate-400 mt-4">
          muhayu.com 계정만 허용됩니다
        </div>
      </div>
    </div>
  );
}