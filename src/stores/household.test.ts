import { beforeEach, describe, expect, it, vi } from "vitest";
import { $household, loadHousehold, setHousehold } from "@/stores/household";

const details = {
  id: "house_1",
  name: "Lovelace Home",
  myRole: "owner" as const,
  inviteCode: "ABCD2345",
  members: [{ firstName: "Ada", lastName: "Lovelace", role: "owner" as const, isCurrentUser: true }],
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
  $household.set({ status: "loading" });
});

describe("loadHousehold", () => {
  it("marks the user as a member when a household is returned", async () => {
    stubFetch(new Response(JSON.stringify({ data: { household: details } }), { status: 200 }));
    await loadHousehold();
    expect($household.get()).toEqual({ status: "member", household: details });
  });

  it("marks the user as having no household when none is returned", async () => {
    stubFetch(new Response(JSON.stringify({ data: { household: null } }), { status: 200 }));
    await loadHousehold();
    expect($household.get()).toEqual({ status: "none" });
  });

  it("marks the user as signed out on 401", async () => {
    stubFetch(new Response(JSON.stringify({ error: "You must be logged in." }), { status: 401 }));
    await loadHousehold();
    expect($household.get()).toEqual({ status: "signedOut" });
  });

  it("marks the household as unavailable on server errors", async () => {
    stubFetch(new Response("{}", { status: 500 }));
    await loadHousehold();
    expect($household.get()).toEqual({ status: "unavailable" });
  });

  it("marks the household as unavailable when the network fails", async () => {
    stubFetch(new TypeError("Failed to fetch"));
    await loadHousehold();
    expect($household.get()).toEqual({ status: "unavailable" });
  });

  it("shares one request between concurrent callers", async () => {
    const fetchMock = stubFetch(new Response(JSON.stringify({ data: { household: null } }), { status: 200 }));
    await Promise.all([loadHousehold(), loadHousehold()]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("setHousehold", () => {
  it("switches the store to the member state after a successful create or join", () => {
    setHousehold(details);
    expect($household.get()).toEqual({ status: "member", household: details });
  });
});
