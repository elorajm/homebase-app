# F6 — Home Maintenance

> Feature implementation plan for the Home Maintenance feature of HomeBase.

## Metadata

| Field | Value |
|---|---|
| **Feature ID** | F6 |
| **Section** | Home Maintenance |
| **Severity** | MAJOR |
| **Markets** | HomeBase household users |
| **Status (today)** | MISSING |
| **Estimated effort** | S (1 week) |
| **Owner (proposed)** | Project team |
| **Depends on** | F1 Authentication & Profiles, F2 Household & Member Management |
| **Unblocks** | F7 Household Dashboard |

---

## 1. Problem Statement

Routine home maintenance can be easy to forget when homeowners are keeping track of tasks through memory, paper notes, or different calendars. HomeBase needs a simple way for households to keep track of maintenance tasks and when they are due. This feature will allow household members to create, view, update, complete, and delete home maintenance tasks in one place.

## 2. Goals

- Allow authorized household members to create maintenance tasks.
- Allow household members to view upcoming maintenance tasks.
- Allow maintenance tasks to include a due date.
- Allow authorized users to edit and delete maintenance tasks.
- Allow household members to mark maintenance tasks as complete.

## 3. Non-Goals

- Professional contractor scheduling is not included.
- Automatic ordering of replacement parts is not included.
- Maintenance expense tracking is not included.
- AI-generated maintenance recommendations are not included.
- Email, text, and push notifications are not included.
- Uploading receipts, manuals, or photos is not included.
- Automatic recurring maintenance is not included in the MVP.

## 4. Personas & User Stories

- **As a household owner**, I want to create maintenance tasks so that important home maintenance is not forgotten.
- **As a household member**, I want to see upcoming maintenance tasks so that I know what needs attention.
- **As an authorized household member**, I want to edit maintenance information so that dates or details can be corrected.
- **As a household member**, I want to mark a maintenance task as complete so that the household knows it has been handled.
- **As an authorized household member**, I want to delete maintenance tasks that are no longer needed.

## 5. Functional Requirements

- **FR-1.** The system MUST allow an authorized household member to create a maintenance task.
- **FR-2.** A maintenance task MUST contain a title, household, due date, and completion status.
- **FR-3.** The system MUST associate every maintenance task with the household that created it.
- **FR-4.** The system MUST display the household's maintenance tasks.
- **FR-5.** The system MUST allow an authorized household member to edit a maintenance task.
- **FR-6.** The system MUST allow a household member with appropriate permission to mark a maintenance task as complete.
- **FR-7.** The system MUST allow an authorized household member to delete a maintenance task.
- **FR-8.** The system MUST prevent users from accessing maintenance tasks belonging to households they do not belong to.
- **FR-9.** The system SHOULD allow an optional description for each maintenance task.
- **FR-10.** The system SHOULD clearly identify overdue maintenance tasks.
- **FR-11.** The system MAY support recurring maintenance schedules in a future version.

## 6. Non-Functional Requirements

- **Performance** — Maintenance tasks should load and update quickly during normal household use.
- **Security** — Users must be authenticated, and household membership and role permissions must be checked before maintenance information is returned or changed.
- **Privacy & Compliance** — Maintenance information must only be available to members of the household that owns the task.
- **Accessibility** — Maintenance forms, controls, dates, and statuses should be usable with a keyboard and understandable with assistive technology.
- **Scalability** — The MVP only needs to support normal household-sized maintenance lists, but records should use unique IDs and household relationships.
- **Reliability** — Failed requests must not create incomplete or incorrect maintenance records.
- **Observability** — Server and authorization errors should be logged without exposing private household information.
- **Maintainability** — Maintenance permissions should follow the same household authorization patterns established in F2.
- **Internationalization** — N/A. The first version of HomeBase will support English only.
- **Backward Compatibility** — N/A. Home Maintenance is a new feature with no existing maintenance data.

## 7. Acceptance Criteria

- **AC-1.** *Given* an authorized household member is logged in, *when* they submit valid maintenance information, *then* the maintenance task is created and appears in the household maintenance list.

- **AC-2.** *Given* a household has maintenance tasks, *when* a household member opens the Maintenance page, *then* the current maintenance tasks, due dates, and statuses are displayed.

- **AC-3.** *Given* an authorized household member edits a maintenance task, *when* valid changes are saved, *then* the updated information is stored and displayed.

