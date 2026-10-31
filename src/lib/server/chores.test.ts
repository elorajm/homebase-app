import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  chore: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
  householdMember: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
}));

vi.mock("@/lib/server/db", () => ({ db }));
vi.mock("@/lib/logger", () => ({ logServerError: vi.fn() }));

import {
  ChoreError,
  createChore,
  deleteChore,
  getChoreDetail,
  listChores,
  resolveViewer,
  setChoreStatus,
  updateChore,
  type Viewer,
} from "@/lib/server/chores";

const owner: Viewer = { userId: "owner_1", householdId: "house_1", role: "owner" };
const adult: Viewer = { userId: "adult_1", householdId: "house_1", role: "adult" };
const member: Viewer = { userId: "member_1", householdId: "house_1", role: "member" };

const chore = (overrides: Record<string, unknown> = {}) => ({
  id: "chore_1",
  title: "Dishes",
  description: null,
  dueDate: new Date("2030-06-12T00:00:00.000Z"),
  status: "pending",
  assignedUserId: "member_1",
  assignedUser: { id: "member_1", firstName: "Mary", lastName: "Somerville" },
  ...overrides,
});

const form = { title: "Dishes", description: "", dueDate: "2030-06-12" };

beforeEach(() => {
  vi.clearAllMocks();
  db.householdMember.findFirst.mockResolvedValue({ id: "membership_1" });
  db.chore.findFirst.mockResolvedValue(chore());
});

describe("resolveViewer", () => {
  it("returns the household and role for a member", async () => {
    db.householdMember.findUnique.mockResolvedValue({ householdId: "house_1", role: "adult" });
    expect(await resolveViewer("adult_1")).toEqual(adult);
  });

  it("returns null when the user has no household", async () => {
    db.householdMember.findUnique.mockResolvedValue(null);
    expect(await resolveViewer("nobody")).toBeNull();
  });
});

describe("listChores", () => {
  it("returns only the viewer's household, earliest due first", async () => {
    db.chore.findMany.mockResolvedValue([chore()]);
    db.householdMember.findMany.mockResolvedValue([{ user: { id: "owner_1", firstName: "Ada", lastName: "L" } }]);

    const payload = await listChores(owner);

    expect(db.chore.findMany.mock.calls[0][0]).toMatchObject({
      where: { householdId: "house_1" },
      orderBy: [{ dueDate: "asc" }, { title: "asc" }],
    });
    expect(payload.chores[0]).toMatchObject({ title: "Dishes", canEdit: true });
    expect(payload.members).toEqual([{ id: "owner_1", firstName: "Ada", lastName: "L" }]);
    expect(payload.viewer).toEqual({ userId: "owner_1", canManage: true });
  });

  it("tells a plain member that they cannot manage chores", async () => {
    db.chore.findMany.mockResolvedValue([]);
    db.householdMember.findMany.mockResolvedValue([]);
    expect((await listChores(member)).viewer.canManage).toBe(false);
  });
});

describe("createChore", () => {
  it("assigns the chore to the creator when no assignee is chosen", async () => {
    db.chore.create.mockResolvedValue(chore({ assignedUserId: "owner_1", assignedUser: { id: "owner_1", firstName: "Ada", lastName: "L" } }));

    const created = await createChore(owner, form);

    const { data } = db.chore.create.mock.calls[0][0];
    expect(data).toMatchObject({ householdId: "house_1", createdById: "owner_1", assignedUserId: "owner_1", title: "Dishes" });
    expect(data.dueDate.toISOString()).toBe("2030-06-12T00:00:00.000Z");
    expect(created.assignee.id).toBe("owner_1");
  });

  it("checks the chosen assignee against the viewer's household", async () => {
    db.chore.create.mockResolvedValue(chore());

    await createChore(owner, { ...form, assignedUserId: "member_1" });

    expect(db.householdMember.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { householdId: "house_1", userId: "member_1" } }),
    );
  });

  it("rejects an assignee who is not in the household, without creating anything", async () => {
    db.householdMember.findFirst.mockResolvedValue(null);

    await expect(createChore(owner, { ...form, assignedUserId: "stranger" })).rejects.toMatchObject({
      status: 400,
      fieldErrors: { assignedUserId: "Choose a member of your household." },
    });
    expect(db.chore.create).not.toHaveBeenCalled();
  });

  it("refuses a plain member, without creating anything", async () => {
    await expect(createChore(member, form)).rejects.toMatchObject({ status: 403 });
    expect(db.chore.create).not.toHaveBeenCalled();
  });

  it("allows an adult to create chores", async () => {
    db.chore.create.mockResolvedValue(chore());
    await expect(createChore(adult, form)).resolves.toBeDefined();
  });
});

