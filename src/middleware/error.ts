import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { env } from "../config/env";
import { AppError } from "../utils/AppError";

/** 404 handler for unmatched routes. */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(AppError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

/**
 * Central error handler. Maps known error types to clean JSON responses and
 * hides internal details for unexpected (non-operational) errors in production.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: "Validation failed",
      details: err.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  // Mongoose duplicate key (e.g. email already registered)
  if (typeof err === "object" && err !== null && (err as { code?: number }).code === 11000) {
    res.status(409).json({ error: "Resource already exists" });
    return;
  }

  // Unknown / programming error.
  const message = err instanceof Error ? err.message : "Unknown error";
  if (env.NODE_ENV !== "test") {
    // eslint-disable-next-line no-console
    console.error("Unhandled error:", err);
  }
  res.status(500).json({
    error: env.NODE_ENV === "production" ? "Internal server error" : message,
  });
}
