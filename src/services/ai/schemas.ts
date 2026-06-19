import { z } from "zod";

/**
 * Zod validators for the data we accept back from the LLM. Every AI response is
 * parsed through these before it touches the database, so malformed or
 * hallucinated shapes can never be persisted.
 */
export const aiActivitySchema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(600).default(""),
  time: z.string().max(40).optional(),
  estimatedCost: z.number().min(0).max(100000).optional(),
});

export const aiDaySchema = z.object({
  day: z.number().int().min(1),
  summary: z.string().max(300).default(""),
  activities: z.array(aiActivitySchema).min(1).max(12),
});

export const aiBudgetSchema = z.object({
  flights: z.number().min(0),
  accommodation: z.number().min(0),
  food: z.number().min(0),
  activities: z.number().min(0),
  total: z.number().min(0),
  currency: z.string().min(1).max(8).default("USD"),
});

export const aiHotelSchema = z.object({
  name: z.string().min(1).max(160),
  tier: z.enum(["Budget", "Mid-range", "Luxury"]),
  pricePerNight: z.number().min(0).max(100000),
  rating: z.number().min(0).max(5),
  description: z.string().max(400).default(""),
});

export const aiPlanSchema = z.object({
  itinerary: z.array(aiDaySchema).min(1).max(30),
  budget: aiBudgetSchema,
  hotels: z.array(aiHotelSchema).min(1).max(8),
});

export const aiDayOnlySchema = aiDaySchema;
export const aiHotelsOnlySchema = z.object({ hotels: z.array(aiHotelSchema).min(1).max(8) });

export type AIPlan = z.infer<typeof aiPlanSchema>;
export type AIDay = z.infer<typeof aiDaySchema>;
export type AIHotel = z.infer<typeof aiHotelSchema>;
