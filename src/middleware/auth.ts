import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/AppError";
import { AUTH_COOKIE, verifyToken } from "../utils/jwt";

/**
 * Authentication gate. Reads the JWT from the httpOnly cookie, verifies it, and
 * attaches the user id to the request. Any protected route mounts this first,
 * guaranteeing downstream handlers always have a trusted req.userId.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = req.cookies?.[AUTH_COOKIE];
  if (!token) {
    throw AppError.unauthorized("Authentication required");
  }
  try {
    const payload = verifyToken(token);
    req.userId = payload.sub;
    next();
  } catch {
    throw AppError.unauthorized("Invalid or expired session");
  }
}
