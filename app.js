import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import router from "./router/index.js";
import swaggerUi from "swagger-ui-express";
import * as dotenv from "dotenv";
import dayjs from "dayjs";
dotenv.config();
import sqlSanitizeMiddleware from "./middleware/sanitizeRequest.js";
import schedule from "node-schedule";
import { recalculate } from "./controllers/recalculateController.js";

const app = express();
const port = process.env.PORT;
const fe = process.env.FE_PORT;

app.disable("x-powered-by");
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.json());

app.use(
  cors({
    origin: [
      `http://localhost:${port}`,
      `http://localhost:${fe}`,
      `https://portalfa.galihrakagustiawan.site`,
      `${process.env.FRONTEND}`,
      `${process.env.FRONTEND}api`,
      `${process.env.API}`,
      `${process.env.API}appdev`,
      `${process.env.API}appdev/app-fa`,
      `http://127.0.0.1:${fe}`,
    ],
  })
);

schedule.scheduleJob("* * * * *", async () => {
  console.log("Running SQ Recalculate Every Minute (" + dayjs().format("YYYY-MM-DD HH:mm:ss") + ')');
  await recalculate();
});

import swaggerDocument from "./swagger-output.json" assert { type: "json" };
app.use("/doc", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use(sqlSanitizeMiddleware);
app.use("/", router);

app.use((req, res) => {
  res.status(404).json({ message: "Not found" });
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
