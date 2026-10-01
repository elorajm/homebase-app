# F3 — Shared Chores

> Feature implementation plan for the Shared Chores feature of HomeBase.

## Metadata

| Field | Value |
|---|---|
| **Feature ID** | F3 |
| **Section** | Household Chores |
| **Severity** | MAJOR |
| **Markets** | HomeBase household users |
| **Status (today)** | MISSING |
| **Estimated effort** | S (1 week) |
| **Owner (proposed)** | Project team |
| **Depends on** | F1 Authentication & Profiles, F2 Household & Member Management |
| **Unblocks** | F7 Household Dashboard |

---

## 1. Problem Statement

Household chores can be difficult to keep organized when responsibilities are communicated through texts, paper lists, or just by talking about them. HomeBase needs a shared chore system where household members can clearly see what needs to be done and who is responsible for it. This feature will give everyone in the household one place to create, assign, track, and complete chores.

## 2. Goals

- Allow household members to create chores.
- Allow chores to be assigned to a household member.
- Allow authorized users to edit and delete chores.
- Allow household members to see chores and their due dates.
- Allow assigned users to mark chores as complete.

## 3. Non-Goals

- Rewards or points for completing chores are not part of this feature.
- Email, text, and push notifications are not included.
- AI-generated chore suggestions are not included.
- A full household calendar is not included.
- Shopping lists, projects, and maintenance tasks are separate HomeBase features.
- Recurring chores are not included in the MVP.

## 4. Personas & User Stories

- **As a household owner**, I want to create and assign chores so that everyone knows what they are responsible for.
- **As a household member**, I want to see the chores assigned to me so that I know what I need to complete.
- **As a household member**, I want to mark my assigned chores as complete so that the rest of the household knows they are finished.
- **As a household owner**, I want to edit or delete chores so that outdated or incorrect chores can be changed.

## 5. Functional Requirements

- **FR-1.** The system MUST allow an authorized household member to create a chore.
- **FR-2.** A chore MUST have a title, assigned household member, due date, and completion status.
- **FR-3.** The system MUST only allow a chore to be assigned to a user who belongs to that household.
- **FR-4.** The system MUST display the current chores for the household.
- **FR-5.** The system MUST allow an assigned user to mark their chore as complete.
- **FR-6.** The system MUST allow authorized users to edit a chore.
- **FR-7.** The system MUST allow authorized users to delete a chore.
- **FR-8.** The system MUST prevent users from accessing chores belonging to a household they are not a member of.
- **FR-9.** The system SHOULD visually show the difference between completed and incomplete chores.
- **FR-10.** The system MAY support recurring chores in a future version.

## 6. Non-Functional Requirements

- **Performance** — Chores should load quickly during normal use.
- **Security** — A user MUST be logged in to access chore information. The system must verify household membership and appropriate permissions before allowing changes.
- **Privacy & Compliance** — Users must not be able to view chores from households they do not belong to.
- **Accessibility** — Forms and buttons should have clear labels, logical keyboard navigation, and readable status information.
- **Scalability** — The first version only needs to support normal household-sized chore lists, but chores should use unique IDs and household relationships so the feature can grow later.
- **Reliability** — Failed requests must not create incomplete or incorrect chore records. The system should show a success or error message after important actions.
- **Observability** — Server and authorization errors should be logged without exposing private household information.
- **Maintainability** — The chore feature should follow the same household permission patterns established in F2.
- **Internationalization** — N/A. The first version of HomeBase will support English only.
- **Backward Compatibility** — N/A. This is a new feature, so there is no existing chore data that needs to be supported.

## 7. Acceptance Criteria

- **AC-1.** *Given* an authorized household member is logged in, *when* they enter valid chore information and submit the form, *then* the new chore appears in the household chore list.

- **AC-2.** *Given* a user is creating a chore, *when* they try to assign it to someone who is not a member of the household, *then* the system rejects the request.

- **AC-3.** *Given* a household has chores, *when* a household member opens the chores page, *then* they can see the chore title, assigned member, due date, and completion status.

- **AC-4.** *Given* a chore is assigned to a household member, *when* that member marks the chore complete, *then* its status changes to completed.

