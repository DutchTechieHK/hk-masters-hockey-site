/// <reference lib="webworker" />
import { precacheAndRoute, createHandlerBoundToURL } from "workbox-precaching";
import { NavigationRoute, registerRoute, setCatchHandler } from "workbox-routing";
import { NetworkFirst, CacheFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";

declare const self: ServiceWorkerGlobalScope;

// Inject precache manifest at build time (all static assets: JS, CSS, HTML, images)
precacheAndRoute(self.__WB_MANIFEST);

// SPA navigation fallback: serve the cached app shell (index.html) for every
// navigation request that isn't an API call. Because index.html is always in
// the precache, SPA routing works fully offline.
const appShellHandler = createHandlerBoundToURL(
  import.meta.env.BASE_URL + "index.html"
);
registerRoute(
  new NavigationRoute(appShellHandler, { denylist: [/^\/api\//] })
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
