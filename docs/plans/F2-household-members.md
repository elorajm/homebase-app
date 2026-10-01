# F2 — Household & Member Management

> Feature implementation plan for Household & Member Management in HomeBase.

## Metadata

| Field | Value |
|---|---|
| **Feature ID** | F2 |
| **Section** | Household Management |
| **Severity** | BLOCKER |
| **Markets** | HomeBase household users |
| **Status (today)** | MISSING |
| **Estimated effort** | S (1 week) |
| **Owner (proposed)** | Project team |
| **Depends on** | F1 Authentication & Profiles |
| **Unblocks** | F3, F4, F5, F6, F7 |

---

## 1. Problem Statement

HomeBase needs a way to organize users into households before they can share chores, shopping lists, projects, or maintenance tasks. Without household membership, the application cannot determine which information belongs to which group of users. This feature will allow users to create or join a household and will establish roles that control what household members are allowed to manage.

## 2. Goals

- Allow an authenticated user to create a household.
- Allow other authenticated users to join a household.
- Allow household members to view the other members of their household.
- Give household members roles that determine their permissions.
- Allow the household owner to manage basic household information and membership.

## 3. Non-Goals

- Chore management is handled in F3.
- Shopping lists are handled in F4.
- Household projects are handled in F5.
- Home maintenance is handled in F6.
- Household dashboard information is handled in F7.
- Household messaging is not included.
- Public household discovery is not included.
- Multiple custom role types are not included in the MVP.

## 4. Personas & User Stories

- **As a new HomeBase user**, I want to create a household so that I can begin organizing my home.
- **As a household owner**, I want other people to join my household so that we can share responsibilities.
- **As a household member**, I want to see who belongs to my household so that I know who I am sharing HomeBase with.
- **As a household owner**, I want to manage member roles so that users have the correct permissions.
- **As a household owner**, I want to remove a member when they no longer belong to my household.
- **As a household member**, I want my household information kept separate from other households.

## 5. Functional Requirements

- **FR-1.** The system MUST allow an authenticated user to create a household.
- **FR-2.** A household MUST have a name and an owner.
- **FR-3.** The user who creates a household MUST automatically become its owner.
- **FR-4.** The system MUST allow an authenticated user to join an existing household using an approved joining method.
- **FR-5.** The system MUST display the members of a household to users who belong to that household.
- **FR-6.** Each household member MUST have a role.
- **FR-7.** The MVP MUST support the roles `owner`, `adult`, and `member`.
- **FR-8.** The system MUST allow the household owner to update household information.
- **FR-9.** The system MUST allow the household owner to change eligible member roles.
- **FR-10.** The system MUST allow the household owner to remove another member from the household.
- **FR-11.** The system MUST prevent users who do not belong to a household from accessing that household's private information.
- **FR-12.** The system MUST prevent non-owners from performing owner-only membership actions.
- **FR-13.** The system SHOULD ask for confirmation before removing a household member.
- **FR-14.** The system MAY support more advanced invitation options in a future version.

## 6. Non-Functional Requirements

- **Performance** — Household information and member lists should load quickly during normal use.
- **Security** — All household routes must require authentication and verify household membership. Owner-only actions must verify that the current user is the household owner.
- **Privacy & Compliance** — Household membership and information must only be available to authorized household members.
- **Accessibility** — Household forms, role controls, member lists, and confirmation dialogs should be usable with a keyboard and assistive technology.
- **Scalability** — The initial version is intended for normal household-sized groups. The data model should still allow multiple users to belong to a household without changing its structure.
- **Reliability** — Failed membership changes must not leave a user's role or household membership in an incomplete state.
- **Observability** — Failed authorization attempts and membership errors should be logged without exposing private user information.
- **Maintainability** — Household permission checks should use a consistent pattern that can also be used by F3–F7.
- **Internationalization** — N/A. The first version of HomeBase will support English only.
- **Backward Compatibility** — N/A. HomeBase does not currently contain existing household records that require migration.

## 7. Acceptance Criteria

- **AC-1.** *Given* an authenticated user who is not currently creating a household, *when* they enter a valid household name and submit the form, *then* a household is created and the user becomes its owner.

- **AC-2.** *Given* an authenticated user has valid information for joining an existing household, *when* they complete the join process, *then* they become a member of that household.

