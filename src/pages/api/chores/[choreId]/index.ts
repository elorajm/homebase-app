import type { APIRoute } from "astro";
import { choreFormSchema, choreIdSchema } from "@/lib/validation";
import { errorResponse, jsonResponse, readJsonBody, validationErrorResponse } from "@/lib/server/api";
import {
  choreErrorResponse,
  deleteChore,
  getChoreDetail,
  requireViewer,
  updateChore,
} from "@/lib/server/chores";

export const prerender = false;

const NOT_FOUND = "That chore could not be found.";

// Malformed ids get the same answer as unknown ones, so the response reveals nothing about which ids exist.
function parseChoreId(value: string | undefined): string | null {
  const parsed = choreIdSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export const GET: APIRoute = async ({ params, cookies }) => {
  try {
    const auth = await requireViewer(cookies);
    if (!auth.ok) {
      return auth.response;
    }

    const choreId = parseChoreId(params.choreId);
    if (!choreId) {
      return errorResponse(404, NOT_FOUND);
    }
    return jsonResponse({ data: await getChoreDetail(auth.viewer, choreId) });
  } catch (error) {
    return choreErrorResponse(error, "chores.get");
  }
};

export const PATCH: APIRoute = async ({ params, request, cookies }) => {
  try {
    const auth = await requireViewer(cookies);
    if (!auth.ok) {
      return auth.response;
    }

    const choreId = parseChoreId(params.choreId);
    if (!choreId) {
      return errorResponse(404, NOT_FOUND);
    }

    const body = await readJsonBody(request);
    if (!body.ok) {
      return body.response;
    }

    const parsed = choreFormSchema.strict().safeParse(body.value);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const chore = await updateChore(auth.viewer, choreId, parsed.data);
    return jsonResponse({ data: { chore } });
  } catch (error) {
    return choreErrorResponse(error, "chores.update");
  }
};

export const DELETE: APIRoute = async ({ params, cookies }) => {
  try {
    const auth = await requireViewer(cookies);
    if (!auth.ok) {
      return auth.response;
    }

    const choreId = parseChoreId(params.choreId);
    if (!choreId) {
      return errorResponse(404, NOT_FOUND);
    }
    await deleteChore(auth.viewer, choreId);
    return jsonResponse({ data: { deleted: true } });
  } catch (error) {
    return choreErrorResponse(error, "chores.delete");
  }
};
