// Frontend data layer for chore management. Mock-backed like ./dashboard and
// ./household; mutations enforce the same role rules the GraphQL resolvers
// will. All reads and writes go through the shared store in ./mock-db so the
// dashboard reflects every change.

import { canCompleteChore, canManageChores } from "../shared/permissions";
import type { Chore, Member } from "../shared/types";
import { currentMember, db, delay, generateId, recordActivity, type DemoScenario } from "./mock-db";

export interface ChoresView {
  /** The signed-in user's member record; null when they have no household. */
  currentMember: Member | null;
  /** Household members, for assignee filters and form selects. */
  members: Member[];
  chores: Chore[];
}

export interface ChoreInput {
  title: string;
  description: string;
  dueDate: string;
  assignedUserId?: string;
}

function requireChoreManager(action: string): Member {
  const member = currentMember();
  if (!member || !canManageChores(member.role)) {
    throw new Error(`Only the household owner or an adult can ${action}.`);
  }
  return member;
}

function resolveAssignee(actor: Member, assignedUserId: string | undefined, fallback: Member): Member {
  if (!assignedUserId) {
    return fallback;
  }
  const assignee = db.household?.members.find((m) => m.id === assignedUserId);
  if (!assignee) {
    throw new Error("Choose a household member to assign this chore to.");
  }
  return assignee;
}

export async function loadChores(scenario: DemoScenario = null): Promise<ChoresView> {
  await delay();
  if (scenario === "loading") {
    return new Promise(() => {});
  }
  if (scenario === "error") {
    throw new Error("We could not load your chores. Check your connection and try again.");
  }
  if (scenario === "empty") {
    return { currentMember: currentMember(), members: db.household?.members ?? [], chores: [] };
  }
  const member = currentMember();
  return {
    currentMember: member ? { ...member } : null,
    members: (db.household?.members ?? []).map((m) => ({ ...m })),
    chores: db.chores.map((chore) => ({ ...chore })),
  };
}

export async function getChore(choreId: string): Promise<Chore> {
  await delay();
  const chore = db.chores.find((c) => c.id === choreId);
  if (!chore) {
    throw new Error("That chore could not be found.");
  }
  return { ...chore };
}

export async function createChore(input: ChoreInput): Promise<Chore> {
  await delay();
  const actor = requireChoreManager("create chores");
  const chore: Chore = {
    id: generateId("c"),
    title: input.title,
    description: input.description,
    dueDate: input.dueDate,
    status: "pending",
    assignee: { ...resolveAssignee(actor, input.assignedUserId, actor) },
  };
  db.chores = [...db.chores, chore];
  recordActivity("chore_created", actor.firstName, chore.title);
  return { ...chore };
}

export async function updateChore(choreId: string, input: ChoreInput): Promise<Chore> {
  await delay();
  const actor = requireChoreManager("edit chores");
  const chore = db.chores.find((c) => c.id === choreId);
  if (!chore) {
    throw new Error("That chore could not be found.");
  }
  chore.title = input.title;
  chore.description = input.description;
  chore.dueDate = input.dueDate;
  chore.assignee = { ...resolveAssignee(actor, input.assignedUserId, chore.assignee) };
  return { ...chore };
}

export async function deleteChore(choreId: string): Promise<void> {
  await delay();
  const actor = requireChoreManager("delete chores");
  const chore = db.chores.find((c) => c.id === choreId);
  if (!chore) {
    throw new Error("That chore could not be found.");
  }
  db.chores = db.chores.filter((c) => c.id !== choreId);
  recordActivity("chore_deleted", actor.firstName, chore.title);
}

export async function setChoreStatus(choreId: string, completed: boolean): Promise<Chore> {
  await delay(250);
  const member = currentMember();
  const chore = db.chores.find((c) => c.id === choreId);
  if (!chore) {
    throw new Error("That chore could not be found.");
  }
  if (!member || !canCompleteChore(member.role, member.id, chore.assignee.id)) {
    throw new Error("Only the assignee, the owner, or an adult can update this chore's status.");
  }
  chore.status = completed ? "completed" : "pending";
  chore.completedAt = completed ? new Date().toISOString() : undefined;
  recordActivity(completed ? "chore_completed" : "chore_reopened", member.firstName, chore.title);
  return { ...chore };
}

// One-shot flash message passed between pages (e.g. create form -> list).
// Purely a frontend nicety; unrelated to the future GraphQL layer.
let flash: string | null = null;

export function setFlash(message: string): void {
  flash = message;
}

export function takeFlash(): string | null {
  const message = flash;
  flash = null;
  return message;
}
