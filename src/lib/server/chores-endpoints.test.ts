import { createHash } from "node:crypto";
import type { APIRoute } from "astro";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE_NAME } from "@/lib/server/session";
import { fakeCookies } from "@/lib/server/test-helpers";

const db = vi.hoisted(() => ({
  session: { findUnique: vi.fn(), deleteMany: vi.fn() },
  householdMember: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
  chore: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
}));

vi.mock("@/lib/server/db", () => ({ db }));
vi.mock("@/lib/logger", () => ({ logServerError: vi.fn() }));

import { GET as listGet, POST as listPost } from "@/pages/api/chores/index";
import { DELETE as choreDelete, GET as choreGet, PATCH as chorePatch } from "@/pages/api/chores/[choreId]/index";
import { PATCH as statusPatch } from "@/pages/api/chores/[choreId]/status";

const TOKEN = "live-token";
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
type Context = Parameters<APIRoute>[0];

const chore = (overrides: Record<string, unknown> = {}) => ({
  id: "chore_1",
  title: "Dishes",
  description: null,
  dueDate: new Date("2030-06-12T00:00:00.000Z"),
  status: "pending",
  assignedUserId: "member_1",
  assignedUser: { id: "member_1", firstName: "Mary", lastName: "Somerville" },
  ...overrides,
});

function signedInAs(role: "owner" | "adult" | "member", userId = "user_1", householdId = "house_1") {
  db.session.findUnique.mockResolvedValue({
    expiresAt: new Date(Date.now() + 60_000),
    user: { id: userId, firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" },
  });
  db.householdMember.findUnique.mockResolvedValue({ householdId, role });
}

function jsonRequest(body: unknown, method = "POST", contentType = "application/json") {
  return new Request("http://localhost/api/chores", {
    method,
    headers: { "content-type": contentType },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function call(handler: APIRoute, options: { request?: Request; choreId?: string; signedIn?: boolean } = {}) {
  const cookies = options.signedIn === false ? fakeCookies() : fakeCookies({ [SESSION_COOKIE_NAME]: TOKEN });
  const request = options.request ?? new Request("http://localhost/api/chores");
  return (await handler({
    request,
    cookies,
    params: { choreId: options.choreId },
  } as unknown as Context)) as Response;
}

const validChore = { title: "Dishes", description: "After dinner", dueDate: "2030-06-12", assignedUserId: "member_1" };

beforeEach(() => {
  vi.clearAllMocks();
  db.session.deleteMany.mockResolvedValue({ count: 0 });
  db.householdMember.findFirst.mockResolvedValue({ id: "membership_1" });
  db.chore.findFirst.mockResolvedValue(chore());
  db.householdMember.findMany.mockResolvedValue([{ user: { id: "member_1", firstName: "Mary", lastName: "Somerville" } }]);
});

describe("authentication and household checks", () => {
  it.each([
    ["list", () => call(listGet, { signedIn: false })],
    ["create", () => call(listPost, { signedIn: false, request: jsonRequest(validChore) })],
    ["detail", () => call(choreGet, { signedIn: false, choreId: "chore_1" })],
    ["edit", () => call(chorePatch, { signedIn: false, choreId: "chore_1", request: jsonRequest(validChore, "PATCH") })],
    ["delete", () => call(choreDelete, { signedIn: false, choreId: "chore_1" })],
    ["status", () => call(statusPatch, { signedIn: false, choreId: "chore_1", request: jsonRequest({ status: "completed" }, "PATCH") })],
  ])("returns 401 for %s without a session and touches no chores", async (_name, run) => {
    const response = await run();
    expect(response.status).toBe(401);
    expect(db.chore.findMany).not.toHaveBeenCalled();
    expect(db.chore.findFirst).not.toHaveBeenCalled();
    expect(db.chore.create).not.toHaveBeenCalled();
  });

  it("returns 403 with a clear message for a signed-in user with no household", async () => {
    db.session.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: "user_1", firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" },
    });
    db.householdMember.findUnique.mockResolvedValue(null);

    const response = await call(listGet);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Join or create a household to see chores." });
    expect(db.chore.findMany).not.toHaveBeenCalled();
  });
});

describe("GET /api/chores", () => {
  it("returns the household's chores, members, and the viewer's permissions without caching", async () => {
    signedInAs("member", "member_1");
    db.chore.findMany.mockResolvedValue([chore()]);

    const response = await call(listGet);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(db.chore.findMany.mock.calls[0][0].where).toEqual({ householdId: "house_1" });
    expect(body.data.chores[0]).toMatchObject({ title: "Dishes", canEdit: false, canComplete: true });
    expect(body.data.viewer).toEqual({ userId: "member_1", canManage: false });
    expect(body.data.members).toEqual([{ id: "member_1", firstName: "Mary", lastName: "Somerville" }]);
  });
});

describe("POST /api/chores", () => {
  it("creates a chore for an owner and returns 201", async () => {
    signedInAs("owner");
    db.chore.create.mockResolvedValue(chore());

    const response = await call(listPost, { request: jsonRequest(validChore) });

    expect(response.status).toBe(201);
    expect((await response.json()).data.chore).toMatchObject({ title: "Dishes" });
    expect(db.chore.create.mock.calls[0][0].data.householdId).toBe("house_1");
  });

  it("refuses a plain member with 403 and writes nothing", async () => {
    signedInAs("member");

    const response = await call(listPost, { request: jsonRequest(validChore) });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "You do not have permission to do that." });
    expect(db.chore.create).not.toHaveBeenCalled();
  });

  it("returns field errors for a missing title and due date", async () => {
    signedInAs("owner");

    const response = await call(listPost, { request: jsonRequest({ ...validChore, title: "", dueDate: "" }) });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.fieldErrors).toMatchObject({ title: "Chore name is required.", dueDate: "Due date is required." });
    expect(db.chore.create).not.toHaveBeenCalled();
  });

  it("rejects an assignee outside the household with a field error", async () => {
    signedInAs("owner");
    db.householdMember.findFirst.mockResolvedValue(null);

    const response = await call(listPost, { request: jsonRequest({ ...validChore, assignedUserId: "stranger" }) });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      fieldErrors: { assignedUserId: "Choose a member of your household." },
    });
    expect(db.chore.create).not.toHaveBeenCalled();
  });

  it("rejects fields the client should not control, such as status", async () => {
    signedInAs("owner");

    const response = await call(listPost, { request: jsonRequest({ ...validChore, status: "completed" }) });

    expect(response.status).toBe(400);
    expect(db.chore.create).not.toHaveBeenCalled();
  });

  it("rejects non-JSON requests", async () => {
    signedInAs("owner");

    const response = await call(listPost, { request: jsonRequest("title=Dishes", "POST", "application/x-www-form-urlencoded") });

    expect(response.status).toBe(415);
  });

  it("returns a generic 500 without leaking database details", async () => {
    signedInAs("owner");
    db.chore.create.mockRejectedValue(new Error("relation chore failed at db.internal"));

    const response = await call(listPost, { request: jsonRequest(validChore) });
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(text).toBe(JSON.stringify({ error: "Something went wrong. Please try again." }));
  });
});

