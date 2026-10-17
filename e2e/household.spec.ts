import { expect, test } from "@playwright/test";
import { createHousehold, formError, fullName, joinHousehold, makeUser, openSession, readInviteCode, register } from "./helpers";

test.describe("households", () => {
  test("creates a household and shows its invite code", async ({ page }) => {
    await register(page, makeUser("Hana"));
    await createHousehold(page, "Harbor House");
    await expect(page.getByRole("region", { name: "Invite code" })).toContainText(/[A-Z0-9]{8}/);
    await expect(page.getByRole("region", { name: /Members/ })).toContainText("(you)");
  });

  test("rejects a household name that is too short", async ({ page }) => {
    await register(page, makeUser("Ivo"));
    await page.goto("/household");
    await page.getByLabel("Household name", { exact: true }).fill("A");
    await page.getByRole("button", { name: "Create household" }).click();
    await expect(formError(page)).toHaveText("Please correct the highlighted fields.");
    await expect(page.getByText("Household name must be at least 2 characters.")).toBeVisible();
  });

  test("reports an unknown invite code", async ({ page }) => {
    await register(page, makeUser("Jun"));
    await page.goto("/household");
    await page.getByLabel("Invite code", { exact: true }).fill("ZZZZ9999");
    await page.getByRole("button", { name: "Join household" }).click();
    await expect(formError(page)).toHaveText("No household matches that invite code.");
  });

  test("owner changes a member's role and removes them; member sees no owner controls", async ({ browser }) => {
    const owner = makeUser("Owen");
    const member = makeUser("Mara");
    const ownerSession = await openSession(browser);
    const memberSession = await openSession(browser);
    try {
      await register(ownerSession.page, owner);
      await createHousehold(ownerSession.page, "Cedar House");
      const code = await readInviteCode(ownerSession.page);

      await register(memberSession.page, member);
      await joinHousehold(memberSession.page, code, member);

      await ownerSession.page.goto("/household");
      const memberItem = ownerSession.page.getByRole("listitem").filter({ hasText: fullName(member) });
      await ownerSession.page.getByLabel(`Role for ${fullName(member)}`).selectOption("adult");
      await memberItem.getByRole("button", { name: "Save role" }).click();
      await expect(ownerSession.page.getByRole("status")).toHaveText("Role updated.");
      await expect(memberItem.locator(".badge")).toHaveText("Adult");

      await memberSession.page.goto("/household");
      await expect(memberSession.page.getByRole("button", { name: "Save role" })).toHaveCount(0);
      await expect(memberSession.page.getByRole("button", { name: "Remove" })).toHaveCount(0);
      await expect(memberSession.page.getByRole("region", { name: "Household settings" })).toHaveCount(0);

      ownerSession.page.once("dialog", (dialog) => dialog.accept());
      await memberItem.getByRole("button", { name: "Remove" }).click();
      await expect(ownerSession.page.getByRole("listitem").filter({ hasText: fullName(member) })).toHaveCount(0);

      await memberSession.page.goto("/household");
      await expect(memberSession.page.getByRole("heading", { level: 1, name: "Household" })).toBeVisible();
    } finally {
      await ownerSession.context.close();
      await memberSession.context.close();
    }
  });
});
