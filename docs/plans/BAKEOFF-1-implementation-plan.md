# Bakeoff 1 Implementation Plan — Next.js

> Implementation plan for Bakeoff 1 of HomeBase. This plan implements the MVP features F1, F2, F3, and F7 (chores summary only) using Next.js. It is a companion to the original feature plans in this folder and does not replace them.

## 1. Scope

| Feature | Status in Bakeoff 1 | Notes |
|---|---|---|
| F1 — Authentication & Profiles | Implemented | Register, login, logout, view and edit profile, protected pages |
| F2 — Household & Member Management | Implemented | Create household, join by invite code, member list, owner role management, owner member removal, household rename |
| F3 — Shared Chores | Implemented | Create, view, edit, delete, assign, complete/reopen, permission checks |
| F4 — Shared Shopping List | Deferred | Dashboard shows a "not built yet" card |
| F5 — Household Projects | Deferred | Dashboard shows a "not built yet" card |
| F6 — Home Maintenance | Deferred | Dashboard shows a "not built yet" card |
| F7 — Household Dashboard | Implemented (partial) | Chores section is live; other sections are placeholders |

## 2. Decisions Made for Open Questions

The original plans list open questions. These decisions keep the prototype buildable in two weeks and are the answers this bakeoff implements.

| Question (source) | Decision |
|---|---|
| Authentication approach (F1 Q1) | Email and password with bcrypt hashing. Sessions are random tokens stored hashed in PostgreSQL and sent in an httpOnly cookie. |
| Minimum password rules (F1 Q2) | 8 to 72 characters (72 is the bcrypt input limit). |
| Auto-login after registration (F1 Q3) | Yes. |
| Email change in MVP (F1 Q4) | No. Only first name and last name are editable. |
| Password reset (F1 Q5) | Deferred. |
| Joining method (F2 Q1) | Invite code. Each household has a unique invite code that a user enters to join. |
| Users in more than one household (F2 Q2) | No. A user belongs to at most one household. This is enforced with a unique `userId` on `HouseholdMember`. |
| Ownership transfer (F2 Q3) | Deferred. |
| Owner removing self (F2 Q4) | No. The owner cannot leave or be removed in this version. |
| Adult vs. member permissions (F2 Q5) | See the permission matrix in section 5. |
| Who can create chores (F3 Q1) | Owners and adults. |
| Who can complete chores (F3 Q2) | Owners and adults can complete any chore. Members can complete only chores assigned to them. |
| Completed chores visibility (F3 Q3) | Completed chores stay visible with a "Completed" label. No archiving. |
| Who can edit/delete chores (F3 Q4) | Owners and adults. |
| Dashboard item counts (F7 Q1) | Up to 5 incomplete chores, with the total count shown. |
| Dashboard chores scope (F7 Q2) | All household chores, not only the current user's. |
| Dashboard API (F7 Q6) | Server Component data loading, not a separate `/api` route. |

## 3. Technology Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js 16 (App Router) | Server Components, Server Actions, and SSR in one full-stack framework |
| UI | React 19 | Used by Next.js; `useActionState` and `useFormStatus` handle form state |
| Language | TypeScript 5 | Type safety across server and client code |
| Database | PostgreSQL 17 | Relational data with foreign keys and unique constraints |
| ORM | Prisma 7 with `@prisma/adapter-pg` | Typed queries and migrations |
| Auth | Custom email/password with `bcryptjs` and DB-backed sessions | Keeps authentication transparent and lets logout invalidate sessions |
| Validation | Zod | Shared schemas for form input validation on the server |
| Styling | Plain CSS with custom properties and media queries | Responsive design without extra build tooling |
| Unit tests | Vitest | Fast tests for validation and permission rules |
| End-to-end tests | Playwright | Runs the real app against the real database |

## 4. Data Model

```
User 1 ─── 0..1 HouseholdMember N ─── 1 Household
 │                                       │
 │ owns (ownerId)  ──────────────────────┘
 │
 ├── N Session
 ├── N Chore (createdById)
 └── N Chore (assignedUserId)

Household 1 ─── N Chore (householdId)
```

