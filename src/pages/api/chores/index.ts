import type { APIRoute } from "astro";
import { choreFormSchema } from "@/lib/validation";
import { jsonResponse, readJsonBody, validationErrorResponse } from "@/lib/server/api";
import { choreErrorResponse, createChore, listChores, requireViewer } from "@/lib/server/chores";

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
  try {
    const auth = await requireViewer(cookies);
    if (!auth.ok) {
      return auth.response;
    }
    return jsonResponse({ data: await listChores(auth.viewer) });
  } catch (error) {
    return choreErrorResponse(error, "chores.list");
  }
};

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const auth = await requireViewer(cookies);
    if (!auth.ok) {
      return auth.response;
    }

    const body = await readJsonBody(request);
    if (!body.ok) {
      return body.response;
    }

    const parsed = choreFormSchema.strict().safeParse(body.value);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const chore = await createChore(auth.viewer, parsed.data);
    return jsonResponse({ data: { chore } }, 201);
  } catch (error) {
    return choreErrorResponse(error, "chores.create");
  }
};
