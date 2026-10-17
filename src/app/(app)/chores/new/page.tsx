import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ChoreForm } from "@/components/forms/chore-form";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/household";
import { canManageChores } from "@/lib/permissions";

export const metadata: Metadata = { title: "Add chore" };

export default async function NewChorePage() {
  const { membership } = await requireMembership();
  if (!canManageChores(membership.role)) {
    redirect("/chores");
  }

  const members = await db.householdMember.findMany({
    where: { householdId: membership.household.id },
    orderBy: { joinedAt: "asc" },
    select: { user: { select: { id: true, firstName: true, lastName: true } } },
  });

  return (
    <>
      <div className="page-header">
        <h1>Add chore</h1>
      </div>
      <section className="card">
        <ChoreForm
          members={members.map((member) => ({
            id: member.user.id,
            name: `${member.user.firstName} ${member.user.lastName}`,
          }))}
        />
      </section>
    </>
  );
}
