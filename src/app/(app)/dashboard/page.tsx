import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { formatDueDate, isOverdue, todayUtc } from "@/lib/dates";
import { requireMembership } from "@/lib/household";
import { ChoreStatusBadge, EmptyState } from "@/components/ui";

export const metadata: Metadata = { title: "Dashboard" };

const UPCOMING_LIMIT = 5;
const LATER_MODULES = ["Shopping list", "Projects", "Maintenance"];

export default async function DashboardPage() {
  const { user, membership } = await requireMembership();
  const householdId = membership.household.id;
  const today = todayUtc();

  const [pendingCount, upcoming] = await Promise.all([
    db.chore.count({ where: { householdId, status: "pending" } }),
    db.chore.findMany({
      where: { householdId, status: "pending" },
      orderBy: [{ dueDate: "asc" }, { title: "asc" }],
      take: UPCOMING_LIMIT,
      select: {
        id: true,
        title: true,
        dueDate: true,
        status: true,
        assignedUser: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Welcome, {user.firstName}</h1>
          <p className="muted">{membership.household.name}</p>
        </div>
      </div>

      <div className="dashboard-grid">
        <section className="card" aria-labelledby="chores-heading">
          <h2 id="chores-heading">Open chores ({pendingCount})</h2>
          {upcoming.length === 0 ? (
            <EmptyState>No open chores. Nice work, or add a chore to get started.</EmptyState>
          ) : (
            <ul className="chore-list">
              {upcoming.map((chore) => (
                <li key={chore.id} className="chore-item">
                  <div>
                    <h3 className="chore-item__title">{chore.title}</h3>
                    <p className="chore-item__meta">
                      Assigned to {chore.assignedUser.firstName} {chore.assignedUser.lastName} · Due{" "}
                      {formatDueDate(chore.dueDate)}
                    </p>
                  </div>
                  <ChoreStatusBadge
                    status={chore.status}
                    overdue={isOverdue(chore.dueDate, chore.status, today)}
                  />
                </li>
              ))}
            </ul>
          )}
          <p>
            <Link href="/chores">View all chores</Link>
          </p>
        </section>

        <section className="card placeholder-card" aria-labelledby="later-heading">
          <h2 id="later-heading">Coming later</h2>
          <ul>
            {LATER_MODULES.map((module) => (
              <li key={module}>{module}</li>
            ))}
          </ul>
          <p>These modules are outside the Bakeoff 1 scope.</p>
        </section>
      </div>
    </>
  );
}
