import { useEffect, useState } from "react";
import { useStore } from "@nanostores/react";
import type { ChoreView } from "@/lib/chores";
import { dueLabel, statusLabel } from "@/lib/chores";
import { GENERIC_ERROR_MESSAGE } from "@/lib/messages";
import { sendJson } from "@/islands/api-client";
import { $chores, loadChores } from "@/stores/chores";

type Notice = { kind: "success" | "error"; text: string };

// The chore form redirects here with ?notice=created or ?notice=updated.
const FLASH_MESSAGES: Record<string, string> = {
  created: "Chore added.",
  updated: "Chore saved.",
};

export function ChoreList() {
  const state = useStore($chores);
  const [notice, setNotice] = useState<Notice>();
  const [busyId, setBusyId] = useState<string>();

  useEffect(() => {
    void loadChores();

    const flash = new URLSearchParams(window.location.search).get("notice");
    if (flash) {
      const text = FLASH_MESSAGES[flash];
      if (text) {
        setNotice({ kind: "success", text });
      }
      window.history.replaceState(null, "", "/chores");
    }
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
      <section className="card">
        <p>Join or create a household to see chores.</p>
        <a className="btn btn--primary" href="/household">
          Go to household
        </a>
      </section>
    );
  }
  if (state.status === "unavailable") {
    return (
      <p role="alert" className="message message--error">
        We could not load chores. Refresh the page to try again.
      </p>
    );
  }

  async function changeStatus(chore: ChoreView) {
    const next = chore.status === "completed" ? "pending" : "completed";
    setBusyId(chore.id);
    setNotice(undefined);
    const result = await sendJson("PATCH", `/api/chores/${chore.id}/status`, { status: next });
    setBusyId(undefined);
    if (!result.ok) {
      setNotice({ kind: "error", text: result.error });
      return;
    }
    setNotice({
      kind: "success",
      text: next === "completed" ? `Marked "${chore.title}" as complete.` : `Marked "${chore.title}" as pending.`,
    });
    await loadChores();
  }

  async function removeChore(chore: ChoreView) {
    if (!window.confirm(`Delete "${chore.title}"? This cannot be undone.`)) {
      return;
    }
    setBusyId(chore.id);
    setNotice(undefined);
    const result = await sendJson("DELETE", `/api/chores/${chore.id}`);
    setBusyId(undefined);
    if (!result.ok) {
      setNotice({ kind: "error", text: result.error || GENERIC_ERROR_MESSAGE });
      return;
    }
    setNotice({ kind: "success", text: `Deleted "${chore.title}".` });
    await loadChores();
  }

  const { chores, viewer } = state;

  return (
    <>
      {notice ? (
        <p role={notice.kind === "success" ? "status" : "alert"} className={`message message--${notice.kind}`}>
          {notice.text}
        </p>
      ) : null}

      {viewer.canManage ? (
        <p>
          <a className="btn btn--primary" href="/chores/new">
            Add chore
          </a>
        </p>
      ) : null}

      {chores.length === 0 ? (
        <div className="empty-state">
          <p>
            {viewer.canManage
              ? "No chores yet. Add the first one to get started."
              : "No chores yet. A household owner or adult can add one."}
          </p>
        </div>
      ) : (
        <ul className="chore-list">
          {chores.map((chore) => {
            const completed = chore.status === "completed";
            const busy = busyId === chore.id;
            return (
              <li key={chore.id} className="chore-item">
                <div>
                  <h2 className="chore-item__title">{chore.title}</h2>
                  <p className="chore-item__meta">
                    Assigned to {chore.assignee.firstName} {chore.assignee.lastName}
                    {chore.assignee.isCurrentUser ? " (you)" : ""}
                  </p>
                  <p className="chore-item__meta">Due {dueLabel(chore.dueDate)}</p>
                  {chore.description ? <p className="chore-item__meta">{chore.description}</p> : null}
                </div>
                <div>
                  <span className={`badge badge--${chore.status}`}>{statusLabel(chore.status)}</span>{" "}
                  {chore.overdue ? <span className="badge badge--overdue">Overdue</span> : null}
                </div>
                <div className="chore-item__actions">
                  {chore.canComplete ? (
                    <button type="button" className="btn btn--secondary" disabled={busy} onClick={() => changeStatus(chore)}>
                      {completed ? "Mark as pending" : "Mark as complete"}
                    </button>
                  ) : null}
                  {chore.canEdit ? (
                    <a className="btn btn--secondary" href={`/chores/edit?id=${encodeURIComponent(chore.id)}`}>
                      Edit
                    </a>
                  ) : null}
                  {chore.canDelete ? (
                    <button type="button" className="btn btn--danger" disabled={busy} onClick={() => removeChore(chore)}>
                      Delete
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

