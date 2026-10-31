# Bakeoff 2 Implementation Plan — HomeBase on Astro

**Branch:** `bakeoff-2-astro` (verified: created from `master` at `296d94a`; no `bakeoff-1-nextjs` commits are included)
**Architecture:** Astro static prerendering + React interactive islands + on-demand API endpoints
**Status:** Draft for approval — no application code written yet
**Date:** 2026-10-31

---

## 1. Goal and constraints

Rebuild the HomeBase MVP (features F1–F3 plus the F7 dashboard summary) with an
architecture that is the deliberate opposite of Bakeoff 1:

| | Bakeoff 1 (Next.js 16) | Bakeoff 2 (Astro) |
|---|---|---|
| Page rendering | Server-rendered per request (RSC) | **Prerendered static HTML at build time** |
| Interactivity | Server Actions, full-page React | **React islands only where needed** |
| Data mutations | Server Actions | **REST API endpoints** (`src/pages/api/`) |
| JS shipped | React runtime on every page | Zero JS on static shell; JS only for islands |

Required features (unchanged from Bakeoff 1):

- User registration, login, and logout
- Household creation and joining (invite codes)
- Shared chores with assignments, due dates, and completion
- Responsive desktop and mobile interface
- Form validation and error handling

Hard constraints:

- Keep the HomeBase branding, colors, and design from Bakeoff 1 (`globals.css` design tokens).
- Do **not** modify, merge, or delete `bakeoff-1-nextjs`.
- Do **not** change the existing live Render deployment; Bakeoff 2 deploys as new services.

## 2. Research findings that shape this plan

1. **Current Astro is 7.x.** Verified on npm on 2026-10-31: `astro` 7.4.4,
   `@astrojs/node` 11.1.9, `@astrojs/react` 7.1.2. Most training material
   describes Astro 5, so read the upgrade notes at
   `docs.astro.build/en/guides/upgrade-to/` before writing code.
   The newer API details from the earlier docs review (`sessionDrivers`,
   `astro/hono` route guarding, Oxc-based React integration) were **not
   re-verified this session**; confirm each against the installed packages
   before relying on it.
2. **Static is the default.** `output: 'static'` prerenders every page and
   endpoint at build time. Individual routes opt out with
   `export const prerender = false` (the old `'hybrid'` mode is gone — this is
   the pattern). We keep the default and opt out only for API endpoints.
3. **An adapter is required for any on-demand route.** We use
   `@astrojs/node` with `mode: 'standalone'`; it serves the prerendered pages
   and static assets itself from `dist/client/` and runs on-demand routes from
   `dist/server/entry.mjs` (configurable via `HOST`/`PORT` env vars) — a
   good fit for a single Render Web Service.
4. **React islands:** `npx astro add react`; hydrate with `client:load`
   (forms), `client:idle`, or `client:visible`. Props must be serializable;
   React context does not cross islands — shared client state uses
   **nanostores** (`@nanostores/react`).
5. **API endpoints** are files in `src/pages/api/*.ts` exporting
   `GET`/`POST`/`PATCH`/`DELETE` functions typed `satisfies APIRoute`, each with
   `export const prerender = false`. They receive an `APIContext` with
   `request`, `cookies` (get/set/delete), and `redirect`.
6. **Auth:** Astro has no official auth solution. The docs sanction
   hand-rolled session auth (the Lucia learning resource) — which matches
   Bakeoff 1's proven design, so we port it. Built-in `Astro.session` exists
   but stores data in an adapter-managed driver; our Postgres-backed `Session`
   table is more durable on Render's free tier and reuses tested code, so we
   keep it.
7. **Prerendered pages never run middleware or server code at request time.**
   Consequence: static app pages cannot do server-side auth redirects. The
   security boundary moves entirely to the API layer (every endpoint validates
   the session); page-level redirects become a client-side UX convenience.
   This is the honest trade-off of a genuinely static architecture, and we
   document it as such.

## 3. Proposed architecture

