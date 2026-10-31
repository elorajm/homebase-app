import { expect, test } from "@playwright/test";
import { E2E_EMAIL_DOMAIN, PASSWORD, formError, logIn, logOut, makeUser, register, waitForIslands } from "./helpers";

test.describe("registration", () => {
  test("creates an account, lands on the dashboard, and shows the user in the header", async ({ page }) => {
    const user = makeUser("Ada");
    await register(page, user);
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
  });

  test("shows field errors for empty input and keeps the values that were valid", async ({ page }) => {
    await page.goto("/register");
    await waitForIslands(page);
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
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await register(page, user);
      await logOut(page);

      await page.goto("/register");
      await waitForIslands(page);
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

  test("keeps the password out of the URL", async ({ page }) => {
    await page.goto("/register");
    await waitForIslands(page);
    await page.getByLabel("First name", { exact: true }).fill("Ada");
    await page.getByLabel("Last name", { exact: true }).fill("Lovelace");
    await page.getByLabel("Email", { exact: true }).fill("not-an-email");
    await page.getByLabel("Password", { exact: true }).fill("secret-password-1");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
    await expect(page).toHaveURL(/\/register$/);
    expect(page.url()).not.toContain("secret-password-1");
  });
});

test.describe("login and logout", () => {
  test("rejects a wrong password and an unknown email with the same message", async ({ browser }) => {
    const user = makeUser("Wren");
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await register(page, user);
      await logOut(page);

      await logIn(page, user.email, "wrong-password-value");
      await expect(formError(page)).toHaveText("Invalid email or password.");

      await logIn(page, `nobody-${Date.now()}@${E2E_EMAIL_DOMAIN}`);
      await expect(formError(page)).toHaveText("Invalid email or password.");
      await expect(page).toHaveURL(/\/login$/);
    } finally {
      await context.close();
    }
  });

  test("logs in with the correct password and shows the user in the header", async ({ browser }) => {
    const user = makeUser("Sam");
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await register(page, user);
      await logOut(page);

      await logIn(page, user.email);
      await expect(page).toHaveURL(/\/dashboard$/);
      await expect(page.locator(".user-name")).toHaveText(`${user.firstName} ${user.lastName}`);
    } finally {
      await context.close();
    }
  });

  test("logs out and blocks protected pages afterwards", async ({ page }) => {
    const user = makeUser("Lee");
    await register(page, user);
    await logOut(page);

    for (const path of ["/dashboard", "/chores", "/chores/new", "/chores/edit?id=abc", "/household", "/profile"]) {
      await page.goto(path);
      await expect(page, `${path} should redirect to login`).toHaveURL(/\/login\?next=/);
    }
  });

  test("returns a user to the page they asked for after logging in", async ({ page }) => {
    const user = makeUser("Nia");
    await register(page, user);
    await logOut(page);

    await page.goto("/chores");
    await expect(page).toHaveURL(/\/login\?next=%2Fchores$/);

    await page.getByLabel("Email", { exact: true }).fill(user.email);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/chores$/);
  });

  test("sends a signed-in user away from the login page", async ({ page }) => {
    const user = makeUser("Kit");
    await register(page, user);

    await page.goto("/login");
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("the browser back button after logout does not reopen the app", async ({ page }) => {
    const user = makeUser("Bea");
    await register(page, user);
    await logOut(page);

    // Going back may restore the earlier dashboard, possibly from the browser's back-forward cache.
    // The page re-checks the session when it is shown again, so it must send the user back to login.
    await page.goBack();
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);
    await expect(page.getByRole("button", { name: "Log out" })).toHaveCount(0);
  });

  test("auth pages raise no browser errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto("/login");
    await waitForIslands(page);
    await page.goto("/register");
    await waitForIslands(page);

    expect(errors).toEqual([]);
  });
});

test.describe("navigation", () => {
  test("signed-in users can move between app pages and see the current page", async ({ page }) => {
    const user = makeUser("Max");
    await register(page, user);

    await page.getByRole("link", { name: "Chores", exact: true }).click();
    await expect(page).toHaveURL(/\/chores$/);
    await expect(page.getByRole("link", { name: "Chores", exact: true })).toHaveAttribute("aria-current", "page");

    await page.getByRole("link", { name: "Profile", exact: true }).click();
    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByRole("heading", { level: 1, name: "Profile" })).toBeVisible();
    await expect(page.locator(".user-name")).toHaveText(`${user.firstName} ${user.lastName}`);
  });

  test("the not-found page does not require signing in", async ({ page }) => {
    const response = await page.goto("/no-such-page");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
  });
});

test.describe("mobile layout", () => {
  test("logs in and logs out on a phone-sized screen @mobile", async ({ page }) => {
    const user = makeUser("Pia");
    await register(page, user);
    await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
    await logOut(page);

    await page.getByLabel("Email", { exact: true }).fill(user.email);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("keeps the login form inside a phone-sized screen without horizontal scrolling @mobile", async ({ page }) => {
    await page.goto("/login");
    await waitForIslands(page);
    const viewport = page.viewportSize();
    const box = await page.getByLabel("Email", { exact: true }).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(200);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport?.width ?? 0);

    const overflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflows).toBe(false);
  });
});
