import { describe, expect, it } from "vitest";
import { canCompleteChore, canManageChores, canManageHousehold, canModifyMember } from "@/lib/permissions";
import { generateInviteCode } from "@/lib/invite-code";

describe("household permissions", () => {
  it("lets only owners manage household settings", () => {
    expect(canManageHousehold("owner")).toBe(true);
    expect(canManageHousehold("adult")).toBe(false);
    expect(canManageHousehold("member")).toBe(false);
  });

  it("lets owners and adults manage chores", () => {
    expect(canManageChores("owner")).toBe(true);
    expect(canManageChores("adult")).toBe(true);
    expect(canManageChores("member")).toBe(false);
  });

  it("lets anyone complete chores assigned to them, and managers complete any chore", () => {
    expect(canCompleteChore("member", "u1", "u1")).toBe(true);
    expect(canCompleteChore("member", "u1", "u2")).toBe(false);
    expect(canCompleteChore("adult", "u1", "u2")).toBe(true);
    expect(canCompleteChore("owner", "u1", "u2")).toBe(true);
  });

  it("lets only owners change or remove non-owner members", () => {
    expect(canModifyMember("owner", "adult")).toBe(true);
    expect(canModifyMember("owner", "member")).toBe(true);
    expect(canModifyMember("owner", "owner")).toBe(false);
    expect(canModifyMember("adult", "member")).toBe(false);
    expect(canModifyMember("member", "member")).toBe(false);
  });
});

describe("generateInviteCode", () => {
  it("creates 8 characters from the unambiguous alphabet", () => {
    for (let i = 0; i < 50; i += 1) {
      expect(generateInviteCode()).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
    }
  });
});
