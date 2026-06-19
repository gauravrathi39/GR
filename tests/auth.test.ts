import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";

const app = createApp();

const user = { name: "Alice Example", email: "alice@example.com", password: "supersecret1" };

describe("Auth", () => {
  it("registers a new user, returns the user, and sets an auth cookie", async () => {
    const res = await request(app).post("/api/auth/register").send(user);
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(user.email);
    expect(res.body.user.passwordHash).toBeUndefined(); // never leaked
    expect(res.headers["set-cookie"]?.[0]).toMatch(/token=/);
  });

  it("rejects duplicate email registration with 409", async () => {
    await request(app).post("/api/auth/register").send(user);
    const res = await request(app).post("/api/auth/register").send(user);
    expect(res.status).toBe(409);
  });

  it("rejects invalid registration input with 400", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "x", email: "not-an-email", password: "short" });
    expect(res.status).toBe(400);
  });

  it("logs in with correct credentials and rejects wrong password", async () => {
    await request(app).post("/api/auth/register").send(user);

    const ok = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: user.password });
    expect(ok.status).toBe(200);

    const bad = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: "wrongpassword" });
    expect(bad.status).toBe(401);
  });

  it("blocks /me without a session and returns the user with one", async () => {
    const noAuth = await request(app).get("/api/auth/me");
    expect(noAuth.status).toBe(401);

    const agent = request.agent(app);
    await agent.post("/api/auth/register").send(user);
    const me = await agent.get("/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(user.email);
  });
});
