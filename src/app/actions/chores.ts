"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseIsoDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/household";
import { formValues, invalidFormState, readField } from "@/lib/form-data";
import { GENERIC_ERROR_MESSAGE, NOT_ALLOWED_MESSAGE, type FormState } from "@/lib/form-state";
import { logServerError } from "@/lib/logger";
import { canCompleteChore, canManageChores } from "@/lib/permissions";
import { choreSchema, choreStatusSchema } from "@/lib/validation";

const CHORE_NOT_FOUND_MESSAGE = "That chore could not be found.";
const ASSIGNEE_NOT_IN_HOUSEHOLD = "Choose a member of your household.";

async function isHouseholdMember(householdId: string, userId: string): Promise<boolean> {
  const member = await db.householdMember.findFirst({
    where: { householdId, userId },
    select: { id: true },
  });
  return member !== null;
}

export async function createChore(_previousState: FormState, formData: FormData): Promise<FormState> {
  const { user, membership } = await requireMembership();
  if (!canManageChores(membership.role)) {
    return { error: NOT_ALLOWED_MESSAGE };
  }

  const householdId = membership.household.id;
  const parsed = choreSchema.safeParse({
    title: readField(formData, "title"),
    description: readField(formData, "description"),
    assignedUserId: readField(formData, "assignedUserId"),
    dueDate: readField(formData, "dueDate"),
  });
  if (!parsed.success) {
    return invalidFormState(formData, parsed.error);
  }

  const { title, description, assignedUserId, dueDate } = parsed.data;
  try {
    if (!(await isHouseholdMember(householdId, assignedUserId))) {
      return {
        error: ASSIGNEE_NOT_IN_HOUSEHOLD,
        fieldErrors: { assignedUserId: ASSIGNEE_NOT_IN_HOUSEHOLD },
        values: formValues(formData),
      };
    }

    await db.chore.create({
      data: {
        householdId,
        title,
        description: description || null,
        assignedUserId,
        dueDate: parseIsoDate(dueDate),
        createdById: user.id,
      },
    });
  } catch (error) {
    logServerError("createChore", error);
    return { error: GENERIC_ERROR_MESSAGE, values: formValues(formData) };
  }

  revalidatePath("/chores");
  revalidatePath("/dashboard");
  redirect("/chores");
}

export async function updateChore(_previousState: FormState, formData: FormData): Promise<FormState> {
  const { membership } = await requireMembership();
  if (!canManageChores(membership.role)) {
    return { error: NOT_ALLOWED_MESSAGE };
  }

  const householdId = membership.household.id;
  const choreId = readField(formData, "choreId");
  const parsed = choreSchema.safeParse({
    title: readField(formData, "title"),
    description: readField(formData, "description"),
    assignedUserId: readField(formData, "assignedUserId"),
    dueDate: readField(formData, "dueDate"),
  });

  try {
    const chore = await db.chore.findFirst({
      where: { id: choreId, householdId },
      select: { id: true },
    });
    if (!chore) {
      return { error: CHORE_NOT_FOUND_MESSAGE };
    }
    if (!parsed.success) {
      return invalidFormState(formData, parsed.error);
    }

    const { title, description, assignedUserId, dueDate } = parsed.data;
    if (!(await isHouseholdMember(householdId, assignedUserId))) {
      return {
        error: ASSIGNEE_NOT_IN_HOUSEHOLD,
        fieldErrors: { assignedUserId: ASSIGNEE_NOT_IN_HOUSEHOLD },
        values: formValues(formData),
      };
    }

    await db.chore.update({
      where: { id: chore.id },
      data: {
        title,
        description: description || null,
        assignedUserId,
        dueDate: parseIsoDate(dueDate),
      },
    });
  } catch (error) {
    logServerError("updateChore", error);
    return { error: GENERIC_ERROR_MESSAGE };
  }

  revalidatePath("/chores");
  revalidatePath("/dashboard");
  redirect("/chores");
}

export async function deleteChore(_previousState: FormState, formData: FormData): Promise<FormState> {
  const { membership } = await requireMembership();
  if (!canManageChores(membership.role)) {
    return { error: NOT_ALLOWED_MESSAGE };
  }

  const householdId = membership.household.id;
  try {
    const result = await db.chore.deleteMany({
      where: { id: readField(formData, "choreId"), householdId },
    });
    if (result.count === 0) {
      return { error: CHORE_NOT_FOUND_MESSAGE };
    }
  } catch (error) {
    logServerError("deleteChore", error);
    return { error: GENERIC_ERROR_MESSAGE };
  }

  revalidatePath("/chores");
  revalidatePath("/dashboard");
  return {};
}

export async function setChoreStatus(_previousState: FormState, formData: FormData): Promise<FormState> {
  const { user, membership } = await requireMembership();
  const householdId = membership.household.id;

  const parsed = choreStatusSchema.safeParse({
    choreId: readField(formData, "choreId"),
    status: readField(formData, "status"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR_MESSAGE };
  }

  try {
    const chore = await db.chore.findFirst({
      where: { id: parsed.data.choreId, householdId },
      select: { id: true, assignedUserId: true },
    });
    if (!chore) {
      return { error: CHORE_NOT_FOUND_MESSAGE };
    }
    if (!canCompleteChore(membership.role, user.id, chore.assignedUserId)) {
      return { error: "You can only update chores assigned to you." };
    }

    await db.chore.update({
      where: { id: chore.id },
      data: { status: parsed.data.status },
    });
  } catch (error) {
    logServerError("setChoreStatus", error);
    return { error: GENERIC_ERROR_MESSAGE };
  }

  revalidatePath("/chores");
  revalidatePath("/dashboard");
  return {};
}
