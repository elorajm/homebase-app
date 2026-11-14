// Shared in-memory working copy of the mock data. Every $lib/api module reads
// and mutates this one store so the dashboard and household pages stay
// consistent while the app is open. Nothing persists: a full page reload
// resets to $lib/mock-data. The real GraphQL backend replaces this file.

import { mockActivity, mockChores, mockCurrentUserId, mockHousehold } from "../mock-data";
import type { ActivityEvent, ActivityType, Chore, Household, Member } from "../shared/types";

/**
 * Demo scenarios for reviewing state designs without a backend:
 * visit a page with ?demo=empty, ?demo=error, or ?demo=loading.
 */
export type DemoScenario = "empty" | "error" | "loading" | null;

export interface MockDb {
  /**
   * The signed-in user (identity only — never a credential). Set by the
   * mock auth layer; null when logged out.
   */
  currentUser: { id: string; firstName: string; lastName: string } | null;
  household: Household | null;
  chores: Chore[];
  activity: ActivityEvent[];
}

const defaultUser = mockHousehold.members.find((m) => m.id === mockCurrentUserId)!;

export const db: MockDb = {
  currentUser: { id: defaultUser.id, firstName: defaultUser.firstName, lastName: defaultUser.lastName },
  household: {
    ...mockHousehold,
    members: mockHousehold.members.map((member) => ({ ...member })),
  },
  chores: mockChores.map((chore) => ({ ...chore })),
  activity: [...mockActivity],
};

export const MOCK_LATENCY_MS = 600;

export function delay(ms: number = MOCK_LATENCY_MS): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let nextId = 1;

export function generateId(prefix: string): string {
  return `${prefix}-local-${nextId++}`;
}

export function recordActivity(type: ActivityType, actorName: string, subject: string): void {
  db.activity = [
    { id: generateId("a"), type, actorName, subject, occurredAt: new Date().toISOString() },
    ...db.activity,
  ];
}

/** The signed-in user's member record, or null when they have no household. */
export function currentMember(): Member | null {
  const user = db.currentUser;
  if (!user) {
    return null;
  }
  return db.household?.members.find((m) => m.id === user.id) ?? null;
}