```
Browser ── GET /chores ──────────► static HTML (prerendered shell, cached)
   │                                  │ hydrates
   │                              <ChoreList client:load />  (React island)
   │                                  │
   └── fetch /api/chores ─────────► Node adapter (on-demand endpoint)
                                      ├─ session cookie → Session table lookup
                                      ├─ permissions check (role rules)
                                      └─ Prisma → PostgreSQL → JSON response
```

Every page is a static `.astro` shell carrying the full HomeBase layout
(header, nav, headings, cards, empty-state skeletons) rendered to HTML at
build time with **zero JavaScript**. Interactive regions are React islands
that call the JSON API. Authentication state reaches the client only through
`GET /api/auth/me`; the session cookie is httpOnly and never readable by JS.

### 3.1 Statically generated pages (all prerendered at build time)

| Route | Shell content (static) | Island inside |
|---|---|---|
| `/` | Redirect page → `/dashboard` (meta refresh + link) | — |
| `/login` | Auth layout, heading, footer links | `LoginForm` |
| `/register` | Auth layout, heading, password hint | `RegisterForm` |
| `/dashboard` | Welcome card frame, "Coming later" card (fully static) | `DashboardSummary` |
| `/household` | Page heading, create/join card grid frame | `HouseholdView` |
| `/chores` | Page heading, list frame | `ChoreList` |
| `/chores/new` | Page heading, form frame | `ChoreForm` (create mode) |
| `/chores/edit` | Page heading, form frame (chore id via `?id=` query param) | `ChoreForm` (edit mode) |
| `/profile` | Page heading, read-only email frame | `ProfileForm` |
| `/404` | Fully static error page | — |

Design note: Bakeoff 1 used the dynamic route `/chores/[choreId]/edit`. A
dynamic path cannot be prerendered without knowing all ids at build time, so
Bakeoff 2 uses `/chores/edit?id=<choreId>` — the page shell stays 100% static
and the island reads the id from `location.search`. Unknown/foreign ids
render the same "not found" state the API returns (404 JSON).

### 3.2 React islands (the only client JavaScript)

| Island | Directive | Responsibility |
|---|---|---|
| `LoginForm`, `RegisterForm` | `client:load` | Submit to auth endpoints, inline field errors, redirect on success |
| `UserMenu` (header) | `client:idle` | Fetch `/api/auth/me`, show "Hi, {firstName}" + Log out button; hides on auth pages |
| `AuthGuard` (tiny, per app page) | `client:load` | If `/api/auth/me` → 401, client-redirect to `/login` (UX only; data is protected server-side) |
| `HouseholdView` | `client:load` | Create/join forms when no household; name, invite code, rename, member list with role select + remove when in one |
| `ChoreList` | `client:load` | Fetch chores, status toggle, delete-with-confirm, overdue badges |
| `ChoreForm` | `client:load` | Create/edit chore, member select populated from API |
| `DashboardSummary` | `client:load` | Open-chores count + next 5 pending chores |
| `ProfileForm` | `client:load` | Edit first/last name |

Shared client state: a single nanostores `map` holding the `/api/auth/me`
result (user + membership) so `UserMenu`, `AuthGuard`, and page islands share
one fetch instead of three. React context is not used across islands (it
cannot cross island boundaries).

### 3.3 Server API endpoints (all `export const prerender = false`)

These must run on the server because they touch the session cookie,
bcrypt, and PostgreSQL. They mirror the REST endpoints already sketched in
the F1–F3 feature plans on `master`.

