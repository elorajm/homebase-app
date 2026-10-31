import { canViewInviteCode, type HouseholdRole } from "@/lib/permissions";

export type HouseholdMemberRecord = {
  userId: string;
  role: HouseholdRole;
  user: { firstName: string; lastName: string };
};

export type HouseholdRecord = {
  id: string;
  name: string;
  inviteCode: string;
  members: HouseholdMemberRecord[];
};

// What one signed-in member may see. Other members appear by name only, with no email addresses.
export type HouseholdMemberView = {
  firstName: string;
  lastName: string;
  role: HouseholdRole;
  isCurrentUser: boolean;
};

export type HouseholdDetails = {
  id: string;
  name: string;
  myRole: HouseholdRole;
  inviteCode: string | null;
  members: HouseholdMemberView[];
};

// Returns null when the viewer is not a member, so non-members never receive household data.
export function toHouseholdDetails(record: HouseholdRecord, viewerId: string): HouseholdDetails | null {
  const viewer = record.members.find((member) => member.userId === viewerId);
  if (!viewer) {
    return null;
  }

  return {
    id: record.id,
    name: record.name,
    myRole: viewer.role,
    inviteCode: canViewInviteCode(viewer.role) ? record.inviteCode : null,
    members: record.members.map((member) => ({
      firstName: member.user.firstName,
      lastName: member.user.lastName,
      role: member.role,
      isCurrentUser: member.userId === viewerId,
    })),
  };
}

export function roleLabel(role: HouseholdRole): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}
