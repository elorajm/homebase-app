# Bakeoff 1 Summary: HomeBase on Next.js

This document describes the Bakeoff 1 implementation of HomeBase on the `bakeoff-1-nextjs` branch. It covers the stack, the rendering model, implemented features, the database and authentication design, the test results observed in this environment, known problems, limitations, and how to run the project.

## Stack

| Layer | Choice | Version used |
| --- | --- | --- |
| Framework | Next.js App Router | 16.4.2 |
| UI | React | 19 |
| Language | TypeScript | see `package.json` |
| Database | PostgreSQL | 18.1 (local server, database `homebase`) |
| ORM | Prisma with `@prisma/adapter-pg` | 7.10.1 |
| Validation | Zod | v4 |
| Password hashing | bcryptjs, cost 12 | see `package.json` |
| Unit tests | Vitest | 3.2.7 (pinned; Vitest 4 failed to install) |
| End-to-end tests | Playwright | 1.64.x |
| Linting | ESLint 9 flat config with `eslint-config-next` | see `package.json` |

## Why Next.js

- Pages, layouts, and data reads live in one codebase, so the page that shows a chore list is also the code that checks the user's household membership.
- Form submissions use Server Actions. Forms work with the same validation and authorization code the server uses, and the browser does not need a separate JSON API for the Bakeoff scope.
- The App Router file conventions (`loading.tsx`, `error.tsx`, `not-found.tsx`, route groups) gave loading, error, and not-found states without custom routing code.
- Trade-off: some framework behavior is subtle (see Challenges), and Server Functions are reachable by direct POST, so each action checks authorization itself.

## Rendering Model

- Pages are Server Components by default. Data is read on the server with Prisma and passed to the page.
- Client Components are used only where browser state is needed: form pending and error state through `useActionState` and `useFormStatus`, and `window.confirm` before destructive actions (remove member, delete chore).
- Per-route `loading.tsx` files provide loading states for the dashboard, household, profile, chore list, and add chore pages. The chore edit route has no loading boundary, so its not-found check runs before streaming and returns a real 404. `error.tsx` provides the error boundary, and `not-found.tsx` provides the not-found UI.
- Per-request deduplication uses React `cache()` for `getCurrentUser` and `getMembershipForUser`.

## Implemented Features

Authentication (plan F1)
- Registration with first name, last name, email, and password.
- Login and logout. Logout deletes the session row.
- Profile update (first and last name). The name shown in the header updates after saving.
- Protected routes redirect to `/login` when no session exists. A logged-in user who visits `/login` is sent to `/household`.

Households (plan F2)
- Create a household. The creator becomes its owner.
- Join a household with an 8-character invite code.
- Owners rename the household, change member roles (owner, adult, member), and remove members.
- The owner cannot be changed or removed.

Shared chores (plan F3)
- Owners and adults create, edit, and delete chores. Each chore has a name, optional description, an assignee who is a household member, and a due date.
- Members see chores but cannot create, edit, or delete them.
- Members complete only chores assigned to them. Owners and adults can mark any chore complete or pending.
- Overdue is shown when a chore is pending and its due date is before today.

Dashboard (plan F7)
- `/dashboard` shows a welcome heading with the household name, a count of open (pending) chores, the next five open chores by due date with overdue badges, and a "Coming later" card for shopping list, projects, and maintenance. Users without a household are redirected to `/household`.

Loading, empty, and error states
- Loading states for the dashboard, household, profile, chore list, and add chore pages, each with its own `loading.tsx`. The edit chore route has no loading state (see Challenges).
- An empty state on the chore list ("No chores yet. Add a chore to get started."), plus error and not-found pages.

Responsive layout
- Mobile-first CSS. Navigation links and buttons have a minimum height of 44px. Layout tests check for horizontal overflow on desktop and mobile.

Routes
- `/` redirects to `/dashboard`.
- `/register`, `/login`
- `/dashboard`, `/household`, `/chores`, `/chores/new`, `/chores/[choreId]/edit`, `/profile`

## Database

- PostgreSQL database `homebase`, accessed through role `homebase_user`.
- Models: `User`, `Session`, `Household`, `HouseholdMember`, `Chore`.
- Enums: `Role` (owner, adult, member) and `ChoreStatus` (pending, completed).
- Constraints: unique email on `User`, unique `tokenHash` on `Session`, unique invite code on `Household`, one membership per user (`HouseholdMember.userId` unique).
- `Chore.dueDate` is a `@db.Date` column.
- Migration: `prisma/migrations/20261017000000_init/`.
- Every household query filters by `householdId`. A chore edit route looks up the chore with both its id and the user's household id.

## Authentication

- Passwords are hashed with bcryptjs at cost 12.
- On login, the server generates a random 32-byte token (base64url), stores its SHA-256 hash in the `Session` table, and sets the raw token in an `httpOnly` cookie named `homebase_session`. The cookie uses `sameSite=lax` and `secure` in production.
- Sessions expire after 7 days. Logout deletes the session row.
- Login errors use the same message for an unknown email and a wrong password ("Invalid email or password.").

## Permissions

| Action | Owner | Adult | Member |
| --- | --- | --- | --- |
| Rename household, change roles, remove members | Yes | No | No |
| Create, edit, delete chores | Yes | Yes | No |
| Mark any chore complete or pending | Yes | Yes | Only own assigned chores |
| View chores and household | Yes | Yes | Yes |

## Test Results

These results come from runs in this environment (Windows 11, local PostgreSQL 18.1). Nothing here is estimated.

