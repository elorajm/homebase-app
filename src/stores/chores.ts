import { atom } from "nanostores";
import type { ChoresPayload } from "@/lib/chores";

export type ChoresState =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "noHousehold" }
  // The chores could not be loaded (network error or server failure).
  | { status: "unavailable" }
  | ({ status: "ready" } & ChoresPayload);

// One store for the chore views on a page, so the page makes one /api/chores request.
export const $chores = atom<ChoresState>({ status: "loading" });

let inFlight: Promise<ChoresState> | null = null;

export function loadChores(): Promise<ChoresState> {
  inFlight ??= fetchChores()
    .then((state) => {
      $chores.set(state);
      return state;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

async function fetchChores(): Promise<ChoresState> {
  try {
    const response = await fetch("/api/chores", { credentials: "same-origin", cache: "no-store" });
    if (response.status === 401) {
      return { status: "signedOut" };
    }
    if (response.status === 403) {
      return { status: "noHousehold" };
    }
    if (!response.ok) {
      return { status: "unavailable" };
    }
    const payload = (await response.json()) as { data: ChoresPayload };
    return { status: "ready", ...payload.data };
  } catch {
    return { status: "unavailable" };
  }
}