| Endpoint | Methods | Purpose | Auth required |
|---|---|---|---|
| `/api/auth/register` | POST | Create user, start session | no |
| `/api/auth/login` | POST | Verify password, start session | no |
| `/api/auth/logout` | POST | Destroy session + cookie | yes |
| `/api/auth/me` | GET | Current user + membership (or 401) | yes |
| `/api/profile` | PATCH | Update first/last name | yes |
| `/api/households` | POST | Create household (owner membership in one transaction) | yes |
| `/api/households/join` | POST | Join via invite code (role `member`) | yes |
| `/api/households/current` | GET, PATCH | Household details + members; rename (owner only) | yes |
| `/api/households/members/[memberId]` | PATCH, DELETE | Change role / remove member (owner only; chores reassigned to owner in-transaction) | yes |
| `/api/chores` | GET, POST | List (sorted by due date, title) / create | yes |
| `/api/chores/[choreId]` | GET, PATCH, DELETE | Read / update / delete one chore (scoped to household) | yes |
| `/api/chores/[choreId]/status` | PATCH | Toggle pending/completed | yes |

Response conventions (same shape as Bakeoff 1's `FormState` so ported tests
and error UI keep working):

- `200/201` → `{ data: ... }`
- `400` → `{ error, fieldErrors?: Record<string,string>, values?: ... }` (first Zod issue per field; password never echoed)
- `401` → `{ error: "You must be logged in." }`
- `403` → `{ error: "You do not have permission to do that." }`
- `404` → `{ error: "Not found." }`
- `409` → `{ error: "An account with this email already exists." }` (Prisma P2002)

### 3.4 Sessions and permissions (ported from Bakeoff 1, adapted to Astro)

**Session design — identical security properties to Bakeoff 1:**

- Passwords hashed with **bcryptjs, cost 12**; unknown emails still run a
  compare against a fake hash (timing-safe); login errors are always
  "Invalid email or password."
- Session token: `randomBytes(32).toString("base64url")`; the database stores
  only the **SHA-256 hash** (`Session.tokenHash`), so a DB leak exposes no
  usable tokens.
- Cookie `homebase_session`: `httpOnly`, `sameSite: "lax"`, `secure` in
  production, `path: "/"`, 7-day expiry — set via Astro's `context.cookies`
  instead of `next/headers`. **Render requirement:** the `Secure` flag is
  only set when `NODE_ENV=production`, so the Render service must define
  `NODE_ENV=production`. Without it, production session cookies are not
  marked `Secure`.
- `getCurrentUser(context)` hashes the cookie value, looks up the session,
  rejects expired rows. `requireUser` / `requireMembership` become endpoint
  helpers returning 401/403 `Response`s instead of Next.js redirects.

**Permission matrix — `src/lib/permissions.ts` ports verbatim (framework-free):**

| Action | owner | adult | member |
|---|---|---|---|
| Rename household, change roles, remove members | ✅ | ❌ | ❌ |
| Create / edit / delete chores | ✅ | ✅ | ❌ |
| Complete a chore | ✅ | ✅ | only if assigned to them |

Enforcement lives **only in the API endpoints** (the real boundary). Static
pages render for anyone; islands hide/disable controls based on
`/api/auth/me` role data, which is cosmetic, not security.

CSRF posture: same as Bakeoff 1 (`sameSite=lax` cookie, JSON-body POSTs). We
additionally reject state-changing requests whose `Content-Type` is not
`application/json`, which blocks plain cross-site form posts.

### 3.5 Validation and error handling

- **Zod schemas port unchanged** from `src/lib/validation.ts` (names 1–60,
  email ≤254 lowercased, password 8–72, invite code `/^[A-Z0-9]{8}$/`, role
  enum, `YYYY-MM-DD` real-calendar due dates stored as UTC midnight).
  The same schemas run in islands for instant feedback; the server copy
  is authoritative.
- Server-side validation in every endpoint is authoritative; islands render
  `fieldErrors` under each input with `aria-describedby`, form-level errors in
  `role="alert"`, successes in `role="status"` — the exact Bakeoff 1 markup
  and CSS classes (`.field__error`, `.message--error`, `.message--success`).
- Islands keep submitted values on error (never the password).
- Fetch/network failures surface "Something went wrong. Please try again."
- Static `/404` page; islands show the dashed-border `.empty-state` pattern
  for empty lists.

