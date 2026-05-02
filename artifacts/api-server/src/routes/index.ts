import { Router, type IRouter } from "express";
import healthRouter from "./health";
import teamsRouter from "./teams";
import playersRouter from "./players";
import kitsRouter from "./kits";
import fundraisingRouter from "./fundraising";
import pledgesRouter from "./pledges";
import logisticsRouter from "./logistics";
import dashboardRouter from "./dashboard";
import contributionsRouter from "./contributions";
import adminAuthRouter from "./adminAuth";
import sponsorsRouter from "./sponsors";
import matchesRouter from "./matches";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/teams", teamsRouter);
router.use("/players", playersRouter);
router.use("/kits", kitsRouter);
router.use("/fundraising", fundraisingRouter);
router.use("/pledges", pledgesRouter);
router.use("/logistics", logisticsRouter);
router.use("/dashboard", dashboardRouter);
router.use("/contributions", contributionsRouter);
router.use("/admin/auth", adminAuthRouter);
router.use("/sponsors", sponsorsRouter);
router.use("/matches", matchesRouter);

export default router;
