import {
  FunctionCallingConfigMode,
  Type,
  type Content,
  type FunctionDeclaration,
} from "@google/genai";
import { AppError } from "../../utils/AppError";
import { newActivityId } from "../../utils/id";
import type {
  BudgetType,
  IBudget,
  IDayPlan,
  IHotel,
  ITrip,
} from "../../models/Trip";
import {
  GEMINI_MODEL,
  genai,
  generateStructured,
  geminiDaySchema,
  geminiHotelsSchema,
  geminiPlanSchema,
} from "./gemini";
import {
  aiDayOnlySchema,
  aiHotelsOnlySchema,
  aiPlanSchema,
  type AIDay,
  type AIHotel,
} from "./schemas";

export interface GeneratePlanInput {
  destination: string;
  days: number;
  budgetType: BudgetType;
  interests: string[];
}

export interface GeneratedPlan {
  itinerary: IDayPlan[];
  budget: IBudget;
  hotels: IHotel[];
}

const BUDGET_GUIDANCE: Record<BudgetType, string> = {
  Low: "budget-conscious: hostels/guesthouses, public transport, street food and free attractions",
  Medium: "mid-range: 3-star hotels, a mix of paid attractions and casual dining",
  High: "premium: 4-5 star hotels, private transfers, fine dining and exclusive experiences",
};

function mapDay(day: AIDay): IDayPlan {
  return {
    day: day.day,
    summary: day.summary,
    activities: day.activities.map((a) => ({
      id: newActivityId(),
      title: a.title,
      description: a.description,
      time: a.time,
      estimatedCost: a.estimatedCost,
    })),
  };
}

function mapHotels(hotels: AIHotel[]): IHotel[] {
  return hotels.map((h) => ({
    name: h.name,
    tier: h.tier,
    pricePerNight: h.pricePerNight,
    rating: h.rating,
    description: h.description,
  }));
}

function recomputeTotal(budget: IBudget): IBudget {
  return {
    ...budget,
    total: budget.flights + budget.accommodation + budget.food + budget.activities,
  };
}

/** Full trip plan: itinerary + budget + hotels in one structured call. */
export async function generateTripPlan(input: GeneratePlanInput): Promise<GeneratedPlan> {
  const interests = input.interests.length ? input.interests.join(", ") : "general sightseeing";
  const systemInstruction =
    "You are an expert travel planner. You produce realistic, well-paced, day-by-day " +
    "itineraries with 2-4 concrete activities per day, a believable cost breakdown, and a " +
    "short list of real-sounding hotel suggestions across budget tiers. All monetary values " +
    "are integers in USD. Costs must be internally consistent: the budget total must equal " +
    "flights + accommodation + food + activities.";

  const prompt = `Plan a ${input.days}-day trip to ${input.destination}.
Budget style: ${input.budgetType} (${BUDGET_GUIDANCE[input.budgetType]}).
Traveler interests: ${interests}.

Requirements:
- Produce exactly ${input.days} day(s), numbered 1..${input.days}.
- Each day: a one-sentence summary and 2-4 activities tailored to the interests.
- Each activity: a title, a vivid one-to-two sentence description, a rough time of day, and an estimated cost in USD.
- Provide a realistic total budget broken into flights, accommodation (for the whole stay), food, and activities, plus the total.
- Provide 3 hotel suggestions: one Budget, one Mid-range, one Luxury, each with a nightly price, a rating out of 5, and a short reason to stay.`;

  const plan = await generateStructured({
    prompt,
    systemInstruction,
    responseSchema: geminiPlanSchema,
    validate: (d) => aiPlanSchema.parse(d),
  });

  return {
    itinerary: plan.itinerary.map(mapDay),
    budget: recomputeTotal({ ...plan.budget }),
    hotels: mapHotels(plan.hotels),
  };
}

/** Regenerate a single day, optionally steered by a free-text instruction. */
export async function regenerateDay(
  trip: ITrip,
  day: number,
  instruction?: string
): Promise<IDayPlan> {
  const systemInstruction =
    "You are an expert travel planner refining one day of an existing itinerary. Return only " +
    "that single day with 2-4 concrete activities. Monetary values are integers in USD.";

  const steer = instruction?.trim()
    ? `Apply this request: "${instruction.trim()}".`
    : "Provide a fresh alternative for this day.";

  const prompt = `Trip: ${trip.days}-day trip to ${trip.destination} (${trip.budgetType} budget).
Traveler interests: ${trip.interests.join(", ") || "general sightseeing"}.
Regenerate day ${day}. ${steer}
Keep the "day" field equal to ${day}.`;

  const result = await generateStructured({
    prompt,
    systemInstruction,
    responseSchema: geminiDaySchema,
    validate: (d) => aiDayOnlySchema.parse(d),
  });

  return mapDay({ ...result, day });
}

