# F5 — Household Projects

> Feature implementation plan for the Household Projects feature of HomeBase.

## Metadata

| Field | Value |
|---|---|
| **Feature ID** | F5 |
| **Section** | Household Projects |
| **Severity** | MAJOR |
| **Markets** | HomeBase household users |
| **Status (today)** | MISSING |
| **Estimated effort** | S (1 week) |
| **Owner (proposed)** | Project team |
| **Depends on** | F1 Authentication & Profiles, F2 Household & Member Management |
| **Unblocks** | F7 Household Dashboard |

---

## 1. Problem Statement

Household projects such as painting a room, cleaning a garage, organizing storage, or starting a garden can involve several tasks and household members. These projects can be difficult to keep organized when information is spread across notes, texts, or conversations. HomeBase needs a place where household members can create projects, track their progress, and see who is responsible for them.

## 2. Goals

- Allow authorized household members to create projects.
- Allow projects to be assigned to a household member.
- Allow household members to view current household projects.
- Allow authorized users to edit and delete projects.
- Allow project status to be updated as work progresses.

## 3. Non-Goals

- Detailed project-management tools such as Gantt charts are not included.
- Project budgets and expense tracking are not included.
- File and photo uploads are not included.
- Project messaging or comments are not included.
- AI-generated project plans are not included.
- Notifications are not included.
- Projects will not contain separate subtasks in the MVP.

## 4. Personas & User Stories

- **As a household owner**, I want to create a household project so that larger jobs can be organized in HomeBase.
- **As a household member**, I want to see current projects so that I know what the household is working on.
- **As an authorized household member**, I want to assign a project to a household member so that responsibility is clear.
- **As an authorized household member**, I want to update a project's status so that everyone can see its progress.
- **As an authorized household member**, I want to edit or delete a project so that outdated or incorrect information can be changed.

## 5. Functional Requirements

- **FR-1.** The system MUST allow an authorized household member to create a project.
- **FR-2.** A project MUST contain a title, household, status, and target completion date.
- **FR-3.** The system MUST associate every project with the household that created it.
- **FR-4.** The system MUST allow a project to be assigned to an eligible member of the same household.
- **FR-5.** The system MUST display the current projects belonging to the household.
- **FR-6.** The system MUST allow authorized users to edit an existing project.
- **FR-7.** The system MUST allow authorized users to update a project's status.
- **FR-8.** The system MUST allow authorized users to delete a project.
- **FR-9.** The system MUST prevent users from accessing projects belonging to households they do not belong to.
- **FR-10.** The system SHOULD allow an optional description for each project.
- **FR-11.** The system SHOULD visually distinguish projects based on their status.
- **FR-12.** The system MAY support project subtasks in a future version.

## 6. Non-Functional Requirements

- **Performance** — Household project lists should load and update quickly during normal use.
- **Security** — Users must be authenticated, and household membership and role permissions must be checked before project information is returned or changed.
- **Privacy & Compliance** — Project information must only be available to members of the household that owns the project.
- **Accessibility** — Project forms, controls, and status information should be keyboard accessible and understandable with assistive technology.
- **Scalability** — The MVP only needs to support normal household-sized project lists, but project records should use unique IDs and household relationships.
- **Reliability** — Failed requests must not leave project records in an incomplete or incorrect state.
- **Observability** — Server and authorization errors should be logged without exposing private household information.
- **Maintainability** — Project permissions should follow the same household authorization patterns established in F2.
- **Internationalization** — N/A. The first version of HomeBase will support English only.
- **Backward Compatibility** — N/A. Household Projects is a new feature with no existing project data.

## 7. Acceptance Criteria

- **AC-1.** *Given* an authorized household member is logged in, *when* they submit valid project information, *then* the project is created and appears in the household project list.

- **AC-2.** *Given* a household has existing projects, *when* a household member opens the Projects page, *then* the household's projects and their current statuses are displayed.

- **AC-3.** *Given* an authorized user assigns a project to a valid household member, *when* the project is saved, *then* that member is displayed as the person responsible for the project.

- **AC-4.** *Given* an authorized user changes a project's status, *when* the update is saved, *then* the new status is stored and displayed.

