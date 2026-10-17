"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, isUniqueViolation } from "@/lib/db";
import { invalidFormState, readField } from "@/lib/form-data";
import { GENERIC_ERROR_MESSAGE, NOT_ALLOWED_MESSAGE, type FormState } from "@/lib/form-state";
import { generateInviteCode } from "@/lib/invite-code";
import { logServerError } from "@/lib/logger";
import { getMembershipForUser, requireMembership } from "@/lib/household";
import { canManageHousehold, canModifyMember } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import {
  householdNameSchema,
  joinHouseholdSchema,
  memberRemovalSchema,
  memberRoleSchema,
} from "@/lib/validation";

const ALREADY_IN_HOUSEHOLD_MESSAGE = "You already belong to a household.";
const MEMBER_NOT_FOUND_MESSAGE = "That member could not be found.";

export async function createHousehold(_previousState: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (await getMembershipForUser(user.id)) {
    return { error: ALREADY_IN_HOUSEHOLD_MESSAGE };
  }

  const parsed = householdNameSchema.safeParse({ name: readField(formData, "name") });
  if (!parsed.success) {
    return invalidFormState(formData, parsed.error);
  }

  try {
    await db.$transaction(async (tx) => {
      const household = await tx.household.create({
        data: { name: parsed.data.name, inviteCode: generateInviteCode(), ownerId: user.id },
        select: { id: true },
      });
      await tx.householdMember.create({
        data: { householdId: household.id, userId: user.id, role: "owner" },
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { error: ALREADY_IN_HOUSEHOLD_MESSAGE };
    }
    logServerError("createHousehold", error);
    return { error: GENERIC_ERROR_MESSAGE, values: { name: parsed.data.name } };
  }

  revalidatePath("/", "layout");
  redirect("/household");
}

export async function joinHousehold(_previousState: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (await getMembershipForUser(user.id)) {
    return { error: ALREADY_IN_HOUSEHOLD_MESSAGE };
  }

  const parsed = joinHouseholdSchema.safeParse({ inviteCode: readField(formData, "inviteCode") });
  if (!parsed.success) {
    return invalidFormState(formData, parsed.error);
  }

  try {
    const household = await db.household.findUnique({
      where: { inviteCode: parsed.data.inviteCode },
      select: { id: true },
    });
    if (!household) {
      return {
        error: "No household matches that invite code.",
        fieldErrors: { inviteCode: "Check the code and try again." },
        values: { inviteCode: parsed.data.inviteCode },
      };
    }

    await db.householdMember.create({
      data: { householdId: household.id, userId: user.id, role: "member" },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { error: ALREADY_IN_HOUSEHOLD_MESSAGE };
    }
    logServerError("joinHousehold", error);
    return { error: GENERIC_ERROR_MESSAGE };
  }

  revalidatePath("/", "layout");
  redirect("/household");
}

export async function renameHousehold(_previousState: FormState, formData: FormData): Promise<FormState> {
  const { membership } = await requireMembership();
  if (!canManageHousehold(membership.role)) {
    return { error: NOT_ALLOWED_MESSAGE };
  }

  const parsed = householdNameSchema.safeParse({ name: readField(formData, "name") });
  if (!parsed.success) {
    return invalidFormState(formData, parsed.error);
  }

  try {
    await db.household.update({
      where: { id: membership.household.id },
      data: { name: parsed.data.name },
    });
  } catch (error) {
    logServerError("renameHousehold", error);
    return { error: GENERIC_ERROR_MESSAGE };
  }

  revalidatePath("/", "layout");
  return { success: "Household name updated." };
}

export async function changeMemberRole(_previousState: FormState, formData: FormData): Promise<FormState> {
  const { membership } = await requireMembership();
  if (!canManageHousehold(membership.role)) {
    return { error: NOT_ALLOWED_MESSAGE };
  }

  const parsed = memberRoleSchema.safeParse({
    memberId: readField(formData, "memberId"),
    role: readField(formData, "role"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR_MESSAGE };
  }

  try {
    const target = await db.householdMember.findFirst({
      where: { id: parsed.data.memberId, householdId: membership.household.id },
      select: { id: true, role: true },
    });
    if (!target) {
      return { error: MEMBER_NOT_FOUND_MESSAGE };
    }
    if (!canModifyMember(membership.role, target.role)) {
      return { error: "The owner's role cannot be changed." };
    }

    await db.householdMember.update({
      where: { id: target.id },
      data: { role: parsed.data.role },
    });
  } catch (error) {
    logServerError("changeMemberRole", error);
    return { error: GENERIC_ERROR_MESSAGE };
  }

  revalidatePath("/household");
  return { success: "Role updated." };
}

export async function removeMember(_previousState: FormState, formData: FormData): Promise<FormState> {
  const { user, membership } = await requireMembership();
  if (!canManageHousehold(membership.role)) {
    return { error: NOT_ALLOWED_MESSAGE };
  }

  const parsed = memberRemovalSchema.safeParse({ memberId: readField(formData, "memberId") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? MEMBER_NOT_FOUND_MESSAGE };
  }

  const householdId = membership.household.id;
  try {
    const target = await db.householdMember.findFirst({
      where: { id: parsed.data.memberId, householdId },
      select: { id: true, userId: true, role: true },
    });
    if (!target) {
      return { error: MEMBER_NOT_FOUND_MESSAGE };
    }
    if (!canModifyMember(membership.role, target.role)) {
      return { error: "The owner cannot be removed from the household." };
    }

    await db.$transaction(async (tx) => {
      await tx.chore.updateMany({
        where: { householdId, assignedUserId: target.userId },
        data: { assignedUserId: user.id },
      });
      await tx.householdMember.delete({ where: { id: target.id } });
    });
  } catch (error) {
    logServerError("removeMember", error);
    return { error: GENERIC_ERROR_MESSAGE };
  }

  revalidatePath("/household");
  revalidatePath("/chores");
  revalidatePath("/dashboard");
  return {};
}
