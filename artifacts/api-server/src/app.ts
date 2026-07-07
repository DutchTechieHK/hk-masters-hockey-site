import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors, { type CorsOptions } from "cors";
import helmet from "helmet";
import router from "./routes";
import sitemapRouter from "./routes/sitemap.js";

const app: Express = express();

// --- Security headers (S7) ---
// The API server returns only JSON/XML (it serves no HTML pages), so helmet's
// defaults — including its default CSP — cannot affect the separately hosted
// front-ends. crossOriginResourcePolicy is relaxed to "cross-origin" so the
// sitemap and any resource-style responses keep working behind the Netlify proxy.
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

// --- CORS allow-list (S2) ---
// In production every browser call is same-origin: the public site is proxied
// server-to-server by Netlify, and the management app / player PWA are served
// from the same Replit origin as this API. Same-origin and server-to-server
// requests send no Origin header and are always allowed, so tightening CORS
// here does not affect any production flow. Cross-origin browsers (e.g. local
// dev on a different port) must appear in ALLOWED_ORIGINS.
const DEFAULT_ALLOWED_ORIGINS = [
  "https://hkmastershockey.com",
  "https://www.hkmastershockey.com",
  "https://masters-world-hub.replit.app",
];
const envOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const allowedOrigins = new Set([...DEFAULT_ALLOWED_ORIGINS, ...envOrigins]);
// Allow any localhost / 127.0.0.1 origin (any port) for local development.
const LOCAL_ORIGIN_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    // No Origin header = same-origin request, server-to-server, curl, or a
    // native/mobile client. These are not cross-origin and are always allowed.
    if (!origin) return callback(null, true);
    if (allowedOrigins.has(origin) || LOCAL_ORIGIN_RE.test(origin)) {
      return callback(null, true);
    }
    return callback(null, false); // reject CORS without throwing a 500
  },
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(sitemapRouter);
app.use("/api", router);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err != null && typeof err === "object" && "name" in err && err.name === "ZodError" && "errors" in err) {
    return res.status(400).json({ error: "Validation error", details: (err as { errors: unknown }).errors });
  }
  console.error(err);
  return res.status(500).json({ error: "Internal server error" });
});

export default app;
