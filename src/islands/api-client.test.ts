import { describe, expect, it, vi } from "vitest";
import { postJson, sendJson } from "@/islands/api-client";

function stubFetch(response: Response | Error) {
  const fetchMock = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("postJson", () => {
  it("sends a JSON POST and returns the data payload", async () => {
    const fetchMock = stubFetch(new Response(JSON.stringify({ data: { id: "user_1" } }), { status: 200 }));

    const result = await postJson<{ id: string }>("/api/auth/login", { email: "a@example.com" });

    expect(result).toEqual({ ok: true, data: { id: "user_1" } });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/auth/login");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("same-origin");
    expect((init.headers as Record<string, string>)["content-type"]).toBe("application/json");
    expect(JSON.parse(init.body as string)).toEqual({ email: "a@example.com" });
  });

  it("passes through the server error and field errors", async () => {
    stubFetch(
      new Response(JSON.stringify({ error: "Invalid email or password.", fieldErrors: { email: "Bad" } }), {
        status: 401,
      }),
    );

    expect(await postJson("/api/auth/login", {})).toEqual({
      ok: false,
      error: "Invalid email or password.",
      fieldErrors: { email: "Bad" },
    });
  });

  it("falls back to the generic message for a non-JSON error response", async () => {
    stubFetch(new Response("<html>bad gateway</html>", { status: 502 }));

    expect(await postJson("/api/auth/login", {})).toEqual({
      ok: false,
      error: "Something went wrong. Please try again.",
      fieldErrors: {},
    });
  });

  it("falls back to the generic message when the network fails", async () => {
    stubFetch(new TypeError("Failed to fetch"));

    expect(await postJson("/api/auth/login", {})).toEqual({
      ok: false,
      error: "Something went wrong. Please try again.",
      fieldErrors: {},
    });
  });
});

describe("sendJson", () => {
  it("sends PATCH with a JSON body", async () => {
    const fetchMock = stubFetch(new Response(JSON.stringify({ data: { ok: true } }), { status: 200 }));
    expect(await sendJson("PATCH", "/api/chores/c1/status", { status: "completed" })).toEqual({ ok: true, data: { ok: true } });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/chores/c1/status");
    expect(init.method).toBe("PATCH");
    expect((init.headers as Record<string, string>)["content-type"]).toBe("application/json");
    expect(JSON.parse(init.body as string)).toEqual({ status: "completed" });
  });

  it("sends DELETE without a body or content type", async () => {
    const fetchMock = stubFetch(new Response(JSON.stringify({ data: { deleted: true } }), { status: 200 }));
    await sendJson("DELETE", "/api/chores/c1");
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe("DELETE");
    expect(init.body).toBeUndefined();
    expect(init.headers).toBeUndefined();
  });

  it("returns the server error for a forbidden request", async () => {
    stubFetch(new Response(JSON.stringify({ error: "You do not have permission to do that." }), { status: 403 }));
    expect(await sendJson("DELETE", "/api/chores/c1")).toEqual({
      ok: false,
      error: "You do not have permission to do that.",
      fieldErrors: {},
    });
  });
});
