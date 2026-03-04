import React, { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import Button from "../ui/Button";

export default function LoginButton() {
  const [busy, setBusy] = useState(false);

  async function login() {
    try {
      setBusy(true);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          // ✅ 현재 사이트로 돌아오게
          redirectTo: window.location.origin,
        },
      });

      if (error) throw error;
      // 여기서부터는 Google로 리다이렉트되므로 코드 실행이 끊기는게 정상
    } catch (e) {
      alert("로그인 실패: " + (e?.message || "unknown"));
      setBusy(false);
    }
  }

  return (
    <Button onClick={login} disabled={busy}>
      {busy ? "이동 중..." : "Google로 로그인"}
    </Button>
  );
}