- **User**: `id`, `firstName`, `lastName`, `email` (unique), `passwordHash`, `createdAt`, `updatedAt`.
- **Session**: `id`, `tokenHash` (unique), `userId`, `expiresAt`, `createdAt`. Index on `userId`.
- **Household**: `id`, `name`, `inviteCode` (unique), `ownerId` (references User), `createdAt`, `updatedAt`.
- **HouseholdMember**: `id`, `householdId`, `userId` (unique), `role` (`owner` | `adult` | `member`), `joinedAt`. Index on `householdId`.
- **Chore**: `id`, `householdId`, `title`, `description` (optional), `assignedUserId`, `dueDate` (date only), `status` (`pending` | `completed`), `createdById`, `createdAt`, `updatedAt`. Indexes on `householdId` and `assignedUserId`.

Constraints and rules enforced in the application:
- `Household.ownerId` always matches the `HouseholdMember` row with role `owner`. Both are created in one transaction.
- A chore's `assignedUserId` must be a member of the same household. This is checked on create and update.
- When a member is removed, their chores are reassigned to the household owner in the same transaction, so no chore is left pointing at a non-member.

No backfill or migration of existing data is needed.

## 5. Authentication and Authorization

### Authentication
- Passwords are hashed with bcrypt (cost 12). Plain-text passwords are never stored, logged, or returned.
- On login success, a random 32-byte token is created. Its SHA-256 hash is stored in `Session`, and the raw token is set in an `httpOnly`, `sameSite=lax` cookie (`secure` in production). Session lifetime is 7 days.
- Logout deletes the session row and clears the cookie.
- Login failures return one generic message: "Invalid email or password." No session is created on failure.

### Route protection
- The `(app)` route group has a layout that calls `requireUser()`. Unauthenticated requests redirect to `/login`.
- Every data-reading function and every Server Action re-checks the session. The layout alone is not relied on.

### Household authorization
- Every household-scoped query filters by the current user's `householdId`. A chore lookup uses both `choreId` and `householdId`, so a chore from another household returns "not found" and does not reveal that it exists.

### Permission matrix

| Action | owner | adult | member |
|---|:-:|:-:|:-:|
| View household, members, and chores | ✔ | ✔ | ✔ |
| Rename household | ✔ | | |
| Change a member's role (adult/member) | ✔ | | |
| Remove a member | ✔ | | |
| Create, edit, delete chores | ✔ | ✔ | |
| Assign chores to any household member | ✔ | ✔ | |
| Complete or reopen any chore | ✔ | ✔ | |
| Complete or reopen a chore assigned to self | ✔ | ✔ | ✔ |

Permission checks live in one module (`src/lib/permissions.ts`) and are reused by every feature.

## 6. Routes, Pages, and Components

| Route | Type | Access | Purpose |
|---|---|---|---|
| `/` | Redirect | Public | Sends users to `/dashboard` or `/login` |
| `/register` | Server Component + form | Guests | Registration |
| `/login` | Server Component + form | Guests | Login |
| `/dashboard` | Server Component | Logged in | F7 dashboard (chores summary, placeholders) |
| `/profile` | Server Component + form | Logged in | View and edit first/last name |
| `/household` | Server Component + forms | Logged in | No household: create/join. With household: settings, rename, invite code, members, roles, removal |
| `/chores` | Server Component | Household member | Chore list with status, assignee, due date, and actions |
| `/chores/new` | Server Component + form | Owner/adult | Create chore |
| `/chores/[choreId]/edit` | Server Component + form | Owner/adult | Edit chore |

Shared components (`src/components/`):
- `AppShell`: header with navigation (Dashboard, Chores, Household, Profile) and logout button. Collapses to a menu-style row on small screens.
- `FormField`: label, input, and error message wired with `aria-describedby`.
- `SubmitButton`: uses `useFormStatus` to show a pending state.
- `ConfirmButton`: client component that asks for confirmation before a destructive submit.
- `StatusBadge`: text plus color, so status is not conveyed by color alone.
- `EmptyState` and `ErrorMessage` components.

Each data page includes loading (`loading.tsx`), empty, and error (`error.tsx` plus inline messages) states.

## 7. Server Actions

Mutations use Server Actions with Zod validation. Each action returns `{ error?, fieldErrors? }` on failure and redirects on success.

