import { createHash } from "node:crypto";
import type { APIRoute } from "astro";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hashPassword } from "@/lib/password";
import { SESSION_COOKIE_NAME } from "@/lib/server/session";
import { fakeCookies } from "@/lib/server/test-helpers";

const db = vi.hoisted(() => ({
  user: { create: vi.fn(), findUnique: vi.fn() },
  session: { create: vi.fn(), findUnique: vi.fn(), deleteMany: vi.fn() },
  householdMember: { findUnique: vi.fn() },
}));

vi.mock("@/lib/server/db", () => ({
  db,
  isUniqueViolation: (error: unknown) => (error as { code?: string } | null)?.code === "P2002",
}));
vi.mock("@/lib/logger", () => ({ logServerError: vi.fn() }));

import { GET as me } from "@/pages/api/auth/me";
import { POST as login } from "@/pages/api/auth/login";
import { POST as logout } from "@/pages/api/auth/logout";
import { POST as register } from "@/pages/api/auth/register";

const PASSWORD = "correct-horse-1";
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const future = () => new Date(Date.now() + 60_000);

let passwordHash: string;

beforeAll(async () => {
  passwordHash = await hashPassword(PASSWORD);
});

beforeEach(() => {
  vi.clearAllMocks();
});

function jsonRequest(body: unknown, contentType = "application/json") {
  return new Request("http://localhost/api/auth/test", {
    method: "POST",
    headers: { "content-type": contentType },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

type Context = Parameters<APIRoute>[0];

async function run(handler: APIRoute, cookies = fakeCookies(), request?: Request): Promise<Response> {
  return (await handler({ request: request ?? jsonRequest({}), cookies } as unknown as Context)) as Response;
}

const validRegistration = {
  firstName: "Ada",
  lastName: "Lovelace",
  email: "Ada@Example.com ",
  password: PASSWORD,
};

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    db.user.create.mockImplementation(async ({ data }) => ({
      id: "user_1",
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
    }));
    db.session.create.mockResolvedValue({});
  });

  it("creates the account, starts a session, and returns only public fields", async () => {
    const cookies = fakeCookies();
    const response = await run(register, cookies, jsonRequest(validRegistration));

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toEqual({
      data: { user: { id: "user_1", firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" } },
    });
    expect(JSON.stringify(body)).not.toMatch(/passwordHash|tokenHash/);
    expect(response.headers.get("cache-control")).toBe("no-store");

    const { data } = db.user.create.mock.calls[0][0];
    expect(data.email).toBe("ada@example.com");
    expect(data.passwordHash).toMatch(/^\$2[aby]\$12\$/);
    expect(data.passwordHash).not.toContain(PASSWORD);
  });

  it("sets an httpOnly session cookie and stores only its hash", async () => {
    const cookies = fakeCookies();
    const response = await run(register, cookies, jsonRequest(validRegistration));
    const cookie = cookies.sets[0];

    expect(cookie.name).toBe(SESSION_COOKIE_NAME);
    expect(cookie.options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
    expect(db.session.create.mock.calls[0][0].data.tokenHash).toBe(sha256(cookie.value));
    expect(JSON.stringify(db.session.create.mock.calls)).not.toContain(cookie.value);
    expect(await response.text()).not.toContain(cookie.value);
  });

  it("rejects non-JSON requests with 415 and does not touch the database", async () => {
    const response = await run(register, fakeCookies(), jsonRequest("a=b", "text/plain"));
    expect(response.status).toBe(415);
    expect(db.user.create).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON with 400", async () => {
    const response = await run(register, fakeCookies(), jsonRequest("{oops"));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("The request body must be valid JSON.");
  });

  it("returns field errors for invalid input without creating anything", async () => {
    const response = await run(
      register,
      fakeCookies(),
      jsonRequest({ firstName: "", lastName: "", email: "not-an-email", password: "short" }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Please correct the highlighted fields.");
    expect(body.fieldErrors).toMatchObject({
      firstName: "First name is required.",
      lastName: "Last name is required.",
      email: "Enter a valid email address.",
      password: "Password must be at least 8 characters.",
    });
    expect(db.user.create).not.toHaveBeenCalled();
  });

  it("rejects fields the client should not control, such as a role", async () => {
    const response = await run(register, fakeCookies(), jsonRequest({ ...validRegistration, role: "owner" }));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/Unrecognized key/);
    expect(db.user.create).not.toHaveBeenCalled();
  });

  it("rejects oversized bodies with 413", async () => {
    const response = await run(
      register,
      fakeCookies(),
      jsonRequest({ ...validRegistration, firstName: "x".repeat(17 * 1024) }),
    );
    expect(response.status).toBe(413);
    expect(db.user.create).not.toHaveBeenCalled();
  });

  it("returns 409 with a field error when the email is already registered", async () => {
    db.user.create.mockRejectedValue({ code: "P2002" });
    const cookies = fakeCookies();

    const response = await run(register, cookies, jsonRequest(validRegistration));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "An account with this email already exists.",
      fieldErrors: { email: "An account with this email already exists." },
    });
    expect(cookies.sets).toHaveLength(0);
  });

  it("returns a generic 500 for unexpected database failures and sets no cookie", async () => {
    db.user.create.mockRejectedValue(new Error("connection refused at postgres://secret"));
    const cookies = fakeCookies();

    const response = await run(register, cookies, jsonRequest(validRegistration));

    expect(response.status).toBe(500);
    const text = await response.text();
    expect(text).toBe(JSON.stringify({ error: "Something went wrong. Please try again." }));
    expect(text).not.toContain("secret");
    expect(cookies.sets).toHaveLength(0);
  });
});

describe("POST /api/auth/login", () => {
  it("returns the same 401 for an unknown email as for a wrong password", async () => {
    db.user.findUnique.mockResolvedValueOnce(null);
    const unknown = await run(login, fakeCookies(), jsonRequest({ email: "nobody@example.com", password: PASSWORD }));

    db.user.findUnique.mockResolvedValueOnce({
      id: "user_1",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      passwordHash,
    });
    const wrong = await run(login, fakeCookies(), jsonRequest({ email: "ada@example.com", password: "nope-nope" }));

    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    const unknownBody = await unknown.text();
    const wrongBody = await wrong.text();
    expect(unknownBody).toBe(wrongBody);
    expect(JSON.parse(wrongBody)).toEqual({ error: "Invalid email or password." });
    expect(db.session.create).not.toHaveBeenCalled();
  });

  it("starts a session for correct credentials and omits the password hash", async () => {
    db.user.findUnique.mockResolvedValue({
      id: "user_1",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      passwordHash,
    });
    db.session.create.mockResolvedValue({});
    const cookies = fakeCookies();

    const response = await run(login, cookies, jsonRequest({ email: " ADA@example.com", password: PASSWORD }));

    expect(response.status).toBe(200);
    expect(db.user.findUnique.mock.calls[0][0].where).toEqual({ email: "ada@example.com" });
    const body = await response.json();
    expect(body.data.user).toEqual({ id: "user_1", firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" });
    expect(JSON.stringify(body)).not.toContain("passwordHash");
    expect(cookies.sets[0].name).toBe(SESSION_COOKIE_NAME);
    expect(cookies.sets[0].options.httpOnly).toBe(true);
  });

  it("rejects malformed JSON with 400", async () => {
    const response = await run(login, fakeCookies(), jsonRequest("{"));
    expect(response.status).toBe(400);
  });

  it("requires an email and password", async () => {
    const response = await run(login, fakeCookies(), jsonRequest({ email: "", password: "" }));
    expect(response.status).toBe(400);
    expect((await response.json()).fieldErrors).toMatchObject({
      email: "Email is required.",
      password: "Password is required.",
    });
  });
});

describe("POST /api/auth/logout", () => {
  it("deletes the stored session by token hash and clears the cookie", async () => {
    db.session.deleteMany.mockResolvedValue({ count: 1 });
    const cookies = fakeCookies({ [SESSION_COOKIE_NAME]: "live-token" });

    const response = await run(logout, cookies);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { loggedOut: true } });
    expect(db.session.deleteMany).toHaveBeenCalledWith({ where: { tokenHash: sha256("live-token") } });
    expect(cookies.deletes[0].name).toBe(SESSION_COOKIE_NAME);
  });

  it("succeeds without a session so a stale cookie can always be cleared", async () => {
    const response = await run(logout, fakeCookies());
    expect(response.status).toBe(200);
    expect(db.session.deleteMany).not.toHaveBeenCalled();
  });

  it("requires a JSON request", async () => {
    const response = await run(logout, fakeCookies(), jsonRequest("", "text/plain"));
    expect(response.status).toBe(415);
  });
});

describe("GET /api/auth/me", () => {
  it("returns 401 without a session cookie", async () => {
    const response = await run(me, fakeCookies(), new Request("http://localhost/api/auth/me"));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "You must be logged in." });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("returns the user and household membership for a valid session", async () => {
    db.session.findUnique.mockResolvedValue({
      expiresAt: future(),
      user: { id: "user_1", firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" },
    });
    db.householdMember.findUnique.mockResolvedValue({ role: "owner", household: { id: "house_1", name: "Lovelace Home" } });

    const response = await run(me, fakeCookies({ [SESSION_COOKIE_NAME]: "live-token" }), new Request("http://localhost/api/auth/me"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: {
        user: { id: "user_1", firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" },
        membership: { role: "owner", household: { id: "house_1", name: "Lovelace Home" } },
      },
    });
  });

  it("returns a null membership for a user without a household", async () => {
    db.session.findUnique.mockResolvedValue({
      expiresAt: future(),
      user: { id: "user_1", firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" },
    });
    db.householdMember.findUnique.mockResolvedValue(null);

    const response = await run(me, fakeCookies({ [SESSION_COOKIE_NAME]: "live-token" }), new Request("http://localhost/api/auth/me"));

    expect((await response.json()).data.membership).toBeNull();
  });

  it("rejects an expired session and deletes it", async () => {
    db.session.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() - 1000),
      user: { id: "user_1", firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" },
    });

    const response = await run(me, fakeCookies({ [SESSION_COOKIE_NAME]: "old-token" }), new Request("http://localhost/api/auth/me"));

    expect(response.status).toBe(401);
    expect(db.session.deleteMany).toHaveBeenCalledWith({ where: { tokenHash: sha256("old-token") } });
  });
});
