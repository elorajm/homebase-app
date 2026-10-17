import type { Metadata } from "next";
import Link from "next/link";
import { ChoreStatusForm, DeleteChoreForm } from "@/components/forms/chore-actions";
import { ChoreStatusBadge, EmptyState } from "@/components/ui";
import { db } from "@/lib/db";
import { formatDueDate, isOverdue, todayUtc } from "@/lib/dates";
import { requireMembership } from "@/lib/household";
import { canCompleteChore, canManageChores } from "@/lib/permissions";

export const metadata: Metadata = { title: "Chores" };

export default async function ChoresPage() {
  const { user, membership } = await requireMembership();
  const householdId = membership.household.id;
  const canManage = canManageChores(membership.role);
  const today = todayUtc();

  const chores = await db.chore.findMany({
    where: { householdId },
    orderBy: [{ dueDate: "asc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      description: true,
      dueDate: true,
      status: true,
      assignedUserId: true,
      assignedUser: { select: { firstName: true, lastName: true } },
    },
  });

  return (
    <>
      <div className="page-header">
        <h1>Chores</h1>
        {canManage ? (
          <Link className="btn btn--primary" href="/chores/new">
            Add chore
          </Link>
        ) : null}
      </div>

      {chores.length === 0 ? (
        <EmptyState>
          {canManage
            ? "No chores yet. Add a chore to get started."
            : "No chores yet. An owner or adult can add one."}
        </EmptyState>
      ) : (
        <ul className="chore-list">
          {chores.map((chore) => {
            const assigneeName = `${chore.assignedUser.firstName} ${chore.assignedUser.lastName}`;
            const canComplete = canCompleteChore(membership.role, user.id, chore.assignedUserId);
            return (
              <li key={chore.id} className="chore-item">
                <div className="chore-item__main">
                  <h2 className="chore-item__title">{chore.title}</h2>
                  <p className="chore-item__meta">
                    Assigned to {assigneeName} · Due {formatDueDate(chore.dueDate)}
                  </p>
                  {chore.description ? <p className="chore-item__meta">{chore.description}</p> : null}
                </div>
                <div className="chore-item__side">
                  <ChoreStatusBadge
                    status={chore.status}
                    overdue={isOverdue(chore.dueDate, chore.status, today)}
                  />
                  {canComplete ? (
                    <ChoreStatusForm choreId={chore.id} status={chore.status} />
                  ) : null}
                  {canManage ? (
                    <div className="chore-item__actions">
                      <Link className="btn btn--secondary" href={`/chores/${chore.id}/edit`}>
                        Edit
                      </Link>
                      <DeleteChoreForm choreId={chore.id} title={chore.title} />
                    </div>
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
