export type HouseholdRole = "owner" | "adult" | "member";

export function canManageHousehold(role: HouseholdRole): boolean {
  return role === "owner";
}

export function canManageChores(role: HouseholdRole): boolean {
  return role === "owner" || role === "adult";
}

export function canCompleteChore(
  role: HouseholdRole,
  currentUserId: string,
  assignedUserId: string,
): boolean {
  return canManageChores(role) || assignedUserId === currentUserId;
}

export function canModifyMember(actorRole: HouseholdRole, targetRole: HouseholdRole): boolean {
  return canManageHousehold(actorRole) && targetRole !== "owner";
}

// Owners and adults can see the invite code so they can invite people. Plain members cannot.
export function canViewInviteCode(role: HouseholdRole): boolean {
  return role === "owner" || role === "adult";
}
