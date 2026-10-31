import { beforeEach, describe, expect, it, vi } from "vitest";
import { $session, loadSession, logout } from "@/stores/auth";

const user = { id: "user_1", firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" };

function stubFetch(...responses: (Response | Error)[]) {
  const fetchMock = vi.fn(async () => {
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return next as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.unstubAllGlobals();
  $session.set({ status: "loading" });
});

describe("loadSession", () => {
  it("marks the session authenticated when /api/auth/me returns a user", async () => {
    stubFetch(new Response(JSON.stringify({ data: { user, membership: null } }), { status: 200 }));

    await loadSession();

    expect($session.get()).toEqual({ status: "authenticated", user });
  });

  it("marks the session anonymous on 401", async () => {
    stubFetch(new Response(JSON.stringify({ error: "You must be logged in." }), { status: 401 }));

    await loadSession();

    expect($session.get()).toEqual({ status: "anonymous" });
  });

  it("marks the session unavailable on server errors so guards do not redirect", async () => {
    stubFetch(new Response("{}", { status: 500 }));

    await loadSession();

    expect($session.get()).toEqual({ status: "unavailable" });
  });

  it("marks the session unavailable when the network fails", async () => {
    stubFetch(new TypeError("Failed to fetch"));

    await loadSession();

    expect($session.get()).toEqual({ status: "unavailable" });
  });

  it("shares one request between concurrent callers", async () => {
    const fetchMock = stubFetch(new Response(JSON.stringify({ data: { user, membership: null } }), { status: 200 }));

    await Promise.all([loadSession(), loadSession(), loadSession()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sends the request without caching and with the same-origin credentials", async () => {
    const fetchMock = stubFetch(new Response(JSON.stringify({ error: "x" }), { status: 401 }));

    await loadSession();

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/auth/me");
    expect(init.cache).toBe("no-store");
    expect(init.credentials).toBe("same-origin");
  });
});

describe("logout", () => {
  it("clears the shared session after the server confirms logout", async () => {
    $session.set({ status: "authenticated", user });
    stubFetch(new Response(JSON.stringify({ data: { loggedOut: true } }), { status: 200 }));

    const result = await logout();

    expect(result.ok).toBe(true);
    expect($session.get()).toEqual({ status: "anonymous" });
  });

  it("keeps the session and reports the error when logout fails", async () => {
    $session.set({ status: "authenticated", user });
    stubFetch(new TypeError("Failed to fetch"));

    const result = await logout();

    expect(result).toEqual({ ok: false, error: "Something went wrong. Please try again.", fieldErrors: {} });
    expect($session.get()).toEqual({ status: "authenticated", user });
  });
});
