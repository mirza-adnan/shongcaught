import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env.js";
import { globalRateLimiter } from "./middleware/rateLimiter.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { apiRouter } from "./routes/index.js";

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.CLIENT_URLS, credentials: true }));
app.use(express.json());
app.use(globalRateLimiter);

app.use("/api", apiRouter);

app.use(errorHandler);
