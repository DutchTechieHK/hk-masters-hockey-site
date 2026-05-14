import { useState, useEffect } from "react";

const DISMISSED_KEY = "hkm_pwa_install_dismissed_at";
const RESET_DAYS = 7;
const MS_PER_DAY = 86_400_000;

function isIOS() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function isInStandaloneMode() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function isSafariOnIOS() {
  return isIOS() && /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS/.test(navigator.userAgent);
}

function isMobile() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

export function OfflineBanner() {
  const [offline, setOffline] = useState(() => !navigator.onLine);
  useEffect(() => {
    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);
  if (!offline) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-[60] bg-amber-500 text-white text-xs font-semibold text-center py-2 px-4 shadow-md">
      You're offline — showing cached content
    </div>
  );
}

export default function InstallBanner() {
  const [show, setShow] = useState(false);
  // "ios" | "android-prompt" | "android-guide"
  const [mode, setMode] = useState(null);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    if (isInStandaloneMode()) return;

    try {
      const dismissedAt = localStorage.getItem(DISMISSED_KEY);
      if (dismissedAt && Date.now() - parseInt(dismissedAt, 10) < RESET_DAYS * MS_PER_DAY) return;
    } catch {}

    // iOS Safari — always show manual instructions
    if (isSafariOnIOS()) {
      setMode("ios");
      setShow(true);
      return;
    }

    // Android / Chrome — listen for the native install prompt
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setMode("android-prompt");
      setShow(true);
      clearTimeout(fallbackTimer);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Fallback: if the prompt never fires within 1.5 s (app already installed,
    // or browser chose not to offer it), still show a guide banner on mobile
    let fallbackTimer;
    if (isMobile()) {
      fallbackTimer = setTimeout(() => {
        setMode("android-guide");
        setShow(true);
      }, 1500);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      clearTimeout(fallbackTimer);
    };
  }, []);

  const dismiss = () => {
    setShow(false);
    try { localStorage.setItem(DISMISSED_KEY, String(Date.now())); } catch {}
  };

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-3 sm:p-4">
      <div className="max-w-lg mx-auto bg-[#1E3A6E] text-white rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3">
        <img
          src={`${import.meta.env.BASE_URL}pwa-192.png`}
          alt=""
          className="w-10 h-10 rounded-xl shrink-0 object-contain"
        />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm leading-tight">Add to Home Screen</p>

          {mode === "ios" && (
            <p className="text-xs text-white/80 mt-0.5 leading-snug">
              Tap{" "}
              <svg className="w-3.5 h-3.5 inline mb-0.5" fill="currentColor" viewBox="0 0 50 50">
                <path d="M30.3 13.7L25 8.4l-5.3 5.3-1.4-1.4L25 5.6l6.7 6.7z" />
                <path d="M24 7h2v21h-2z" />
                <path d="M35 40H15c-1.7 0-3-1.3-3-3V19c0-1.7 1.3-3 3-3h7v2h-7c-.6 0-1 .4-1 1v18c0 .6.4 1 1 1h20c.6 0 1-.4 1-1V19c0-.6-.4-1-1-1h-7v-2h7c1.7 0 3 1.3 3 3v18c0 1.7-1.3 3-3 3z" />
              </svg>{" "}
              Share then <strong className="text-white">"Add to Home Screen"</strong>
              {" · "}
              <a href="/get-the-app" className="underline text-white font-medium hover:text-blue-100 transition-colors">
                Watch how
              </a>
            </p>
          )}

          {mode === "android-prompt" && (
            <p className="text-xs text-white/80 mt-0.5 leading-snug">
              Install for quick access during the tournament
              {" · "}
              <a href="/get-the-app" className="underline text-white font-medium hover:text-blue-100 transition-colors">
                Watch how
              </a>
            </p>
          )}

          {mode === "android-guide" && (
            <p className="text-xs text-white/80 mt-0.5 leading-snug">
              Tap <strong className="text-white">⋮ Menu</strong> then{" "}
              <strong className="text-white">"Add to Home screen"</strong>
              {" · "}
              <a href="/get-the-app" className="underline text-white font-medium hover:text-blue-100 transition-colors">
                Watch how
              </a>
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {mode === "android-prompt" && deferredPrompt && (
            <button
              onClick={install}
              className="text-xs font-bold bg-white text-[#1E3A6E] px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
            >
              Install
            </button>
          )}
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            className="text-blue-300 hover:text-white transition-colors p-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