- **AC-3.** *Given* a user belongs to a household, *when* they open the household members page, *then* they can see the members and their roles.

- **AC-4.** *Given* a household owner views an eligible member, *when* the owner changes that member's role and saves the change, *then* the new role is stored and displayed.

- **AC-5.** *Given* a household owner selects another member for removal, *when* the owner confirms the action, *then* that user is removed from the household.

- **AC-6.** *Given* a regular member attempts an owner-only action, *when* the request is submitted, *then* the action is denied and no household information is changed.

- **AC-7.** *Given* a user does not belong to a household, *when* they attempt to access that household's private information, *then* access is denied.

- **AC-8.** *Given* a household owner enters a valid new household name, *when* the owner saves the change, *then* the updated household name is stored and displayed.

- **AC-9.** *Given* required household information is missing or invalid, *when* the user submits the form, *then* an error is displayed and invalid data is not saved.

## 8. Data Model

Two main models will be needed.

### Household

- `id`
- `name`
- `ownerId`
- `createdAt`
- `updatedAt`

### HouseholdMember

- `id`
- `householdId`
- `userId`
- `role`
- `joinedAt`

### Role Values

The initial role values will be:

- `owner`
- `adult`
- `member`

### Constraints

- Every household must have a unique ID.
- Every household must have a name.
- Every household must have an owner.
- `ownerId` must reference an existing user.
- `householdId` must reference an existing household.
- `userId` must reference an existing user.
- A membership record must contain a valid role.
- The same user should not have duplicate membership records for the same household.

A unique constraint should prevent duplicate `householdId` and `userId` combinations.

Indexes should support looking up household members by household and looking up a user's household membership.

No backfill is required because this is a new feature.

The exact migration file names will depend on the database and migration conventions chosen during implementation.

## 9. API Surface

The feature will need routes similar to:

    POST   /api/households
    GET    /api/households/:householdId
    PUT    /api/households/:householdId

    GET    /api/households/:householdId/members
    POST   /api/households/:householdId/members
    PUT    /api/households/:householdId/members/:memberId
    DELETE /api/households/:householdId/members/:memberId

All routes require authentication.

### Create Household

Request:

    {
      "name": "Smith Family"
    }

The authenticated user becomes the household owner.

### Join Household

The exact request will depend on the joining method selected before implementation.

A successful join request should create a household membership for the authenticated user.

### Update Member Role

Request:

    {
      "role": "adult"
    }

Only the household owner can perform owner-only membership management actions.

The API must verify both authentication and household permissions.

WebSockets are N/A because real-time household membership updates are not required for the MVP.

Rate limiting MAY be added to repeated household join attempts if the selected joining method could be abused.

API documentation should be updated when the routes are implemented.

## 10. UI / UX

The feature will need:

- Create Household page or form
- Join Household page or form
- Household settings page
- Household member list
- Member role controls for the owner

### Create Household Flow

1. Authenticated user chooses to create a household.
2. User enters a household name.
3. User submits the form.
4. The system creates the household.
5. The user becomes the household owner.
6. The user is taken to their household area.

### Join Household Flow

1. Authenticated user chooses to join a household.
2. User provides the required joining information.
3. The system validates the request.
4. A household membership is created.
5. The user can access the household.

### Manage Members Flow

1. Household owner opens Household Settings.
2. The owner views the current member list.
3. The owner selects an eligible member.
4. The owner changes the role or chooses to remove the member.
5. The system saves the change.
6. The updated member list is displayed.

### Empty, Loading, and Error States

A new user who does not yet have household access should see clear options to create or join a household.

Member lists should show a loading state while information is being retrieved.

If household information cannot be loaded, the user should see an error message and an option to retry.

Invalid join information should display a clear error without adding the user to the household.

If an unauthorized user attempts an owner-only action, the interface should show that they do not have permission.

### Responsive Behavior

Household settings and member lists should work on both desktop and mobile screens. Member controls should remain easy to select on smaller screens.

### Accessibility

All inputs should have visible labels. Role controls must be keyboard accessible. Confirmation dialogs should receive keyboard focus and clearly describe the action being confirmed.

## 11. AI / ML Considerations

N/A. Household and member management does not use AI or machine learning.

## 12. Integration Points

This feature depends directly on:

