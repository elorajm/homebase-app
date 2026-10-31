import { atom } from "nanostores";
import { postJson } from "@/islands/api-client";

export type SessionUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

export type SessionState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "authenticated"; user: SessionUser }
  // The session could not be checked (network error or server failure). Guards do not redirect in this state.
  | { status: "unavailable" };

// One store shared by every island on the page, so each page makes a single /api/auth/me request.
export const $session = atom<SessionState>({ status: "loading" });

let inFlight: Promise<SessionState> | null = null;

export function loadSession(): Promise<SessionState> {
  inFlight ??= fetchSession()
    .then((state) => {
      $session.set(state);
      return state;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

async function fetchSession(): Promise<SessionState> {
  try {
    const response = await fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" });
    if (response.status === 401) {
      return { status: "anonymous" };
    }
    if (!response.ok) {
      return { status: "unavailable" };
    }
    const payload = (await response.json()) as { data: { user: SessionUser } };
    return { status: "authenticated", user: payload.data.user };
  } catch {
    return { status: "unavailable" };
  }
}

export async function logout() {
  const result = await postJson<{ loggedOut: boolean }>("/api/auth/logout", {});
  if (result.ok) {
    $session.set({ status: "anonymous" });
  }
  return result;
}