### 3.6 Responsive design and branding (kept from Bakeoff 1)

- Copy `src/app/globals.css` → `src/styles/global.css` **unchanged**: same
  design tokens (`--color-primary: #2456b8`, `--color-bg: #f5f6f8`, danger
  `#a4281c`, success `#1d6b38`, warning `#7a4d00`, `--radius: 10px`), same
  system font stack, same single `@media (min-width: 720px)` breakpoint, same
  `.container`/`.card`/`.btn`/`.badge`/`.chore-item` classes, same focus-ring
  and `prefers-reduced-motion` accessibility rules.
- Header/nav markup reproduced in `src/layouts/AppLayout.astro` (static), with
  `aria-current="page"` set at build time per page — no client JS needed for
  nav highlighting, unlike Bakeoff 1's client component.
- Same text-only "HomeBase" brand link, same page titles ("%s | HomeBase"),
  same skip link to `#main`.

### 3.7 Securing the API and PostgreSQL access

The trust boundary is the server. Everything under `src/pages/api/` and
`src/lib/server/` runs on the server; the static HTML and island bundles are
what reach the browser. The rules below keep secrets and database access on
the server side of that line.

- **Server-only modules.** The Prisma client, `session.ts`, and endpoint
  helpers live in `src/lib/server/`. Islands may import only `src/islands/`,
  `src/stores/`, and the pure shared modules (`validation.ts`,
  `permissions.ts`). An ESLint `no-restricted-imports` rule enforces this:
  `@prisma/*`, `pg`, `node:crypto`, and `src/lib/server/**` are forbidden
  under `src/islands/**`.
- **Secrets never reach the client.** `DATABASE_URL` is declared as a server
  secret in Astro's `astro:env` server schema (`access: "secret"`; confirm
  the option name in the installed version). No secret uses the `PUBLIC_`
  prefix, and `.env` is git-ignored (§5).
- **Parameterized database access only.** Prisma with the `@prisma/adapter-pg`
  driver adapter, as in Bakeoff 1. No `$queryRawUnsafe`; any raw SQL uses
  tagged templates.
- **Never trust client IDs for scope.** Chore and member queries filter by the
  `householdId` of the caller's membership, loaded from the session, not from
  the request body or URL. A chore id outside the caller's household returns
  404, the same behavior the Bakeoff 1 isolation e2e spec checks.
- **Fixed endpoint order:** (1) session → 401; (2) membership → 403/404;
  (3) role check via `permissions.ts` → 403; (4) Zod parse of the body → 400;
  (5) query → response. Steps 1–2 live in the `requireUser` /
  `requireMembership` helpers so no endpoint can skip them.
- **Session tokens:** 32 random bytes, SHA-256 hashed in `Session.tokenHash`,
  httpOnly cookie, `sameSite=lax`, `secure` in production, expiry checked on
  every request, row deleted on logout.
- **Strict input:** Zod request schemas use `.strict()`, so unknown fields
  such as `householdId` or `role` are rejected instead of silently applied.
  Mutating requests must have `Content-Type: application/json`, and bodies
  over 16 KB are rejected.
- **Error handling:** endpoints return the §3.3 JSON shapes. Prisma errors and
  stack traces are logged server-side (`src/lib/logger.ts`) and never
  returned. `isUniqueViolation` maps P2002 to 409.
- **Caching:** API responses send `Cache-Control: no-store`, so per-user data
  is never cached by a browser or CDN. Static pages cannot carry per-request
  headers; they contain no user data, so this is acceptable.
- **Transactions** for multi-row changes: household creation (household +
  owner membership) and member removal (reassign chores to the owner).
- **Verification:** Vitest covers the endpoint helpers and permission checks.
  The ported isolation e2e spec must pass. After `astro build`, grep
  `dist/client/` for `DATABASE_URL` and `@prisma`; both must be absent.
- **Known gaps (carried from Bakeoff 1, §9):** no login rate limiting and no
  password reset. Both are documented, not fixed, to keep the comparison fair.

