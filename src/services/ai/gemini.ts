import { GoogleGenAI, Type, type Schema } from "@google/genai";
import { env } from "../../config/env";
import { AppError } from "../../utils/AppError";

/**
 * Single integration point for Google Gemini. Everything that talks to the LLM
 * goes through here so the rest of the app stays provider-agnostic.
 */
export const genai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
export const GEMINI_MODEL = env.GEMINI_MODEL;
export { Type };

// ----- Response schemas (constrain Gemini's JSON output) -----

const activitySchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    description: { type: Type.STRING },
    time: { type: Type.STRING },
    estimatedCost: { type: Type.NUMBER },
  },
  required: ["title", "description"],
};

const daySchema: Schema = {
  type: Type.OBJECT,
  properties: {
    day: { type: Type.INTEGER },
    summary: { type: Type.STRING },
    activities: { type: Type.ARRAY, items: activitySchema },
  },
  required: ["day", "summary", "activities"],
};

const budgetSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    flights: { type: Type.NUMBER },
    accommodation: { type: Type.NUMBER },
    food: { type: Type.NUMBER },
    activities: { type: Type.NUMBER },
    total: { type: Type.NUMBER },
    currency: { type: Type.STRING },
  },
  required: ["flights", "accommodation", "food", "activities", "total", "currency"],
};

const hotelSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    tier: { type: Type.STRING, enum: ["Budget", "Mid-range", "Luxury"] },
    pricePerNight: { type: Type.NUMBER },
    rating: { type: Type.NUMBER },
    description: { type: Type.STRING },
  },
  required: ["name", "tier", "pricePerNight", "rating", "description"],
};

export const geminiPlanSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    itinerary: { type: Type.ARRAY, items: daySchema },
    budget: budgetSchema,
    hotels: { type: Type.ARRAY, items: hotelSchema },
  },
  required: ["itinerary", "budget", "hotels"],
};

export const geminiDaySchema = daySchema;
export const geminiHotelsSchema: Schema = {
  type: Type.OBJECT,
  properties: { hotels: { type: Type.ARRAY, items: hotelSchema } },
  required: ["hotels"],
};

// ----- Structured generation with validation + one repair retry -----

interface StructuredOptions<T> {
  prompt: string;
  systemInstruction: string;
  responseSchema: Schema;
  validate: (data: unknown) => T;
}

export async function generateStructured<T>(opts: StructuredOptions<T>): Promise<T> {
  const callModel = async (): Promise<string> => {
    const res = await genai.models.generateContent({
      model: GEMINI_MODEL,
      contents: opts.prompt,
      config: {
        systemInstruction: opts.systemInstruction,
        responseMimeType: "application/json",
        responseSchema: opts.responseSchema,
        temperature: 0.8,
      },
    });
    return res.text ?? "";
  };

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await callModel();
      return opts.validate(JSON.parse(raw));
    } catch (err) {
      lastError = err;
    }
  }
  // eslint-disable-next-line no-console
  console.error("Gemini structured generation failed:", lastError);
  throw new AppError(
    502,
    "The AI service could not generate a valid result right now. Please try again."
  );
}
