import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import "./app/styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// The service worker only keeps the app itself so it opens offline (see public/app/sw.js). It never sees your files.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  addEventListener("load", () => {
    navigator.serviceWorker.register("/app/sw.js", { scope: "/app/" }).catch(() => undefined);
  });
}
