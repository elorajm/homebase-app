import type { APIRoute } from "astro";
import { logServerError } from "@/lib/logger";
import { GENERIC_ERROR_MESSAGE, INVALID_LOGIN_MESSAGE } from "@/lib/messages";
import { spendLoginTimeOnUnknownEmail, verifyPassword } from "@/lib/password";
import { errorResponse, jsonResponse, readJsonBody, validationErrorResponse } from "@/lib/server/api";
import { db } from "@/lib/server/db";
import { createSession, sessionUserSelect, toSessionUser } from "@/lib/server/session";
import { loginSchema } from "@/lib/validation";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  const body = await readJsonBody(request);
  if (!body.ok) {
    return body.response;
  }

  const parsed = loginSchema.strict().safeParse(body.value);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }

  const { email, password } = parsed.data;
  try {
    const user = await db.user.findUnique({
      where: { email },
      select: { ...sessionUserSelect, passwordHash: true },
    });

    // Unknown emails and wrong passwords get the same response and similar timing, so accounts cannot be probed.
    if (!user) {
      await spendLoginTimeOnUnknownEmail(password);
      return errorResponse(401, INVALID_LOGIN_MESSAGE);
    }
    if (!(await verifyPassword(password, user.passwordHash))) {
      return errorResponse(401, INVALID_LOGIN_MESSAGE);
    }

    await createSession(cookies, user.id);
    return jsonResponse({ data: { user: toSessionUser(user) } });
  } catch (error) {
    logServerError("login", error);
    return errorResponse(500, GENERIC_ERROR_MESSAGE);
  }
};
