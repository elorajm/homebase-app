import { expect, test, type Browser, type Page } from "@playwright/test";
import { makeUser, register, waitForIslands } from "./helpers";

const INVITE_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{8}$/;

function householdName(label: string): string {
  return `${label} ${Math.random().toString(36).slice(2, 8)} House`;
}

async function openHouseholdPage(page: Page): Promise<void> {
  await page.goto("/household");
  await waitForIslands(page);
}

async function createHousehold(page: Page, name: string): Promise<void> {
  await openHouseholdPage(page);
  await page.getByLabel("Household name", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Create household" }).click();
  await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
}

async function readInviteCode(page: Page): Promise<string> {
  await openHouseholdPage(page);
  const region = page.getByRole("region", { name: "Invite code" });
  await expect(region).toBeVisible();
  return (await region.locator("strong").innerText()).trim();
}

async function joinHousehold(page: Page, inviteCode: string): Promise<void> {
  await openHouseholdPage(page);
  await page.getByLabel("Invite code", { exact: true }).fill(inviteCode);
  await page.getByRole("button", { name: "Join household" }).click();
}

// Opens a second, isolated browser session so two accounts can be signed in at once.
async function newUserPage(browser: Browser, label: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const user = makeUser(label);
  await register(page, user);
  return { context, page, user };
}

test.describe("creating a household", () => {
  test("creates a household and shows the owner role, the invite code, and the owner in the members list", async ({ page }) => {
    const user = makeUser("Owner");
    await register(page, user);
    const name = householdName("Lovelace");

    await createHousehold(page, name);

    await expect(page.getByText("Your role: Owner")).toBeVisible();
    await expect(page.getByRole("region", { name: "Members (1)" }).getByText("(you)")).toBeVisible();
    const code = (await page.getByRole("region", { name: "Invite code" }).locator("strong").innerText()).trim();
    expect(code).toMatch(INVITE_CODE_PATTERN);
    await expect(page.getByRole("status")).toContainText(`Created ${name}.`);
  });

  test("rejects a name that is too short without sending a request", async ({ page }) => {
    const user = makeUser("Short");
    await register(page, user);
    await openHouseholdPage(page);

    let householdPosts = 0;
    page.on("request", (request) => {
      if (request.method() === "POST" && request.url().includes("/api/households")) householdPosts += 1;
    });

    await page.getByLabel("Household name", { exact: true }).fill("A");
    await page.getByRole("button", { name: "Create household" }).click();

    await expect(page.getByText("Household name must be at least 2 characters.")).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "Please correct the highlighted fields." })).toBeVisible();
    expect(householdPosts).toBe(0);
  });

  test("rejects a name over 60 characters", async ({ page }) => {
    const user = makeUser("Long");
    await register(page, user);
    await openHouseholdPage(page);

    await page.getByLabel("Household name", { exact: true }).fill("x".repeat(61));
    await page.getByRole("button", { name: "Create household" }).click();

    await expect(page.getByText("Household name must be 60 characters or fewer.")).toBeVisible();
  });

  test("shows the household on the dashboard after it is created", async ({ page }) => {
    const user = makeUser("Dash");
    await register(page, user);
    const name = householdName("Dash");
    await createHousehold(page, name);

    await page.goto("/dashboard");
    await waitForIslands(page);
    await expect(page.getByText(name, { exact: true })).toBeVisible();
    await expect(page.getByText(/Your role: Owner/)).toBeVisible();
  });

  test("a user without a household sees the create and join options", async ({ page }) => {
    const user = makeUser("Newbie");
    await register(page, user);

    await openHouseholdPage(page);
    await expect(page.getByRole("heading", { level: 2, name: "Create a household" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Join a household" })).toBeVisible();

    await page.goto("/dashboard");
    await waitForIslands(page);
    await expect(page.getByText("You are not in a household yet.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Create or join a household" })).toBeVisible();
  });
});