- **AC-5.** *Given* an authorized user edits valid project information, *when* the changes are saved, *then* the updated information is stored and displayed.

- **AC-6.** *Given* an authorized user chooses to delete a project, *when* they confirm the deletion, *then* the project is removed from the household project list.

- **AC-7.** *Given* a user does not belong to a household, *when* they attempt to access that household's projects, *then* access is denied.

- **AC-8.** *Given* required project information is missing, *when* the user attempts to submit the project, *then* an error is displayed and the project is not created.

## 8. Data Model

A Project model will be needed.

### Project

- `id`
- `householdId`
- `title`
- `description`
- `assignedUserId`
- `status`
- `targetDate`
- `createdBy`
- `createdAt`
- `updatedAt`

### Status Values

The initial project status values will be:

- `planned`
- `in_progress`
- `completed`

### Constraints

- Every project must have a unique ID.
- `householdId` must reference an existing household.
- `title` is required.
- `status` is required.
- `targetDate` is required.
- `createdBy` must reference an authenticated user.
- `assignedUserId` must reference a member of the same household when provided.
- `description` is optional.
- `assignedUserId` may be optional if the household has not assigned the project yet.

Indexes should support finding projects by household, status, and assigned user.

No backfill is required because this is a new feature.

The exact migration file name will depend on the database and migration conventions selected during implementation.

## 9. API Surface

The Household Projects feature will need routes similar to:

    GET    /api/households/:householdId/projects
    POST   /api/households/:householdId/projects
    GET    /api/projects/:projectId
    PUT    /api/projects/:projectId
    PATCH  /api/projects/:projectId/status
    DELETE /api/projects/:projectId

All routes require authentication.

The API must verify household membership and role permissions before returning or changing project information.

### Create Project

Request:

    {
      "title": "Paint the living room",
      "description": "Paint walls and trim",
      "assignedUserId": "user-id",
      "targetDate": "2026-11-01"
    }

A newly created project should begin with the appropriate initial status, normally `planned`.

### Update Project

Request:

    {
      "title": "Paint the living room and hallway",
      "description": "Paint walls and trim",
      "assignedUserId": "user-id",
      "targetDate": "2026-11-05"
    }

### Update Status

Request:

    {
      "status": "in_progress"
    }

Invalid requests should return an appropriate error without changing the project.

WebSockets are N/A because real-time project updates are outside the MVP.

Special rate limits are N/A beyond the application's normal API protections.

API documentation should be updated when these routes are implemented.

## 10. UI / UX

HomeBase will have a Projects page available from the household navigation.

Each project should display:

- Project title
- Assigned household member when applicable
- Target completion date
- Current status
- Edit option when allowed
- Delete option when allowed
- Status update control when allowed

The page will have an **Add Project** button for users with permission to create projects.

### Add Project Flow

1. The user opens the Projects page.
2. Existing household projects are displayed.
3. An authorized user selects **Add Project**.
4. The user enters a project title.
5. The user may enter a description.
6. The user may assign the project to a household member.
7. The user chooses a target completion date.
8. The user submits the form.
9. The project appears in the household project list.

### Status Flow

1. An authorized user opens an existing project.
2. The user changes the project status.
3. The user saves the change.
4. The updated status is displayed.

### Empty State

If the household has no projects, the page should display:

> No household projects yet. Add a project to get started.

### Loading State

A loading indicator should appear while projects are being retrieved or changed.

### Error State

If projects cannot be loaded or a project cannot be created, edited, updated, or deleted, a clear error message should be displayed.

Unauthorized actions should display an appropriate permission message.

### Responsive Behavior

Project cards or list items should adjust for mobile and desktop screens without requiring horizontal scrolling.

### Accessibility

Forms should have visible labels. Project controls should be keyboard accessible. Project status should not rely only on color. Confirmation dialogs should use logical focus behavior.

## 11. AI / ML Considerations

N/A. Household Projects does not use AI or machine learning.

## 12. Integration Points

This feature depends on:

- F1 Authentication & Profiles
- F2 Household & Member Management

F1 provides the authenticated user.

