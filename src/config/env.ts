import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

/**
 * Centralised, validated environment configuration.
 * The process fails fast at startup if a required variable is missing or malformed,
 * so we never run with a half-configured server.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  JWT_SECRET: z.string().min(10, "JWT_SECRET must be at least 10 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required"),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  CLIENT_ORIGIN: z.string().default("http://localhost:3000"),
  COOKIE_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

// In test mode we don't require real external services; supply safe defaults.
const isTest = process.env.NODE_ENV === "test";
const rawEnv = {
  ...process.env,
  MONGODB_URI: process.env.MONGODB_URI ?? (isTest ? "mongodb://127.0.0.1:27017/test" : undefined),
  JWT_SECRET: process.env.JWT_SECRET ?? (isTest ? "test-secret-test-secret" : undefined),
  GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? (isTest ? "test-key" : undefined),
};

const parsed = envSchema.safeParse(rawEnv);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  // eslint-disable-next-line no-console
  console.error(`\n❌ Invalid environment configuration:\n${issues}\n`);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
