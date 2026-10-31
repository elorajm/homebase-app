import type { FieldErrors } from "@/lib/field-errors";
import { GENERIC_ERROR_MESSAGE } from "@/lib/messages";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; fieldErrors: FieldErrors };

type ApiPayload<T> = { data?: T; error?: string; fieldErrors?: FieldErrors };

export type JsonMethod = "GET" | "POST" | "PATCH" | "DELETE";

// DELETE and GET have no body. Cross-site forms cannot send DELETE, and cross-site fetch needs a CORS preflight, so this is safe.
export async function sendJson<T>(method: JsonMethod, url: string, body?: unknown): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      method,
      credentials: "same-origin",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => null)) as ApiPayload<T> | null;

    if (response.ok && payload?.data !== undefined) {
      return { ok: true, data: payload.data };
    }
    return {
      ok: false,
      error: payload?.error ?? GENERIC_ERROR_MESSAGE,
      fieldErrors: payload?.fieldErrors ?? {},
    };
  } catch {
    return { ok: false, error: GENERIC_ERROR_MESSAGE, fieldErrors: {} };
  }
}

export function postJson<T>(url: string, body: unknown): Promise<ApiResult<T>> {
  return sendJson<T>("POST", url, body);
}