- F1 Authentication & Profiles

This feature provides household and permission information to:

- F3 Shared Chores
- F4 Shared Shopping List
- F5 Household Projects
- F6 Home Maintenance
- F7 Household Dashboard

No external services are required for the initial version.

## 13. Dependencies & Sequencing

- **Must ship after:** F1 Authentication & Profiles.
- **Must ship before:** F3, F4, F5, F6, and F7.
- **Shared infrastructure needed:** Authentication and user records from F1.

Household membership should be completed before household-specific CRUD features because those features need a reliable way to determine which data the current user is allowed to access.

## 14. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| User accesses another household's information | M | H | Verify household membership on every protected household request |
| Regular member performs an owner-only action | M | H | Check role before role changes, removals, or household updates |
| Duplicate household memberships are created | M | M | Use a unique household/user membership constraint |
| Owner accidentally removes a member | M | M | Require confirmation before removal |
| Joining method allows unauthorized access | M | H | Validate join information and avoid exposing household data before membership is approved |

## 15. Rollout Plan

A feature flag is N/A because household management is required for the HomeBase MVP.

F1 Authentication & Profiles must be working first. Household data storage should then be created, followed by household creation, joining, member viewing, and role management.

Household authorization should be tested carefully before F3–F7 are built on top of it.

If permission problems are discovered, development of dependent household features should pause until those problems are corrected.

## 16. Test Plan

### Acceptance Criteria Test Mapping

| Acceptance Criterion | Test |
|---|---|
| AC-1 | Create a household as an authenticated user and verify the user becomes the owner. |
| AC-2 | Join an existing household using valid join information and verify a membership record is created. |
| AC-3 | Open the member list as a household member and verify household members and roles are displayed. |
| AC-4 | Change an eligible member's role as the owner and verify the new role is saved. |
| AC-5 | Remove a member as the owner and verify the membership no longer exists. |
| AC-6 | Attempt an owner-only action as a regular member and verify the request is denied and no data changes. |
| AC-7 | Attempt to access a household as a non-member and verify access is denied. |
| AC-8 | Update the household name as the owner and verify the new name is stored and displayed. |
| AC-9 | Submit invalid household information and verify an error appears and no invalid data is stored. |

### Additional Testing

- **Unit** — Test household validation, membership rules, and role permission checks.
- **Integration** — Test household creation, joining, member retrieval, role updates, and member removal with the database.
- **End-to-End** — Test registration/login → household creation → another user joining → owner managing that member.
- **Security** — Test access using non-members, regular members, adults, and owners to verify the permission rules.
- **Accessibility** — Test form labels, keyboard navigation, role controls, and confirmation dialogs.
- **Performance** — Verify normal household and member lists load without noticeable delays.
- **Manual Exploratory** — Test invalid joins, duplicate joins, role changes, removal confirmation, mobile layouts, and unauthorized actions.

## 17. Documentation & Training

The project README should document:

- Household creation
- Household joining
- Household roles
- Permission rules
- Household and membership API routes

N/A for separate user training because the household setup process should be explained directly through the interface.

## 18. Open Questions

1. What method should users use to join a household: an invite code, invitation link, or another approach?
2. Can a user belong to more than one household in the MVP?
3. Can an owner transfer household ownership to another member?
4. Can an owner remove themselves from a household?
5. What exact permissions should the `adult` role have compared with the `member` role?

These questions should be decided before or during implementation because they affect the household data model and permission rules.

## 19. References

- HomeBase Project Specification
- HomeBase MVP Feature Inventory
- WDD 430 Feature Implementation Plan Template
- `docs/plans/README.md`
- Related plan: `F1-authentication-profiles.md`
- Related plan: `F3-shared-chores.md`
- Related plan: `F4-shopping-list.md`
- Related plan: `F5-household-projects.md`
- Related plan: `F6-home-maintenance.md`
- Related plan: `F7-household-dashboard.md`

---

## Human Review Notes

After reviewing the AI-assisted draft, I made household permissions more specific because the later HomeBase features depend on them. I separated authentication from household management instead of allowing this plan to repeat F1. I also kept chores, shopping, projects, maintenance, and dashboard functionality outside this feature so it stays small enough to implement separately. Error states and unauthorized actions were added to the UI plan, and every acceptance criterion was connected to a specific test.