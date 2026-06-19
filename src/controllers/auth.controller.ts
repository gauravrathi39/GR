import type { CookieOptions, Request, Response } from "express";
import { env } from "../config/env";
import { getUserById, loginUser, registerUser } from "../services/auth.service";
import { asyncHandler } from "../utils/asyncHandler";
import { AUTH_COOKIE, signToken } from "../utils/jwt";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SECURE ? "none" : "lax",
    maxAge: SEVEN_DAYS_MS,
    path: "/",
  };
}

function setAuthCookie(res: Response, userId: string): void {
  res.cookie(AUTH_COOKIE, signToken(userId), cookieOptions());
}

export const register = asyncHandler(async (req: Request, res: Response) => {
  const user = await registerUser(req.body);
  setAuthCookie(res, user.id);
  res.status(201).json({ user });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const user = await loginUser(req.body);
  setAuthCookie(res, user.id);
  res.json({ user });
});

export const logout = asyncHandler(async (_req: Request, res: Response) => {
  res.clearCookie(AUTH_COOKIE, { ...cookieOptions(), maxAge: undefined });
  res.json({ ok: true });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await getUserById(req.userId as string);
  res.json({ user });
});
