# Bakeoff 3 Implementation Plan — HomeBase on SvelteKit + GraphQL + MongoDB

**Branch:** `bakeoff-3-svelte` (created from `master`; contains no Bakeoff 1 or Bakeoff 2 commits)
**Architecture:** SvelteKit single-page app (pure CSR) + GraphQL API endpoint + MongoDB Atlas
**Status:** Draft — no application code written yet
**Date:** 2026-11-12

---

## 1. Goal and constraints

Rebuild the HomeBase MVP (F1–F3 plus the F7 dashboard summary, same scope as
Bakeoffs 1 and 2) on a third, deliberately different stack:

| | Bakeoff 1 (Next.js) | Bakeoff 2 (Astro) | Bakeoff 3 (SvelteKit) |
|---|---|---|---|
| Rendering | SSR per request | Static prerender + islands | **Client-side rendering only** |
| UI framework | React | React islands | **Svelte** |
| API style | Server Actions | REST endpoints | **GraphQL** (single endpoint) |
| Database | PostgreSQL + Prisma | PostgreSQL + Prisma | **MongoDB Atlas** (official driver) |

Required features (unchanged):

- User registration, login, and logout (F1 FR-1–10)
- Household creation, invite-code joining, member list, owner-only rename /
  role changes / member removal (F2 FR-1–13)
- Shared chores: create, list, edit, delete, assign to household members,
  complete/track with due dates and overdue indication (F3 FR-1–9)
- Dashboard summary of chores with navigation (F7, chores portion)
- Responsive desktop and mobile interface
- Form validation and error handling

Hard constraints:

- Do **not** modify, merge, or delete `bakeoff-1-nextjs` or `bakeoff-2-astro`,
  or their Render services.
- Keep the HomeBase branding and design (reuse `global.css` design tokens).
- No credentials or secrets committed; `.env` is git-ignored from the start.
- Minimal dependencies — no Apollo/urql/Houdini, no Mongoose, no CSS framework.

## 2. Research reference: SvelteKit CSR

Primary docs: **https://svelte.dev/docs/kit** — specifically:

- Page options (`ssr`, `csr`, `prerender`): https://svelte.dev/docs/kit/page-options
- Single-page apps guide: https://svelte.dev/docs/kit/single-page-apps
- Server endpoints (`+server.ts`): https://svelte.dev/docs/kit/routing#server
- Node adapter: https://svelte.dev/docs/kit/adapter-node

**How we guarantee CSR (not SSR, not SSG):**

1. `src/routes/+layout.ts` exports `export const ssr = false;` — the root
   layout option applies to every page, so **no page is ever rendered on the
   server**. The server returns an empty HTML shell and Svelte renders
   everything in the browser.
2. We do **not** set `prerender = true` anywhere, so nothing is generated at
   build time either (no SSG).
3. Verification: after `npm run build`, `curl` any page URL and confirm the
   response body contains only the empty `<div>` shell with script tags — no
   rendered page content. Playwright tests exercise the hydrated app.

The app still ships **one small server**: the `@sveltejs/adapter-node` build
serves the static client bundle *and* hosts the GraphQL endpoint
(`/api/graphql` as a SvelteKit `+server.ts`). Pages are 100% client-rendered;
only the API runs on the server. This keeps Bakeoff 3 to **one Render Web
Service** instead of a separate static site + API server, with zero change to
the CSR story. (Verify current package versions at scaffold time; SvelteKit 2
/ Svelte 5 with runes is the expected baseline.)

## 3. Proposed architecture

```
Browser ── GET /chores ─────────► adapter-node serves empty shell + JS bundle
   │                                 │ Svelte boots in browser (CSR)
   │                             <ChoreList /> component
   │                                 │
   └── POST /api/graphql ────────► GraphQL Yoga handler (+server.ts)
         { query, variables }        ├─ session cookie → sessions collection
                                     ├─ permissions check (role rules)
                                     └─ mongodb driver → Atlas → JSON data/errors
```

