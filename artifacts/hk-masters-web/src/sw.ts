/// <reference lib="webworker" />
import { precacheAndRoute, createHandlerBoundToURL } from "workbox-precaching";
import { NavigationRoute, registerRoute, setCatchHandler } from "workbox-routing";
import { NetworkFirst, CacheFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";

declare const self: ServiceWorkerGlobalScope;

// Take control immediately on install/activate so new deploys apply at once
// without requiring the user to close all tabs or clear the cache manually.
self.skipWaiting();
self.addEventListener("activate", (event) => {
  event.waitUntil((self.clients as Clients).claim());
});

// Inject precache manifest at build time (all static assets: JS, CSS, HTML, images)
precacheAndRoute(self.__WB_MANIFEST);

// SPA navigation fallback: serve the cached app shell (index.html) for every
// navigation request that isn't an API call. Because index.html is always in
// the precache, SPA routing works fully offline.
const appShellHandler = createHandlerBoundToURL(
  import.meta.env.BASE_URL + "index.html"
);
registerRoute(
  new NavigationRoute(appShellHandler, {
    denylist: [
      /^\/api\//,        // API calls
      /^\/admin\//,      // Admin portal (separate SPA)
      /^\/pwa-install-video\//,  // Video artifact
    ],
  })
);

// NetworkFirst for all read-only portal and public API endpoints.
// Workbox only caches GET responses, so POST/PUT/DELETE mutations are unaffected.
registerRoute(
  ({ url }) =>
    /\/api\/(announcements|contributions|documents|events|matches|player-auth|players|public|sponsors)/.test(
      url.pathname
    ),
  new NetworkFirst({
    cacheName: "portal-api-cache",
    networkTimeoutSeconds: 10,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 86400 }),
    ],
  })
);

// CacheFirst for Google Fonts (long-lived, never changes for a given URL)
registerRoute(
  ({ url }) => url.origin === "https://fonts.googleapis.com",
  new CacheFirst({
    cacheName: "google-fonts-stylesheets",
    plugins: [new ExpirationPlugin({ maxEntries: 5, maxAgeSeconds: 31536000 })],
  })
);
registerRoute(
  ({ url }) => url.origin === "https://fonts.gstatic.com",
  new CacheFirst({
    cacheName: "google-fonts-webfonts",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 31536000 }),
    ],
  })
);

// Push notification handler: show a notification when the server sends a push event
self.addEventListener("push", (event: PushEvent) => {
  let payload: { title?: string; body?: string; url?: string } = {};
  try {
    if (event.data) payload = event.data.json();
  } catch {}
  const title = payload.title ?? "HK Masters Hockey";
  const body = payload.body ?? "You have a new announcement.";
  const url = payload.url ?? "/announcements";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: self.registration.scope + "pwa-192.png",
      badge: self.registration.scope + "pwa-192.png",
      data: { url },
      tag: "announcement",
    })
  );
});

// Notification click: focus existing window or open a new one
self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const url = (event.notification.data?.url as string | undefined) ?? "/";
  const absoluteUrl = new URL(url, self.registration.scope).href;
  event.waitUntil(
    (self.clients as Clients).matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(self.registration.scope)) {
          (client as WindowClient).focus();
          (client as WindowClient).navigate(absoluteUrl);
          return;
        }
      }
      return (self.clients as Clients).openWindow(absoluteUrl);
    })
  );
});

// True offline fallback: when BOTH network AND all caches fail for a document
// request (e.g. first visit with no connectivity, cache fully cleared), serve
// the precached offline.html so users see a branded error instead of a blank page.
setCatchHandler(async ({ event }) => {
  if ((event as FetchEvent).request.destination === "document") {
    const cached = await caches.match(
      import.meta.env.BASE_URL + "offline.html"
    );
    return cached ?? Response.error();
  }
  return Response.error();
});