/** (Re)generate hotel suggestions for the destination + budget. */
export async function suggestHotels(trip: ITrip): Promise<IHotel[]> {
  const systemInstruction =
    "You are a hotel concierge. Suggest real-sounding hotels across budget tiers with nightly " +
    "prices in USD and ratings out of 5.";
  const prompt = `Suggest 3-5 hotels in ${trip.destination} suitable for a ${trip.budgetType} budget traveler. Include at least one Budget, one Mid-range, and one Luxury option.`;

  const result = await generateStructured({
    prompt,
    systemInstruction,
    responseSchema: geminiHotelsSchema,
    validate: (d) => aiHotelsOnlySchema.parse(d),
  });
  return mapHotels(result.hotels);
}

// ----- Conversational editor (the creative feature) -----

export interface ChatEditResult {
  assistantMessage: string;
  itinerary: IDayPlan[];
  budget: IBudget;
  hotels: IHotel[];
  changed: boolean;
}

const editTools: FunctionDeclaration[] = [
  {
    name: "add_activity",
    description: "Add a new activity to a specific day of the itinerary.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        day: { type: Type.INTEGER, description: "Day number to add the activity to" },
        title: { type: Type.STRING },
        description: { type: Type.STRING },
        time: { type: Type.STRING, description: "Time of day, e.g. 'Morning' or '14:00'" },
        estimatedCost: { type: Type.NUMBER, description: "Estimated cost in USD" },
      },
      required: ["day", "title", "description"],
    },
  },
  {
    name: "remove_activity",
    description: "Remove an activity from a day by matching its title.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        day: { type: Type.INTEGER },
        title: { type: Type.STRING, description: "Title (or part of it) of the activity to remove" },
      },
      required: ["day", "title"],
    },
  },
  {
    name: "replace_day",
    description: "Replace all activities for a day with a new set (use to restructure a day).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        day: { type: Type.INTEGER },
        summary: { type: Type.STRING },
        activities: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              time: { type: Type.STRING },
              estimatedCost: { type: Type.NUMBER },
            },
            required: ["title", "description"],
          },
        },
      },
      required: ["day", "summary", "activities"],
    },
  },
  {
    name: "update_budget",
    description: "Adjust one or more budget categories (USD). Total is recomputed automatically.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        flights: { type: Type.NUMBER },
        accommodation: { type: Type.NUMBER },
        food: { type: Type.NUMBER },
        activities: { type: Type.NUMBER },
      },
    },
  },
];

interface WorkingState {
  itinerary: IDayPlan[];
  budget: IBudget;
  changed: boolean;
}

function executeTool(
  name: string,
  args: Record<string, unknown>,
  state: WorkingState
): Record<string, unknown> {
  const findDay = (d: number) => state.itinerary.find((x) => x.day === d);

  switch (name) {
    case "add_activity": {
      const day = findDay(Number(args.day));
      if (!day) return { ok: false, error: `Day ${args.day} does not exist` };
      day.activities.push({
        id: newActivityId(),
        title: String(args.title),
        description: String(args.description ?? ""),
        time: args.time ? String(args.time) : undefined,
        estimatedCost: args.estimatedCost != null ? Number(args.estimatedCost) : undefined,
      });
      state.changed = true;
      return { ok: true };
    }
    case "remove_activity": {
      const day = findDay(Number(args.day));
      if (!day) return { ok: false, error: `Day ${args.day} does not exist` };
      const needle = String(args.title).toLowerCase();
      const before = day.activities.length;
      day.activities = day.activities.filter((a) => !a.title.toLowerCase().includes(needle));
      if (day.activities.length === before) return { ok: false, error: "No matching activity found" };
      state.changed = true;
      return { ok: true, removed: before - day.activities.length };
    }
    case "replace_day": {
      const dayNum = Number(args.day);
      const rawActivities = Array.isArray(args.activities) ? args.activities : [];
      const activities = rawActivities.map((a) => {
        const obj = a as Record<string, unknown>;
        return {
          id: newActivityId(),
          title: String(obj.title ?? "Activity"),
          description: String(obj.description ?? ""),
          time: obj.time ? String(obj.time) : undefined,
          estimatedCost: obj.estimatedCost != null ? Number(obj.estimatedCost) : undefined,
        };
      });
      const newDay: IDayPlan = { day: dayNum, summary: String(args.summary ?? ""), activities };
      const idx = state.itinerary.findIndex((x) => x.day === dayNum);
      if (idx === -1) state.itinerary.push(newDay);
      else state.itinerary[idx] = newDay;
      state.itinerary.sort((a, b) => a.day - b.day);
      state.changed = true;
      return { ok: true };
    }
    case "update_budget": {
      const b = state.budget;
      if (args.flights != null) b.flights = Number(args.flights);
      if (args.accommodation != null) b.accommodation = Number(args.accommodation);
      if (args.food != null) b.food = Number(args.food);
      if (args.activities != null) b.activities = Number(args.activities);
      b.total = b.flights + b.accommodation + b.food + b.activities;
      state.changed = true;
      return { ok: true, total: b.total };
    }
    default:
      return { ok: false, error: `Unknown tool ${name}` };
  }
}

