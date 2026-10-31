import type { APIRoute } from "astro";
import { logServerError } from "@/lib/logger";
import { GENERIC_ERROR_MESSAGE } from "@/lib/messages";
import { errorResponse, jsonResponse, requireJsonRequest } from "@/lib/server/api";
import { endSession } from "@/lib/server/session";

export const prerender = false;

// Logout is idempotent: a stale or missing session still gets its cookie cleared.
export const POST: APIRoute = async ({ request, cookies }) => {
  const unsupported = requireJsonRequest(request);
  if (unsupported) {
    return unsupported;
  }

  try {
    await endSession(cookies);
  } catch (error) {
    logServerError("logout", error);
    return errorResponse(500, GENERIC_ERROR_MESSAGE);
  }
  return jsonResponse({ data: { loggedOut: true } });
};