### 3.1 GraphQL API (single endpoint, `graphql-yoga`)

One endpoint `POST /api/graphql`, built with **GraphQL Yoga** (fits
SvelteKit's `RequestEvent` via `yoga.fetch`; schema-first SDL + resolvers, no
codegen). The client uses plain `fetch` with a ~30-line helper — no GraphQL
client library.

Schema (maps 1:1 to the REST endpoints of Bakeoffs 1/2):

```graphql
type Query {
  me: Me                      # current user + household membership, null if logged out
  myHousehold: Household      # name, inviteCode (owner/adult only), members
  chores: [Chore!]!           # household-scoped, sorted by due date then title
  chore(id: ID!): Chore       # 404-equivalent error if not in caller's household
}

type Mutation {
  register(input: RegisterInput!): AuthPayload!
  login(email: String!, password: String!): AuthPayload!
  logout: Boolean!
  updateProfile(firstName: String!, lastName: String!): Me!
  createHousehold(name: String!): Household!
  joinHousehold(inviteCode: String!): Household!
  renameHousehold(name: String!): Household!              # owner only
  updateMemberRole(memberId: ID!, role: Role!): Member!   # owner only
  removeMember(memberId: ID!): Boolean!                   # owner only; chores reassigned to owner
  createChore(input: ChoreInput!): Chore!
  updateChore(id: ID!, input: ChoreInput!): Chore!
  deleteChore(id: ID!): Boolean!
  setChoreStatus(id: ID!, completed: Boolean!): Chore!
}
```

Error conventions (GraphQL `errors` with `extensions.code`, mirroring the
HTTP codes of Bakeoffs 1/2): `UNAUTHENTICATED` (401), `FORBIDDEN` (403),
`NOT_FOUND` (404), `BAD_USER_INPUT` with `extensions.fieldErrors` (400),
`CONFLICT` for duplicate email (409). The form components render
`fieldErrors` under each input exactly like the previous bakeoffs.

Resolver order (fixed, enforced by shared helpers): (1) session → UNAUTHENTICATED;
(2) household membership → FORBIDDEN/NOT_FOUND; (3) role check via
`permissions.ts` → FORBIDDEN; (4) Zod parse of input → BAD_USER_INPUT;
(5) database operation → data.

### 3.2 MongoDB Atlas data model (official `mongodb` driver, no ODM)

| Collection | Shape | Indexes |
|---|---|---|
| `users` | `{ _id, email, passwordHash, firstName, lastName, createdAt }` | unique `email` |
| `sessions` | `{ _id, tokenHash, userId, expiresAt }` | unique `tokenHash`; TTL on `expiresAt` (auto-cleanup) |
| `households` | `{ _id, name, inviteCode, members: [{ userId, role, joinedAt }] }` | unique `inviteCode`; `members.userId` |
| `chores` | `{ _id, householdId, title, description?, assigneeId, dueDate, status, createdAt }` | `householdId` |

Document-model notes: members are **embedded** in the household (one
household per user, small member lists — reads become one query). Chores are
a separate collection (unbounded growth). Multi-step changes that Postgres
did in transactions (create household + owner membership) become single
document writes here; member removal reassigns that member's chores to the
owner with one `updateMany` then one `$pull` — acceptable for the MVP and
documented. Indexes are created by an idempotent `ensureIndexes()` run at
server startup (no migration system needed).

### 3.3 Auth and sessions (same security properties as Bakeoffs 1/2)

- Passwords hashed with **bcryptjs, cost 12**; unknown emails compare against
  a fake hash (timing-safe); login errors are always "Invalid email or password."
- Session token: `randomBytes(32).toString("base64url")`; MongoDB stores only
  the **SHA-256 hash**; 7-day expiry enforced on lookup + TTL index.
