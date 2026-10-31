import { beforeEach, describe, expect, it, vi } from "vitest";
import { $chores, loadChores } from "@/stores/chores";

const payload = {
  chores: [],
  members: [{ id: "owner_1", firstName: "Ada", lastName: "Lovelace" }],
  viewer: { userId: "owner_1", canManage: true },
};

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
  $chores.set({ status: "loading" });
});

describe("loadChores", () => {
  it("is ready with the chores, members, and viewer on success", async () => {
    stubFetch(new Response(JSON.stringify({ data: payload }), { status: 200 }));
    await loadChores();
    expect($chores.get()).toEqual({ status: "ready", ...payload });
  });

  it("is signed out on 401", async () => {
    stubFetch(new Response("{}", { status: 401 }));
    await loadChores();
    expect($chores.get()).toEqual({ status: "signedOut" });
  });

  it("reports no household on 403", async () => {
    stubFetch(new Response("{}", { status: 403 }));
    await loadChores();
    expect($chores.get()).toEqual({ status: "noHousehold" });
  });

  it("is unavailable on server errors", async () => {
    stubFetch(new Response("{}", { status: 500 }));
    await loadChores();
    expect($chores.get()).toEqual({ status: "unavailable" });
  });

  it("is unavailable when the network fails", async () => {
    stubFetch(new TypeError("Failed to fetch"));
    await loadChores();
    expect($chores.get()).toEqual({ status: "unavailable" });
  });

  it("shares one request between concurrent callers and requests fresh data", async () => {
    const fetchMock = stubFetch(new Response(JSON.stringify({ data: payload }), { status: 200 }));
    await Promise.all([loadChores(), loadChores()]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].cache).toBe("no-store");
  });
});
