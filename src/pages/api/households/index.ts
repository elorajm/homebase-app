import type { APIRoute } from "astro";
import { jsonResponse, readJsonBody, requireUser, validationErrorResponse } from "@/lib/server/api";
import { createHousehold, householdErrorResponse } from "@/lib/server/household";
import { householdNameSchema } from "@/lib/validation";

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

    const parsed = householdNameSchema.strict().safeParse(body.value);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const household = await createHousehold(auth.user.id, parsed.data.name);
    return jsonResponse({ data: { household } }, 201);
  } catch (error) {
    return householdErrorResponse(error, "household.create");
  }
};