describe("updateChore", () => {
  it("scopes the lookup and the write to the viewer's household", async () => {
    db.chore.updateMany.mockResolvedValue({ count: 1 });

    await updateChore(owner, "chore_1", { ...form, assignedUserId: "member_1" });

    expect(db.chore.findFirst.mock.calls[0][0].where).toEqual({ id: "chore_1", householdId: "house_1" });
    expect(db.chore.updateMany.mock.calls[0][0].where).toEqual({ id: "chore_1", householdId: "house_1" });
  });

  it("keeps the current assignee when none is sent", async () => {
    db.chore.updateMany.mockResolvedValue({ count: 1 });

    await updateChore(owner, "chore_1", form);

    expect(db.chore.updateMany.mock.calls[0][0].data.assignedUserId).toBe("member_1");
  });

  it("reports not found for a chore outside the household, without writing", async () => {
    db.chore.findFirst.mockResolvedValue(null);

    await expect(updateChore(owner, "other_household_chore", form)).rejects.toMatchObject({
      status: 404,
      message: "That chore could not be found.",
    });
    expect(db.chore.updateMany).not.toHaveBeenCalled();
  });

  it("reports not found when the chore disappears before the write", async () => {
    db.chore.updateMany.mockResolvedValue({ count: 0 });
    await expect(updateChore(owner, "chore_1", form)).rejects.toMatchObject({ status: 404 });
  });

  it("refuses a plain member", async () => {
    await expect(updateChore(member, "chore_1", form)).rejects.toMatchObject({ status: 403 });
    expect(db.chore.updateMany).not.toHaveBeenCalled();
  });

  it("rejects reassigning to someone outside the household", async () => {
    db.householdMember.findFirst.mockResolvedValue(null);
    await expect(updateChore(owner, "chore_1", { ...form, assignedUserId: "stranger" })).rejects.toMatchObject({
      status: 400,
    });
    expect(db.chore.updateMany).not.toHaveBeenCalled();
  });
});

describe("deleteChore", () => {
  it("deletes only within the viewer's household", async () => {
    db.chore.deleteMany.mockResolvedValue({ count: 1 });

    await deleteChore(owner, "chore_1");

    expect(db.chore.deleteMany).toHaveBeenCalledWith({ where: { id: "chore_1", householdId: "house_1" } });
  });

  it("reports not found when nothing in the household matched", async () => {
    db.chore.deleteMany.mockResolvedValue({ count: 0 });
    await expect(deleteChore(owner, "other_household_chore")).rejects.toMatchObject({ status: 404 });
  });

  it("refuses a plain member before touching the database", async () => {
    await expect(deleteChore(member, "chore_1")).rejects.toBeInstanceOf(ChoreError);
    expect(db.chore.deleteMany).not.toHaveBeenCalled();
  });
});

describe("setChoreStatus", () => {
  it("lets an assigned member complete their chore", async () => {
    db.chore.updateMany.mockResolvedValue({ count: 1 });
    db.chore.findFirst
      .mockResolvedValueOnce(chore({ assignedUserId: "member_1" }))
      .mockResolvedValueOnce(chore({ status: "completed" }));

    const view = await setChoreStatus(member, "chore_1", "completed");

    expect(db.chore.updateMany).toHaveBeenCalledWith({
      where: { id: "chore_1", householdId: "house_1" },
      data: { status: "completed" },
    });
    expect(view.status).toBe("completed");
  });

  it("refuses a member completing someone else's chore", async () => {
    db.chore.findFirst.mockResolvedValue(chore({ assignedUserId: "someone_else" }));

    await expect(setChoreStatus(member, "chore_1", "completed")).rejects.toMatchObject({
      status: 403,
      message: "You can only update chores assigned to you.",
    });
    expect(db.chore.updateMany).not.toHaveBeenCalled();
  });

  it("lets an owner complete any chore in the household", async () => {
    db.chore.updateMany.mockResolvedValue({ count: 1 });
    db.chore.findFirst.mockResolvedValue(chore({ assignedUserId: "someone_else" }));
    await expect(setChoreStatus(owner, "chore_1", "completed")).resolves.toBeDefined();
  });

  it("reports not found for another household's chore, without writing", async () => {
    db.chore.findFirst.mockResolvedValue(null);

    await expect(setChoreStatus(member, "other_household_chore", "completed")).rejects.toMatchObject({ status: 404 });
    expect(db.chore.findFirst.mock.calls[0][0].where.householdId).toBe("house_1");
    expect(db.chore.updateMany).not.toHaveBeenCalled();
  });
});

describe("getChoreDetail", () => {
  it("returns the chore and the household members", async () => {
    db.householdMember.findMany.mockResolvedValue([{ user: { id: "member_1", firstName: "Mary", lastName: "S" } }]);

    const detail = await getChoreDetail(member, "chore_1");

    expect(detail.chore).toMatchObject({ id: "chore_1", canComplete: true, canEdit: false });
    expect(detail.members).toEqual([{ id: "member_1", firstName: "Mary", lastName: "S" }]);
  });

  it("returns not found for a chore in another household", async () => {
    db.chore.findFirst.mockResolvedValue(null);
    await expect(getChoreDetail(member, "other_household_chore")).rejects.toMatchObject({ status: 404 });
  });
});
