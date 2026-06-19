import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/error";
import authRoutes from "./routes/auth.routes";
import tripRoutes from "./routes/trip.routes";

/**
 * Builds the Express app. Kept separate from server startup so tests can mount
 * it with supertest without opening a port or connecting to a real DB.
 */
export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.CLIENT_ORIGIN,
      credentials: true, // allow the auth cookie on cross-origin XHR
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  if (env.NODE_ENV !== "test") {
    app.use(morgan("dev"));
  }

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", uptime: process.uptime() });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/trips", tripRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
