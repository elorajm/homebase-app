import type { APIRoute } from "astro";
import { logServerError } from "@/lib/logger";
import { GENERIC_ERROR_MESSAGE } from "@/lib/messages";
import { errorResponse, jsonResponse, requireUser } from "@/lib/server/api";
import { db } from "@/lib/server/db";

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
  try {
    const auth = await requireUser(cookies);
    if (!auth.ok) {
      return auth.response;
    }

    const membership = await db.householdMember.findUnique({
      where: { userId: auth.user.id },
      select: { role: true, household: { select: { id: true, name: true } } },
    });

    return jsonResponse({
      data: {
        user: auth.user,
        membership: membership ? { role: membership.role, household: membership.household } : null,
      },
    });
  } catch (error) {
    logServerError("me", error);
    return errorResponse(500, GENERIC_ERROR_MESSAGE);
  }
};
