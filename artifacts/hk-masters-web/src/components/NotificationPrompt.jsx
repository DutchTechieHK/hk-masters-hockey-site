import { useState, useEffect } from "react";
import { API_BASE } from "../utils/api";
import { getPlayerToken } from "../lib/playerAuth";

const DISMISSED_KEY = "hkm_notif_dismissed";
const SUBSCRIBED_KEY = "hkm_notif_subscribed";

async function getVapidPublicKey() {
  const res = await fetch(`${API_BASE}/api/push/vapid-public-key`);
  if (!res.ok) return null;
  const { key } = await res.json();
  return key;
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function subscribeToPush(vapidKey) {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey),
  });
  return sub;
}

async function sendSubscriptionToServer(sub) {
  const token = getPlayerToken();
  if (!token) throw new Error("Not authenticated");
  const json = sub.toJSON();
  const res = await fetch(`${API_BASE}/api/push/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
  });
  if (!res.ok) throw new Error("Server subscription failed");
}

export default function NotificationPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) return;

    const token = getPlayerToken();
    if (!token) return;

    try {
      if (localStorage.getItem(DISMISSED_KEY)) return;
      if (localStorage.getItem(SUBSCRIBED_KEY)) return;
    } catch {}

    if (Notification.permission === "denied") return;
    if (Notification.permission === "granted") {
      handleAutoSubscribe();
      return;
    }

    const timer = setTimeout(() => setShow(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  async function handleAutoSubscribe() {
    const token = getPlayerToken();
    if (!token) return;
    try {
      const vapidKey = await getVapidPublicKey();
      if (!vapidKey) return;
      const sub = await subscribeToPush(vapidKey);
      await sendSubscriptionToServer(sub);
      try { localStorage.setItem(SUBSCRIBED_KEY, "1"); } catch {}
    } catch (err) {
      console.error("Auto push subscription failed:", err);
    }
  }

  async function handleAllow() {
    setShow(false);
    const token = getPlayerToken();
    if (!token) return;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        try { localStorage.setItem(DISMISSED_KEY, "1"); } catch {}
        return;
      }
      const vapidKey = await getVapidPublicKey();
      if (!vapidKey) return;
      const sub = await subscribeToPush(vapidKey);
      await sendSubscriptionToServer(sub);
      try { localStorage.setItem(SUBSCRIBED_KEY, "1"); } catch {}
    } catch (err) {
      console.error("Push subscription failed:", err);
    }
  }

  function handleDismiss() {
    setShow(false);
    try { localStorage.setItem(DISMISSED_KEY, "1"); } catch {}
  }

  if (!show) return null;

  return (
    <div className="fixed bottom-20 left-0 right-0 z-50 p-3 sm:p-4 pointer-events-none">
      <div className="max-w-lg mx-auto bg-[#1E3A6E] text-white rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3 pointer-events-auto">
        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0 text-xl">
          🔔
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm leading-tight">Stay in the loop</p>
          <p className="text-xs text-blue-200 mt-0.5 leading-snug">
            Get notified when new announcements are posted
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleAllow}
            className="text-xs font-bold bg-white text-[#1E3A6E] px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
          >
            Allow
          </button>
          <button
            onClick={handleDismiss}
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
