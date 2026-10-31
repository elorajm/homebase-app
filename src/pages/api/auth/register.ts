import type { APIRoute } from "astro";
import { logServerError } from "@/lib/logger";
import { DUPLICATE_EMAIL_MESSAGE, GENERIC_ERROR_MESSAGE } from "@/lib/messages";
import { hashPassword } from "@/lib/password";
import { errorResponse, jsonResponse, readJsonBody, validationErrorResponse } from "@/lib/server/api";
import { db, isUniqueViolation } from "@/lib/server/db";
import { createSession, sessionUserSelect, toSessionUser } from "@/lib/server/session";
import { registerSchema } from "@/lib/validation";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  const body = await readJsonBody(request);
  if (!body.ok) {
    return body.response;
  }

  // strict() rejects unexpected fields, so a client cannot set server-controlled values such as a role.
  const parsed = registerSchema.strict().safeParse(body.value);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }

  const { firstName, lastName, email, password } = parsed.data;
  try {
    const passwordHash = await hashPassword(password);
    const user = await db.user.create({
      data: { firstName, lastName, email, passwordHash },
      select: sessionUserSelect,
    });
    await createSession(cookies, user.id);
    return jsonResponse({ data: { user: toSessionUser(user) } }, 201);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return errorResponse(409, DUPLICATE_EMAIL_MESSAGE, { email: DUPLICATE_EMAIL_MESSAGE });
    }
    logServerError("register", error);
    return errorResponse(500, GENERIC_ERROR_MESSAGE);
  }
};
