// Domain types shared by the frontend. Shapes mirror the planned GraphQL
// schema (docs/plans/BAKEOFF-3-implementation-plan.md) so the mock API layer
// can be swapped for real queries without touching components.

export type Role = "owner" | "adult" | "member";

export interface Member {
  id: string;
  firstName: string;
  lastName: string;
  role: Role;
}

export interface Household {
  id: string;
  name: string;
  /** 8-character code; the API will only return it to owners and adults. */
  inviteCode: string;
  members: Member[];
}

export type ChoreStatus = "pending" | "completed";

export interface Chore {
  id: string;
  title: string;
  description: string;
  /** ISO date (YYYY-MM-DD) */
  dueDate: string;
  status: ChoreStatus;
  assignee: Member;
  /** ISO timestamp, present when status is "completed" */
  completedAt?: string;
}

export type ActivityType =
  | "chore_completed"
  | "chore_created"
  | "chore_reopened"
  | "chore_deleted"
  | "member_joined"
  | "member_removed"
  | "household_created"
  | "household_renamed";

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  /** Display name of the person who performed the action */
  actorName: string;
  /** What the action applied to, e.g. a chore title or member name */
  subject: string;
  /** ISO timestamp */
  occurredAt: string;
}
