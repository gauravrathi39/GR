import { z } from "zod";

export const budgetTypeSchema = z.enum(["Low", "Medium", "High"]);

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  email: z.string().trim().toLowerCase().email("A valid email is required"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("A valid email is required"),
  password: z.string().min(1, "Password is required"),
});

export const createTripSchema = z.object({
  destination: z.string().trim().min(2, "Destination is required").max(120),
  days: z.coerce.number().int().min(1, "At least 1 day").max(30, "Max 30 days"),
  budgetType: budgetTypeSchema,
  interests: z
    .array(z.string().trim().min(1).max(40))
    .max(12, "Too many interests")
    .default([]),
});

export const tripIdParamSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid trip id"),
});

export const activityParamSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid trip id"),
  day: z.coerce.number().int().min(1),
  activityId: z.string().min(1),
});

export const addActivitySchema = z.object({
  day: z.coerce.number().int().min(1),
  title: z.string().trim().min(1, "Title is required").max(120),
  description: z.string().trim().max(500).default(""),
  time: z.string().trim().max(40).optional(),
  estimatedCost: z.coerce.number().min(0).optional(),
});

export const regenerateDaySchema = z.object({
  day: z.coerce.number().int().min(1),
  instruction: z.string().trim().max(300).optional(),
});

export const chatSchema = z.object({
  message: z.string().trim().min(1, "Message is required").max(1000),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateTripInput = z.infer<typeof createTripSchema>;
export type AddActivityInput = z.infer<typeof addActivitySchema>;
export type RegenerateDayInput = z.infer<typeof regenerateDaySchema>;
export type ChatInput = z.infer<typeof chatSchema>;
