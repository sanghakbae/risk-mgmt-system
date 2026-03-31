import { createClient } from "@supabase/supabase-js";

const sessionStorageAdapter = {
  getItem(key) {
    if (typeof window === "undefined") return null;
    return window.sessionStorage.getItem(key);
  },
  setItem(key, value) {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(key, value);
  },
  removeItem(key) {
    if (typeof window === "undefined") return;
    window.sessionStorage.removeItem(key);
  },
};

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      flowType: "pkce", // ✅ HashRouter(#)와 충돌 방지
      persistSession: true,
      autoRefreshToken: true,
      // main.jsx에서 code 교환을 수동 처리하므로 중복 교환을 막는다.
      detectSessionInUrl: false,
      // 브라우저/탭 종료 시 세션이 사라지도록 sessionStorage를 사용한다.
      storage: sessionStorageAdapter,
      storageKey: "sb-risk-mgmt-auth",
    },
  }
);
