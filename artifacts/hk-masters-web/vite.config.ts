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
// Player portal is now at root (/). BASE_PATH env var drives this at runtime.

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

export default defineConfig(({ command }) => ({
  base: basePath,
  define: {
    // Only inject the Replit dev-domain URL for the local dev server
    // (`vite` / command === "serve"). Any build — including deployment
    // builds, where REPLIT_DEV_DOMAIN may point at the .replit.app domain —
    // must NOT bake this in, so API calls go to the same origin where the
    // API server artifact is deployed under /api. Relying on NODE_ENV here
    // previously let a deployment build bake masters-world-hub.replit.app
    // into the bundle.
    ...(isReplit && replitDevDomain && !process.env.VITE_API_BASE_URL && command === "serve"
      ? { "import.meta.env.VITE_API_BASE_URL": JSON.stringify(`https://${replitDevDomain}`) }
      : {}),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // injectManifest gives full control over the SW code, including
      // setCatchHandler for the offline.html fallback.
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
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
        // "." is relative to the manifest URL — works at both the production
        // root (hkmastershockey.com/) and any dev subpath (/hk-masters-web/).
        start_url: ".",
        scope: ".",
        icons: [
          { src: "pwa-192.png",          sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "pwa-512-any.png",      sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "pwa-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
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
    outDir: path.resolve(import.meta.dirname, "dist/public"),
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
}));
