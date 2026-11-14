// Mock data for frontend development. This is the ONLY place mock data lives;
// components receive it through the API layer in $lib/api. Delete this file
// once the GraphQL backend is connected.

import { todayUtc, toIsoDate } from "./shared/dates";
import type { ActivityEvent, Chore, Household, Member } from "./shared/types";

/** ISO date `offset` days from today (negative = past). */
function dateFromToday(offset: number): string {
  const date = todayUtc();
  date.setUTCDate(date.getUTCDate() + offset);
  return toIsoDate(date);
}

/** ISO timestamp `hoursAgo` hours in the past. */
function timestampHoursAgo(hoursAgo: number): string {
  return new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
}

const avery: Member = { id: "m-1", firstName: "Avery", lastName: "Castillo", role: "owner" };
const jordan: Member = { id: "m-2", firstName: "Jordan", lastName: "Castillo", role: "adult" };
const sam: Member = { id: "m-3", firstName: "Sam", lastName: "Castillo", role: "member" };
const riley: Member = { id: "m-4", firstName: "Riley", lastName: "Okafor", role: "member" };

/** The signed-in user until real authentication lands (owner view by default). */
export const mockCurrentUserId = avery.id;

/**
 * A user with no household yet, used by the ?demo=empty flows: creating a
 * household makes them its owner; joining adds them as a plain member.
 */
export const mockGuestUser: Member = {
  id: "m-9",
  firstName: "Taylor",
  lastName: "Brooks",
  role: "member",
};

export const mockHousehold: Household = {
  id: "h-1",
  name: "Castillo Family",
  inviteCode: "HB7K2MQ4",
  members: [avery, jordan, sam, riley],
};

export const mockChores: Chore[] = [
  {
    id: "c-1",
    title: "Take out recycling",
    description: "Blue bin to the curb before 7am pickup.",
    dueDate: dateFromToday(-2),
    status: "pending",
    assignee: sam,
  },
  {
    id: "c-2",
    title: "Clean litter box",
    description: "",
    dueDate: dateFromToday(-1),
    status: "pending",
    assignee: riley,
  },
  {
    id: "c-3",
    title: "Unload dishwasher",
    description: "Morning routine before school.",
    dueDate: dateFromToday(0),
    status: "pending",
    assignee: sam,
  },
  {
    id: "c-4",
    title: "Water the plants",
    description: "Living room, kitchen herbs, and the porch ferns.",
    dueDate: dateFromToday(0),
    status: "pending",
    assignee: jordan,
  },
  {
    id: "c-5",
    title: "Wipe kitchen counters",
    description: "",
    dueDate: dateFromToday(0),
    status: "completed",
    assignee: avery,
    completedAt: timestampHoursAgo(3),
  },
  {
    id: "c-6",
    title: "Vacuum living room",
    description: "Move the couch cushions and get under the rug edges.",
    dueDate: dateFromToday(1),
    status: "pending",
    assignee: avery,
  },
  {
    id: "c-7",
    title: "Mow the lawn",
    description: "Front and back; bag the clippings for yard waste day.",
    dueDate: dateFromToday(2),
    status: "pending",
    assignee: jordan,
  },
  {
    id: "c-8",
    title: "Grocery run",
    description: "Staples list on the fridge plus taco night ingredients.",
    dueDate: dateFromToday(3),
    status: "pending",
    assignee: avery,
  },
  {
    id: "c-9",
    title: "Change HVAC filter",
    description: "Filters are in the hall closet, size 16x25x1.",
    dueDate: dateFromToday(6),
    status: "pending",
    assignee: jordan,
  },
  {
    id: "c-10",
    title: "Fold laundry",
    description: "",
    dueDate: dateFromToday(-1),
    status: "completed",
    assignee: riley,
    completedAt: timestampHoursAgo(26),
  },
  {
    id: "c-11",
    title: "Scrub bathroom sink",
    description: "",
    dueDate: dateFromToday(-3),
    status: "completed",
    assignee: sam,
    completedAt: timestampHoursAgo(49),
  },
];

export const mockActivity: ActivityEvent[] = [
  {
    id: "a-1",
    type: "chore_completed",
    actorName: "Avery",
    subject: "Wipe kitchen counters",
    occurredAt: timestampHoursAgo(3),
  },
  {
    id: "a-2",
    type: "chore_created",
    actorName: "Jordan",
    subject: "Change HVAC filter",
    occurredAt: timestampHoursAgo(8),
  },
  {
    id: "a-3",
    type: "chore_completed",
    actorName: "Riley",
    subject: "Fold laundry",
    occurredAt: timestampHoursAgo(26),
  },
  {
    id: "a-4",
    type: "member_joined",
    actorName: "Riley",
    subject: "Castillo Family",
    occurredAt: timestampHoursAgo(30),
  },
  {
    id: "a-5",
    type: "chore_reopened",
    actorName: "Avery",
    subject: "Clean litter box",
    occurredAt: timestampHoursAgo(45),
  },
  {
    id: "a-6",
    type: "chore_completed",
    actorName: "Sam",
    subject: "Scrub bathroom sink",
    occurredAt: timestampHoursAgo(49),
  },
];
