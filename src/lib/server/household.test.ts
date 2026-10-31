import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  household: { create: vi.fn(), findUnique: vi.fn(), findUniqueOrThrow: vi.fn() },
  householdMember: { findUnique: vi.fn(), create: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/server/db", () => ({
  db,
  isUniqueViolation: (error: unknown) => (error as { code?: string } | null)?.code === "P2002",
}));

import { createHousehold, getHouseholdForUser, HouseholdError, joinHousehold } from "@/lib/server/household";

const uniqueError = () => Object.assign(new Error("Unique constraint failed"), { code: "P2002" });

const record = (viewerRole: "owner" | "member" = "owner") => ({
  id: "house_1",
  name: "Lovelace Home",
  inviteCode: "ABCD2345",
  members: [
    { userId: "user_1", role: viewerRole, user: { firstName: "Ada", lastName: "Lovelace" } },
  ],
});

beforeEach(() => {
  vi.clearAllMocks();
  // Transactions run their callback against the same mock, which is enough to test the decisions made inside.
  db.$transaction.mockImplementation(async (callback: (tx: typeof db) => unknown) => callback(db));
  db.householdMember.findUnique.mockResolvedValue(null);
});

describe("createHousehold", () => {
  it("creates the household with the creator as owner and returns the owner's view", async () => {
    db.household.create.mockResolvedValue(record("owner"));

    const details = await createHousehold("user_1", "Lovelace Home");

    const { data } = db.household.create.mock.calls[0][0];
    expect(data.name).toBe("Lovelace Home");
    expect(data.ownerId).toBe("user_1");
    expect(data.members).toEqual({ create: { userId: "user_1", role: "owner" } });
    expect(details.inviteCode).toBe("ABCD2345");
    expect(details.myRole).toBe("owner");
  });

  it("generates an invite code from the unambiguous alphabet", async () => {
    db.household.create.mockResolvedValue(record("owner"));

    await createHousehold("user_1", "Lovelace Home");

    expect(db.household.create.mock.calls[0][0].data.inviteCode).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
  });

  it("refuses when the user already belongs to a household and writes nothing", async () => {
    db.householdMember.findUnique.mockResolvedValue({ id: "member_1" });

    await expect(createHousehold("user_1", "Second Home")).rejects.toMatchObject({
      status: 409,
      message: "You already belong to a household.",
    });
    expect(db.household.create).not.toHaveBeenCalled();
  });

  it("reports a concurrent membership as already belonging to a household", async () => {
    db.household.create.mockRejectedValueOnce(uniqueError());
    // The concurrent request committed its membership first, so the re-check finds it.
    db.householdMember.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "member_1" });

    await expect(createHousehold("user_1", "Second Home")).rejects.toMatchObject({
      status: 409,
      message: "You already belong to a household.",
    });
  });

  it("retries with a new invite code when the random code collides", async () => {
    db.household.create.mockRejectedValueOnce(uniqueError()).mockResolvedValueOnce(record("owner"));

    const details = await createHousehold("user_1", "Lovelace Home");

    expect(db.household.create).toHaveBeenCalledTimes(2);
    expect(details.name).toBe("Lovelace Home");
  });

  it("gives up after repeated invite-code collisions", async () => {
    db.household.create.mockRejectedValue(uniqueError());

    await expect(createHousehold("user_1", "Lovelace Home")).rejects.toThrow("Could not generate a unique invite code.");
    expect(db.household.create).toHaveBeenCalledTimes(5);
  });

  it("passes unexpected database errors through unchanged", async () => {
    db.household.create.mockRejectedValue(new Error("connection lost"));

    await expect(createHousehold("user_1", "Lovelace Home")).rejects.toThrow("connection lost");
  });
});

describe("joinHousehold", () => {
  it("adds the user as a member and returns the member's view without the invite code", async () => {
    db.household.findUnique.mockResolvedValue({ id: "house_1" });
    db.householdMember.create.mockResolvedValue({});
    db.household.findUniqueOrThrow.mockResolvedValue(record("member"));

    const details = await joinHousehold("user_1", "ABCD2345");

    expect(db.householdMember.create).toHaveBeenCalledWith({
      data: { householdId: "house_1", userId: "user_1", role: "member" },
    });
    expect(details.myRole).toBe("member");
    expect(details.inviteCode).toBeNull();
  });

  it("returns a 404 with a field error for an unknown invite code and adds nobody", async () => {
    db.household.findUnique.mockResolvedValue(null);

    await expect(joinHousehold("user_1", "ZZZZZZZZ")).rejects.toMatchObject({
      status: 404,
      message: "No household matches this invite code.",
      fieldErrors: { inviteCode: "Check the code and try again." },
    });
    expect(db.householdMember.create).not.toHaveBeenCalled();
  });

  it("refuses when the user already belongs to a household", async () => {
    db.household.findUnique.mockResolvedValue({ id: "house_2" });
    db.householdMember.findUnique.mockResolvedValue({ id: "member_1" });

    await expect(joinHousehold("user_1", "ABCD2345")).rejects.toMatchObject({ status: 409 });
    expect(db.householdMember.create).not.toHaveBeenCalled();
  });

  it("reports a concurrent duplicate join as already belonging to a household", async () => {
    db.household.findUnique.mockResolvedValue({ id: "house_1" });
    db.householdMember.create.mockRejectedValue(uniqueError());

    await expect(joinHousehold("user_1", "ABCD2345")).rejects.toMatchObject({
      status: 409,
      message: "You already belong to a household.",
    });
  });
});

describe("getHouseholdForUser", () => {
  it("returns null for a signed-in user without a household", async () => {
    db.householdMember.findUnique.mockResolvedValue(null);
    expect(await getHouseholdForUser("user_1")).toBeNull();
  });

  it("returns the household view for a member, hiding the code from plain members", async () => {
    db.householdMember.findUnique.mockResolvedValue({ household: record("member") });

    const details = await getHouseholdForUser("user_1");

    expect(details?.name).toBe("Lovelace Home");
    expect(details?.inviteCode).toBeNull();
  });

  it("includes the invite code for owners", async () => {
    db.householdMember.findUnique.mockResolvedValue({ household: record("owner") });
    expect((await getHouseholdForUser("user_1"))?.inviteCode).toBe("ABCD2345");
  });
});
