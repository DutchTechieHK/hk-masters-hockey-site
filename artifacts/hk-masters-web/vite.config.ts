import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

const isReplit = !!process.env.REPL_ID;
const isNetlify = !!process.env.NETLIFY;
const replitDevDomain = process.env.REPLIT_DEV_DOMAIN;

const rawPort = process.env.PORT;
const port = rawPort ? Number(rawPort) : 3000;

const basePath = process.env.BASE_PATH ?? "/";

const replitPlugins =
  isReplit && process.env.NODE_ENV !== "production"
    ? [
        (await import("@replit/vite-plugin-runtime-error-modal")).default(),
        await import("@replit/vite-plugin-cartographer").then((m) =>
          m.cartographer({ root: path.resolve(import.meta.dirname, "..") }),
        ),
        await import("@replit/vite-plugin-dev-banner").then((m) =>
          m.devBanner(),
        ),
      ]
    : [];

export default defineConfig({
  base: basePath,
  define: {
    ...(isReplit && replitDevDomain && !process.env.VITE_API_BASE_URL
      ? { "import.meta.env.VITE_API_BASE_URL": JSON.stringify(`https://${replitDevDomain}`) }
      : {}),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "logo.png", "apple-touch-icon.png", "offline.html"],
      manifest: {
        name: "HK Masters Hockey",
        short_name: "HK Masters",
        description: "Player portal and news for HK Masters Hockey",
        theme_color: "#1E3A6E",
        background_color: "#1E3A6E",
        display: "standalone",
        orientation: "portrait",
        // "." resolves relative to the manifest URL, so it works at both
        // the root (hkmastershockey.com/) and any subpath (dev: /hk-masters-web/)
        start_url: ".",
        scope: ".",
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        // SPA: serve the cached app shell for all non-API navigations.
        // If both network and cache fail, Workbox falls back to offline.html
        // (included in the precache via includeAssets above).
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // NetworkFirst for every read-only portal/public API endpoint.
            // Workbox only caches GET responses, so POST mutations are unaffected.
            urlPattern: /\/api\/(announcements|contributions|documents|events|matches|player-auth|players|public|sponsors)[/]/,
            handler: "NetworkFirst",
            options: {
              cacheName: "portal-api-cache",
              networkTimeoutSeconds: 10,
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 100, maxAgeSeconds: 86400 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-stylesheets",
              expiration: { maxEntries: 5, maxAgeSeconds: 31536000 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 20, maxAgeSeconds: 31536000 },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
    ...replitPlugins,
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    proxy: {
      "/api": {
        target: `http://localhost:${process.env.API_PORT || 8080}`,
        changeOrigin: true,
      },
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