- Cookie `homebase_session`: `httpOnly`, `sameSite: "lax"`, `secure` in
  production (`NODE_ENV=production` required on Render), `path: "/"` — set
  via SvelteKit's `event.cookies` inside the GraphQL handler.
- CSRF: `sameSite=lax` httpOnly cookie + GraphQL accepts only
  `Content-Type: application/json` POSTs, which blocks cross-site form posts.
- **Route protection (F1 FR-9) in a CSR app:** the real security boundary is
  the GraphQL layer — every resolver validates the session. Client-side, the
  root layout runs a `me` query on boot; unauthenticated users are redirected
  to `/login` via `goto()`. As in Bakeoff 2, the client redirect is UX, not
  security, and the writeup says so.
- Permission matrix ported verbatim (framework-free `permissions.ts`):
  owner = everything; adult = manage chores + see invite code; member = view,
  complete only own chores.

### 3.4 Validation and error handling

- **Zod schemas ported** from the previous bakeoffs (names 1–60, email ≤254
  lowercased, password 8–72, invite code `/^[A-Z0-9]{8}$/`, role enum,
  `YYYY-MM-DD` real-calendar due dates stored as UTC midnight). Same schemas
  run in Svelte components for instant feedback; the server copy inside
  resolvers is authoritative.
- Field errors under inputs with `aria-describedby`; form errors in
  `role="alert"`; successes in `role="status"`; submitted values kept on
  error (never the password) — the exact markup/CSS patterns from Bakeoffs 1/2.
- Network failures → "Something went wrong. Please try again."
- `+error.svelte` for unknown routes; dashed-border `.empty-state` for empty lists.

### 3.5 Responsive design and branding

Copy `global.css` from Bakeoff 2 **unchanged** via a read-only git command
(`git show bakeoff-2-astro:src/styles/global.css > src/app.css`): same design
tokens (`--color-primary: #2456b8`, etc.), single `@media (min-width: 720px)`
breakpoint, `.container`/`.card`/`.btn`/`.badge`/`.chore-item` classes, focus
rings, `prefers-reduced-motion`. Header/nav lives in `+layout.svelte` with
`aria-current="page"` derived from `page.url` — Svelte makes this reactive
for free.

## 4. Project structure

```
svelte.config.js          # adapter-node
vite.config.ts
package.json              # @sveltejs/kit, adapter-node, svelte, graphql-yoga,
                          # graphql, mongodb, bcryptjs, zod, vitest, playwright
.env                      # MONGODB_URL (git-ignored; never committed)
src/
  app.css                 # ported HomeBase branding
  app.html
  routes/
    +layout.ts            # export const ssr = false  ← the CSR switch
    +layout.svelte        # header, nav, auth bootstrap (me query)
    +page.svelte          # / → redirect to /dashboard
    login/+page.svelte
    register/+page.svelte
    dashboard/+page.svelte
    household/+page.svelte
    chores/+page.svelte
    chores/new/+page.svelte
    chores/[id]/edit/+page.svelte    # dynamic routes are fine in CSR
    profile/+page.svelte
    api/graphql/+server.ts           # the ONLY server-rendered thing: the API
  lib/
    client/
      graphql.ts          # fetch helper: query(doc, vars) → data | typed errors
      auth.svelte.ts      # Svelte 5 runes store for the `me` result + guard helper
    components/           # FormField, ChoreList, ChoreForm, HouseholdView, …
    shared/
      validation.ts       # Zod schemas (ported)
      permissions.ts      # role matrix (ported)
      dates.ts            # due-date helpers (ported)
    server/               # importable only by +server.ts (SvelteKit enforces
      db.ts               #   $lib/server/* never reaches client bundles)
      session.ts          # token create/lookup/destroy, cookie helpers
      schema.ts           # GraphQL SDL
      resolvers.ts        # resolvers using helpers below
      guards.ts           # requireUser / requireMembership / requireRole
      invite-code.ts      # ported generator
e2e/                      # Playwright suite ported from previous bakeoffs
docs/plans/BAKEOFF-3-implementation-plan.md   # this file
render.svelte.yaml        # NEW blueprint, Bakeoff 3 services only (deploy phase)
```