test.describe("joining a household", () => {
  test("joins with an invite code, sees the other members, and cannot see the invite code", async ({ browser, page }) => {
    const owner = makeUser("Hostess");
    await register(page, owner);
    const name = householdName("Shared");
    await createHousehold(page, name);
    const code = await readInviteCode(page);

    const { context, page: memberPage, user: member } = await newUserPage(browser, "Joiner");
    try {
      await joinHousehold(memberPage, code);

      await expect(memberPage.getByRole("status")).toContainText(`You joined ${name}.`);
      await expect(memberPage.getByText("Your role: Member")).toBeVisible();
      const members = memberPage.getByRole("region", { name: /Members/ });
      await expect(members).toContainText(`${owner.firstName} ${owner.lastName}`);
      await expect(members).toContainText(`${member.firstName} ${member.lastName}`);
      await expect(members.getByText("(you)")).toBeVisible();
      await expect(memberPage.getByRole("region", { name: "Invite code" })).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test("the joined household appears on the new member's dashboard", async ({ browser, page }) => {
    const owner = makeUser("Host2");
    await register(page, owner);
    const name = householdName("Dash Join");
    await createHousehold(page, name);
    const code = await readInviteCode(page);

    const { context, page: memberPage } = await newUserPage(browser, "Guest");
    try {
      await joinHousehold(memberPage, code);
      await expect(memberPage.getByRole("status")).toContainText(`You joined ${name}.`);

      await memberPage.goto("/dashboard");
      await waitForIslands(memberPage);
      await expect(memberPage.getByText(name, { exact: true })).toBeVisible();
      await expect(memberPage.getByText(/Your role: Member/)).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("rejects an invite code that matches no household", async ({ page }) => {
    const user = makeUser("Lost");
    await register(page, user);
    await openHouseholdPage(page);

    await page.getByLabel("Invite code", { exact: true }).fill("ZZZZZZZZ");
    await page.getByRole("button", { name: "Join household" }).click();

    await expect(page.getByRole("alert").filter({ hasText: "No household matches this invite code." })).toBeVisible();
    await expect(page.getByText("Check the code and try again.")).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Join a household" })).toBeVisible();
  });

  test("rejects a malformed invite code without sending a request", async ({ page }) => {
    const user = makeUser("Typo");
    await register(page, user);
    await openHouseholdPage(page);

    let joinPosts = 0;
    page.on("request", (request) => {
      if (request.method() === "POST" && request.url().includes("/api/households/join")) joinPosts += 1;
    });

    await page.getByLabel("Invite code", { exact: true }).fill("abc");
    await page.getByRole("button", { name: "Join household" }).click();

    await expect(page.getByText("Invite code must be 8 letters or numbers.")).toBeVisible();
    expect(joinPosts).toBe(0);
  });

  test("a user who already has a household cannot join another one", async ({ browser, page }) => {
    const first = makeUser("Firsthome");
    await register(page, first);
    const firstName = householdName("First");
    await createHousehold(page, firstName);
    const firstCode = await readInviteCode(page);

    const { context, page: memberPage } = await newUserPage(browser, "Member");
    try {
      await joinHousehold(memberPage, firstCode);
      await expect(memberPage.getByRole("status")).toContainText(`You joined ${firstName}.`);

      // The page now shows the member's household and no longer offers the join form.
      await openHouseholdPage(memberPage);
      await expect(memberPage.getByRole("heading", { level: 2, name: firstName })).toBeVisible();
      await expect(memberPage.locator('input[name="inviteCode"]')).toHaveCount(0);

      // The server still refuses a second join, for example from a stale tab or a direct request.
      const other = await newUserPage(browser, "Otherhome");
      try {
        await createHousehold(other.page, householdName("Other"));
        const otherCode = await readInviteCode(other.page);

        const response = await memberPage.request.post("/api/households/join", { data: { inviteCode: otherCode } });
        expect(response.status()).toBe(409);
        expect(await response.json()).toEqual({ error: "You already belong to a household." });
      } finally {
        await other.context.close();
      }
    } finally {
      await context.close();
    }
  });
});

test.describe("household authorization", () => {
  test("a signed-out visitor is sent to log in before reaching the household page", async ({ page }) => {
    await page.goto("/household");
    await expect(page).toHaveURL(/\/login\?next=%2Fhousehold$/);
  });

  test("signed-out API requests are refused and reveal no household data", async ({ request }) => {
    const current = await request.get("/api/households/current");
    expect(current.status()).toBe(401);
    expect(await current.text()).not.toContain("household");

    const create = await request.post("/api/households", { data: { name: "Nobody Home" } });
    expect(create.status()).toBe(401);

    const join = await request.post("/api/households/join", { data: { inviteCode: "ABCD2345" } });
    expect(join.status()).toBe(401);
  });

  test("a plain member gets the household without the invite code, while the owner gets it", async ({ browser, page }) => {
    const owner = makeUser("Keeper");
    await register(page, owner);
    const name = householdName("Private");
    await createHousehold(page, name);
    const code = await readInviteCode(page);

    const ownerView = await page.request.get("/api/households/current");
    expect((await ownerView.json()).data.household.inviteCode).toBe(code);

    const { context, page: memberPage } = await newUserPage(browser, "Plain");
    try {
      await joinHousehold(memberPage, code);
      await expect(memberPage.getByRole("status")).toContainText(`You joined ${name}.`);

      const memberResponse = await memberPage.request.get("/api/households/current");
      const text = await memberResponse.text();
      expect(JSON.parse(text).data.household.inviteCode).toBeNull();
      expect(text).not.toContain(code);
      expect(text).not.toContain("@");
    } finally {
      await context.close();
    }
  });

  test("a user who already belongs to a household is not offered the create form", async ({ page }) => {
    const user = makeUser("Settled");
    await register(page, user);
    const name = householdName("Settled");
    await createHousehold(page, name);

    await openHouseholdPage(page);
    await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
    await expect(page.locator('input[name="name"]')).toHaveCount(0);
    await expect(page.locator('input[name="inviteCode"]')).toHaveCount(0);
  });

  test("the API refuses a second household for a user who already has one", async ({ page }) => {
    const user = makeUser("Twice");
    await register(page, user);
    await createHousehold(page, householdName("Once"));

    const response = await page.request.post("/api/households", { data: { name: "Twice Home" } });
    expect(response.status()).toBe(409);
    expect(await response.json()).toEqual({ error: "You already belong to a household." });
  });

  test("concurrent create requests from one account produce exactly one household", async ({ page }) => {
    const user = makeUser("Racer");
    await register(page, user);
    const name = householdName("Race");

    const [first, second] = await Promise.all([
      page.request.post("/api/households", { data: { name } }),
      page.request.post("/api/households", { data: { name } }),
    ]);

    expect([first.status(), second.status()].sort()).toEqual([201, 409]);
    const current = await (await page.request.get("/api/households/current")).json();
    expect(current.data.household.name).toBe(name);
  });
});

test.describe("household on a phone", () => {
  test("creates a household on a phone-sized screen without horizontal scrolling @mobile", async ({ page }) => {
    const user = makeUser("Phone");
    await register(page, user);
    await openHouseholdPage(page);
    const name = householdName("Phone");

    const viewport = page.viewportSize();
    const nameField = page.getByLabel("Household name", { exact: true });
    await expect(nameField).toBeVisible();
    const box = await nameField.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport?.width ?? 0);

    await nameField.fill(name);
    await page.getByRole("button", { name: "Create household" }).click();
    await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();

    const overflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflows).toBe(false);
  });
});