| Check | Result |
| --- | --- |
| Unit tests (`dates`, `validation`, `permissions`) | 25 of 25 passed |
| TypeScript check (`tsc --noEmit`) | Passed |
| ESLint (`eslint .`) | Passed |
| Production build (`next build`, 10 routes) | Passed |
| Playwright end-to-end, desktop and mobile projects | 16 of 16 passed |

End-to-end coverage (all 16 passed):
- Registration: account creation, field validation, duplicate email.
- Login and logout: wrong password and unknown email, correct login, protected routes after logout, redirect from `/login` when logged in.
- Profile: name update shows in the header.
- Households: create, invite code display, short-name validation, unknown invite code, owner role change and removal, member sees no owner controls, removed member's view.
- Chores: owner and member flow, empty-form validation, create and edit with reassignment, overdue badge, member completes only own chores, member redirected from `/chores/new`, owner deletes, data persists after logout and login.
- Isolation: a user in a second household cannot see the first household's chore, and visiting its edit URL returns HTTP 404 with the not-found page and none of the other household's data.
- Layout: no horizontal overflow on desktop and mobile; mobile tap targets at least 44px.

## Challenges

- **Migrations and the shadow database.** `prisma migrate dev` failed with P3014 because the `homebase_user` role cannot create the shadow database. The role's privileges were not changed. The initial migration was generated with `prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script` and applied with `prisma migrate deploy`. Granting `CREATEDB` to the role would allow `migrate dev` later.
- **Prisma install.** The Prisma `preinstall` script crashed `npm install`. Dependencies were installed with `--ignore-scripts`, and `prisma generate` was run manually.
- **npm scripts on Windows.** `npm run` scripts failed silently from Git Bash on this machine. Commands were run by calling the `node_modules` binaries directly.
- **Lint script.** `npm run lint` exited 1 without output. The script was changed to `eslint .`.
- **Workspace root.** `next build` ignored `package-lock.json` because it detected a parent directory as the root. `turbopack.root` in `next.config.ts` fixes this.
- **Vitest.** Vitest 4 failed to install, so the project is pinned to Vitest 3.2.7.
- **Cross-household status code.** The first version of the chore edit route was protected by the root `loading.tsx`. That boundary streams the response, so the 200 status was sent before `notFound()` ran, and the cross-household request returned HTTP 200 with the not-found UI. The Next.js `loading.js` documentation describes this behavior. The fix removed the root `loading.tsx`, placed loading boundaries only on the list, add, dashboard, household, and profile routes, and moved the chore list into a `(list)` route group so the edit route is not inside any loading boundary. The lookup now runs before streaming and returns a real 404. The cost is that the edit page has no loading state.
- **Route announcer.** Next.js renders its own `role="alert"` element, so tests use a helper that combines the role with the `.message--error` class.
- **Login race.** The persistence test waits for the redirect to `/dashboard` before navigating, so it does not read the page before the session cookie is set.

## Limitations

- No rate limiting on login or registration.
- No password reset or email verification.
- A user belongs to at most one household.
- No ownership transfer. The owner cannot leave or be removed.
- Plan features F4 through F6 are not implemented.
- Dates are handled in UTC. A chore due "today" in a time zone far from UTC can show as overdue or not overdue at the wrong time.
- PostgreSQL 18.1 is the version used here. Other versions were not tested.
- No login throttling, no account lockout. Cross-site request protection relies on `sameSite=lax` cookies and Next.js Server Action POST handling; no separate CSRF token was added.
- Decided: users without a household are sent to `/household` after registering or logging in, where they create or join one.

## Run Instructions

Requirements: Node.js, npm, PostgreSQL with a `homebase` database and a `homebase_user` role that can connect to it.

1. Copy `.env.example` to `.env` and set `DATABASE_URL` to your connection string. Do not commit `.env`.
2. Install dependencies: `npm install --ignore-scripts`, then `npx prisma generate` (or `npm run db:generate`).
3. Apply migrations: `npm run db:deploy`.
4. Start the app from the project folder: `node node_modules/next/dist/bin/next dev`, then open http://localhost:3000. For a production check, run `node node_modules/next/dist/bin/next build` and then `node node_modules/next/dist/bin/next start`.
5. Run unit tests: `node node_modules/vitest/vitest.mjs run`.
6. Run end-to-end tests: install the browser once with `node node_modules/playwright/cli.js install chromium`, then `node node_modules/@playwright/test/cli.js test`. To test against a running server, set `E2E_BASE_URL` (for example `http://localhost:3000`). Otherwise Playwright builds and starts the app.
7. Other checks: `node node_modules/typescript/bin/tsc --noEmit`, `node node_modules/eslint/bin/eslint.js .`.

On Windows, `npm run` scripts produced no output from Git Bash in this project, so these commands call the `node_modules` binaries directly. The `npm run` scripts in `package.json` are the same commands.

## Official Next.js and React References

- App Router: https://nextjs.org/docs/app
- Mutating data (Server Functions and Server Actions): https://nextjs.org/docs/app/getting-started/mutating-data
- `cookies`: https://nextjs.org/docs/app/api-reference/functions/cookies
- `notFound`: https://nextjs.org/docs/app/api-reference/functions/not-found
- `redirect`: https://nextjs.org/docs/app/api-reference/functions/redirect
- `loading.js`: https://nextjs.org/docs/app/api-reference/file-conventions/loading
- `error.js`: https://nextjs.org/docs/app/api-reference/file-conventions/error
- Route groups: https://nextjs.org/docs/app/api-reference/file-conventions/route-groups
- React `useActionState`: https://react.dev/reference/react/useActionState

## Benchmarks

No performance benchmarks were run. This document contains no timing or throughput numbers.
