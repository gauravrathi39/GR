import { AppError } from "../utils/AppError";
import { hashPassword, User, type IUser } from "../models/User";
import type { LoginInput, RegisterInput } from "../validation/schemas";

/**
 * Registers a new user. Rejects duplicate emails with a 409 (the unique index
 * is the ultimate guard; this pre-check yields a friendlier message).
 */
export async function registerUser(input: RegisterInput): Promise<IUser> {
  const existing = await User.findOne({ email: input.email }).lean();
  if (existing) {
    throw AppError.conflict("An account with this email already exists");
  }
  const passwordHash = await hashPassword(input.password);
  const user = await User.create({
    name: input.name,
    email: input.email,
    passwordHash,
  });
  return user;
}

/**
 * Verifies credentials and returns the user. Uses a single generic error for
 * both "no such email" and "wrong password" to avoid user enumeration.
 */
export async function loginUser(input: LoginInput): Promise<IUser> {
  const user = await User.findOne({ email: input.email });
  if (!user) {
    throw AppError.unauthorized("Invalid email or password");
  }
  const ok = await user.comparePassword(input.password);
  if (!ok) {
    throw AppError.unauthorized("Invalid email or password");
  }
  return user;
}

export async function getUserById(userId: string): Promise<IUser> {
  const user = await User.findById(userId);
  if (!user) {
    throw AppError.unauthorized("Account no longer exists");
  }
  return user;
}
