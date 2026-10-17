import type { Metadata } from "next";
import {
  CreateHouseholdForm,
  JoinHouseholdForm,
  MemberRoleForm,
  RemoveMemberForm,
  RenameHouseholdForm,
} from "@/components/forms/household-forms";
import { EmptyState, RoleBadge } from "@/components/ui";
import { db } from "@/lib/db";
import { getMembershipForUser } from "@/lib/household";
import { canManageHousehold } from "@/lib/permissions";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Household" };

export default async function HouseholdPage() {
  const user = await requireUser();
  const membership = await getMembershipForUser(user.id);

  if (!membership) {
    return (
      <>
        <div className="page-header">
          <h1>Household</h1>
        </div>
        <p className="muted">You are not in a household yet. Create one or join with an invite code.</p>
        <div className="grid grid--two">
          <section className="card" aria-labelledby="create-heading">
            <h2 id="create-heading">Create a household</h2>
            <p>Start a household and share its invite code with the people you live with.</p>
            <CreateHouseholdForm />
          </section>
          <section className="card" aria-labelledby="join-heading">
            <h2 id="join-heading">Join a household</h2>
            <p>Enter the invite code shared by a household owner.</p>
            <JoinHouseholdForm />
          </section>
        </div>
      </>
    );
  }

  const isOwner = canManageHousehold(membership.role);
  const members = await db.householdMember.findMany({
    where: { householdId: membership.household.id },
    orderBy: { joinedAt: "asc" },
    select: {
      id: true,
      role: true,
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{membership.household.name}</h1>
          <p className="muted">
            Your role: {membership.role.charAt(0).toUpperCase() + membership.role.slice(1)}
          </p>
        </div>
      </div>

      <section className="card" aria-labelledby="invite-heading">
        <h2 id="invite-heading">Invite code</h2>
        <p>
          Share this code so others can join: <strong>{membership.household.inviteCode}</strong>
        </p>
      </section>

      {isOwner ? (
        <section className="card" aria-labelledby="settings-heading">
          <h2 id="settings-heading">Household settings</h2>
          <RenameHouseholdForm currentName={membership.household.name} />
        </section>
      ) : null}

      <section className="card" aria-labelledby="members-heading">
        <h2 id="members-heading">Members ({members.length})</h2>
        {members.length === 0 ? (
          <EmptyState>No members found.</EmptyState>
        ) : (
          <ul className="member-list">
            {members.map((member) => {
              const name = `${member.user.firstName} ${member.user.lastName}`;
              const isYou = member.user.id === user.id;
              const canEdit = isOwner && member.role !== "owner";
              return (
                <li key={member.id} className="member-item">
                  <div className="member-item__info">
                    <p>
                      <strong>{name}</strong>
                      {isYou ? " (you)" : null}
                    </p>
                    <p className="muted">{member.user.email}</p>
                  </div>
                  <div className="member-item__controls">
                    <RoleBadge role={member.role} />
                    {canEdit ? (
                      <>
                        <MemberRoleForm
                          memberId={member.id}
                          memberName={name}
                          currentRole={member.role === "adult" ? "adult" : "member"}
                        />
                        <RemoveMemberForm memberId={member.id} memberName={name} />
                      </>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
