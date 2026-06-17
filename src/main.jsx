import "./index.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";

function bootstrap() {
  if (window.location.hostname === "127.0.0.1") {
    const nextUrl = new URL(window.location.href);
    nextUrl.hostname = "localhost";
    window.location.replace(nextUrl.toString());
    return;
  }

  ReactDOM.createRoot(document.getElementById("root")).render(
    <HashRouter>
      <App />
    </HashRouter>
  );
}

bootstrap();
