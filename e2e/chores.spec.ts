import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { makeUser, register, waitForIslands } from "./helpers";

const opened: BrowserContext[] = [];

test.afterEach(async () => {
  await Promise.all(opened.splice(0).map((context) => context.close()));
});

function tag(): string {
  return Math.random().toString(36).slice(2, 8);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysFromToday(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

async function newUser(browser: Browser, label: string) {
  const context = await browser.newContext();
  opened.push(context);
  const page = await context.newPage();
  const user = makeUser(label);
  await register(page, user);
  return { page, user, name: `${user.firstName} ${user.lastName}` };
}

async function apiCreateHousehold(page: Page, name: string): Promise<{ id: string; name: string; inviteCode: string }> {
  const response = await page.request.post("/api/households", { data: { name } });
  expect(response.status()).toBe(201);
  return (await response.json()).data.household;
}

async function apiJoinHousehold(page: Page, inviteCode: string): Promise<void> {
  const response = await page.request.post("/api/households/join", { data: { inviteCode } });
  expect(response.status()).toBe(200);
}

async function apiCreateChore(
  page: Page,
  chore: { title: string; dueDate?: string; assignedUserId?: string; description?: string },
): Promise<{ id: string; title: string; assignee: { id: string } }> {
  const response = await page.request.post("/api/chores", {
    data: { description: "", dueDate: todayIso(), ...chore },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).data.chore;
}

// Sets up an owner with a household and returns the owner's view of the household.
async function ownerWithHousehold(browser: Browser, label = "Owner") {
  const owner = await newUser(browser, label);
  const household = await apiCreateHousehold(owner.page, `Chores ${tag()} House`);
  return { ...owner, household };
}

async function openChores(page: Page): Promise<void> {
  await page.goto("/chores");
  await waitForIslands(page);
}

function choreItem(page: Page, title: string) {
  return page.locator("li.chore-item").filter({ has: page.getByRole("heading", { level: 2, name: title, exact: true }) });
}

test.describe("viewing chores", () => {
  test("shows an empty state for a household with no chores", async ({ browser }) => {
    const { page } = await ownerWithHousehold(browser);
    await openChores(page);

    await expect(page.getByText("No chores yet. Add the first one to get started.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Add chore" })).toBeVisible();
  });

  test("a signed-out visitor is sent to log in", async ({ page }) => {
    await page.goto("/chores");
    await expect(page).toHaveURL(/\/login\?next=%2Fchores$/);
  });

  test("a user without a household is told to join or create one", async ({ browser }) => {
    const { page } = await newUser(browser, "Solo");
    await openChores(page);

    await expect(page.getByText("Join or create a household to see chores.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Add chore" })).toHaveCount(0);
  });

  test("the dashboard summarises open and overdue chores", async ({ browser }) => {
    const { page } = await ownerWithHousehold(browser);
    await apiCreateChore(page, { title: `Overdue ${tag()}`, dueDate: daysFromToday(-2) });
    await apiCreateChore(page, { title: `Future ${tag()}`, dueDate: daysFromToday(5) });

    await page.goto("/dashboard");
    await waitForIslands(page);

    await expect(page.getByText("2 open · 1 overdue")).toBeVisible();
  });
});

test.describe("creating chores", () => {
  test("an owner adds a chore that is assigned to them by default", async ({ browser }) => {
    const { page, name } = await ownerWithHousehold(browser);
    const title = `Dishes ${tag()}`;

    await page.goto("/chores/new");
    await waitForIslands(page);
    await page.getByLabel("Chore name", { exact: true }).fill(title);
    await page.getByLabel("Description (optional)", { exact: true }).fill("After dinner");
    await page.getByRole("button", { name: "Add chore" }).click();

    await expect(page).toHaveURL(/\/chores/);
    await expect(page.getByRole("status")).toHaveText("Chore added.");
    const item = choreItem(page, title);
    await expect(item).toContainText(`Assigned to ${name} (you)`);
    await expect(item.locator(".badge").first()).toHaveText("Pending");
    await expect(item).toContainText("After dinner");
  });

  test("an owner assigns a chore to another member", async ({ browser }) => {
    const { page, household } = await ownerWithHousehold(browser);
    const member = await newUser(browser, "Helper");
    await apiJoinHousehold(member.page, household.inviteCode);
    const title = `Laundry ${tag()}`;

    await page.goto("/chores/new");
    await waitForIslands(page);
    await page.getByLabel("Chore name", { exact: true }).fill(title);
    await page.getByLabel("Assigned to", { exact: true }).selectOption({ label: member.name });
    await page.getByRole("button", { name: "Add chore" }).click();

    await expect(page).toHaveURL(/\/chores/);
    await expect(choreItem(page, title)).toContainText(`Assigned to ${member.name}`);
  });

  test("shows field errors for an empty form and sends nothing", async ({ browser }) => {
    const { page } = await ownerWithHousehold(browser);
    await page.goto("/chores/new");
    await waitForIslands(page);

    let choresPosts = 0;
    page.on("request", (request) => {
      if (request.method() === "POST" && request.url().endsWith("/api/chores")) choresPosts += 1;
    });

    await page.getByLabel("Due date", { exact: true }).fill("");
    await page.getByRole("button", { name: "Add chore" }).click();

    await expect(page.getByRole("alert").filter({ hasText: "Please correct the highlighted fields." })).toBeVisible();
    await expect(page.getByText("Chore name is required.")).toBeVisible();
    await expect(page.getByText("Due date is required.")).toBeVisible();
    expect(choresPosts).toBe(0);
  });

  test("the server rejects an assignee from another household with a field error", async ({ browser }) => {
    const { page } = await ownerWithHousehold(browser);
    const stranger = await ownerWithHousehold(browser, "Stranger");

    const strangerView = await (await stranger.page.request.get("/api/chores")).json();
    const strangerMemberId = strangerView.data.members[0].id;

    const response = await page.request.post("/api/chores", {
      data: { title: "Sneaky", description: "", dueDate: todayIso(), assignedUserId: strangerMemberId },
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).fieldErrors).toEqual({ assignedUserId: "Choose a member of your household." });
  });
});

test.describe("completing chores", () => {
  test("an assigned member completes a chore and can reopen it", async ({ browser }) => {
    const owner = await ownerWithHousehold(browser);
    const member = await newUser(browser, "Doer");
    await apiJoinHousehold(member.page, owner.household.inviteCode);
    const title = `Vacuum ${tag()}`;
    await apiCreateChore(owner.page, { title, assignedUserId: (await memberIdFor(member.page)) });

    await openChores(member.page);
    const item = choreItem(member.page, title);
    await item.getByRole("button", { name: "Mark as complete" }).click();
    await expect(member.page.getByRole("status")).toHaveText(`Marked "${title}" as complete.`);
    await expect(item.locator(".badge").first()).toHaveText("Completed");

    await item.getByRole("button", { name: "Mark as pending" }).click();
    await expect(item.locator(".badge").first()).toHaveText("Pending");

    await openChores(owner.page);
    await expect(choreItem(owner.page, title).locator(".badge").first()).toHaveText("Pending");
  });

  test("a member cannot complete someone else's chore", async ({ browser }) => {
    const owner = await ownerWithHousehold(browser);
    const member = await newUser(browser, "Bystander");
    await apiJoinHousehold(member.page, owner.household.inviteCode);
    const title = `Owner task ${tag()}`;
    await apiCreateChore(owner.page, { title });

    await openChores(member.page);
    await expect(choreItem(member.page, title)).toBeVisible();
    await expect(choreItem(member.page, title).getByRole("button", { name: "Mark as complete" })).toHaveCount(0);

    const response = await member.page.request.patch(`/api/chores/${await choreIdFor(owner.page, title)}/status`, {
      data: { status: "completed" },
    });
    expect(response.status()).toBe(403);
  });
});

test.describe("editing and deleting chores", () => {
  test("an owner edits a chore and reassigns it", async ({ browser }) => {
    const owner = await ownerWithHousehold(browser);
    const member = await newUser(browser, "Newperson");
    await apiJoinHousehold(member.page, owner.household.inviteCode);
    const original = `Recycling ${tag()}`;
    await apiCreateChore(owner.page, { title: original });

    await openChores(owner.page);
    await choreItem(owner.page, original).getByRole("link", { name: "Edit" }).click();
    await expect(owner.page.getByRole("heading", { level: 1, name: "Edit chore" })).toBeVisible();
    await waitForIslands(owner.page);

    const edited = `${original} (edited)`;
    await owner.page.getByLabel("Chore name", { exact: true }).fill(edited);
    await owner.page.getByLabel("Assigned to", { exact: true }).selectOption({ label: member.name });
    await owner.page.getByRole("button", { name: "Save chore" }).click();

    await expect(owner.page).toHaveURL(/\/chores/);
    await expect(owner.page.getByRole("status")).toHaveText("Chore saved.");
    await expect(choreItem(owner.page, edited)).toContainText(`Assigned to ${member.name}`);
    await expect(choreItem(owner.page, original)).toHaveCount(0);
  });

  test("an owner deletes a chore after confirming, and keeps it when they cancel", async ({ browser }) => {
    const owner = await ownerWithHousehold(browser);
    const title = `Bins ${tag()}`;
    await apiCreateChore(owner.page, { title });

    await openChores(owner.page);
    owner.page.once("dialog", (dialog) => dialog.dismiss());
    await choreItem(owner.page, title).getByRole("button", { name: "Delete" }).click();
    await expect(choreItem(owner.page, title)).toBeVisible();

    owner.page.once("dialog", (dialog) => dialog.accept());
    await choreItem(owner.page, title).getByRole("button", { name: "Delete" }).click();
    await expect(choreItem(owner.page, title)).toHaveCount(0);
    await expect(owner.page.getByRole("status")).toHaveText(`Deleted "${title}".`);
  });

  test("a plain member sees no add, edit, or delete controls and gets 403 from the API", async ({ browser }) => {
    const owner = await ownerWithHousehold(browser);
    const member = await newUser(browser, "Plainmember");
    await apiJoinHousehold(member.page, owner.household.inviteCode);
    const title = `Owned ${tag()}`;
    const chore = await apiCreateChore(owner.page, { title });

    await openChores(member.page);
    await expect(choreItem(member.page, title)).toBeVisible();
    await expect(member.page.getByRole("link", { name: "Add chore" })).toHaveCount(0);
    await expect(member.page.getByRole("link", { name: "Edit" })).toHaveCount(0);
    await expect(member.page.getByRole("button", { name: "Delete" })).toHaveCount(0);

    await member.page.goto("/chores/new");
    await expect(member.page.getByText("Only household owners and adults can add or edit chores.")).toBeVisible();

    const create = await member.page.request.post("/api/chores", {
      data: { title: "Nope", description: "", dueDate: todayIso(), assignedUserId: chore.assignee.id },
    });
    expect(create.status()).toBe(403);
    const remove = await member.page.request.delete(`/api/chores/${chore.id}`);
    expect(remove.status()).toBe(403);
  });
});

test.describe("household isolation", () => {
  test("another household's chores are invisible and cannot be read, changed, or deleted", async ({ browser }) => {
    const owner = await ownerWithHousehold(browser);
    const title = `Private ${tag()}`;
    const chore = await apiCreateChore(owner.page, { title });

    const outsider = await ownerWithHousehold(browser, "Outsider");
    await openChores(outsider.page);
    await expect(choreItem(outsider.page, title)).toHaveCount(0);
    await expect(outsider.page.getByText("No chores yet. Add the first one to get started.")).toBeVisible();

    const read = await outsider.page.request.get(`/api/chores/${chore.id}`);
    expect(read.status()).toBe(404);
    expect(await read.text()).not.toContain(title);

    const edit = await outsider.page.request.patch(`/api/chores/${chore.id}`, {
      data: { title: "Hijacked", description: "", dueDate: todayIso() },
    });
    expect(edit.status()).toBe(404);

    const status = await outsider.page.request.patch(`/api/chores/${chore.id}/status`, { data: { status: "completed" } });
    expect(status.status()).toBe(404);

    const remove = await outsider.page.request.delete(`/api/chores/${chore.id}`);
    expect(remove.status()).toBe(404);

    const stillThere = await owner.page.request.get(`/api/chores/${chore.id}`);
    expect((await stillThere.json()).data.chore).toMatchObject({ title, status: "pending" });
  });

  test("the chores API refuses signed-out requests and reveals nothing", async ({ request }) => {
    const list = await request.get("/api/chores");
    expect(list.status()).toBe(401);
    expect(await list.text()).not.toContain("chores");

    const create = await request.post("/api/chores", { data: { title: "x", description: "", dueDate: todayIso() } });
    expect(create.status()).toBe(401);
  });
});

test.describe("chores on a phone", () => {
  test("adds a chore on a phone-sized screen without horizontal scrolling @mobile", async ({ browser }) => {
    const { page } = await ownerWithHousehold(browser);
    await page.goto("/chores/new");
    await waitForIslands(page);
    const title = `Mobile ${tag()}`;

    const nameField = page.getByLabel("Chore name", { exact: true });
    await expect(nameField).toBeVisible();
    await nameField.fill(title);
    await page.getByRole("button", { name: "Add chore" }).click();
    await expect(page).toHaveURL(/\/chores/);
    await expect(choreItem(page, title)).toBeVisible();

    const overflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflows).toBe(false);
  });
});

// Looks up the id of the signed-in user, from the household view, for assigning chores to them.
async function memberIdFor(page: Page): Promise<string> {
  const me = await (await page.request.get("/api/auth/me")).json();
  const chores = await (await page.request.get("/api/chores")).json();
  const member = chores.data.members.find((entry: { firstName: string }) => entry.firstName === me.data.user.firstName);
  return member.id;
}

async function choreIdFor(page: Page, title: string): Promise<string> {
  const chores = await (await page.request.get("/api/chores")).json();
  return chores.data.chores.find((chore: { title: string }) => chore.title === title).id;
}
