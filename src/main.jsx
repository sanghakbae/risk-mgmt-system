import "./index.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { firebaseBackend } from "./lib/firebaseClient";

function withTimeout(promise, ms, fallbackValue = null) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallbackValue), ms)),
  ]);
}

async function bootstrap() {
  try {
    if (window.location.hostname === "127.0.0.1") {
      const nextUrl = new URL(window.location.href);
      nextUrl.hostname = "localhost";
      window.location.replace(nextUrl.toString());
      return;
    }

    const result = await withTimeout(
      firebaseBackend.auth.exchangeCodeForSession(),
      4000,
      { error: new Error("exchange timeout") }
    );

    if (result?.error) {
      console.error("Firebase auth redirect result failed:", result.error);
    }
  } catch (e) {
    console.error("Firebase auth bootstrap error:", e);
  }

  ReactDOM.createRoot(document.getElementById("root")).render(
    <HashRouter>
      <App />
    </HashRouter>
  );
}

bootstrap();
