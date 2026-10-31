import { useEffect, useState } from "react";
import { useStore } from "@nanostores/react";
import { roleLabel, type HouseholdDetails } from "@/lib/household-details";
import { CreateHouseholdForm, JoinHouseholdForm } from "@/islands/household-forms";
import { $household, loadHousehold } from "@/stores/household";

type Notice = { kind: "success" | "error"; text: string };

export function HouseholdView() {
  const state = useStore($household);
  const [notice, setNotice] = useState<Notice>();

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
        We could not load your household. Refresh the page to try again.
      </p>
    );
  }

  const noticeElement = notice ? (
    <p role={notice.kind === "success" ? "status" : "alert"} className={`message message--${notice.kind}`}>
      {notice.text}
    </p>
  ) : null;

  if (state.status === "member") {
    return (
      <>
        {noticeElement}
        <HouseholdOverview household={state.household} />
      </>
    );
  }

  return (
    <>
      {noticeElement}
      <p className="muted">You are not in a household yet. Create one or join with an invite code.</p>
      <div className="grid grid--two">
        <section className="card" aria-labelledby="create-heading">
          <h2 id="create-heading">Create a household</h2>
          <p>Start a household and share its invite code with the people you live with.</p>
          <CreateHouseholdForm
            onSuccess={(text) => setNotice({ kind: "success", text })}
            onAlreadyMember={() => setNotice({ kind: "error", text: "You already belong to a household." })}
          />
        </section>
        <section className="card" aria-labelledby="join-heading">
          <h2 id="join-heading">Join a household</h2>
          <p>Enter the invite code shared by a household owner.</p>
          <JoinHouseholdForm
            onSuccess={(text) => setNotice({ kind: "success", text })}
            onAlreadyMember={() => setNotice({ kind: "error", text: "You already belong to a household." })}
          />
        </section>
      </div>
    </>
  );
}

function HouseholdOverview({ household }: { household: HouseholdDetails }) {
  const memberCount = household.members.length;

  return (
    <>
      <div className="page-header">
        <div>
          <h2>{household.name}</h2>
          <p className="muted">Your role: {roleLabel(household.myRole)}</p>
        </div>
      </div>

      {household.inviteCode ? (
        <section className="card" aria-labelledby="invite-heading">
          <h2 id="invite-heading">Invite code</h2>
          <p>
            Share this code so others can join: <strong>{household.inviteCode}</strong>
          </p>
        </section>
      ) : null}

      <section className="card" aria-labelledby="members-heading">
        <h2 id="members-heading">Members ({memberCount})</h2>
        <ul className="member-list">
          {household.members.map((member, index) => (
            <li key={`${member.firstName}-${member.lastName}-${index}`} className="member-item">
              <div className="member-item__info">
                <p>
                  <strong>
                    {member.firstName} {member.lastName}
                  </strong>
                  {member.isCurrentUser ? " (you)" : null}
                </p>
              </div>
              <div className="member-item__controls">
                <span className="badge badge--role">{roleLabel(member.role)}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