F2 provides household membership, household members, and role permissions.

This feature provides project information to:

- F7 Household Dashboard

No external services or APIs are required for the MVP.

## 13. Dependencies & Sequencing

- **Must ship after:** F1 Authentication & Profiles and F2 Household & Member Management.
- **Must ship before:** F7 Household Dashboard.
- **Shared infrastructure needed:** Authentication, users, households, membership, and permission checks.

F5 does not depend directly on F3 or F4 because it can use the shared authentication and household infrastructure independently.

## 14. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| A user accesses another household's projects | M | H | Verify household membership on every project request |
| Unauthorized users change projects | M | H | Check F2 role permissions before protected actions |
| Project is assigned to someone outside the household | M | H | Validate household membership before saving assignment |
| Project scope becomes too complex | M | M | Keep subtasks, budgets, files, and comments outside the MVP |
| Project is accidentally deleted | M | M | Require confirmation before deletion |
| Project data does not integrate correctly with F7 | L | M | Keep household and status fields consistent and test dashboard integration |

## 15. Rollout Plan

A feature flag is N/A because Household Projects is a core HomeBase MVP feature.

F1 and F2 must be available before implementation begins.

The Project data model should be created first, followed by the project API routes and then the user interface.

Project CRUD and permissions should be tested before project information is connected to F7 Household Dashboard.

If permission or data problems are discovered, they should be corrected before dashboard integration.

## 16. Test Plan

### Acceptance Criteria Test Mapping

| Acceptance Criterion | Test |
|---|---|
| AC-1 | Create a project with valid information and verify it appears in the household project list. |
| AC-2 | Open the Projects page and verify the household's projects and statuses are displayed. |
| AC-3 | Assign a project to a valid household member and verify the assignment is stored and displayed. |
| AC-4 | Change a project's status and verify the new status is stored and displayed. |
| AC-5 | Edit an existing project and verify the updated information is stored and displayed. |
| AC-6 | Delete a project and verify it no longer appears in the household project list. |
| AC-7 | Attempt to access another household's projects and verify access is denied. |
| AC-8 | Submit a project with missing required information and verify an error appears and no project is created. |

### Additional Testing

- **Unit** — Test project validation, status changes, assignments, and permission rules.
- **Integration** — Test project create, read, update, status, and delete operations through the API and data storage.
- **End-to-End** — Test login → household access → create project → assign project → update status → edit → delete.
- **Security** — Verify users cannot access or modify projects belonging to another household or perform actions outside their role.
- **Accessibility** — Test labels, keyboard navigation, status communication, and confirmation dialogs.
- **Performance** — Verify normal household project lists load and update without noticeable delays.
- **Manual Exploratory** — Test empty lists, loading states, invalid data, mobile layouts, server errors, and unauthorized actions.

## 17. Documentation & Training

The project README should be updated to describe:

- The Household Projects feature
- Project permissions
- Project API routes
- Project data and status values

N/A for separate end-user training because the feature should be understandable through the HomeBase interface.

## 18. Open Questions

1. Which household roles should be allowed to create, edit, and delete projects?
2. Should assigning a project to a household member be optional?
3. Should completed projects remain visible or eventually be archived?
4. Should a completed project be allowed to return to `in_progress`?
5. Should target completion dates be required or optional?

These decisions should be finalized before implementation if they affect the data model or permission rules.

## 19. References

- HomeBase Project Specification
- HomeBase MVP Feature Inventory
- WDD 430 Feature Implementation Plan Template
- `docs/plans/README.md`
- Related plan: `F1-authentication-profiles.md`
- Related plan: `F2-household-members.md`
- Related plan: `F7-household-dashboard.md`

---

## Human Review Notes

After reviewing the AI-assisted draft, I simplified Household Projects so it stays realistic for one feature plan. Subtasks, budgets, file uploads, comments, notifications, and advanced project-management tools were kept outside the MVP. I also made household membership and permission checks explicit instead of assuming authenticated users could access every project. Empty, loading, error, and unauthorized states were included in the UI plan. Finally, each acceptance criterion was connected to a specific test so there is a clear way to check whether the feature is complete.