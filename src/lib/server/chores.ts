import { parseIsoDate, todayUtc } from "@/lib/dates";
import { logServerError } from "@/lib/logger";
import { GENERIC_ERROR_MESSAGE } from "@/lib/messages";
import { toChoreView, type ChoreMember, type ChoreRecord, type ChoreStatus, type ChoreView, type ChoresPayload } from "@/lib/chores";
import { canCompleteChore, canManageChores, type HouseholdRole } from "@/lib/permissions";
import { errorResponse, requireUser } from "@/lib/server/api";
import { db } from "@/lib/server/db";
import type { Cookies } from "@/lib/server/session";

export const NO_HOUSEHOLD_MESSAGE = "Join or create a household to see chores.";
const NOT_ALLOWED_MESSAGE = "You do not have permission to do that.";
const CHORE_NOT_FOUND_MESSAGE = "That chore could not be found.";
const NOT_ASSIGNED_MESSAGE = "You can only update chores assigned to you.";
const ASSIGNEE_NOT_MEMBER_MESSAGE = "Choose a member of your household.";

export class ChoreError extends Error {
  readonly status: 400 | 403 | 404;
  readonly fieldErrors?: Record<string, string>;

  constructor(status: 400 | 403 | 404, message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = "ChoreError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export type Viewer = { userId: string; householdId: string; role: HouseholdRole };

export type ChoreFormInput = {
  title: string;
  description: string;
  dueDate: string;
  assignedUserId?: string;
};

const choreSelect = {
  id: true,
  title: true,
  description: true,
  dueDate: true,
  status: true,
  assignedUserId: true,
  assignedUser: { select: { id: true, firstName: true, lastName: true } },
} as const;

function viewerContext(viewer: Viewer) {
  return { userId: viewer.userId, role: viewer.role };
}

// Every chore query filters by the viewer's household. A chore in another household looks exactly like a missing one.
export async function resolveViewer(userId: string): Promise<Viewer | null> {
  const membership = await db.householdMember.findUnique({
    where: { userId },
    select: { householdId: true, role: true },
  });
  return membership ? { userId, householdId: membership.householdId, role: membership.role } : null;
}

async function householdMembers(householdId: string): Promise<ChoreMember[]> {
  const memberships = await db.householdMember.findMany({
    where: { householdId },
    orderBy: { joinedAt: "asc" },
    select: { user: { select: { id: true, firstName: true, lastName: true } } },
  });
  return memberships.map((membership) => membership.user);
}

async function findChoreRecord(viewer: Viewer, choreId: string): Promise<ChoreRecord> {
  const record = await db.chore.findFirst({
    where: { id: choreId, householdId: viewer.householdId },
    select: choreSelect,
  });
  if (!record) {
    throw new ChoreError(404, CHORE_NOT_FOUND_MESSAGE);
  }
  return record;
}

async function loadChoreView(viewer: Viewer, choreId: string): Promise<ChoreView> {
  return toChoreView(await findChoreRecord(viewer, choreId), viewerContext(viewer), todayUtc());
}

function requireManager(viewer: Viewer): void {
  if (!canManageChores(viewer.role)) {
    throw new ChoreError(403, NOT_ALLOWED_MESSAGE);
  }
}

// The assignee must belong to the same household. The lookup is scoped, so another household's member is rejected.
async function assertAssignable(householdId: string, userId: string): Promise<void> {
  const member = await db.householdMember.findFirst({
    where: { householdId, userId },
    select: { id: true },
  });
  if (!member) {
    throw new ChoreError(400, ASSIGNEE_NOT_MEMBER_MESSAGE, { assignedUserId: ASSIGNEE_NOT_MEMBER_MESSAGE });
  }
}

export async function listChores(viewer: Viewer): Promise<ChoresPayload> {
  const [records, members] = await Promise.all([
    db.chore.findMany({
      where: { householdId: viewer.householdId },
      select: choreSelect,
      orderBy: [{ dueDate: "asc" }, { title: "asc" }],
    }),
    householdMembers(viewer.householdId),
  ]);

  const today = todayUtc();
  return {
    chores: records.map((record) => toChoreView(record, viewerContext(viewer), today)),
    members,
    viewer: { userId: viewer.userId, canManage: canManageChores(viewer.role) },
  };
}

export async function getChoreDetail(viewer: Viewer, choreId: string) {
  const chore = await loadChoreView(viewer, choreId);
  return { chore, members: await householdMembers(viewer.householdId) };
}

export async function createChore(viewer: Viewer, input: ChoreFormInput): Promise<ChoreView> {
  requireManager(viewer);

  // Assignment is optional on create: with no assignee chosen, the creator is responsible for the chore.
  const assigneeId = input.assignedUserId ?? viewer.userId;
  await assertAssignable(viewer.householdId, assigneeId);

  const record = await db.chore.create({
    data: {
      householdId: viewer.householdId,
      title: input.title,
      description: input.description || null,
      assignedUserId: assigneeId,
      dueDate: parseIsoDate(input.dueDate),
      createdById: viewer.userId,
    },
    select: choreSelect,
  });
  return toChoreView(record, viewerContext(viewer), todayUtc());
}

export async function updateChore(viewer: Viewer, choreId: string, input: ChoreFormInput): Promise<ChoreView> {
  requireManager(viewer);

  const existing = await findChoreRecord(viewer, choreId);
  // Leaving the assignee out on edit keeps the current assignee.
  await assertAssignable(viewer.householdId, input.assignedUserId ?? existing.assignedUserId);

  const result = await db.chore.updateMany({
    where: { id: choreId, householdId: viewer.householdId },
    data: {
      title: input.title,
      description: input.description || null,
      assignedUserId: input.assignedUserId ?? existing.assignedUserId,
      dueDate: parseIsoDate(input.dueDate),
    },
  });
  if (result.count === 0) {
    throw new ChoreError(404, CHORE_NOT_FOUND_MESSAGE);
  }
  return loadChoreView(viewer, choreId);
}

export async function deleteChore(viewer: Viewer, choreId: string): Promise<void> {
  requireManager(viewer);

  const result = await db.chore.deleteMany({
    where: { id: choreId, householdId: viewer.householdId },
  });
  if (result.count === 0) {
    throw new ChoreError(404, CHORE_NOT_FOUND_MESSAGE);
  }
}

export async function setChoreStatus(viewer: Viewer, choreId: string, status: ChoreStatus): Promise<ChoreView> {
  const existing = await findChoreRecord(viewer, choreId);
  if (!canCompleteChore(viewer.role, viewer.userId, existing.assignedUserId)) {
    throw new ChoreError(403, NOT_ASSIGNED_MESSAGE);
  }

  const result = await db.chore.updateMany({
    where: { id: choreId, householdId: viewer.householdId },
    data: { status },
  });
  if (result.count === 0) {
    throw new ChoreError(404, CHORE_NOT_FOUND_MESSAGE);
  }
  return loadChoreView(viewer, choreId);
}

// Resolves the signed-in user and their household. Returns a 401 or 403 response when either is missing.
export async function requireViewer(
  cookies: Cookies,
): Promise<{ ok: true; viewer: Viewer } | { ok: false; response: Response }> {
  const auth = await requireUser(cookies);
  if (!auth.ok) {
    return { ok: false, response: auth.response };
  }
  const viewer = await resolveViewer(auth.user.id);
  if (!viewer) {
    return { ok: false, response: errorResponse(403, NO_HOUSEHOLD_MESSAGE) };
  }
  return { ok: true, viewer };
}

export function choreErrorResponse(error: unknown, operation: string): Response {
  if (error instanceof ChoreError) {
    return errorResponse(error.status, error.message, error.fieldErrors);
  }
  logServerError(operation, error);
  return errorResponse(500, GENERIC_ERROR_MESSAGE);
}
