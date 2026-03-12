import { Router, type IRouter } from "express";
import healthRouter from "./health";
import teamsRouter from "./teams";
import playersRouter from "./players";
import kitsRouter from "./kits";
import fundraisingRouter from "./fundraising";
import logisticsRouter from "./logistics";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/teams", teamsRouter);
router.use("/players", playersRouter);
router.use("/kits", kitsRouter);
router.use("/fundraising", fundraisingRouter);
router.use("/logistics", logisticsRouter);
router.use("/dashboard", dashboardRouter);

export default router;