| Action | Module | Who |
|---|---|---|
| `register` | `src/app/actions/auth.ts` | Guest |
| `login` | `src/app/actions/auth.ts` | Guest |
| `logout` | `src/app/actions/auth.ts` | Logged in |
| `updateProfile` | `src/app/actions/profile.ts` | Logged in |
| `createHousehold` | `src/app/actions/household.ts` | Logged in, no household |
| `joinHousehold` | `src/app/actions/household.ts` | Logged in, no household |
| `renameHousehold` | `src/app/actions/household.ts` | Owner |
| `changeMemberRole` | `src/app/actions/household.ts` | Owner |
| `removeMember` | `src/app/actions/household.ts` | Owner |
| `createChore` | `src/app/actions/chores.ts` | Owner/adult |
| `updateChore` | `src/app/actions/chores.ts` | Owner/adult |
| `deleteChore` | `src/app/actions/chores.ts` | Owner/adult |
| `setChoreStatus` | `src/app/actions/chores.ts` | Per matrix |

Original plan routes (`/api/...`) are represented by these actions. Route handlers are used only where Next.js requires them. The API documentation in the README lists the equivalent actions.

## 8. Validation and Error Handling

- Zod schemas in `src/lib/validation.ts` are used for all input:
  - Register: first name and last name required (max 60 chars), valid email (max 254), password 8 to 72 characters.
  - Login: valid email, password required.
  - Profile: first and last name required.
  - Household: name required (2 to 60 chars). Invite code required, 8 characters, uppercase letters and digits.
  - Chore: title required (max 120), description optional (max 1000), assignee required, due date required in `YYYY-MM-DD` format and a real calendar date, status must be `pending` or `completed`.
- Field errors appear next to each field. Form-level errors appear at the top of the form with `role="alert"`.
- Duplicate email (P2002) returns "An account with this email already exists."
- Database or unexpected errors return "Something went wrong. Please try again." and are logged on the server without sensitive data.
- Unauthorized actions return "You do not have permission to do that."

## 9. Responsive and Accessibility Requirements

- Mobile-first CSS. Breakpoint at 720px for the two-column layouts (dashboard, household).
- Tap targets at least 44px high. Inputs use 16px font to prevent iOS zoom.
- Chore lists use a card layout on small screens and a table on wider screens, with no horizontal scrolling at 375px width.
- Visible labels on all inputs. Visible focus outline. Logical tab order.
- Status is shown as text ("Completed", "Pending", "Overdue") plus color.
- Confirmation before deleting chores and removing members.

## 10. Testing Requirements

Unit (Vitest):
- Zod validation schemas (valid and invalid inputs).
- Permission helpers (`canManageChores`, `canManageHousehold`, `canCompleteChore`).
- Due date formatting and overdue calculation.

Integration and end-to-end (Playwright against the running app and real PostgreSQL):
- Registration with valid data, invalid data, and duplicate email.
- Login with correct and incorrect credentials.
- Logout, then protected route redirects to login.
- Protected routes redirect when logged out.
- Create household; second user joins with invite code; owner sees member list.
- Owner changes a member's role; member cannot access owner actions.
- Non-member cannot see another household's chore by URL.
- Create, edit, delete, assign, and complete/reopen chores.
- Data persists after reload.
- Invalid chore submission shows errors and creates nothing.
- Responsive layouts at 375px (mobile) and 1280px (desktop) with no horizontal scroll.

Build checks:
- `npx tsc --noEmit`, `npm run lint`, `npm run build`.

Each test result will be recorded in the Bakeoff 1 summary with the actual outcome.

## 11. Deferred Work (Later Bakeoffs)

- F4 Shopping list, F5 Projects, F6 Maintenance, and their dashboard sections.
- Email change, password reset, profile photo.
- Ownership transfer, owner leaving the household, multiple households per user.
- Invite code regeneration and expiration.
- Rate limiting on login and join attempts (SHOULD/MAY in the plans). This is a known gap for Bakeoff 1.
- Recurring chores, notifications, rewards.
- Automated accessibility audit (axe) and Lighthouse runs. Results will be recorded only if they are actually run.

## 12. Deliverables

1. Next.js application at the repository root (`src/`, `prisma/`, `tests/`).
2. Prisma schema and initial migration.
3. Updated `README.md` with setup, routes, permission rules, and API (action) reference.
4. `docs/BAKEOFF-1-SUMMARY.md` with the stack, rendering approach, features, database, auth, test results, challenges, limitations, and run instructions. Includes the official Next.js documentation references used.
5. `.env.example` with placeholder values only. No real secrets are committed.