- **AC-4.** *Given* an incomplete maintenance task exists, *when* a household member with permission marks it complete, *then* its status changes to completed.

- **AC-5.** *Given* an authorized household member chooses to delete a maintenance task, *when* they confirm the deletion, *then* the task is removed from the household maintenance list.

- **AC-6.** *Given* a user does not belong to a household, *when* they attempt to access that household's maintenance tasks, *then* access is denied.

- **AC-7.** *Given* required maintenance information is missing, *when* the user attempts to submit the form, *then* an error is displayed and the maintenance task is not created.

- **AC-8.** *Given* an incomplete maintenance task has a due date earlier than the current date, *when* the Maintenance page is displayed, *then* the task is clearly identified as overdue.

## 8. Data Model

A MaintenanceTask model will be needed.

### MaintenanceTask

- `id`
- `householdId`
- `title`
- `description`
- `dueDate`
- `status`
- `createdBy`
- `completedAt`
- `createdAt`
- `updatedAt`

### Status Values

The initial maintenance status values will be:

- `pending`
- `completed`

### Constraints

- Every maintenance task must have a unique ID.
- `householdId` must reference an existing household.
- `title` is required.
- `dueDate` is required.
- `status` is required.
- `createdBy` must reference an authenticated user.
- `description` is optional.
- `completedAt` should remain empty until the task is completed.

Indexes should support retrieving maintenance tasks by household, status, and due date.

No backfill is required because this is a new feature.

The exact migration file name will depend on the database and migration conventions selected during implementation.

## 9. API Surface

The Home Maintenance feature will need routes similar to:

    GET    /api/households/:householdId/maintenance
    POST   /api/households/:householdId/maintenance
    GET    /api/maintenance/:maintenanceId
    PUT    /api/maintenance/:maintenanceId
    PATCH  /api/maintenance/:maintenanceId/complete
    DELETE /api/maintenance/:maintenanceId

All routes require authentication.

The API must verify household membership and role permissions before returning or changing maintenance information.

### Create Maintenance Task

Request:

    {
      "title": "Replace furnace filter",
      "description": "Replace the main furnace filter",
      "dueDate": "2026-11-15"
    }

A newly created maintenance task should begin with the `pending` status.

### Update Maintenance Task

Request:

    {
      "title": "Replace furnace filter",
      "description": "Use the replacement filter stored in the garage",
      "dueDate": "2026-11-20"
    }

### Complete Maintenance Task

The completion route changes the task status from `pending` to `completed` and records the completion date when appropriate.

Invalid requests should return an appropriate error without changing the maintenance task.

WebSockets are N/A because real-time maintenance updates are outside the MVP.

Special rate limits are N/A beyond the application's normal API protections.

API documentation should be updated when these routes are implemented.

## 10. UI / UX

HomeBase will have a Maintenance page available from the household navigation.

Each maintenance task should display:

- Task title
- Description when provided
- Due date
- Current status
- Overdue indicator when applicable
- Mark Complete option when allowed
- Edit option when allowed
- Delete option when allowed

The page will have an **Add Maintenance Task** button for users with permission to create maintenance tasks.

### Add Maintenance Task Flow

1. The user opens the Maintenance page.
2. Existing maintenance tasks are displayed.
3. An authorized user selects **Add Maintenance Task**.
4. The user enters a title.
5. The user may enter a description.
6. The user selects a due date.
7. The user submits the form.
8. The new maintenance task appears in the list.

### Complete Maintenance Flow

1. The user views an incomplete maintenance task.
2. The user selects **Mark Complete**.
3. The system updates the task.
4. The task is displayed as completed.

### Empty State

If there are no maintenance tasks, the page should display:

> No maintenance tasks yet. Add a task to start keeping track of your home maintenance.

### Loading State

A loading indicator should appear while maintenance information is being retrieved or changed.

### Error State

If maintenance tasks cannot be loaded or a task cannot be created, edited, completed, or deleted, a clear error message should be displayed.

Unauthorized actions should display an appropriate permission message.

### Responsive Behavior

The Maintenance page should work on both mobile and desktop screens. Task information and controls should remain readable without horizontal scrolling.

### Accessibility

Forms should have visible labels. Buttons and controls should be keyboard accessible. Completed and overdue statuses must not rely only on color and should include text or another accessible indicator.

## 11. AI / ML Considerations

N/A. The Home Maintenance feature does not use AI or machine learning.

