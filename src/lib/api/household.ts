// Frontend data layer for household management. Mock-backed like ./dashboard;
// mutations enforce the same role rules the GraphQL resolvers will, so the
// page behaves correctly before the backend exists.

import {
  canManageHousehold,
  canModifyMember,
  canViewInviteCode,
} from "../shared/permissions";
import type { Chore, Household, Member, Role } from "../shared/types";
import {
  currentMember,
  db,
  delay,
  generateId,
  recordActivity,
  type DemoScenario,
} from "./mock-db";

export interface HouseholdView {
  /** The signed-in user's member record, with their role in this household. */
  currentMember: Member;
  household: Household;
  /** Household chores, used to show each member's assigned work. */
  chores: Chore[];
}

function cloneHousehold(household: Household, viewerRole: Role): Household {
  return {
    ...household,
    // Mirror the planned API: plain members never receive the invite code.
    inviteCode: canViewInviteCode(viewerRole) ? household.inviteCode : "",
    members: household.members.map((member) => ({ ...member })),
  };
}

function requireOwner(action: string): Member {
  const member = currentMember();
  if (!member || !canManageHousehold(member.role)) {
    throw new Error(`Only the household owner can ${action}.`);
  }
  return member;
}

/** Resolves to null when the signed-in user has no household yet. */
export async function loadHousehold(scenario: DemoScenario = null): Promise<HouseholdView | null> {
  await delay();
  if (scenario === "loading") {
    return new Promise(() => {});
  }
  if (scenario === "error") {
    throw new Error("We could not load your household. Check your connection and try again.");
  }
  if (scenario === "empty") {
    return null;
  }
  const member = currentMember();
  if (!db.household || !member) {
    return null;
  }
  return {
    currentMember: { ...member },
    household: cloneHousehold(db.household, member.role),
    chores: db.chores.map((chore) => ({ ...chore })),
  };
}

function generateInviteCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function requireSignedInUser(): { id: string; firstName: string; lastName: string } {
  if (!db.currentUser) {
    throw new Error("You need to be signed in to do that.");
  }
  return db.currentUser;
}

export async function createHousehold(name: string): Promise<Household> {
  await delay();
  const user = requireSignedInUser();
  const owner: Member = { id: user.id, firstName: user.firstName, lastName: user.lastName, role: "owner" };
  db.household = {
    id: generateId("h"),
    name,
    inviteCode: generateInviteCode(),
    members: [owner],
  };
  db.chores = [];
  db.activity = [];
  recordActivity("household_created", owner.firstName, name);
  return cloneHousehold(db.household, owner.role);
}

export async function joinHousehold(inviteCode: string): Promise<Household> {
  await delay();
  const user = requireSignedInUser();
  if (!db.household || db.household.inviteCode !== inviteCode) {
    throw new Error("No household matches that invite code. Check the code and try again.");
  }
  if (!db.household.members.some((m) => m.id === user.id)) {
    const joiner: Member = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      role: "member",
    };
    db.household.members.push(joiner);
    recordActivity("member_joined", joiner.firstName, db.household.name);
  }
  const role = db.household.members.find((m) => m.id === user.id)!.role;
  return cloneHousehold(db.household, role);
}

export async function renameHousehold(name: string): Promise<Household> {
  await delay();
  const owner = requireOwner("rename the household");
  db.household!.name = name;
  recordActivity("household_renamed", owner.firstName, name);
  return cloneHousehold(db.household!, owner.role);
}

export async function updateMemberRole(memberId: string, role: "adult" | "member"): Promise<Member> {
  await delay();
  const owner = requireOwner("change member roles");
  const target = db.household!.members.find((m) => m.id === memberId);
  if (!target) {
    throw new Error("That member could not be found.");
  }
  if (!canModifyMember(owner.role, target.role)) {
    throw new Error("The owner's role cannot be changed.");
  }
  target.role = role;
  return { ...target };
}

export async function removeMember(memberId: string): Promise<void> {
  await delay();
  const owner = requireOwner("remove members");
  const target = db.household!.members.find((m) => m.id === memberId);
  if (!target) {
    throw new Error("That member could not be found.");
  }
  if (!canModifyMember(owner.role, target.role)) {
    throw new Error("The household owner cannot be removed.");
  }
  db.household!.members = db.household!.members.filter((m) => m.id !== memberId);
  // Match the planned backend behavior: the removed member's chores are
  // reassigned to the owner.
  for (const chore of db.chores) {
    if (chore.assignee.id === memberId) {
      chore.assignee = { ...owner };
    }
  }
  recordActivity("member_removed", owner.firstName, `${target.firstName} ${target.lastName}`);
}
