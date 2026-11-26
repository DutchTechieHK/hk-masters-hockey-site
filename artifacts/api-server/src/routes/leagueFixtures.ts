import { Router, type IRouter } from "express";
import { GetLadiesLeagueFixturesResponse } from "@workspace/api-zod";
import { getLadiesLeagueFixtures } from "../lib/ladiesLeagueFixtures";

const router: IRouter = Router();

router.get("/ladies", async (_req, res): Promise<void> => {
  try {
    const schedule = GetLadiesLeagueFixturesResponse.parse(await getLadiesLeagueFixtures());
    res.setHeader("Cache-Control", schedule.stale ? "no-store" : "public, max-age=60");
    res.json(schedule);
  } catch {
    res.setHeader("Cache-Control", "no-store");
    res.status(502).json({ error: "The official Ladies schedule is temporarily unavailable. Please check HK Hockey or try again shortly." });
  }
});

export default router;
