import { Trip, type ITrip } from "../models/Trip";
import { AppError } from "../utils/AppError";
import { newActivityId } from "../utils/id";
import type { AddActivityInput, CreateTripInput } from "../validation/schemas";
import * as agent from "./ai/travelAgent.service";

/**
 * Trip service. CRITICAL INVARIANT: every read/write is scoped by `userId`.
 * A user can never see or mutate another user's trip — a mismatched owner
 * surfaces as a 404 (we don't reveal that the id exists).
 */

export async function listTrips(userId: string): Promise<ITrip[]> {
  return Trip.find({ userId }).sort({ createdAt: -1 });
}

/** Loads a trip owned by the user, or throws 404. The single ownership gate. */
async function getOwnedTrip(userId: string, tripId: string): Promise<ITrip> {
  const trip = await Trip.findOne({ _id: tripId, userId });
  if (!trip) {
    throw AppError.notFound("Trip not found");
  }
  return trip;
}

export function getTrip(userId: string, tripId: string): Promise<ITrip> {
  return getOwnedTrip(userId, tripId);
}

/** Creates a trip and populates it with an AI-generated plan. */
export async function createTrip(userId: string, input: CreateTripInput): Promise<ITrip> {
  const plan = await agent.generateTripPlan({
    destination: input.destination,
    days: input.days,
    budgetType: input.budgetType,
    interests: input.interests,
  });

  return Trip.create({
    userId,
    destination: input.destination,
    days: input.days,
    budgetType: input.budgetType,
    interests: input.interests,
    itinerary: plan.itinerary,
    budget: plan.budget,
    hotels: plan.hotels,
    chatHistory: [],
  });
}

export async function deleteTrip(userId: string, tripId: string): Promise<void> {
  const result = await Trip.deleteOne({ _id: tripId, userId });
  if (result.deletedCount === 0) {
    throw AppError.notFound("Trip not found");
  }
}

export async function addActivity(
  userId: string,
  tripId: string,
  input: AddActivityInput
): Promise<ITrip> {
  const trip = await getOwnedTrip(userId, tripId);
  const day = trip.itinerary.find((d) => d.day === input.day);
  if (!day) {
    throw AppError.badRequest(`Day ${input.day} does not exist on this trip`);
  }
  day.activities.push({
    id: newActivityId(),
    title: input.title,
    description: input.description,
    time: input.time,
    estimatedCost: input.estimatedCost,
  });
  await trip.save();
  return trip;
}

export async function removeActivity(
  userId: string,
  tripId: string,
  day: number,
  activityId: string
): Promise<ITrip> {
  const trip = await getOwnedTrip(userId, tripId);
  const dayPlan = trip.itinerary.find((d) => d.day === day);
  if (!dayPlan) {
    throw AppError.badRequest(`Day ${day} does not exist on this trip`);
  }
  const before = dayPlan.activities.length;
  dayPlan.activities = dayPlan.activities.filter((a) => a.id !== activityId);
  if (dayPlan.activities.length === before) {
    throw AppError.notFound("Activity not found");
  }
  await trip.save();
  return trip;
}

export async function regenerateDay(
  userId: string,
  tripId: string,
  day: number,
  instruction?: string
): Promise<ITrip> {
  const trip = await getOwnedTrip(userId, tripId);
  if (day < 1 || day > trip.days) {
    throw AppError.badRequest(`Day ${day} is out of range for this trip`);
  }
  const newDay = await agent.regenerateDay(trip, day, instruction);
  const idx = trip.itinerary.findIndex((d) => d.day === day);
  if (idx === -1) trip.itinerary.push(newDay);
  else trip.itinerary[idx] = newDay;
  trip.itinerary.sort((a, b) => a.day - b.day);
  await trip.save();
  return trip;
}

/** Conversational edit: runs the agent, persists the result, records chat history. */
export async function chatEditTrip(
  userId: string,
  tripId: string,
  message: string
): Promise<{ trip: ITrip; assistantMessage: string }> {
  const trip = await getOwnedTrip(userId, tripId);
  const result = await agent.chatEdit(trip, message);

  if (result.changed) {
    trip.itinerary = result.itinerary;
    trip.budget = result.budget;
  }
  trip.chatHistory.push(
    { role: "user", content: message, createdAt: new Date() },
    { role: "assistant", content: result.assistantMessage, createdAt: new Date() }
  );
  await trip.save();
  return { trip, assistantMessage: result.assistantMessage };
}
