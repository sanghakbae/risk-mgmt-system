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

function bootstrap() {
  if (window.location.hostname === "127.0.0.1") {
    const nextUrl = new URL(window.location.href);
    nextUrl.hostname = "localhost";
    window.location.replace(nextUrl.toString());
    return;
  }

  // Render immediately so the UI never waits on a network round-trip.
  // App handles auth state itself via getSession()/onAuthStateChange.
  ReactDOM.createRoot(document.getElementById("root")).render(
    <HashRouter>
      <App />
    </HashRouter>
  );

  // Process any OAuth redirect result in the background; the resulting
  // session is picked up by App's onAuthStateChange subscription.
  withTimeout(
    firebaseBackend.auth.exchangeCodeForSession(),
    4000,
    { error: new Error("exchange timeout") }
  )
    .then((result) => {
      if (result?.error) {
        console.error("Firebase auth redirect result failed:", result.error);
      }
    })
    .catch((e) => {
      console.error("Firebase auth bootstrap error:", e);
    });
}

bootstrap();
