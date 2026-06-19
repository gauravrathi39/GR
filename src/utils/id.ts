import { randomUUID } from "node:crypto";

/** Stable unique id for itinerary activities (so the UI can target them). */
export function newActivityId(): string {
  return `act_${randomUUID()}`;
}
