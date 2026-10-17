import type { ReactNode } from "react";

export function ChoreStatusBadge({
  status,
  overdue,
}: {
  status: "pending" | "completed";
  overdue: boolean;
}) {
  if (status === "completed") {
    return <span className="badge badge--completed">Completed</span>;
  }
  if (overdue) {
    return <span className="badge badge--overdue">Overdue</span>;
  }
  return <span className="badge badge--pending">Pending</span>;
}

export function RoleBadge({ role }: { role: "owner" | "adult" | "member" }) {
  const label = role.charAt(0).toUpperCase() + role.slice(1);
  return <span className="badge badge--role">{label}</span>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="empty-state">{children}</div>;
}
