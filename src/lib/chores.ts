import { formatDueDate, isOverdue, toIsoDate } from "@/lib/dates";
import { canCompleteChore, canManageChores, type HouseholdRole } from "@/lib/permissions";

export type ChoreStatus = "pending" | "completed";

export type ChoreRecord = {
  id: string;
  title: string;
  description: string | null;
  dueDate: Date;
  status: ChoreStatus;
  assignedUserId: string;
  assignedUser: { id: string; firstName: string; lastName: string };
};

// What one household member may see and do with a chore. The server computes these flags; the UI only hides controls.
export type ChoreView = {
  id: string;
  title: string;
  description: string | null;
  dueDate: string;
  status: ChoreStatus;
  overdue: boolean;
  assignee: { id: string; firstName: string; lastName: string; isCurrentUser: boolean };
  canEdit: boolean;
  canDelete: boolean;
  canComplete: boolean;
};

export type ChoreMember = { id: string; firstName: string; lastName: string };

export type ChoresViewer = { userId: string; canManage: boolean };

export type ChoresPayload = {
  chores: ChoreView[];
  members: ChoreMember[];
  viewer: ChoresViewer;
};

export type ViewerContext = { userId: string; role: HouseholdRole };

export function toChoreView(record: ChoreRecord, viewer: ViewerContext, today: Date): ChoreView {
  const manage = canManageChores(viewer.role);
  return {
    id: record.id,
    title: record.title,
    description: record.description,
    dueDate: toIsoDate(record.dueDate),
    status: record.status,
    overdue: isOverdue(record.dueDate, record.status, today),
    assignee: {
      id: record.assignedUser.id,
      firstName: record.assignedUser.firstName,
      lastName: record.assignedUser.lastName,
      isCurrentUser: record.assignedUserId === viewer.userId,
    },
    canEdit: manage,
    canDelete: manage,
    canComplete: canCompleteChore(viewer.role, viewer.userId, record.assignedUserId),
  };
}

// Earliest due first, then title, so the list reads in the order work is due.
export function sortChores(chores: ChoreView[]): ChoreView[] {
  return [...chores].sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.title.localeCompare(b.title));
}

export function summarizeChores(chores: ChoreView[], limit = 5) {
  const pending = sortChores(chores.filter((chore) => chore.status === "pending"));
  return {
    open: pending.length,
    overdue: pending.filter((chore) => chore.overdue).length,
    next: pending.slice(0, limit),
  };
}

export function dueLabel(isoDate: string): string {
  return formatDueDate(new Date(`${isoDate}T00:00:00.000Z`));
}

export function statusLabel(status: ChoreStatus): string {
  return status === "completed" ? "Completed" : "Pending";
}
