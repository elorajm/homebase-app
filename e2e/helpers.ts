import { expect, type Page } from "@playwright/test";

export const PASSWORD = "correct-horse-battery";
export const E2E_EMAIL_DOMAIN = "e2e.homebase.test";

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
    email: `${label.toLowerCase()}-${suffix}@${E2E_EMAIL_DOMAIN}`,
    password: PASSWORD,
  };
}

export function fullName(user: TestUser): string {
  return `${user.firstName} ${user.lastName}`;
}

// Islands hydrate after the page loads. Astro marks an island with the ssr attribute until it hydrates.
// Waiting for that avoids submitting a form before its handlers are attached.
export async function waitForIslands(page: Page): Promise<void> {
  await expect(page.locator("astro-island[ssr]")).toHaveCount(0);
}

export function formError(page: Page) {
  return page.getByRole("alert").and(page.locator(".message--error"));
}

export async function register(page: Page, user: TestUser): Promise<void> {
  await page.goto("/register");
  await waitForIslands(page);
  await page.getByLabel("First name", { exact: true }).fill(user.firstName);
  await page.getByLabel("Last name", { exact: true }).fill(user.lastName);
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator(".user-name")).toHaveText(fullName(user));
}

export async function logIn(page: Page, email: string, password: string = PASSWORD): Promise<void> {
  await page.goto("/login");
  await waitForIslands(page);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

export async function logOut(page: Page): Promise<void> {
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login$/);
}
