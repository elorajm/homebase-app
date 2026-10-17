import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";

export const PASSWORD = "correct-horse-battery";

export type TestUser = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
};

export function makeUser(label: string): TestUser {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    firstName: label,
    lastName: "Tester",
    email: `${label.toLowerCase()}-${suffix}@example.com`,
    password: PASSWORD,
  };
}

export function fullName(user: TestUser): string {
  return `${user.firstName} ${user.lastName}`;
}

export async function openSession(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  return { context, page };
}

export async function register(page: Page, user: TestUser): Promise<void> {
  await page.goto("/register");
  await page.getByLabel("First name", { exact: true }).fill(user.firstName);
  await page.getByLabel("Last name", { exact: true }).fill(user.lastName);
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/household$/);
}

export function formError(page: Page) {
  return page.getByRole("alert").and(page.locator(".message--error"));
}

export async function logIn(page: Page, email: string, password: string = PASSWORD): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

export async function logOut(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login$/);
}

export async function createHousehold(page: Page, name: string): Promise<void> {
  await page.goto("/household");
  await page.getByLabel("Household name", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Create household" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

export async function readInviteCode(page: Page): Promise<string> {
  await page.goto("/household");
  const section = page.getByRole("region", { name: "Invite code" });
  const code = await section.locator("strong").innerText();
  return code.trim();
}

export async function joinHousehold(page: Page, inviteCode: string, user: TestUser): Promise<void> {
  await page.goto("/household");
  await page.getByLabel("Invite code", { exact: true }).fill(inviteCode);
  await page.getByRole("button", { name: "Join household" }).click();
  await expect(page.getByRole("region", { name: /Members/ })).toContainText(fullName(user));
}

export async function addChore(
  page: Page,
  chore: { title: string; assigneeName: string; dueDate: string; description?: string },
): Promise<void> {
  await page.goto("/chores/new");
  await page.getByLabel("Chore name", { exact: true }).fill(chore.title);
  if (chore.description) {
    await page.getByLabel("Description (optional)", { exact: true }).fill(chore.description);
  }
  await page.getByLabel("Assigned to", { exact: true }).selectOption({ label: chore.assigneeName });
  await page.getByLabel("Due date", { exact: true }).fill(chore.dueDate);
  await page.getByRole("button", { name: "Add chore" }).click();
  await expect(page).toHaveURL(/\/chores$/);
  await expect(choreItem(page, chore.title)).toBeVisible();
}

export function choreItem(page: Page, title: string) {
  return page.getByRole("listitem").filter({ has: page.getByRole("heading", { level: 2, name: title, exact: true }) });
}
