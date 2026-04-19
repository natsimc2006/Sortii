import { Router, type IRouter } from "express";
import healthRouter from "./health";
import juggleRouter from "./juggle";

const router: IRouter = Router();

router.use(healthRouter);
router.use(juggleRouter);

export default router;
