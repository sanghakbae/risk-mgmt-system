import "./index.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { supabase } from "./lib/supabaseClient";

function withTimeout(promise, ms, fallbackValue = null) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallbackValue), ms)),
  ]);
}

async function bootstrap() {
  try {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");

    if (code) {
      const result = await withTimeout(
        supabase.auth.exchangeCodeForSession(code),
        4000,
        { error: new Error("exchange timeout") }
      );

      if (result?.error) {
        console.error("OAuth session exchange failed:", result.error);
      } else {
        url.searchParams.delete("code");
        window.history.replaceState({}, "", url.toString());
      }
    }
  } catch (e) {
    console.error("OAuth bootstrap error:", e);
  }

  ReactDOM.createRoot(document.getElementById("root")).render(
    <HashRouter>
      <App />
    </HashRouter>
  );
}

bootstrap();