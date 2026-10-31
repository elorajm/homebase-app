import { useEffect } from "react";
import { useStore } from "@nanostores/react";
import { roleLabel } from "@/lib/household-details";
import { $household, loadHousehold } from "@/stores/household";

export function DashboardSummary() {
  const state = useStore($household);

  useEffect(() => {
    void loadHousehold();
  }, []);

  if (state.status === "loading") {
    return (
      <p className="muted" role="status">
        Loading your household…
      </p>
    );
  }
  if (state.status === "signedOut") {
    return null;
  }
  if (state.status === "unavailable") {
    return (
      <p role="alert" className="message message--error">
        We could not load your household.
      </p>
    );
  }
  if (state.status === "none") {
    return (
      <>
        <p>You are not in a household yet.</p>
        <a className="btn btn--primary" href="/household">
          Create or join a household
        </a>
      </>
    );
  }

  const { household } = state;
  return (
    <>
      <p>
        <strong>{household.name}</strong>
      </p>
      <p className="muted">
        Your role: {roleLabel(household.myRole)} · {household.members.length} member
        {household.members.length === 1 ? "" : "s"}
      </p>
      <a className="btn btn--secondary" href="/household">
        Open household
      </a>
    </>
  );
}
