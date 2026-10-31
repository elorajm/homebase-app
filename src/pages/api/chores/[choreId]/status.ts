import type { APIRoute } from "astro";
import { choreIdSchema, choreStatusInputSchema } from "@/lib/validation";
import { errorResponse, jsonResponse, readJsonBody, validationErrorResponse } from "@/lib/server/api";
import { choreErrorResponse, requireViewer, setChoreStatus } from "@/lib/server/chores";

export const prerender = false;

export const PATCH: APIRoute = async ({ params, request, cookies }) => {
  try {
    const auth = await requireViewer(cookies);
    if (!auth.ok) {
      return auth.response;
    }

    const choreId = choreIdSchema.safeParse(params.choreId);
    if (!choreId.success) {
      return errorResponse(404, "That chore could not be found.");
    }

    const body = await readJsonBody(request);
    if (!body.ok) {
      return body.response;
    }

    const parsed = choreStatusInputSchema.strict().safeParse(body.value);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const chore = await setChoreStatus(auth.viewer, choreId.data, parsed.data.status);
    return jsonResponse({ data: { chore } });
  } catch (error) {
    return choreErrorResponse(error, "chores.status");
  }
};
