import { describe, expect, it, vi } from "vitest";
import { postJson } from "@/islands/api-client";

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
