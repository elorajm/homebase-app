import { createHash, randomBytes } from "node:crypto";
import type { APIContext } from "astro";
import { db } from "@/lib/server/db";

export const SESSION_COOKIE_NAME = "homebase_session";
const SESSION_LENGTH_MS = 7 * 24 * 60 * 60 * 1000;

export type Cookies = APIContext["cookies"];

export type SessionUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

export const sessionUserSelect = { id: true, firstName: true, lastName: true, email: true } as const;

export function toSessionUser(user: SessionUser): SessionUser {
  return { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email };
}

// Only the SHA-256 hash is stored, so a database leak does not expose usable session tokens.
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function sessionCookieOptions(expires: Date, secure = process.env.NODE_ENV === "production") {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    expires,
  };
}

export async function createSession(cookies: Cookies, userId: string): Promise<void> {
  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_LENGTH_MS);

  await db.session.create({
    data: { tokenHash: hashSessionToken(token), userId, expiresAt },
  });

  cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions(expiresAt));
}

export async function getCurrentUser(cookies: Cookies): Promise<SessionUser | null> {
  const token = cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  const tokenHash = hashSessionToken(token);
  const session = await db.session.findUnique({
    where: { tokenHash },
    select: { expiresAt: true, user: { select: sessionUserSelect } },
  });

  if (!session) {
    return null;
  }
  if (session.expiresAt.getTime() <= Date.now()) {
    await db.session.deleteMany({ where: { tokenHash } });
    return null;
  }
  return toSessionUser(session.user);
}

export async function endSession(cookies: Cookies): Promise<void> {
  const token = cookies.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    await db.session.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
  }
  cookies.delete(SESSION_COOKIE_NAME, { path: "/" });
}
