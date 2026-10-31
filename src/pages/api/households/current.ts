import type { APIRoute } from "astro";
import { jsonResponse, requireUser } from "@/lib/server/api";
import { getHouseholdForUser, householdErrorResponse } from "@/lib/server/household";

export const prerender = false;

// Returns null for a signed-in user who has no household. The invite code is only included for owners and adults.
export const GET: APIRoute = async ({ cookies }) => {
  try {
    const auth = await requireUser(cookies);
    if (!auth.ok) {
      return auth.response;
    }

    const household = await getHouseholdForUser(auth.user.id);
    return jsonResponse({ data: { household } });
  } catch (error) {
    return householdErrorResponse(error, "household.current");
  }
};
