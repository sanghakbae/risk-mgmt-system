import { createClient } from "@supabase/supabase-js";

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
      storageKey: "sb-risk-mgmt-auth",
    },
  }
);
