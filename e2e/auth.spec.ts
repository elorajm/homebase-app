import { expect, test } from "@playwright/test";
import { PASSWORD, formError, logIn, logOut, makeUser, register } from "./helpers";

test.describe("registration", () => {
  test("creates an account and sends a user with no household to household setup", async ({ page }) => {
    const user = makeUser("Ada");
    await register(page, user);
    await expect(page.getByRole("heading", { level: 1, name: "Household" })).toBeVisible();
    await expect(page.locator(".user-name")).toHaveText(`${user.firstName} ${user.lastName}`);
  });

  test("shows field errors for empty and invalid input and keeps valid values", async ({ page }) => {
    await page.goto("/register");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(formError(page)).toHaveText("Please correct the highlighted fields.");
    await expect(page.getByText("First name is required.")).toBeVisible();
    await expect(page.getByText("Last name is required.")).toBeVisible();
    await expect(page.getByText("Email is required.")).toBeVisible();
    await expect(page.getByText("Password must be at least 8 characters.")).toBeVisible();

    await page.getByLabel("First name", { exact: true }).fill("Ada");
    await page.getByLabel("Last name", { exact: true }).fill("Lovelace");
    await page.getByLabel("Email", { exact: true }).fill("not-an-email");
    await page.getByLabel("Password", { exact: true }).fill("short");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
    await expect(page.getByText("Password must be at least 8 characters.")).toBeVisible();
    await expect(page.getByLabel("First name", { exact: true })).toHaveValue("Ada");
    await expect(page.getByLabel("Email", { exact: true })).toHaveValue("not-an-email");
    await expect(page).toHaveURL(/\/register$/);
  });

  test("rejects an email that is already registered", async ({ browser }) => {
    const user = makeUser("Dup");
    const { context, page } = await openFresh(browser);
    try {
      await register(page, user);
      await logOut(page);
      await page.goto("/register");
      await page.getByLabel("First name", { exact: true }).fill(user.firstName);
      await page.getByLabel("Last name", { exact: true }).fill(user.lastName);
      await page.getByLabel("Email", { exact: true }).fill(user.email);
      await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
      await page.getByRole("button", { name: "Create account" }).click();
      await expect(formError(page)).toHaveText("An account with this email already exists.");
      await expect(page).toHaveURL(/\/register$/);
    } finally {
      await context.close();
    }
  });
});

test.describe("login and logout", () => {
  test("rejects a wrong password and an unknown email with the same message", async ({ browser }) => {
    const user = makeUser("Wren");
    const { context, page } = await openFresh(browser);
    try {
      await register(page, user);
      await logOut(page);

      await logIn(page, user.email, "wrong-password-value");
      await expect(formError(page)).toHaveText("Invalid email or password.");

      await logIn(page, `nobody-${Date.now()}@example.com`);
      await expect(formError(page)).toHaveText("Invalid email or password.");
      await expect(page).toHaveURL(/\/login$/);
    } finally {
      await context.close();
    }
  });

  test("logs in with the correct password", async ({ browser }) => {
    const user = makeUser("Sam");
    const { context, page } = await openFresh(browser);
    try {
      await register(page, user);
      await logOut(page);
      await logIn(page, user.email);
      await expect(page).toHaveURL(/\/household$/);
      await expect(page.locator(".user-name")).toHaveText(`${user.firstName} ${user.lastName}`);
    } finally {
      await context.close();
    }
  });

  test("logs out and blocks protected pages afterwards", async ({ browser }) => {
    const user = makeUser("Lee");
    const { context, page } = await openFresh(browser);
    try {
      await register(page, user);
      await logOut(page);
      for (const path of ["/dashboard", "/chores", "/household", "/profile", "/chores/new"]) {
        await page.goto(path);
        await expect(page, `${path} should redirect to login`).toHaveURL(/\/login$/);
      }
    } finally {
      await context.close();
    }
  });

  test("keeps a logged-in user out of the login page", async ({ browser }) => {
    const user = makeUser("Kit");
    const { context, page } = await openFresh(browser);
    try {
      await register(page, user);
      await page.goto("/login");
      await expect(page).toHaveURL(/\/household$/);
    } finally {
      await context.close();
    }
  });
});

test.describe("profile", () => {
  test("updates the display name shown in the header", async ({ browser }) => {
    const user = makeUser("Pat");
    const { context, page } = await openFresh(browser);
    try {
      await register(page, user);
      await page.goto("/profile");
      await page.getByLabel("First name", { exact: true }).fill("Patricia");
      await page.getByRole("button", { name: "Save profile" }).click();
      await expect(page.getByRole("status")).toHaveText("Profile updated.");
      await expect(page.locator(".user-name")).toHaveText("Patricia Tester");
    } finally {
      await context.close();
    }
  });
});

async function openFresh(browser: import("@playwright/test").Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  return { context, page };
}
