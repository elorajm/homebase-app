import type { FieldErrors } from "@/lib/field-errors";
import { GENERIC_ERROR_MESSAGE } from "@/lib/messages";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; fieldErrors: FieldErrors };

type ApiPayload<T> = { data?: T; error?: string; fieldErrors?: FieldErrors };

export async function postJson<T>(url: string, body: unknown): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
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