## 4. Reusing Bakeoff 1 code without merging branches

`bakeoff-1-nextjs` is treated as **read-only**. Files are copied onto
`bakeoff-2-astro` with read-only git commands — no merge, no rebase, no
cherry-pick, and no commits on the Bakeoff 1 branch. `git checkout <branch> -- <path>`
and `git show <branch>:<path>` read from Bakeoff 1's objects and write only into
the Bakeoff 2 working tree.

**Working-tree prerequisite (see step 0 in §8).** The main directory is on
`bakeoff-2-astro`, but it still holds untracked Bakeoff 1 leftovers: `.env`,
`.next/`, `node_modules/`, `next-env.d.ts`, `playwright-report/`,
`test-results/`, `tsconfig.tsbuildinfo`, and a partial `src/` tree. The
checkout removed some tracked Bakeoff 1 files and left others untracked.
Git history is intact, and nothing has been deleted. These leftovers would
block the copy commands below, so they must be cleared first.

```bash
# After step 0 (clean tree), from the Bakeoff 2 directory:
git checkout bakeoff-1-nextjs -- prisma prisma.config.ts
git checkout bakeoff-1-nextjs -- src/lib/validation.ts src/lib/validation.test.ts \
    src/lib/permissions.ts src/lib/permissions.test.ts src/lib/password.ts \
    src/lib/invite-code.ts src/lib/dates.ts src/lib/dates.test.ts src/lib/logger.ts
mkdir -p src/lib/server src/styles
git show bakeoff-1-nextjs:src/lib/db.ts > src/lib/server/db.ts    # then fix imports
git show bakeoff-1-nextjs:src/app/globals.css > src/styles/global.css
git checkout bakeoff-1-nextjs -- e2e
```

If Bakeoff 1 must run side by side later, add a separate worktree rather than
switching this directory: `git worktree add ../homebase-bakeoff1 bakeoff-1-nextjs`.

| Asset | Reuse | Adaptation needed |
|---|---|---|
| `prisma/schema.prisma` + init migration + `prisma.config.ts` | As-is | None (schema is framework-agnostic) |
| `validation.ts`, `permissions.ts`, `password.ts`, `invite-code.ts`, `dates.ts` + unit tests | As-is | None — checked: no imports from `next`, `react`, or `server-only`. Bakeoff 1 uses the `@/` alias, so add the same `paths` entry to `tsconfig.json` |
| `db.ts` (Prisma singleton, P2002 helper) | Logic reused | Move to `src/lib/server/db.ts`. Keep `@prisma/adapter-pg` and the generated client path (`@/generated/prisma/client`) |
| `logger.ts` | As-is | Confirm no Next imports when copied |
| `session.ts` | Logic reused | Rewrite I/O: `next/headers`, `next/navigation`, and React `cache()` → Astro `APIContext.cookies` and per-request locals |
| `globals.css` | As-is | New path only |
| Form components | Patterns reused | Rewritten as plain React (no `useActionState`/`useFormStatus`; submit via `fetch`) |
| Playwright e2e suite (16 tests) | Mostly as-is | Selectors/flows preserved; waits adjusted for client-side fetches; `/chores/[id]/edit` URLs change to `/chores/edit?id=` |
| Server Actions (`src/app/actions/*`) | Business logic transplanted into API endpoints | Replace `revalidatePath`/`redirect` with JSON responses |

## 5. Project structure (new, on `bakeoff-2-astro`)

