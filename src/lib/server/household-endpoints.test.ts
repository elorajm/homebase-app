import { createHash } from "node:crypto";
import type { APIRoute } from "astro";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE_NAME } from "@/lib/server/session";
import { fakeCookies } from "@/lib/server/test-helpers";

const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  session: { findUnique: vi.fn(), deleteMany: vi.fn(), create: vi.fn() },
  household: { create: vi.fn(), findUnique: vi.fn(), findUniqueOrThrow: vi.fn() },
  householdMember: { findUnique: vi.fn(), create: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/server/db", () => ({
  db,
  isUniqueViolation: (error: unknown) => (error as { code?: string } | null)?.code === "P2002",
}));
vi.mock("@/lib/logger", () => ({ logServerError: vi.fn() }));

import { GET as current } from "@/pages/api/households/current";
import { POST as join } from "@/pages/api/households/join";
import { POST as create } from "@/pages/api/households";

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const TOKEN = "live-token";

type Context = Parameters<APIRoute>[0];

const signedIn = () => {
  db.session.findUnique.mockResolvedValue({
    expiresAt: new Date(Date.now() + 60_000),
    user: { id: "user_1", firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" },
  });
};

const record = (role: "owner" | "member") => ({
  id: "house_1",
  name: "Lovelace Home",
  inviteCode: "ABCD2345",
  members: [{ userId: "user_1", role, user: { firstName: "Ada", lastName: "Lovelace" } }],
});

function jsonRequest(body: unknown, contentType = "application/json") {
  return new Request("http://localhost/api/households", {
    method: "POST",
    headers: { "content-type": contentType },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function run(handler: APIRoute, request: Request, cookies = fakeCookies({ [SESSION_COOKIE_NAME]: TOKEN })) {
  return (await handler({ request, cookies } as unknown as Context)) as Response;
}

const getRequest = () => new Request("http://localhost/api/households/current");

beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation(async (callback: (tx: typeof db) => unknown) => callback(db));
  db.householdMember.findUnique.mockResolvedValue(null);
  db.session.deleteMany.mockResolvedValue({ count: 0 });
});

describe("authentication on household endpoints", () => {
  it.each([
    ["POST /api/households", () => run(create, jsonRequest({ name: "Home" }), fakeCookies())],
    ["POST /api/households/join", () => run(join, jsonRequest({ inviteCode: "ABCD2345" }), fakeCookies())],
    ["GET /api/households/current", () => run(current, getRequest(), fakeCookies())],
  ])("%s returns 401 without a session and touches no household data", async (_name, call) => {
    const response = await call();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "You must be logged in." });
    expect(db.household.create).not.toHaveBeenCalled();
    expect(db.household.findUnique).not.toHaveBeenCalled();
    expect(db.householdMember.findUnique).not.toHaveBeenCalled();
  });

  it("rejects an expired session on the current-household endpoint", async () => {
    db.session.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() - 1000),
      user: { id: "user_1", firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" },
    });

    const response = await run(current, getRequest());

    expect(response.status).toBe(401);
    expect(db.session.deleteMany).toHaveBeenCalledWith({ where: { tokenHash: sha256(TOKEN) } });
  });
});

