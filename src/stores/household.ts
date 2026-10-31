import { atom } from "nanostores";
import type { HouseholdDetails } from "@/lib/household-details";

export type HouseholdState =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "none" }
  | { status: "member"; household: HouseholdDetails }
  // The household could not be loaded (network error or server failure).
  | { status: "unavailable" };

// One store for the household views on the page, so the page makes one /api/households/current request.
export const $household = atom<HouseholdState>({ status: "loading" });

let inFlight: Promise<HouseholdState> | null = null;

export function loadHousehold(): Promise<HouseholdState> {
  inFlight ??= fetchHousehold()
    .then((state) => {
      $household.set(state);
      return state;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

export function setHousehold(household: HouseholdDetails): void {
  $household.set({ status: "member", household });
}

async function fetchHousehold(): Promise<HouseholdState> {
  try {
    const response = await fetch("/api/households/current", { credentials: "same-origin", cache: "no-store" });
    if (response.status === 401) {
      return { status: "signedOut" };
    }
    if (!response.ok) {
      return { status: "unavailable" };
    }
    const payload = (await response.json()) as { data: { household: HouseholdDetails | null } };
    return payload.data.household ? { status: "member", household: payload.data.household } : { status: "none" };
  } catch {
    return { status: "unavailable" };
  }
}
