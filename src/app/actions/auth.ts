"use server";

import { redirect } from "next/navigation";
import { db, isUniqueViolation } from "@/lib/db";
import { formValues, invalidFormState, readField } from "@/lib/form-data";
import { GENERIC_ERROR_MESSAGE, type FormState } from "@/lib/form-state";
import { logServerError } from "@/lib/logger";
import { hashPassword, spendLoginTimeOnUnknownEmail, verifyPassword } from "@/lib/password";
import { createSession, deleteSession } from "@/lib/session";
import { loginSchema, registerSchema } from "@/lib/validation";

const INVALID_LOGIN_MESSAGE = "Invalid email or password.";
const DUPLICATE_EMAIL_MESSAGE = "An account with this email already exists.";

export async function register(_previousState: FormState, formData: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse({
    firstName: readField(formData, "firstName"),
    lastName: readField(formData, "lastName"),
    email: readField(formData, "email"),
    password: readField(formData, "password"),
  });
  if (!parsed.success) {
    return invalidFormState(formData, parsed.error);
  }

  const { firstName, lastName, email, password } = parsed.data;
  try {
    const passwordHash = await hashPassword(password);
    const user = await db.user.create({
      data: { firstName, lastName, email, passwordHash },
      select: { id: true },
    });
    await createSession(user.id);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        error: DUPLICATE_EMAIL_MESSAGE,
        fieldErrors: { email: DUPLICATE_EMAIL_MESSAGE },
        values: formValues(formData),
      };
    }
    logServerError("register", error);
    return { error: GENERIC_ERROR_MESSAGE, values: formValues(formData) };
  }

  redirect("/dashboard");
}

export async function login(_previousState: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: readField(formData, "email"),
    password: readField(formData, "password"),
  });
  if (!parsed.success) {
    return invalidFormState(formData, parsed.error);
  }

  const { email, password } = parsed.data;
  try {
    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, passwordHash: true },
    });

    if (!user) {
      await spendLoginTimeOnUnknownEmail(password);
      return { error: INVALID_LOGIN_MESSAGE, values: formValues(formData) };
    }
    if (!(await verifyPassword(password, user.passwordHash))) {
      return { error: INVALID_LOGIN_MESSAGE, values: formValues(formData) };
    }

    await createSession(user.id);
  } catch (error) {
    logServerError("login", error);
    return { error: GENERIC_ERROR_MESSAGE, values: formValues(formData) };
  }

  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  await deleteSession();
  redirect("/login");
}
