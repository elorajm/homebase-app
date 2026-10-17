import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const getMembershipForUser = cache((userId: string) =>
  db.householdMember.findUnique({
    where: { userId },
    select: {
      id: true,
      role: true,
      userId: true,
      household: { select: { id: true, name: true, inviteCode: true, ownerId: true } },
    },
  }),
);

export async function requireMembership() {
  const user = await requireUser();
  const membership = await getMembershipForUser(user.id);
  if (!membership) {
    redirect("/household");
  }
  return { user, membership };
}