```
astro.config.mjs            # static output (default) + react() + node({ mode: 'standalone' })
tsconfig.json               # adds the "@/*" → "src/*" path alias from Bakeoff 1
.gitignore                  # node_modules, .env, .env*.local, dist/, .astro/, Prisma output,
                            # playwright-report/, test-results/ (match Bakeoff 1's rules)
package.json                # astro, @astrojs/react, @astrojs/node, react 19, prisma,
                            # @prisma/client, @prisma/adapter-pg, pg, zod, bcryptjs,
                            # nanostores, @nanostores/react, vitest, playwright
prisma/                     # copied from bakeoff-1-nextjs
src/
  styles/global.css         # copied branding
  layouts/BaseLayout.astro  # <head>, title template, skip link, global.css
  layouts/AppLayout.astro   # header + nav (static) + UserMenu island slot
  layouts/AuthLayout.astro  # .auth-page wrapper
  pages/
    index.astro, login.astro, register.astro, dashboard.astro,
    household.astro, chores/index.astro, chores/new.astro,
    chores/edit.astro, profile.astro, 404.astro        # ALL prerendered
    api/ ... (see §3.3)                                # ALL prerender = false
  islands/                  # React components (see §3.2); no server imports
  stores/auth.ts            # nanostores map for /api/auth/me result
  lib/                      # pure shared: validation, permissions, dates, invite-code,
                            # password (hashing is server-only in practice), logger
  lib/server/               # server-only: db.ts, session.ts, endpoint helpers (§3.7)
e2e/                        # ported Playwright suite
render.astro.yaml           # NEW blueprint for separate services (see §6)
docs/BAKEOFF-2-summary.md   # written at the end, incl. comparison data (see §7)
```

## 6. Separate deployment (live site untouched)

The existing Render services (`homebase` web service + `homebase-db`,
deployed from `bakeoff-1-nextjs` via `render.yaml`) are **not edited in any
way** — not their branch, build command, env vars, or database.

**Verify first:** `render.yaml` on Bakeoff 1 has no `branch:` line, so the
live service's branch is set in the Render dashboard, not in the file. Confirm
in the dashboard that the live service tracks `bakeoff-1-nextjs` before any
Bakeoff 2 blueprint is created. Its `render.yaml` build and start commands
match what Bakeoff 2 will use.

Bakeoff 2 gets brand-new services:

- **New blueprint file** with distinct names, committed only on
  `bakeoff-2-astro` (named `render.astro.yaml` so it can never be
  confused with the live `render.yaml`):
  - `homebase-astro` — Node Web Service, free plan, `branch: bakeoff-2-astro`
    (set explicitly, not inherited)
    - build: `npm ci --include=dev && npm run build` (`build` = `prisma generate && astro build`)
    - start: `npm run db:deploy && node ./dist/server/entry.mjs`
    - env: `HOST=0.0.0.0` (Render injects `PORT`; the node adapter reads both),
      `NODE_ENV=production` (**required**: enables `Secure` on session cookies),
      `DATABASE_URL` from the new database
    - health check: `/login`
  - `homebase-astro-db` — **new, separate PostgreSQL instance** running the
    same migrations. The two apps never share a database, so Bakeoff 2 cannot
    corrupt live data. Free Postgres on Render has a limited lifetime; record
    its expiry date with the measurements in §7.
- Create the new Blueprint in the Render dashboard against `render.astro.yaml`
  only. Never re-sync the existing Blueprint to point at this file.
- The Astro docs only document Render's static-site flow; the Web Service
  recipe above follows the node adapter's documented standalone server and
  Render's standard Node service behavior — verify the health check path
  once deployed.
- Result: two independent URLs; the current HomeBase site keeps serving from
  `bakeoff-1-nextjs` unchanged.

## 7. Measuring Next.js vs Astro

Collected into `docs/BAKEOFF-2-summary.md` after deployment, comparing the two
live deployments and local builds:

1. **Client JavaScript shipped per page** (DevTools network, cache disabled):
   total JS bytes on `/login`, `/dashboard`, `/chores` for both apps. This is
   the headline islands-architecture metric — Astro's static shells should
   ship ~0 KB framework JS on pages without islands and only island bundles
   elsewhere, vs the full React/RSC runtime on every Next.js page.
2. **Lighthouse** (mobile preset, 3 runs, median) on the same three pages:
   Performance score, FCP, LCP, TBT, CLS.
