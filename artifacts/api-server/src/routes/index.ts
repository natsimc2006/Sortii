import { Router, type IRouter } from "express";
import healthRouter from "./health";
import juggleRouter from "./juggle";
import googleRouter from "./google";
import cookWithRouter from "./cook-with";

const router: IRouter = Router();

router.use(healthRouter);
router.use(juggleRouter);
router.use(googleRouter);
router.use(cookWithRouter);

export default router;
