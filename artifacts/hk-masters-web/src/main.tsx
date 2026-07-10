import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// The service worker (registerType: "autoUpdate") already installs and
// activates new versions immediately via skipWaiting/clients.claim(), but by
// default the browser only *checks* for a new sw.js on hard navigation/reload.
// Players who leave the portal open (or "installed" as a PWA) for a long time
// can miss updates for a while as a result. Force an active update check
// periodically and whenever the tab regains focus, so new deploys (e.g. new
// profile fields) reach open sessions within minutes instead of waiting for
// an eventual reload.
if ("serviceWorker" in navigator) {
  // Once a new SW takes control (after skipWaiting + clients.claim), reload
  // so the open tab actually picks up the new JS/CSS bundle instead of
  // continuing to run the old code in memory.
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });

  navigator.serviceWorker.ready.then((registration) => {
    const checkForUpdate = () => registration.update().catch(() => {});

    // Poll periodically while the tab is open.
    setInterval(checkForUpdate, 5 * 60 * 1000);

    // Also check immediately whenever the player returns to the tab/app.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") checkForUpdate();
    });
    window.addEventListener("focus", checkForUpdate);
  });
}
