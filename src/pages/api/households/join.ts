import type { APIRoute } from "astro";
import { jsonResponse, readJsonBody, requireUser, validationErrorResponse } from "@/lib/server/api";
import { householdErrorResponse, joinHousehold } from "@/lib/server/household";
import { joinHouseholdSchema } from "@/lib/validation";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const auth = await requireUser(cookies);
    if (!auth.ok) {
      return auth.response;
    }

    const body = await readJsonBody(request);
    if (!body.ok) {
      return body.response;
    }

    const parsed = joinHouseholdSchema.strict().safeParse(body.value);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const household = await joinHousehold(auth.user.id, parsed.data.inviteCode);
    return jsonResponse({ data: { household } });
  } catch (error) {
    return householdErrorResponse(error, "household.join");
  }
};
