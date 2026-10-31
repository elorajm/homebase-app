import { useEffect } from "react";
import { useStore } from "@nanostores/react";
import { dueLabel, summarizeChores } from "@/lib/chores";
import { $chores, loadChores } from "@/stores/chores";

export function ChoreSummary() {
  const state = useStore($chores);

  useEffect(() => {
    void loadChores();
  }, []);

  if (state.status === "loading") {
    return (
      <p className="muted" role="status">
        Loading chores…
      </p>
    );
  }
  if (state.status === "signedOut") {
    return null;
  }
  if (state.status === "noHousehold") {
    return (
      <>
        <p>Join or create a household to see chores.</p>
      </>
    );
  }
  if (state.status === "unavailable") {
    return (
      <p role="alert" className="message message--error">
        We could not load chores.
      </p>
    );
  }

  const summary = summarizeChores(state.chores);

  return (
    <>
      <p>
        <strong>{summary.open}</strong> open · <strong>{summary.overdue}</strong> overdue
      </p>
      {summary.next.length === 0 ? (
        <p className="muted">No open chores.</p>
      ) : (
        <ul className="chore-list">
          {summary.next.map((chore) => (
            <li key={chore.id} className="chore-item">
              <p className="chore-item__title">{chore.title}</p>
              <p className="chore-item__meta">
                Assigned to {chore.assignee.firstName} {chore.assignee.lastName} · due {dueLabel(chore.dueDate)}
                {chore.overdue ? " · overdue" : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
      <a className="btn btn--secondary" href="/chores">
        View all chores
      </a>
    </>
  );
}
