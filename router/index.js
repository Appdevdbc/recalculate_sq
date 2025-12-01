import express from "express";

import {
  recalculate
} from "../controllers/recalculateController.js";

const router = express.Router();

router.post('/getRecalculate', recalculate);
router.get('/getRecalculate', recalculate);

export default router;
