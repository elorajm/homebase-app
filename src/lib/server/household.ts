import { generateInviteCode } from "@/lib/invite-code";
import { logServerError } from "@/lib/logger";
import { ALREADY_IN_HOUSEHOLD_MESSAGE, GENERIC_ERROR_MESSAGE, NO_HOUSEHOLD_FOR_CODE_MESSAGE } from "@/lib/messages";
import { toHouseholdDetails, type HouseholdDetails, type HouseholdRecord } from "@/lib/household-details";
import { errorResponse } from "@/lib/server/api";
import { db, isUniqueViolation } from "@/lib/server/db";

const MAX_INVITE_CODE_ATTEMPTS = 5;
const CHECK_CODE_MESSAGE = "Check the code and try again.";

// A business-rule failure with the HTTP status and field errors the endpoint should return.
export class HouseholdError extends Error {
  readonly status: 404 | 409;
  readonly fieldErrors?: Record<string, string>;

  constructor(status: 404 | 409, message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = "HouseholdError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

// Every household read and write uses this shape, so the members list and invite code are built the same way.
const householdSelect = {
  id: true,
  name: true,
  inviteCode: true,
  members: {
    orderBy: { joinedAt: "asc" as const },
    select: {
      userId: true,
      role: true,
      user: { select: { firstName: true, lastName: true } },
    },
  },
} as const;

function detailsFor(record: HouseholdRecord, viewerId: string): HouseholdDetails {
  const details = toHouseholdDetails(record, viewerId);
  if (!details) {
    throw new Error("Viewer is missing from a household they just joined or created.");
  }
  return details;
}

// Membership is unique per user (HouseholdMember.userId), so a user has at most one household.
// The check runs inside the transaction; a concurrent insert that slips past it is caught by the unique index.
async function assertNoMembership(userId: string): Promise<void> {
  const existing = await db.householdMember.findUnique({ where: { userId }, select: { id: true } });
  if (existing) {
    throw new HouseholdError(409, ALREADY_IN_HOUSEHOLD_MESSAGE);
  }
}

export async function createHousehold(ownerId: string, name: string): Promise<HouseholdDetails> {
  for (let attempt = 0; attempt < MAX_INVITE_CODE_ATTEMPTS; attempt += 1) {
    try {
      const record = await db.$transaction(async (tx) => {
        await assertNoMembership(ownerId);
        return tx.household.create({
          data: {
            name,
            inviteCode: generateInviteCode(),
            ownerId,
            members: { create: { userId: ownerId, role: "owner" } },
          },
          select: householdSelect,
        });
      });
      return detailsFor(record, ownerId);
    } catch (error) {
      if (error instanceof HouseholdError || !isUniqueViolation(error)) {
        throw error;
      }
      // A unique conflict is either a concurrent membership (report it) or an invite-code collision (try again).
      await assertNoMembership(ownerId);
    }
  }
  throw new Error("Could not generate a unique invite code.");
}

export async function joinHousehold(userId: string, inviteCode: string): Promise<HouseholdDetails> {
  try {
    const record = await db.$transaction(async (tx) => {
      const match = await tx.household.findUnique({ where: { inviteCode }, select: { id: true } });
      if (!match) {
        throw new HouseholdError(404, NO_HOUSEHOLD_FOR_CODE_MESSAGE, { inviteCode: CHECK_CODE_MESSAGE });
      }

      await assertNoMembership(userId);
      await tx.householdMember.create({
        data: { householdId: match.id, userId, role: "member" },
      });
      return tx.household.findUniqueOrThrow({ where: { id: match.id }, select: householdSelect });
    });
    return detailsFor(record, userId);
  } catch (error) {
    // Two joins by the same user can both pass the check. The second insert hits the unique index.
    if (!(error instanceof HouseholdError) && isUniqueViolation(error)) {
      throw new HouseholdError(409, ALREADY_IN_HOUSEHOLD_MESSAGE);
    }
    throw error;
  }
}

export async function getHouseholdForUser(userId: string): Promise<HouseholdDetails | null> {
  const membership = await db.householdMember.findUnique({
    where: { userId },
    select: { household: { select: householdSelect } },
  });
  return membership ? toHouseholdDetails(membership.household, userId) : null;
}

// Converts failures into JSON responses. Unknown errors are logged without details and returned as a generic 500.
export function householdErrorResponse(error: unknown, operation: string): Response {
  if (error instanceof HouseholdError) {
    return errorResponse(error.status, error.message, error.fieldErrors);
  }
  logServerError(operation, error);
  return errorResponse(500, GENERIC_ERROR_MESSAGE);
}