- **AC-5.** *Given* an authorized user is viewing a chore, *when* they edit the information and save valid changes, *then* the updated chore information is stored and displayed.

- **AC-6.** *Given* an authorized user chooses to delete a chore, *when* they confirm the deletion, *then* the chore is removed from the household chore list.

- **AC-7.** *Given* a user does not belong to a household, *when* they attempt to access that household's chores, *then* access is denied.

- **AC-8.** *Given* required information is missing from the chore form, *when* the user tries to submit it, *then* an error is shown and the chore is not created.

## 8. Data Model

A Chore model will be needed with the following information:

### Chore

- `id`
- `householdId`
- `title`
- `description`
- `assignedUserId`
- `dueDate`
- `status`
- `createdBy`
- `createdAt`
- `updatedAt`

The `householdId` connects the chore to the correct household.

The `assignedUserId` identifies the household member responsible for completing the chore.

The `createdBy` field identifies the user who created the chore.

### Status Values

The initial status values will be:

- `pending`
- `completed`

### Constraints

- Every chore must have a unique ID.
- `householdId` must reference an existing household.
- `assignedUserId` must reference a user who belongs to the same household.
- `createdBy` must reference an authenticated user.
- `title` is required.
- `dueDate` is required.
- `status` is required.

Indexes should support finding chores by household and assigned user.

No backfill is needed because this is a new feature with no existing chore data.

The exact migration file name will depend on the database and migration conventions selected during implementation.

## 9. API Surface

The Shared Chores feature will need these API routes:

    GET    /api/households/:householdId/chores
    POST   /api/households/:householdId/chores
    GET    /api/chores/:choreId
    PUT    /api/chores/:choreId
    DELETE /api/chores/:choreId
    PATCH  /api/chores/:choreId/complete

All routes require authentication.

The system must verify that the user belongs to the household associated with the chore and has permission to perform the requested action.

### Create Chore

Request:

    {
      "title": "Take out trash",
      "description": "Take trash bins to the curb",
      "assignedUserId": "user-id",
      "dueDate": "2026-10-05"
    }

A successful request should return the newly created chore.

### Update Chore

An authorized user may update allowed chore fields such as:

    {
      "title": "Take out trash and recycling",
      "assignedUserId": "user-id",
      "dueDate": "2026-10-06"
    }

### Complete Chore

The completion route changes the chore status from `pending` to `completed`.

Invalid requests should return an appropriate error without changing the chore.

WebSockets are N/A because real-time updates are not part of the MVP.

Rate limiting does not require special rules beyond the application's normal API protections.

API documentation should be updated when these routes are implemented.

## 10. UI / UX

HomeBase will have a Chores page available from the main household navigation.

Each chore will display:

- Chore name
- Assigned household member
- Due date
- Status
- Edit option when allowed
- Delete option when allowed
- Mark Complete option when allowed

The page will also have an **Add Chore** button for users with permission to create chores.

### Add Chore Form

The form will contain:

- Chore name
- Description
- Assign To
- Due Date
- Create Chore button

### Main User Flow

1. The user opens the Chores page.
2. Existing household chores are displayed.
3. An authorized user selects **Add Chore**.
4. The user enters the chore information.
5. The user selects a household member.
6. The user selects a due date.
7. The user submits the form.
8. The new chore appears in the chore list.

### Empty State

If there are no chores, the page should display:

> No chores yet. Add a chore to get started.

### Loading State

A loading message or indicator should appear while chores are being retrieved, created, edited, completed, or deleted.

### Error State

If chores cannot be loaded or saved, the application should display a clear error message and allow the user to try again when appropriate.

If the user does not have permission to perform an action, the application should explain that the action is not allowed.

### Responsive Behavior

The page should work on both desktop and mobile screen sizes. Chore information should remain readable without requiring horizontal scrolling.

### Accessibility

Forms should have visible labels. Buttons should be keyboard accessible. Completion status should not rely only on color to communicate whether a chore is finished. Confirmation dialogs should use a logical focus order.

## 11. AI / ML Considerations

N/A. The Shared Chores feature does not use AI or machine learning.

## 12. Integration Points

This feature depends on:

- F1 Authentication & Profiles
- F2 Household & Member Management

