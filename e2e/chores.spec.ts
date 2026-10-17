import { expect, test } from "@playwright/test";
import {
  addChore,
  choreItem,
  createHousehold,
  fullName,
  joinHousehold,
  logIn,
  logOut,
  makeUser,
  openSession,
  formError,
  readInviteCode,
  register,
} from "./helpers";

test("owner and member manage shared chores, and the data persists across sessions", async ({ browser }) => {
  const tag = Date.now().toString(36);
  const owner = makeUser("Olivia");
  const member = makeUser("Milo");
  const ownerSession = await openSession(browser);
  const memberSession = await openSession(browser);
  const ownerPage = ownerSession.page;
  const memberPage = memberSession.page;
  const recycling = `Recycling ${tag}`;
  const dishes = `Dishes ${tag}`;

  try {
    await register(ownerPage, owner);
    await createHousehold(ownerPage, "Birch House");
    const code = await readInviteCode(ownerPage);

    await register(memberPage, member);
    await joinHousehold(memberPage, code, member);

    await test.step("owner sees validation errors on an empty chore form", async () => {
      await ownerPage.goto("/chores/new");
      await ownerPage.getByRole("button", { name: "Add chore" }).click();
      await expect(formError(ownerPage)).toHaveText("Please correct the highlighted fields.");
      await expect(ownerPage.getByText("Chore name is required.")).toBeVisible();
      await expect(ownerPage.getByText("Choose a household member to assign this chore to.")).toBeVisible();
      await expect(ownerPage.getByText("Due date is required.")).toBeVisible();
    });

    await test.step("owner creates a chore assigned to a member", async () => {
      await addChore(ownerPage, {
        title: recycling,
        assigneeName: fullName(member),
        dueDate: "2030-01-15",
        description: "Bins go to the curb",
      });
      const item = choreItem(ownerPage, recycling);
      await expect(item).toContainText(`Assigned to ${fullName(member)}`);
      await expect(item.locator(".badge")).toHaveText("Pending");
    });

    await test.step("owner edits the chore and reassigns it to themselves", async () => {
      await choreItem(ownerPage, recycling).getByRole("link", { name: "Edit" }).click();
      await expect(ownerPage.getByRole("heading", { level: 1, name: "Edit chore" })).toBeVisible();
      await ownerPage.getByLabel("Chore name", { exact: true }).fill(dishes);
      await ownerPage.getByLabel("Assigned to", { exact: true }).selectOption({ label: fullName(owner) });
      await ownerPage.getByRole("button", { name: "Save chore" }).click();
      await expect(ownerPage).toHaveURL(/\/chores$/);
      await expect(choreItem(ownerPage, dishes)).toContainText(`Assigned to ${fullName(owner)}`);
      await expect(choreItem(ownerPage, recycling)).toHaveCount(0);
    });

    await test.step("an overdue pending chore shows the overdue badge", async () => {
      await addChore(ownerPage, {
        title: `Vacuum ${tag}`,
        assigneeName: fullName(member),
        dueDate: "2020-01-01",
      });
      await expect(choreItem(ownerPage, `Vacuum ${tag}`).locator(".badge")).toHaveText("Overdue");
    });

    await test.step("member completes a chore assigned to them and cannot complete others' chores", async () => {
      await memberPage.goto("/chores");
      await expect(choreItem(memberPage, dishes)).toBeVisible();
      await expect(choreItem(memberPage, dishes).getByRole("button", { name: "Mark as complete" })).toHaveCount(0);
      await expect(memberPage.getByRole("link", { name: "Add chore" })).toHaveCount(0);
      await expect(memberPage.getByRole("link", { name: "Edit" })).toHaveCount(0);

      await addChore(ownerPage, { title: `Laundry ${tag}`, assigneeName: fullName(member), dueDate: "2030-02-01" });
      await memberPage.goto("/chores");
      await choreItem(memberPage, `Laundry ${tag}`).getByRole("button", { name: "Mark as complete" }).click();
      await expect(choreItem(memberPage, `Laundry ${tag}`).locator(".badge")).toHaveText("Completed");
    });

    await test.step("member is redirected away from the add chore page", async () => {
      await memberPage.goto("/chores/new");
      await expect(memberPage).toHaveURL(/\/chores$/);
    });

    await test.step("owner deletes a chore after confirming", async () => {
      ownerPage.once("dialog", (dialog) => dialog.accept());
      await choreItem(ownerPage, `Vacuum ${tag}`).getByRole("button", { name: "Delete" }).click();
      await expect(choreItem(ownerPage, `Vacuum ${tag}`)).toHaveCount(0);
    });

    await test.step("data persists after logging out and back in", async () => {
      await logOut(ownerPage);
      await logIn(ownerPage, owner.email);
      await expect(ownerPage).toHaveURL(/\/dashboard$/);
      await ownerPage.goto("/chores");
      await expect(choreItem(ownerPage, `Laundry ${tag}`).locator(".badge")).toHaveText("Completed");
      await expect(choreItem(ownerPage, dishes)).toBeVisible();
      await expect(choreItem(ownerPage, `Vacuum ${tag}`)).toHaveCount(0);
    });
  } finally {
    await ownerSession.context.close();
    await memberSession.context.close();
  }
});
