import { expect, test } from "@playwright/test";
import { addChore, choreItem, createHousehold, fullName, makeUser, openSession, register } from "./helpers";

test("users in different households cannot see or edit each other's chores", async ({ browser }) => {
  const tag = Date.now().toString(36);
  const ownerA = makeUser("Alder");
  const ownerB = makeUser("Blair");
  const sessionA = await openSession(browser);
  const sessionB = await openSession(browser);
  const secretTitle = `Secret chore ${tag}`;

  try {
    await register(sessionA.page, ownerA);
    await createHousehold(sessionA.page, "Alder Lane");
    await addChore(sessionA.page, {
      title: secretTitle,
      assigneeName: fullName(ownerA),
      dueDate: "2030-03-03",
    });
    const editHref = await choreItem(sessionA.page, secretTitle)
      .getByRole("link", { name: "Edit" })
      .getAttribute("href");
    expect(editHref).toMatch(/^\/chores\/[^/]+\/edit$/);

    await register(sessionB.page, ownerB);
    await createHousehold(sessionB.page, "Blair Court");
    await sessionB.page.goto("/chores");
    await expect(sessionB.page.getByText("No chores yet. Add a chore to get started.")).toBeVisible();
    await expect(sessionB.page.getByText(secretTitle)).toHaveCount(0);

    const response = await sessionB.page.goto(editHref as string);
    await expect(sessionB.page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
    await expect(sessionB.page.getByLabel("Chore name", { exact: true })).toHaveCount(0);
    await expect(sessionB.page.getByText(secretTitle)).toHaveCount(0);
    expect(response?.status()).toBe(404);
  } finally {
    await sessionA.context.close();
    await sessionB.context.close();
  }
});
