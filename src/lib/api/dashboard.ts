// Frontend data layer for the dashboard. Today it serves mock data from the
// shared in-memory store in ./mock-db behind the same async signatures the
// real GraphQL client will have, so next week only these function bodies
// change.

import { mockHousehold } from "../mock-data";
import type { ActivityEvent, Chore, Household, Member } from "../shared/types";
import { currentMember, db, delay, type DemoScenario } from "./mock-db";

export type { DemoScenario };

export interface DashboardData {
  /** The signed-in user's member record; null when they have no household. */
  currentMember: Member | null;
  household: Household;
  chores: Chore[];
  activity: ActivityEvent[];
}

export async function loadDashboard(scenario: DemoScenario = null): Promise<DashboardData> {
  await delay();
  if (scenario === "loading") {
    // Never resolves; keeps the skeleton visible for design review.
    return new Promise(() => {});
  }
  if (scenario === "error") {
    throw new Error("We could not load your dashboard. Check your connection and try again.");
  }
  if (scenario === "empty") {
    return {
      currentMember: null,
      household: { ...mockHousehold, name: "New Household", members: [] },
      chores: [],
      activity: [],
    };
  }
  const member = currentMember();
  // No household membership yet: the API will return nothing household-scoped.
  if (!member || !db.household) {
    return {
      currentMember: null,
      household: { id: "", name: "Your household", inviteCode: "", members: [] },
      chores: [],
      activity: [],
    };
  }
  const household = db.household;
  return {
    currentMember: { ...member },
    household: { ...household, members: household.members.map((m) => ({ ...m })) },
    chores: db.chores.map((chore) => ({ ...chore })),
    activity: [...db.activity],
  };
}
