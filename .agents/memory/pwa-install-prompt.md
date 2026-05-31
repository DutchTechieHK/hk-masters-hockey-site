---
name: PWA install prompt race condition
description: Why the Android "Install" button silently broke and how it's wired now
---

# PWA install banner (hk-masters-web)

`beforeinstallprompt` (Chrome/Android) fires **once, very early** — typically
before the React bundle mounts `InstallBanner` (it sits at the bottom of
`Layout.jsx`, rendered after route content + data fetches). If no listener is
attached in time, the event is lost forever for that page load and the banner
falls back to "android-guide" mode, which has **no Install button** → user taps
and nothing happens.

**Fix / how it's wired:** an inline classic `<script>` in `index.html` (runs
during head parse, before the deferred module bundle) captures the event into
`window.__deferredInstallPrompt`, calls `preventDefault()`, and dispatches a
`pwa-install-available` custom event. `InstallBanner.jsx` reads that global on
mount and also listens for the custom event, so a late prompt upgrades the guide
into a real Install button.

**Why:** the listener-attach timing was losing the one-shot event; capturing at
the earliest possible point is the only reliable approach.

**How to apply:** never rely on a React component attaching the
`beforeinstallprompt` listener — always capture it pre-React and read the global.

**iOS reality:** Apple never fires `beforeinstallprompt`. There is NO programmatic
install on iOS — only manual Share → Add to Home Screen. The banner can only show
instructions there; a tappable "Install" is impossible by design.

**Dev caveat:** `vite.config.ts` sets `VitePWA devOptions.enabled = false`, so no
service worker runs in the Replit dev preview → `beforeinstallprompt` never fires
in dev. The install flow is only testable in a production/deployed build.