describe("chore ids", () => {
  it("answers a malformed id with 404 without touching the database", async () => {
    signedInAs("owner");
    const response = await call(choreGet, { choreId: "x".repeat(200) });
    expect(response.status).toBe(404);
    expect(db.chore.findFirst).not.toHaveBeenCalled();
  });

  it("answers an unknown or foreign id with the same 404", async () => {
    signedInAs("member");
    db.chore.findFirst.mockResolvedValue(null);

    const response = await call(choreGet, { choreId: "chore_from_another_household" });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "That chore could not be found." });
    expect(db.chore.findFirst.mock.calls[0][0].where).toEqual({ id: "chore_from_another_household", householdId: "house_1" });
  });
});

describe("GET /api/chores/[choreId]", () => {
  it("returns the chore and the household members", async () => {
    signedInAs("member");
    const response = await call(choreGet, { choreId: "chore_1" });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.chore.id).toBe("chore_1");
    expect(body.data.members).toHaveLength(1);
  });
});

describe("PATCH /api/chores/[choreId]", () => {
  it("updates a chore for an adult", async () => {
    signedInAs("adult");
    db.chore.updateMany.mockResolvedValue({ count: 1 });

    const response = await call(chorePatch, { choreId: "chore_1", request: jsonRequest({ ...validChore, title: "Dishes!" }, "PATCH") });

    expect(response.status).toBe(200);
    expect(db.chore.updateMany.mock.calls[0][0].where).toEqual({ id: "chore_1", householdId: "house_1" });
  });

  it("refuses a plain member with 403", async () => {
    signedInAs("member");

    const response = await call(chorePatch, { choreId: "chore_1", request: jsonRequest(validChore, "PATCH") });

    expect(response.status).toBe(403);
    expect(db.chore.updateMany).not.toHaveBeenCalled();
  });

  it("returns 404 for a chore in another household", async () => {
    signedInAs("owner");
    db.chore.findFirst.mockResolvedValue(null);

    const response = await call(chorePatch, { choreId: "other_household_chore", request: jsonRequest(validChore, "PATCH") });

    expect(response.status).toBe(404);
    expect(db.chore.updateMany).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/chores/[choreId]", () => {
  it("deletes a chore for an owner", async () => {
    signedInAs("owner");
    db.chore.deleteMany.mockResolvedValue({ count: 1 });

    const response = await call(choreDelete, { choreId: "chore_1" });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { deleted: true } });
  });

  it("refuses a plain member with 403", async () => {
    signedInAs("member");

    const response = await call(choreDelete, { choreId: "chore_1" });

    expect(response.status).toBe(403);
    expect(db.chore.deleteMany).not.toHaveBeenCalled();
  });

  it("returns 404 for a chore in another household", async () => {
    signedInAs("owner");
    db.chore.deleteMany.mockResolvedValue({ count: 0 });

    const response = await call(choreDelete, { choreId: "other_household_chore" });

    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/chores/[choreId]/status", () => {
  it("lets the assigned member mark their chore complete", async () => {
    signedInAs("member", "member_1");
    db.chore.updateMany.mockResolvedValue({ count: 1 });
    db.chore.findFirst
      .mockResolvedValueOnce(chore({ assignedUserId: "member_1" }))
      .mockResolvedValueOnce(chore({ status: "completed" }));

    const response = await call(statusPatch, { choreId: "chore_1", request: jsonRequest({ status: "completed" }, "PATCH") });

    expect(response.status).toBe(200);
    expect((await response.json()).data.chore.status).toBe("completed");
  });

  it("refuses a status for someone else's chore with 403", async () => {
    signedInAs("member", "member_1");
    db.chore.findFirst.mockResolvedValue(chore({ assignedUserId: "someone_else" }));

    const response = await call(statusPatch, { choreId: "chore_1", request: jsonRequest({ status: "completed" }, "PATCH") });

    expect(response.status).toBe(403);
    expect(db.chore.updateMany).not.toHaveBeenCalled();
  });

  it("rejects an unknown status value with 400", async () => {
    signedInAs("owner");

    const response = await call(statusPatch, { choreId: "chore_1", request: jsonRequest({ status: "archived" }, "PATCH") });

    expect(response.status).toBe(400);
    expect((await response.json()).fieldErrors).toEqual({ status: "Choose a valid status." });
  });
});