## 12. Integration Points

This feature depends on:

- F1 Authentication & Profiles
- F2 Household & Member Management

F1 provides the authenticated user.

F2 provides household membership and role permissions.

This feature provides maintenance information to:

- F7 Household Dashboard

No external services or APIs are required for the MVP.

## 13. Dependencies & Sequencing

- **Must ship after:** F1 Authentication & Profiles and F2 Household & Member Management.
- **Must ship before:** F7 Household Dashboard.
- **Shared infrastructure needed:** Authentication, users, households, membership, and permission checks.

F6 does not depend directly on F3, F4, or F5 because each feature can use the shared authentication and household infrastructure independently.

## 14. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| A user accesses another household's maintenance tasks | M | H | Verify household membership on every maintenance request |
| Unauthorized users modify maintenance information | M | H | Check F2 role permissions before protected actions |
| Overdue status is calculated incorrectly | M | M | Compare due dates consistently using the application's chosen date rules |
| Invalid maintenance information is created | M | M | Validate required fields before saving |
| A maintenance task is accidentally deleted | M | M | Require confirmation before deletion |
| Scope expands into a complex maintenance system | M | M | Keep recurring schedules, contractors, expenses, uploads, and notifications outside the MVP |

## 15. Rollout Plan

A feature flag is N/A because Home Maintenance is a core HomeBase MVP feature.

F1 and F2 must be available before implementation begins.

The MaintenanceTask data model should be created first, followed by the API routes and then the user interface.

Maintenance CRUD, completion, overdue display, and permissions should be tested before maintenance information is connected to F7 Household Dashboard.

If authorization or data problems are discovered, they should be corrected before dashboard integration.

## 16. Test Plan

### Acceptance Criteria Test Mapping

| Acceptance Criterion | Test |
|---|---|
| AC-1 | Create a maintenance task with valid information and verify it appears in the household maintenance list. |
| AC-2 | Open the Maintenance page and verify current tasks, due dates, and statuses are displayed. |
| AC-3 | Edit an existing maintenance task and verify the updated information is stored and displayed. |
| AC-4 | Mark a pending maintenance task complete and verify its status changes to completed. |
| AC-5 | Delete a maintenance task and verify it no longer appears in the household maintenance list. |
| AC-6 | Attempt to access another household's maintenance tasks and verify access is denied. |
| AC-7 | Submit a maintenance task with missing required information and verify an error appears and no task is created. |
| AC-8 | Display an incomplete task with a past due date and verify it is clearly identified as overdue. |

### Additional Testing

- **Unit** — Test maintenance validation, completion behavior, overdue calculations, and permission rules.
- **Integration** — Test create, read, update, complete, and delete operations through the API and data storage.
- **End-to-End** — Test login → household access → create maintenance task → edit → complete → delete.
- **Security** — Verify users cannot view or modify maintenance information belonging to another household or perform actions outside their role.
- **Accessibility** — Test labels, keyboard navigation, status communication, and confirmation dialogs.
- **Performance** — Verify normal household maintenance lists load and update without noticeable delays.
- **Manual Exploratory** — Test empty lists, loading states, invalid information, overdue dates, mobile layouts, server errors, and unauthorized actions.

## 17. Documentation & Training

The project README should be updated to describe:

- The Home Maintenance feature
- Maintenance permissions
- Maintenance API routes
- MaintenanceTask data fields and statuses

N/A for separate end-user training because the feature should be understandable through the HomeBase interface.

## 18. Open Questions

1. Which household roles should be allowed to create, edit, and delete maintenance tasks?
2. Should every household member be allowed to mark maintenance tasks complete?
3. Should completed maintenance tasks remain visible or eventually be archived?
4. Should a completed maintenance task be allowed to return to `pending`?
5. How should HomeBase handle due dates when users are in different time zones?

These decisions should be finalized before implementation if they affect permissions, date handling, or the data model.

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

After reviewing the AI-assisted draft, I kept Home Maintenance focused on basic household maintenance tracking instead of turning it into a larger home-management system. Recurring schedules, contractor scheduling, expenses, uploads, notifications, and AI recommendations were kept outside the MVP. I also added a clear overdue state because due dates would not be very useful if the interface did not show when something had been missed. Household permissions, error states, loading states, and unauthorized access were made explicit. Finally, each acceptance criterion was connected to a specific test so there is a clear way to determine whether the feature works correctly.