3. **TTFB** on warm requests to each page (static file serve vs per-request
   SSR).
4. **Build output**: build time, number of prerendered pages, output size.
5. **Feature parity**: the same ported Playwright suite passing on both apps
   is the parity proof.
6. **Qualitative DX comparison**: lines of code (`cloc` on `src/`), number of
   files, and a written reflection on where each architecture helped or hurt
   (e.g., Server Actions vs REST endpoints, server redirects vs client
   guards, hydration model).
7. **Trade-off honesty**: document what static rendering gave up —
   per-request auth redirects, server-rendered per-user content, and
   first-paint data (islands show loading states) — alongside what it gained.

## 8. Implementation steps (in order)

Nothing below starts until this plan is approved.

0. **Clean the working tree** (needs approval before any deletion): move
   `.env` out of the repo to a safe location (it may hold live secrets; do not
   delete it), then remove the Bakeoff 1 leftovers (`src/`, `.next/`,
   `node_modules/`, `next-env.d.ts`, `playwright-report/`, `test-results/`,
   `tsconfig.tsbuildinfo`). Add `.env` to `.gitignore`. Confirm `git status`
   shows only the plan document.
1. **Scaffold** (on `bakeoff-2-astro`): `npm create astro@latest`, then add
   `@astrojs/react` 7.x and `@astrojs/node` 11.x (standalone). Confirm the
   installed Astro major (7.x expected) and read the upgrade notes before coding.
2. **Port shared code** from `bakeoff-1-nextjs` via the commands in §4:
   Prisma schema + migrations, pure lib modules + unit tests, `db.ts` into
   `lib/server/`, `global.css`, and the e2e suite.
3. **Layouts and static pages**: Base/App/Auth layouts, all ten prerendered
   pages with their static shells; verify `astro build` emits them as HTML.
4. **Session + API layer**: Astro-flavored `lib/server/session.ts`, endpoint
   helpers (`requireUser`, `requireMembership`, JSON error responses), the ESLint
   import rule, then the auth, household, and chore endpoints with Zod
   validation and permission checks (§3.7 order).
5. **Islands**: auth store (nanostores), forms, chore list, household view,
   dashboard summary, user menu, auth guard.
6. **Testing**: Vitest unit tests (ported + new session/endpoint-helper
   tests); port the Playwright suite; run desktop (1280×800) and Pixel 5
   mobile projects as in Bakeoff 1.
7. **Local verification**: full build, `node ./dist/server/entry.mjs`, manual
   walkthrough of all five required features, and the §3.7 bundle grep.
8. **Deploy** new Render services per §6 (only after plan approval; live site
   untouched), run e2e smoke against the deployed URL.
9. **Measure and document** (§7) in `docs/BAKEOFF-2-summary.md` +
   `docs/REFLECTION` update.

## 9. Risks and open questions

- **Astro API drift**: Astro is 7.x, and the newer APIs in §2 are unverified.
  Mitigation: step 1 checks the installed version and reads the shipped docs
  before any code is written. The core architecture (static default,
  `prerender = false`, islands, node standalone) is the stable part.
- **Static pages cannot redirect unauthenticated users server-side.** Accepted
  trade-off (§2.7); API layer is the security boundary, `AuthGuard` island
  handles UX. The bakeoff writeup calls this out explicitly.
- **First paint shows loading states** for user data (fetch-after-hydrate).
  Mitigated with skeletons styled like Bakeoff 1 cards.
- **Leftover secrets in the working tree**: the untracked `.env` is not
  ignored on this branch, so `git add .` could commit it. Step 0 moves it out
  and adds it to `.gitignore`.
- **Live Render branch unconfirmed**: `render.yaml` does not set a branch, so
  the live service's branch must be checked in the dashboard (§6).
- **Render free tier** cold starts affect both apps equally; measurements use
  warmed instances.
- **One household per user** and other Bakeoff 1 limitations (no password
  reset, no rate limiting, UTC due dates) are carried over intentionally for
  a fair comparison.
