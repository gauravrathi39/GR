import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";

// Mock the AI layer so trip creation is deterministic and offline.
vi.mock("../src/services/ai/travelAgent.service", () => ({
  generateTripPlan: vi.fn(async () => ({
    itinerary: [
      {
        day: 1,
        summary: "Arrival day",
        activities: [
          { id: "act_seed_1", title: "Check in", description: "Hotel check-in" },
        ],
      },
    ],
    budget: { flights: 100, accommodation: 100, food: 50, activities: 50, total: 300, currency: "USD" },
    hotels: [
      { name: "Test Inn", tier: "Budget", pricePerNight: 50, rating: 4, description: "Cosy" },
    ],
  })),
  regenerateDay: vi.fn(),
  suggestHotels: vi.fn(),
  chatEdit: vi.fn(),
}));

const app = createApp();

async function makeUser(email: string) {
  const agent = request.agent(app);
  await agent
    .post("/api/auth/register")
    .send({ name: "User", email, password: "supersecret1" });
  return agent;
}

describe("Authorization / data isolation", () => {
  let ownerTripId: string;
  let owner: ReturnType<typeof request.agent>;
  let attacker: ReturnType<typeof request.agent>;

  beforeEach(async () => {
    owner = await makeUser("owner@example.com");
    attacker = await makeUser("attacker@example.com");

    const created = await owner
      .post("/api/trips")
      .send({ destination: "Tokyo", days: 1, budgetType: "Medium", interests: ["Food"] });
    expect(created.status).toBe(201);
    ownerTripId = created.body.trip._id;
  });

  it("lets the owner read their own trip", async () => {
    const res = await owner.get(`/api/trips/${ownerTripId}`);
    expect(res.status).toBe(200);
    expect(res.body.trip.destination).toBe("Tokyo");
  });

  it("returns 404 (not 403) when another user reads the trip", async () => {
    const res = await attacker.get(`/api/trips/${ownerTripId}`);
    expect(res.status).toBe(404);
  });

  it("does not list another user's trips", async () => {
    const res = await attacker.get("/api/trips");
    expect(res.status).toBe(200);
    expect(res.body.trips).toHaveLength(0);
  });

  it("forbids another user from deleting the trip, and it still exists", async () => {
    const del = await attacker.delete(`/api/trips/${ownerTripId}`);
    expect(del.status).toBe(404);

    const stillThere = await owner.get(`/api/trips/${ownerTripId}`);
    expect(stillThere.status).toBe(200);
  });

  it("forbids another user from adding activities to the trip", async () => {
    const res = await attacker
      .post(`/api/trips/${ownerTripId}/activities`)
      .send({ day: 1, title: "Sneaky edit", description: "should fail" });
    expect(res.status).toBe(404);
  });

  it("requires authentication for any trip route", async () => {
    const res = await request(app).get("/api/trips");
    expect(res.status).toBe(401);
  });
});
