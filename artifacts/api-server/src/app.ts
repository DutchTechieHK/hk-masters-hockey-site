import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import router from "./routes";
import sitemapRouter from "./routes/sitemap.js";

const app: Express = express();

app.use(cors());
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
