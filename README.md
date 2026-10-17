# HomeBase

HomeBase is a household organization web application designed to help families, couples, and roommates keep track of shared responsibilities in one place.

The goal of HomeBase is to make managing a household easier by giving everyone a shared place to see what needs to be done instead of relying on text messages, paper lists, or multiple apps.

## Planned Features

HomeBase will include features such as:

- User accounts and authentication
- Shared households
- Chores and task assignments
- Shared shopping lists
- Household projects
- Home maintenance tracking
- Different household user roles
- A household dashboard

Additional features may include notifications, a shared calendar, meal planning, expense tracking, and a points or rewards system.

## Current Status

HomeBase has a Bakeoff 1 implementation on the `bakeoff-1-nextjs` branch, built with Next.js (App Router), React, TypeScript, PostgreSQL, and Prisma. It includes:

- Registration, login, logout, and profile updates with bcrypt-hashed passwords and database-backed sessions
- Households with invite codes and owner, adult, and member roles
- Shared chores: create, edit, delete, assign, set due dates, and mark complete
- A household dashboard

Results of the Bakeoff 1 tests and known limitations are in `docs/BAKEOFF-1-summary.md`.

The shared chores plan is [docs/plans/F3-shared-chores.md](docs/plans/F3-shared-chores.md).

## Routes

| Path | Access |
| --- | --- |
| `/register`, `/login` | Guests only (logged-in users go to `/household`) |
| `/dashboard` | Logged in, with a household |
| `/household` | Logged in (create or join a household, or manage the current one) |
| `/chores` | Logged in, with a household |
| `/chores/new`, `/chores/[choreId]/edit` | Owner or adult only |
| `/profile` | Logged in |

Logged-out users who open a protected route are sent to `/login`. Users without a household are sent to `/household`.

## Permissions

| Action | Owner | Adult | Member |
| --- | --- | --- | --- |
| Rename household, change roles, remove members | Yes | No | No |
| Create, edit, delete chores | Yes | Yes | No |
| Mark any chore complete or pending | Yes | Yes | Own assigned chores only |

The owner cannot be changed or removed.

## Project Documentation

Feature implementation plans are in [docs/plans/](docs/plans/README.md). The Bakeoff 1 documents are:

- [docs/plans/BAKEOFF-1-implementation-plan.md](docs/plans/BAKEOFF-1-implementation-plan.md): implementation plan, including the server action reference
- [docs/BAKEOFF-1-summary.md](docs/BAKEOFF-1-summary.md): stack, features, test results, challenges, and run instructions


## Development

### Stack

- Next.js 16 (App Router), React 19, TypeScript
- PostgreSQL with Prisma 7 (`@prisma/adapter-pg`)
- Zod for validation, bcryptjs for password hashing
- Vitest for unit tests, Playwright for end-to-end tests, ESLint for linting

### Setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL` to your PostgreSQL connection string. `.env` is ignored by git; do not commit it.
2. Install dependencies with `npm install --ignore-scripts`, then run `npm run db:generate`.
3. Apply migrations with `npm run db:deploy`.
4. Start the app from the project folder with `node node_modules/next/dist/bin/next dev`, then open http://localhost:3000.

For a production build, run `npm run build` and then `npm run start`.

### Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` / `npm run start` | Production build and server |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm run test` | Unit tests (Vitest) |
| `npm run test:e2e` | End-to-end tests (Playwright). Set `E2E_BASE_URL` to test a running server. Run `npx playwright install chromium` once first. |
| `npm run db:generate` | Generate the Prisma client |
| `npm run db:migrate` | Create a migration (needs `CREATEDB` for the role, see the summary) |
| `npm run db:deploy` | Apply existing migrations |

On Windows, `npm run` scripts produced no output from Git Bash in this project, so the commands above call the `node_modules` binaries directly.