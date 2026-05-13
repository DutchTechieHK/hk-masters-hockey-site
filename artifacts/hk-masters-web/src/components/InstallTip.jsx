import { useState, useEffect } from "react";

const DISMISSED_KEY = "hkm_install_tip_dismissed";
const VISITS_KEY = "hkm_install_tip_visits";
const MAX_VISITS = 3;

function isIOS() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function isAndroid() {
  return /Android/.test(navigator.userAgent);
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

function shouldShow() {
  if (isInStandaloneMode()) return false;
  try {
    if (localStorage.getItem(DISMISSED_KEY)) return false;
    const visits = parseInt(localStorage.getItem(VISITS_KEY) || "0", 10);
    if (visits >= MAX_VISITS) return false;
  } catch {
    return false;
  }
  return isIOS() || isAndroid();
}

function incrementVisits() {
  try {
    const visits = parseInt(localStorage.getItem(VISITS_KEY) || "0", 10);
    localStorage.setItem(VISITS_KEY, String(visits + 1));
  } catch {}
}

export default function InstallTip() {
  const [show, setShow] = useState(false);
  const [platform, setPlatform] = useState(null);

  useEffect(() => {
    if (!shouldShow()) return;
    incrementVisits();
    if (isSafariOnIOS()) {
      setPlatform("ios-safari");
    } else if (isIOS()) {
      setPlatform("ios-other");
    } else if (isAndroid()) {
      setPlatform("android");
    }
    setShow(true);
  }, []);

  const dismiss = () => {
    setShow(false);
    try { localStorage.setItem(DISMISSED_KEY, "1"); } catch {}
  };

  if (!show) return null;

  return (
    <div className="mb-6 bg-[#1E3A6E] text-white rounded-2xl px-5 py-4 flex items-start gap-4 shadow-md">
      <div className="text-3xl shrink-0 mt-0.5">📲</div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm leading-tight mb-1">Add this app to your home screen</p>
        {platform === "ios-safari" && (
          <p className="text-xs text-blue-200 leading-relaxed">
            Tap the{" "}
            <svg className="w-3.5 h-3.5 inline mb-0.5" fill="currentColor" viewBox="0 0 50 50">
              <path d="M30.3 13.7L25 8.4l-5.3 5.3-1.4-1.4L25 5.6l6.7 6.7z" />
              <path d="M24 7h2v21h-2z" />
              <path d="M35 40H15c-1.7 0-3-1.3-3-3V19c0-1.7 1.3-3 3-3h7v2h-7c-.6 0-1 .4-1 1v18c0 .6.4 1 1 1h20c.6 0 1-.4 1-1V19c0-.6-.4-1-1-1h-7v-2h7c1.7 0 3 1.3 3 3v18c0 1.7-1.3 3-3 3z" />
            </svg>{" "}
            <strong className="text-white">Share</strong> button in Safari, then choose{" "}
            <strong className="text-white">"Add to Home Screen"</strong> — get instant access during the tournament.{" "}
            <a
              href={`${import.meta.env.BASE_URL}get-the-app`}
              className="underline text-blue-300 hover:text-white transition-colors"
            >
              Watch how
            </a>
          </p>
        )}
        {platform === "ios-other" && (
          <p className="text-xs text-blue-200 leading-relaxed">
            Open this page in <strong className="text-white">Safari</strong>, tap the{" "}
            <strong className="text-white">Share</strong> button, then choose{" "}
            <strong className="text-white">"Add to Home Screen"</strong> for instant access.{" "}
            <a
              href={`${import.meta.env.BASE_URL}get-the-app`}
              className="underline text-blue-300 hover:text-white transition-colors"
            >
              Watch how
            </a>
          </p>
        )}
        {platform === "android" && (
          <p className="text-xs text-blue-200 leading-relaxed">
            Tap the <strong className="text-white">⋮ menu</strong> in Chrome, then select{" "}
            <strong className="text-white">"Add to Home screen"</strong> — quick access during the tournament, even offline.{" "}
            <a
              href={`${import.meta.env.BASE_URL}get-the-app`}
              className="underline text-blue-300 hover:text-white transition-colors"
            >
              Watch how
            </a>
          </p>
        )}
      </div>
      <button
        onClick={dismiss}
        aria-label="Dismiss install tip"
        className="text-blue-300 hover:text-white transition-colors p-1 shrink-0"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
