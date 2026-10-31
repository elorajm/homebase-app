import type { z } from "zod";
import { toFieldErrors, type FieldErrors } from "@/lib/field-errors";
import {
  BODY_TOO_LARGE_MESSAGE,
  INVALID_JSON_MESSAGE,
  UNAUTHENTICATED_MESSAGE,
  UNSUPPORTED_MEDIA_MESSAGE,
  VALIDATION_ERROR_MESSAGE,
} from "@/lib/messages";
import { getCurrentUser, type Cookies, type SessionUser } from "@/lib/server/session";

export const MAX_BODY_BYTES = 16 * 1024;

// API responses carry per-user data, so they must never be cached by a browser or CDN.
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export function errorResponse(status: number, error: string, fieldErrors?: FieldErrors): Response {
  return jsonResponse(fieldErrors ? { error, fieldErrors } : { error }, status);
}

// Mutating requests must be JSON. Browsers cannot send JSON cross-site without a CORS preflight,
// so this also blocks plain cross-site form posts.
export function requireJsonRequest(request: Request): Response | null {
  const contentType = request.headers.get("content-type") ?? "";
  return contentType.toLowerCase().startsWith("application/json")
    ? null
    : errorResponse(415, UNSUPPORTED_MEDIA_MESSAGE);
}

export type JsonBodyResult = { ok: true; value: unknown } | { ok: false; response: Response };

export async function readJsonBody(request: Request): Promise<JsonBodyResult> {
  const unsupported = requireJsonRequest(request);
  if (unsupported) {
    return { ok: false, response: unsupported };
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return { ok: false, response: errorResponse(413, BODY_TOO_LARGE_MESSAGE) };
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    return { ok: false, response: errorResponse(413, BODY_TOO_LARGE_MESSAGE) };
  }

  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, response: errorResponse(400, INVALID_JSON_MESSAGE) };
  }
}

export function validationErrorResponse(error: z.ZodError): Response {
  const fieldErrors = toFieldErrors(error.issues);
  if (Object.keys(fieldErrors).length > 0) {
    return errorResponse(400, VALIDATION_ERROR_MESSAGE, fieldErrors);
  }
  return errorResponse(400, error.issues[0]?.message ?? VALIDATION_ERROR_MESSAGE);
}

export type AuthResult = { ok: true; user: SessionUser } | { ok: false; response: Response };

export async function requireUser(cookies: Cookies): Promise<AuthResult> {
  const user = await getCurrentUser(cookies);
  if (!user) {
    return { ok: false, response: errorResponse(401, UNAUTHENTICATED_MESSAGE) };
  }
  return { ok: true, user };
}
