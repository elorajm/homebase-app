import { describe, expect, it } from "vitest";
import { dueLabel, sortChores, statusLabel, summarizeChores, toChoreView, type ChoreRecord, type ChoreView } from "@/lib/chores";
import { choreFormSchema, choreStatusInputSchema } from "@/lib/validation";

const today = new Date("2030-06-10T00:00:00.000Z");

const record = (overrides: Partial<ChoreRecord> = {}): ChoreRecord => ({
  id: "chore_1",
  title: "Dishes",
  description: null,
  dueDate: new Date("2030-06-12T00:00:00.000Z"),
  status: "pending",
  assignedUserId: "member_1",
  assignedUser: { id: "member_1", firstName: "Mary", lastName: "Somerville" },
  ...overrides,
});

describe("toChoreView", () => {
  it("formats the due date as an ISO day and reports the assignee", () => {
    const view = toChoreView(record(), { userId: "owner_1", role: "owner" }, today);
    expect(view.dueDate).toBe("2030-06-12");
    expect(view.assignee).toEqual({ id: "member_1", firstName: "Mary", lastName: "Somerville", isCurrentUser: false });
  });

  it("marks a pending chore overdue only after its due date", () => {
    expect(toChoreView(record({ dueDate: new Date("2030-06-09T00:00:00.000Z") }), { userId: "owner_1", role: "owner" }, today).overdue).toBe(true);
    expect(toChoreView(record(), { userId: "owner_1", role: "owner" }, today).overdue).toBe(false);
  });

  it("is never overdue once completed", () => {
    const completed = record({ status: "completed", dueDate: new Date("2030-06-01T00:00:00.000Z") });
    expect(toChoreView(completed, { userId: "owner_1", role: "owner" }, today).overdue).toBe(false);
  });

  it("lets owners and adults edit, delete, and complete any chore", () => {
    for (const role of ["owner", "adult"] as const) {
      const view = toChoreView(record(), { userId: "owner_1", role }, today);
      expect({ edit: view.canEdit, delete: view.canDelete, complete: view.canComplete }).toEqual({
        edit: true,
        delete: true,
        complete: true,
      });
    }
  });

  it("lets a plain member complete only chores assigned to them and never edit or delete", () => {
    const mine = toChoreView(record({ assignedUserId: "member_1" }), { userId: "member_1", role: "member" }, today);
    expect(mine).toMatchObject({ canEdit: false, canDelete: false, canComplete: true });
    expect(mine.assignee.isCurrentUser).toBe(true);

    const theirs = toChoreView(record({ assignedUserId: "someone_else" }), { userId: "member_1", role: "member" }, today);
    expect(theirs).toMatchObject({ canEdit: false, canDelete: false, canComplete: false });
  });
});

const view = (overrides: Partial<ChoreView>): ChoreView => ({
  id: "c",
  title: "A",
  description: null,
  dueDate: "2030-06-12",
  status: "pending",
  overdue: false,
  assignee: { id: "m", firstName: "M", lastName: "M", isCurrentUser: false },
  canEdit: false,
  canDelete: false,
  canComplete: false,
  ...overrides,
});

describe("sortChores and summarizeChores", () => {
  it("sorts by due date, then title", () => {
    const sorted = sortChores([
      view({ id: "2", title: "Zed", dueDate: "2030-06-12" }),
      view({ id: "1", title: "Alpha", dueDate: "2030-06-12" }),
      view({ id: "3", title: "Early", dueDate: "2030-06-01" }),
    ]);
    expect(sorted.map((chore) => chore.id)).toEqual(["3", "1", "2"]);
  });

  it("counts open and overdue chores, ignoring completed ones", () => {
    const summary = summarizeChores([
      view({ id: "1", overdue: true }),
      view({ id: "2" }),
      view({ id: "3", status: "completed" }),
    ]);
    expect(summary.open).toBe(2);
    expect(summary.overdue).toBe(1);
  });

  it("returns at most five upcoming pending chores", () => {
    const chores = Array.from({ length: 7 }, (_, index) => view({ id: `c${index}`, title: `T${index}`, dueDate: `2030-06-0${index + 1}` }));
    expect(summarizeChores(chores).next).toHaveLength(5);
  });

  it("returns no upcoming chores when everything is complete", () => {
    expect(summarizeChores([view({ status: "completed" })]).next).toEqual([]);
  });
});

describe("labels", () => {
  it("formats due dates and statuses for display", () => {
    expect(dueLabel("2030-06-12")).toBe("Jun 12, 2030");
    expect(statusLabel("pending")).toBe("Pending");
    expect(statusLabel("completed")).toBe("Completed");
  });
});

describe("choreFormSchema", () => {
  const valid = { title: "Dishes", description: "", dueDate: "2030-06-12", assignedUserId: "member_1" };

  it("accepts a complete chore", () => {
    expect(choreFormSchema.strict().safeParse(valid).success).toBe(true);
  });

  it("treats a blank assignee as not chosen", () => {
    const result = choreFormSchema.strict().safeParse({ ...valid, assignedUserId: "" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.assignedUserId).toBeUndefined();
    }
  });

  it("accepts a chore with no assignee field at all", () => {
    const { assignedUserId: _omitted, ...withoutAssignee } = valid;
    expect(choreFormSchema.strict().safeParse(withoutAssignee).success).toBe(true);
  });

  it("requires a title and a due date with the shared messages", () => {
    const result = choreFormSchema.safeParse({ ...valid, title: "  ", dueDate: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message);
      expect(messages).toContain("Chore name is required.");
      expect(messages).toContain("Due date is required.");
    }
  });

  it("rejects impossible calendar dates", () => {
    expect(choreFormSchema.safeParse({ ...valid, dueDate: "2030-02-31" }).success).toBe(false);
  });

  it("rejects overlong descriptions and titles", () => {
    expect(choreFormSchema.safeParse({ ...valid, description: "x".repeat(1001) }).success).toBe(false);
    expect(choreFormSchema.safeParse({ ...valid, title: "x".repeat(121) }).success).toBe(false);
  });

  it("rejects unexpected fields such as a status or a household id", () => {
    expect(choreFormSchema.strict().safeParse({ ...valid, status: "completed" }).success).toBe(false);
    expect(choreFormSchema.strict().safeParse({ ...valid, householdId: "h2" }).success).toBe(false);
  });
});

describe("choreStatusInputSchema", () => {
  it("accepts only pending or completed", () => {
    expect(choreStatusInputSchema.safeParse({ status: "completed" }).success).toBe(true);
    expect(choreStatusInputSchema.safeParse({ status: "archived" }).success).toBe(false);
  });
});
