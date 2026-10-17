import { expect, test, type Page } from "@playwright/test";
import { addChore, createHousehold, fullName, makeUser, register } from "./helpers";

const ROUTES = ["/dashboard", "/chores", "/chores/new", "/household", "/profile"];

async function expectNoHorizontalOverflow(page: Page, path: string): Promise<void> {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, `${path} should not scroll horizontally`).toBeLessThanOrEqual(clientWidth);
}

async function expectTapTargets(page: Page): Promise<void> {
  const boxes = await page.locator(".app-nav__link, .btn").evaluateAll((elements) =>
    elements.map((element) => element.getBoundingClientRect().height),
  );
  expect(boxes.length).toBeGreaterThan(0);
  for (const height of boxes) {
    expect(height).toBeGreaterThanOrEqual(44);
  }
}

async function setUpHousehold(page: Page, label: string) {
  const user = makeUser(label);
  await register(page, user);
  await createHousehold(page, `${label} Home`);
  await addChore(page, {
    title: `Sweep ${label}`,
    assigneeName: fullName(user),
    dueDate: "2030-04-04",
  });
}

test("main pages fit a desktop viewport without horizontal scrolling", async ({ page }) => {
  await setUpHousehold(page, "Desk");
  for (const path of ROUTES) {
    await page.goto(path);
    await expectNoHorizontalOverflow(page, path);
  }
  await page.goto("/dashboard");
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("desktop-dashboard.png"), fullPage: true });
});

test("main pages fit a phone viewport with touch-sized controls @mobile", async ({ page }) => {
  await setUpHousehold(page, "Phone");
  for (const path of ROUTES) {
    await page.goto(path);
    await expectNoHorizontalOverflow(page, path);
  }
  await page.goto("/chores");
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  await expectTapTargets(page);
  await page.screenshot({ path: test.info().outputPath("mobile-chores.png"), fullPage: true });
});