F1 provides the authenticated user.

F2 provides household membership, household members, and role permissions.

This feature provides chore information to:

- F7 Household Dashboard

No external services or APIs are required for the initial version.

## 13. Dependencies & Sequencing

- **Must ship after:** F1 Authentication & Profiles and F2 Household & Member Management.
- **Must ship before:** F7 Household Dashboard.
- **Shared infrastructure needed:** Authentication, user records, household records, household membership, and role permissions.

Shared Chores depends on F1 and F2 because HomeBase must know who the current user is, which household they belong to, and what permissions they have before allowing them to manage chores.

F3 does not need to block F4, F5, or F6 because those features can use the same household infrastructure independently.

## 14. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| A user accesses another household's chores | M | H | Verify household membership before allowing access |
| A chore is assigned to someone outside the household | M | H | Validate household membership before saving the assignment |
| A user performs an action their role does not allow | M | H | Check F2 role permissions before protected actions |
| Invalid chore information is submitted | M | M | Validate required information before saving |
| A chore is deleted accidentally | M | M | Ask the user to confirm before deleting |
| Chore data does not connect correctly to the dashboard | L | M | Keep the chore status and household relationships consistent and test F7 integration later |

## 15. Rollout Plan

A feature flag is N/A because HomeBase is currently a student project and Shared Chores is a core MVP feature.

F1 and F2 should be working before this feature is implemented.

The chore data model should be created first. The API functionality can then be added, followed by the user interface.

The feature should be tested independently before its information is added to F7 Household Dashboard.

If a major permission or data problem is discovered, the chore feature should be corrected before dashboard integration continues.

## 16. Test Plan

### Acceptance Criteria Test Mapping

| Acceptance Criterion | Test |
|---|---|
| AC-1 | Create a chore with valid information and verify it appears in the household chore list. |
| AC-2 | Attempt to assign a chore to a user outside the household and verify the request is rejected. |
| AC-3 | Open the chores page and verify the title, assigned member, due date, and status are displayed. |
| AC-4 | Mark an assigned chore complete and verify its status changes to completed. |
| AC-5 | Edit an existing chore and verify the updated information is saved and displayed. |
| AC-6 | Delete a chore and verify it no longer appears in the household chore list. |
| AC-7 | Attempt to access household chores as a non-member and verify access is denied. |
| AC-8 | Submit a chore with missing required information and verify an error appears and the chore is not created. |

### Additional Testing

- **Unit** — Test chore validation, status changes, and permission rules.
- **Integration** — Test creating, reading, editing, completing, and deleting chores through the API and data storage.
- **End-to-End** — Test login → household access → create chore → edit chore → complete chore → delete chore.
- **Security** — Verify users cannot access or change chores belonging to another household and cannot perform actions outside their role.
- **Accessibility** — Test keyboard navigation, form labels, buttons, status information, and confirmation dialogs.
- **Performance** — Verify normal household chore lists load without noticeable delays.
- **Manual Exploratory** — Test desktop and mobile layouts, empty lists, loading states, invalid information, server errors, and unauthorized actions.

## 17. Documentation & Training

The project README should be updated to describe:

- The Shared Chores feature
- Chore permissions
- Chore API routes
- Chore data fields

N/A for separate end-user training because the feature should be understandable through the HomeBase interface.

## 18. Open Questions

1. Should every household member be allowed to create chores, or only owners and adults?
2. Should members only be able to complete their own chores, or should they be able to complete any household chore?
3. Should completed chores stay visible or eventually be archived?
4. Should owners and adults both be allowed to edit and delete chores?

These questions should be decided before implementation because they affect the role permissions established in F2.

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

After reviewing the AI-assisted draft, I clarified the household permissions because users should not be able to access chores belonging to another household. I also made the dependencies more specific by connecting this feature directly to F1 Authentication & Profiles and F2 Household & Member Management. Empty, loading, error, and unauthorized states were included because the feature needs to account for more than just successful actions. Recurring chores, notifications, rewards, and calendar features were kept outside this plan so the feature stays small enough to implement separately. Finally, every acceptance criterion was connected to a specific test so there is a clear way to determine whether the feature works correctly.