describe("POST /api/households", () => {
  beforeEach(() => signedIn());

  it("creates a household and returns 201 with the owner view and invite code", async () => {
    db.household.create.mockResolvedValue(record("owner"));

    const response = await run(create, jsonRequest({ name: "  Lovelace Home  " }));

    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body.data.household).toMatchObject({ name: "Lovelace Home", myRole: "owner", inviteCode: "ABCD2345" });
    expect(db.household.create.mock.calls[0][0].data.name).toBe("Lovelace Home");
  });

  it("rejects a name that is too short, with a field error and no write", async () => {
    const response = await run(create, jsonRequest({ name: "A" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Please correct the highlighted fields.",
      fieldErrors: { name: "Household name must be at least 2 characters." },
    });
    expect(db.household.create).not.toHaveBeenCalled();
  });

  it("rejects an unexpected field such as a role, so the client cannot pick its own role", async () => {
    const response = await run(create, jsonRequest({ name: "Home", role: "owner" }));

    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/Unrecognized key/);
    expect(db.household.create).not.toHaveBeenCalled();
  });

  it("returns 409 when the user already belongs to a household", async () => {
    db.householdMember.findUnique.mockResolvedValue({ id: "member_1" });

    const response = await run(create, jsonRequest({ name: "Second Home" }));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "You already belong to a household." });
  });

  it("rejects a non-JSON request before creating anything", async () => {
    const response = await run(create, jsonRequest("name=Home", "application/x-www-form-urlencoded"));
    expect(response.status).toBe(415);
    expect(db.household.create).not.toHaveBeenCalled();
  });

  it("returns a generic 500 for unexpected failures without leaking details", async () => {
    db.household.create.mockRejectedValue(new Error("password=hunter2 at db.internal"));

    const response = await run(create, jsonRequest({ name: "Home" }));

    expect(response.status).toBe(500);
    const text = await response.text();
    expect(text).toBe(JSON.stringify({ error: "Something went wrong. Please try again." }));
    expect(text).not.toContain("hunter2");
  });
});

describe("POST /api/households/join", () => {
  beforeEach(() => signedIn());

  it("joins a household by invite code as a member and returns the member view", async () => {
    db.household.findUnique.mockResolvedValue({ id: "house_1" });
    db.householdMember.create.mockResolvedValue({});
    db.household.findUniqueOrThrow.mockResolvedValue(record("member"));

    const response = await run(join, jsonRequest({ inviteCode: "abcd2345" }));

    expect(response.status).toBe(200);
    expect(db.household.findUnique.mock.calls[0][0].where).toEqual({ inviteCode: "ABCD2345" });
    const body = await response.json();
    expect(body.data.household.myRole).toBe("member");
    expect(body.data.household.inviteCode).toBeNull();
  });

  it("rejects a malformed invite code before any lookup", async () => {
    const response = await run(join, jsonRequest({ inviteCode: "abc" }));

    expect(response.status).toBe(400);
    expect((await response.json()).fieldErrors).toEqual({ inviteCode: "Invite code must be 8 letters or numbers." });
    expect(db.household.findUnique).not.toHaveBeenCalled();
  });

  it("returns 404 with a field error for a code that matches no household", async () => {
    db.household.findUnique.mockResolvedValue(null);

    const response = await run(join, jsonRequest({ inviteCode: "ZZZZZZZZ" }));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "No household matches this invite code.",
      fieldErrors: { inviteCode: "Check the code and try again." },
    });
  });

  it("returns 409 when the user already belongs to a household", async () => {
    db.household.findUnique.mockResolvedValue({ id: "house_2" });
    db.householdMember.findUnique.mockResolvedValue({ id: "member_1" });

    const response = await run(join, jsonRequest({ inviteCode: "ABCD2345" }));

    expect(response.status).toBe(409);
    expect(db.householdMember.create).not.toHaveBeenCalled();
  });

  it("rejects an extra field such as a household id", async () => {
    const response = await run(join, jsonRequest({ inviteCode: "ABCD2345", householdId: "house_9" }));
    expect(response.status).toBe(400);
  });
});

describe("GET /api/households/current", () => {
  beforeEach(() => signedIn());

  it("returns null for a signed-in user with no household", async () => {
    const response = await run(current, getRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { household: null } });
  });

  it("returns the household to a member without the invite code", async () => {
    db.householdMember.findUnique.mockResolvedValue({ household: record("member") });

    const response = await run(current, getRequest());
    const text = await response.text();

    expect(JSON.parse(text).data.household).toMatchObject({ name: "Lovelace Home", myRole: "member", inviteCode: null });
    expect(text).not.toContain("ABCD2345");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("includes the invite code for the owner", async () => {
    db.householdMember.findUnique.mockResolvedValue({ household: record("owner") });

    const body = await (await run(current, getRequest())).json();

    expect(body.data.household.inviteCode).toBe("ABCD2345");
  });
});
