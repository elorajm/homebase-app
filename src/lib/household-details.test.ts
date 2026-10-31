import { describe, expect, it } from "vitest";
import { roleLabel, toHouseholdDetails, type HouseholdRecord } from "@/lib/household-details";

const record: HouseholdRecord = {
  id: "house_1",
  name: "Lovelace Home",
  inviteCode: "ABCD2345",
  members: [
    { userId: "owner", role: "owner", user: { firstName: "Ada", lastName: "Lovelace" } },
    { userId: "adult", role: "adult", user: { firstName: "Charles", lastName: "Babbage" } },
    { userId: "member", role: "member", user: { firstName: "Mary", lastName: "Somerville" } },
  ],
};

describe("toHouseholdDetails", () => {
  it("returns nothing for a user who is not a member", () => {
    expect(toHouseholdDetails(record, "stranger")).toBeNull();
  });

  it("shows the invite code to the owner", () => {
    expect(toHouseholdDetails(record, "owner")?.inviteCode).toBe("ABCD2345");
  });

  it("shows the invite code to adults", () => {
    expect(toHouseholdDetails(record, "adult")?.inviteCode).toBe("ABCD2345");
  });

  it("hides the invite code from plain members", () => {
    const details = toHouseholdDetails(record, "member");
    expect(details?.inviteCode).toBeNull();
    expect(JSON.stringify(details)).not.toContain("ABCD2345");
  });

  it("reports the viewer's own role and marks their own row", () => {
    const details = toHouseholdDetails(record, "member");
    expect(details?.myRole).toBe("member");
    expect(details?.members.map((member) => member.isCurrentUser)).toEqual([false, false, true]);
  });

  it("lists members by name and role only, keeping the join order", () => {
    const details = toHouseholdDetails(record, "owner");
    expect(details?.members).toEqual([
      { firstName: "Ada", lastName: "Lovelace", role: "owner", isCurrentUser: true },
      { firstName: "Charles", lastName: "Babbage", role: "adult", isCurrentUser: false },
      { firstName: "Mary", lastName: "Somerville", role: "member", isCurrentUser: false },
    ]);
    expect(Object.keys(details?.members[0] ?? {})).not.toContain("email");
  });
});

describe("roleLabel", () => {
  it("capitalizes each role", () => {
    expect(roleLabel("owner")).toBe("Owner");
    expect(roleLabel("adult")).toBe("Adult");
    expect(roleLabel("member")).toBe("Member");
  });
});
