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
          redirectTo: `${window.location.origin}/risk-mgmt-system/#/`,
        },
      });

      if (error) throw error;
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