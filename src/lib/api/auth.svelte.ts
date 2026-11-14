// DEMO MODE authentication. This is a UI-testing mock only: it accepts any
// non-empty password for the demo accounts in $lib/mock-data, never stores or
// checks a real password anywhere, and keeps the "session" in sessionStorage
// as identity-only data (id, name, email — no credentials). The function
// signatures match the planned GraphQL mutations (login, register, logout,
// updateProfile) so real authentication can replace the bodies next week.

import { mockDemoAccounts } from "../mock-data";
import { db, delay, generateId } from "./mock-db";

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

const SESSION_KEY = "homebase-demo-session";

function restoreSession(): AuthUser | null {
  if (typeof sessionStorage === "undefined") {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as AuthUser;
    if (!parsed.id || !parsed.email) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export const auth = $state<{ user: AuthUser | null }>({ user: restoreSession() });

function syncDbUser(user: AuthUser | null): void {
  db.currentUser = user
    ? { id: user.id, firstName: user.firstName, lastName: user.lastName }
    : null;
}

// Apply the restored session (or logged-out state) to the mock store on load.
syncDbUser(auth.user);

function storeSession(user: AuthUser | null): void {
  if (typeof sessionStorage === "undefined") {
    return;
  }
  if (user) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
  } else {
    sessionStorage.removeItem(SESSION_KEY);
  }
}

function setUser(user: AuthUser | null): void {
  auth.user = user;
  syncDbUser(user);
  storeSession(user);
}

export async function login(email: string, _password: string): Promise<AuthUser> {
  await delay();
  // Demo mode: the password is ignored entirely — only the email is matched.
  const account = mockDemoAccounts.find((a) => a.email === email);
  if (!account) {
    throw new Error("No demo account uses that email. Pick one of the demo accounts listed below.");
  }
  const user: AuthUser = {
    id: account.user.id,
    firstName: account.user.firstName,
    lastName: account.user.lastName,
    email: account.email,
  };
  setUser(user);
  return user;
}

export async function register(input: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}): Promise<AuthUser> {
  await delay();
  if (mockDemoAccounts.some((a) => a.email === input.email)) {
    throw new Error("An account with that email already exists. Try logging in instead.");
  }
  // Demo mode: the password is discarded immediately and never stored.
  const user: AuthUser = {
    id: generateId("u"),
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
  };
  setUser(user);
  return user;
}

export async function logout(): Promise<void> {
  await delay(250);
  setUser(null);
}

export async function updateProfile(firstName: string, lastName: string): Promise<AuthUser> {
  await delay();
  if (!auth.user) {
    throw new Error("You need to be signed in to update your profile.");
  }
  const user: AuthUser = { ...auth.user, firstName, lastName };
  setUser(user);
  // Keep the household member record in step so every page shows the new name.
  const member = db.household?.members.find((m) => m.id === user.id);
  if (member) {
    member.firstName = firstName;
    member.lastName = lastName;
  }
  return user;
}
