"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { invalidFormState, readField } from "@/lib/form-data";
import { GENERIC_ERROR_MESSAGE, type FormState } from "@/lib/form-state";
import { logServerError } from "@/lib/logger";
import { requireUser } from "@/lib/session";
import { profileSchema } from "@/lib/validation";

export async function updateProfile(_previousState: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = profileSchema.safeParse({
    firstName: readField(formData, "firstName"),
    lastName: readField(formData, "lastName"),
  });
  if (!parsed.success) {
    return invalidFormState(formData, parsed.error);
  }

  try {
    await db.user.update({
      where: { id: user.id },
      data: { firstName: parsed.data.firstName, lastName: parsed.data.lastName },
    });
  } catch (error) {
    logServerError("updateProfile", error);
    return { error: GENERIC_ERROR_MESSAGE };
  }

  revalidatePath("/", "layout");
  return { success: "Profile updated." };
}