/**
 * Conversational itinerary editor. The model interprets the user's natural-language
 * request and calls edit tools; we execute them against a working copy of the trip,
 * loop until the model is done, then return the updated plan plus a friendly reply.
 */
export async function chatEdit(trip: ITrip, message: string): Promise<ChatEditResult> {
  const state: WorkingState = {
    itinerary: JSON.parse(JSON.stringify(trip.itinerary)),
    budget: JSON.parse(JSON.stringify(trip.budget)),
    changed: false,
  };

  const itinerarySnapshot = state.itinerary
    .map(
      (d) =>
        `Day ${d.day}: ${d.summary}\n` +
        d.activities.map((a) => `  - ${a.title}${a.estimatedCost ? ` ($${a.estimatedCost})` : ""}`).join("\n")
    )
    .join("\n");

  const systemInstruction =
    `You are a friendly, concise travel assistant helping edit an existing ${trip.days}-day ` +
    `trip to ${trip.destination} (${trip.budgetType} budget). Use the provided tools to make the ` +
    `requested changes, then briefly confirm what you changed in one or two sentences. ` +
    `If a request is unrelated to editing this trip, answer helpfully without calling tools. ` +
    `Keep budget categories sensible and in USD.\n\nCurrent itinerary:\n${itinerarySnapshot}\n\n` +
    `Current budget: flights $${state.budget.flights}, accommodation $${state.budget.accommodation}, ` +
    `food $${state.budget.food}, activities $${state.budget.activities}, total $${state.budget.total}.`;

  // Seed with recent chat history for continuity, then the new message.
  const history: Content[] = trip.chatHistory.slice(-8).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const contents: Content[] = [...history, { role: "user", parts: [{ text: message }] }];

  let assistantMessage = "";
  const MAX_TURNS = 5;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const res = await genai.models.generateContent({
      model: GEMINI_MODEL,
      contents,
      config: {
        systemInstruction,
        tools: [{ functionDeclarations: editTools }],
        toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } },
        temperature: 0.7,
      },
    });

    const calls = res.functionCalls ?? [];
    if (calls.length === 0) {
      assistantMessage = res.text?.trim() || "Done.";
      break;
    }

    // Echo the model's tool-call turn back into the conversation.
    const modelParts = res.candidates?.[0]?.content?.parts;
    if (modelParts) contents.push({ role: "model", parts: modelParts });

    // Execute each call and feed results back.
    const responseParts = calls.map((call) => {
      const result = executeTool(call.name ?? "", (call.args ?? {}) as Record<string, unknown>, state);
      return { functionResponse: { name: call.name ?? "", response: result } };
    });
    contents.push({ role: "user", parts: responseParts });

    if (turn === MAX_TURNS - 1) {
      assistantMessage = state.changed
        ? "I've applied your requested changes."
        : "I wasn't able to complete that — could you rephrase?";
    }
  }

  if (!assistantMessage) {
    throw new AppError(502, "The assistant did not return a response. Please try again.");
  }

  return {
    assistantMessage,
    itinerary: state.itinerary,
    budget: recomputeTotal(state.budget),
    hotels: trip.hotels,
    changed: state.changed,
  };
}
