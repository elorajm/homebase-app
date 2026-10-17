import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ChoreForm } from "@/components/forms/chore-form";
import { db } from "@/lib/db";
import { toIsoDate } from "@/lib/dates";
import { requireMembership } from "@/lib/household";
import { canManageChores } from "@/lib/permissions";

export const metadata: Metadata = { title: "Edit chore" };

export default async function EditChorePage({
  params,
}: {
  params: Promise<{ choreId: string }>;
}) {
  const { choreId } = await params;
  const { membership } = await requireMembership();
  if (!canManageChores(membership.role)) {
    redirect("/chores");
  }

  const householdId = membership.household.id;
  const [chore, members] = await Promise.all([
    db.chore.findFirst({
      where: { id: choreId, householdId },
      select: { id: true, title: true, description: true, assignedUserId: true, dueDate: true },
    }),
    db.householdMember.findMany({
      where: { householdId },
      orderBy: { joinedAt: "asc" },
      select: { user: { select: { id: true, firstName: true, lastName: true } } },
    }),
  ]);

  if (!chore) {
    notFound();
  }

  return (
    <>
      <div className="page-header">
        <h1>Edit chore</h1>
      </div>
      <section className="card">
        <ChoreForm
          members={members.map((member) => ({
            id: member.user.id,
            name: `${member.user.firstName} ${member.user.lastName}`,
          }))}
          chore={{
            id: chore.id,
            title: chore.title,
            description: chore.description ?? "",
            assignedUserId: chore.assignedUserId,
            dueDate: toIsoDate(chore.dueDate),
          }}
        />
      </section>
    </>
  );
}