SvelteKit's `$lib/server/` convention is a build-time guarantee that the
Mongo driver, session code, and resolvers can never be imported into client
code — the equivalent of Bakeoff 2's ESLint rule, but built in.

## 5. Implementation phases

**Phase 0 — Clean the working tree** (first implementation prompt):
the directory still holds untracked Bakeoff 2 leftovers (`src/`, `dist/`,
`.astro/`, `node_modules/`, `playwright-report/`, `test-results/`, and a
`.env` that may hold Bakeoff 2 secrets). Move `.env` out of the repo (do not
delete), remove the rest, and add a `.gitignore` covering `node_modules/`,
`.env`, `.env.*`, `build/`, `.svelte-kit/`, `playwright-report/`,
`test-results/` **before** anything else so `git add .` can never commit a
secret.

**Phase 1 — Scaffold + foundation:** `npx sv create` (SvelteKit, TypeScript,
minimal), adapter-node, `ssr = false` in root layout, port `app.css` +
shared libs (`validation`, `permissions`, `dates`, `invite-code`) read-only
from `bakeoff-2-astro`, Mongo connection singleton + `ensureIndexes()`,
layouts/nav shells for all routes. Verify CSR with the §2 curl check.

**Phase 2 — Auth (F1):** sessions + guards, GraphQL schema/resolvers for
`register/login/logout/me/updateProfile`, login/register/profile pages, auth
store + client-side redirect guard, unit tests for session + validation.

**Phase 3 — Households (F2):** create/join/rename/member-role/remove
resolvers with permission checks, `/household` page (create/join forms,
member list, owner controls, remove confirmation).

**Phase 4 — Chores + dashboard (F3, F7):** chore CRUD + status resolvers
(household-scoped, overdue computed server-side), `/chores` list with status
toggle + delete-confirm + overdue badges, create/edit form with member
select, dashboard summary (open count + next 5 pending).

**Phase 5 — Testing + polish:** port the Playwright e2e suite (desktop
1280×800 + Pixel 5 mobile projects; URL change: `/chores/[id]/edit` returns),
Vitest unit tests for permissions/validation/guards, responsive pass,
empty/error states.

**Phase 6 — Deploy (separate prompt):** `render.svelte.yaml` blueprint with a
new `homebase-svelte` Web Service (`branch: bakeoff-3-svelte`, build
`npm ci && npm run build`, start `node build`, env `NODE_ENV=production`,
`MONGODB_URL` from dashboard secret). No Render database — Atlas is external.
Existing Bakeoff 1/2 services untouched.

## 6. Manual setup required (user)

1. **MongoDB Atlas** (free M0 cluster): create the cluster, a database user,
   and a connection string; allow network access from your IP (and later
   `0.0.0.0/0` or Render's IPs for deployment). Put the connection string in
   `.env` as `MONGODB_URL` — never commit it.
2. **Render** (deploy phase only): create the new Blueprint from
   `render.svelte.yaml` and set `MONGODB_URL` as a dashboard secret.

## 7. Risks / notes

- **CSR trade-offs (accepted, same as Bakeoff 2's static pages):** no
  server-side auth redirects, loading states on first paint, SEO-irrelevant
  for an authenticated app. Documented in the final writeup.
- **No multi-document transactions** on the Atlas M0 free tier without
  replica-set-aware code; the data model avoids needing them (§3.2).
- **Carried limitations** (intentional, for fair comparison): one household
  per user, no password reset, no login rate limiting, UTC due dates.
- Package versions (SvelteKit, Yoga, mongodb driver) verified at scaffold
  time against npm before code is written.
