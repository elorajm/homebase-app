# F4 — Shared Shopping List

> Feature implementation plan for the Shared Shopping List feature of HomeBase.

## Metadata

| Field | Value |
|---|---|
| **Feature ID** | F4 |
| **Section** | Shared Shopping |
| **Severity** | MAJOR |
| **Markets** | HomeBase household users |
| **Status (today)** | MISSING |
| **Estimated effort** | S (1 week) |
| **Owner (proposed)** | Project team |
| **Depends on** | F1 Authentication & Profiles, F2 Household & Member Management |
| **Unblocks** | F7 Household Dashboard |

---

## 1. Problem Statement

Household shopping lists can become difficult to manage when different people keep separate paper lists, text each other items, or forget what has already been purchased. HomeBase needs a shared shopping list where household members can see and manage the same list. This feature will allow household members to add items, update them, mark them as purchased, and remove items that are no longer needed.

## 2. Goals

- Allow household members to view one shared shopping list.
- Allow authorized household members to add shopping items.
- Allow shopping items to be edited or removed.
- Allow household members to mark items as purchased.
- Clearly show the difference between needed and purchased items.

## 3. Non-Goals

- Online grocery ordering is not included.
- Grocery delivery services are not included.
- Price comparison between stores is not included.
- Automatic product suggestions are not included.
- AI-generated shopping lists are not included.
- Meal planning is not included.
- Household expense tracking is not included.
- Real-time WebSocket updates are not included in the MVP.

## 4. Personas & User Stories

- **As a household member**, I want to add an item to the shared shopping list so that another household member can see what is needed.
- **As a household member**, I want to see the current shopping list so that I know what needs to be purchased.
- **As a household member**, I want to mark an item as purchased so that other household members know it has already been bought.
- **As an authorized household member**, I want to edit an item so that incorrect information can be fixed.
- **As an authorized household member**, I want to remove an item that is no longer needed so that the list stays current.

## 5. Functional Requirements

- **FR-1.** The system MUST allow an authorized household member to add an item to the household shopping list.
- **FR-2.** A shopping item MUST contain an item name and purchase status.
- **FR-3.** The system MUST associate every shopping item with the household that created it.
- **FR-4.** The system MUST display the household's current shopping items.
- **FR-5.** The system MUST allow a household member to mark an item as purchased.
- **FR-6.** The system MUST allow an authorized household member to edit an existing shopping item.
- **FR-7.** The system MUST allow an authorized household member to delete a shopping item.
- **FR-8.** The system MUST prevent users from accessing shopping lists belonging to households they do not belong to.
- **FR-9.** The system SHOULD allow an optional quantity to be entered for an item.
- **FR-10.** The system SHOULD visually distinguish purchased items from items that are still needed.
- **FR-11.** The system MAY support shopping categories in a future version.

## 6. Non-Functional Requirements

- **Performance** — The shopping list should load and update quickly during normal household use.
- **Security** — Users must be authenticated, and household membership must be verified before shopping information is returned or changed.
- **Privacy & Compliance** — Users must not be able to view shopping information belonging to another household.
- **Accessibility** — Shopping forms, item controls, and purchase status must be usable with a keyboard and understandable with assistive technology.
- **Scalability** — The MVP only needs to support normal household-sized shopping lists, but records should use unique IDs and household relationships so the feature can grow later.
- **Reliability** — Failed requests must not incorrectly add, update, purchase, or remove shopping items.
- **Observability** — Server and authorization errors should be logged without exposing private household information.
- **Maintainability** — Shopping list permissions should follow the household authorization patterns established in F2.
- **Internationalization** — N/A. The first HomeBase version will support English only.
- **Backward Compatibility** — N/A. This is a new feature with no existing shopping-list data.

## 7. Acceptance Criteria

- **AC-1.** *Given* an authorized household member is logged in, *when* they enter a valid item name and submit the form, *then* the item appears on the household shopping list.

- **AC-2.** *Given* a household has shopping items, *when* a household member opens the shopping list, *then* the current items and their purchase status are displayed.

- **AC-3.** *Given* a shopping item has not been purchased, *when* a household member marks it as purchased, *then* its status changes to purchased.

- **AC-4.** *Given* an authorized household member edits an existing item, *when* they save valid changes, *then* the updated information is stored and displayed.

- **AC-5.** *Given* an authorized household member chooses to delete an item, *when* they confirm the deletion, *then* the item is removed from the shopping list.

- **AC-6.** *Given* a user does not belong to a household, *when* they attempt to access that household's shopping list, *then* access is denied.

- **AC-7.** *Given* a user submits a shopping item without a required item name, *when* they attempt to save it, *then* an error is displayed and the item is not created.

- **AC-8.** *Given* an item has been marked as purchased, *when* the shopping list is displayed, *then* the interface clearly distinguishes it from items that are still needed.

## 8. Data Model

A ShoppingItem model will be needed.

### ShoppingItem

- `id`
- `householdId`
- `name`
- `quantity`
- `status`
- `createdBy`
- `createdAt`
- `updatedAt`

### Status Values

The initial status values will be:

- `needed`
- `purchased`

### Constraints

- Every shopping item must have a unique ID.
- `householdId` must reference an existing household.
- `name` is required.
- `status` is required.
- `createdBy` must reference an authenticated user.
- `quantity` is optional.

Indexes should support retrieving shopping items by household.

No backfill is required because this is a new feature with no existing shopping-list data.

The exact migration file name will depend on the database and migration conventions selected during implementation.

## 9. API Surface

The Shared Shopping List feature will need routes similar to:

    GET    /api/households/:householdId/shopping-items
    POST   /api/households/:householdId/shopping-items
    GET    /api/shopping-items/:itemId
    PUT    /api/shopping-items/:itemId
    DELETE /api/shopping-items/:itemId
    PATCH  /api/shopping-items/:itemId/purchased

All routes require authentication.

The system must verify household membership and appropriate permissions before returning or changing shopping-list information.

### Create Shopping Item

Request:

    {
      "name": "Milk",
      "quantity": "1 gallon"
    }

A successful request should return the newly created shopping item.

### Update Shopping Item

Request:

    {
      "name": "Whole Milk",
      "quantity": "2 gallons"
    }

### Mark Purchased

The purchase route changes the item's status from `needed` to `purchased`.

Invalid requests should return an appropriate error without changing the shopping item.

WebSockets are N/A because real-time updates are outside the MVP.

Special rate limits are N/A beyond the application's normal API protections.

API documentation should be updated when these routes are implemented.

## 10. UI / UX

HomeBase will have a Shopping List page available from the household navigation.

Each shopping item should display:

- Item name
- Quantity when provided
- Purchase status
- Mark Purchased option
- Edit option when allowed
- Delete option when allowed

The page will have an **Add Item** button for users with permission to add shopping items.

### Add Item Flow

1. The user opens the Shopping List page.
2. Existing items are displayed.
3. The user selects **Add Item**.
4. The user enters an item name.
5. The user may enter a quantity.
6. The user submits the form.
7. The new item appears on the household shopping list.

### Purchase Flow

1. The user views an item that is still needed.
2. The user selects **Mark Purchased**.
3. The system updates the item.
4. The interface clearly shows that the item has been purchased.

### Empty State

If there are no shopping items, the page should display:

> Your shopping list is empty. Add an item to get started.

### Loading State

A loading indicator should appear while shopping items are being retrieved or changed.

### Error State

If the list cannot be loaded or an item cannot be saved, updated, or deleted, the application should display a clear error message.

Unauthorized actions should display an appropriate permission message.

### Responsive Behavior

The shopping list should work on desktop and mobile screen sizes. Controls should remain easy to use on smaller screens without horizontal scrolling.

### Accessibility

Forms should have visible labels. Buttons and item controls should be keyboard accessible. Purchased status must not rely only on color. Status information should also be communicated through text or another accessible indicator.

## 11. AI / ML Considerations

N/A. The Shared Shopping List feature does not use AI or machine learning.

## 12. Integration Points

This feature depends on:

- F1 Authentication & Profiles
- F2 Household & Member Management

F1 provides the authenticated user.

F2 provides household membership and role permissions.

This feature provides shopping-list information to:

- F7 Household Dashboard

No external services or APIs are required for the MVP.

## 13. Dependencies & Sequencing

- **Must ship after:** F1 Authentication & Profiles and F2 Household & Member Management.
- **Must ship before:** F7 Household Dashboard.
- **Shared infrastructure needed:** Authentication, user records, household records, household membership, and permission checks.

F4 does not depend on F3 Shared Chores because both features can use the household infrastructure from F1 and F2 independently.

## 14. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| A user accesses another household's shopping list | M | H | Verify household membership on every request |
| Unauthorized user changes shopping items | M | H | Check role permissions before protected actions |
| Purchased items are confused with needed items | M | M | Clearly display item status using text and visual differences |
| Invalid or blank items are created | M | M | Validate required item names before saving |
| An item is accidentally deleted | M | M | Ask for confirmation before deletion |
| Shopping data does not integrate correctly with F7 | L | M | Keep household and status fields consistent and test dashboard integration |

## 15. Rollout Plan

A feature flag is N/A because the Shared Shopping List is a core HomeBase MVP feature.

F1 and F2 must be available before this feature is implemented.

The ShoppingItem data model should be created first, followed by the API routes and then the Shopping List interface.

The feature should be tested independently before shopping information is added to F7 Household Dashboard.

If authorization or data problems are discovered, they should be corrected before dashboard integration.

## 16. Test Plan

### Acceptance Criteria Test Mapping

| Acceptance Criterion | Test |
|---|---|
| AC-1 | Add a valid shopping item and verify it appears on the household shopping list. |
| AC-2 | Open a household shopping list and verify current items and purchase statuses are displayed. |
| AC-3 | Mark a needed item as purchased and verify its stored status changes to purchased. |
| AC-4 | Edit an existing shopping item and verify the updated information is stored and displayed. |
| AC-5 | Delete an item and verify it no longer appears on the shopping list. |
| AC-6 | Attempt to access another household's shopping list and verify access is denied. |
| AC-7 | Submit an item without a name and verify an error appears and no item is created. |
| AC-8 | Display a purchased item and verify its purchased status is clearly communicated. |

### Additional Testing

- **Unit** — Test shopping-item validation, purchase status changes, and permission rules.
- **Integration** — Test create, read, update, purchase, and delete operations through the API and data storage.
- **End-to-End** — Test login → household access → add item → edit item → mark purchased → delete item.
- **Security** — Verify users cannot view or change shopping information belonging to another household.
- **Accessibility** — Test labels, keyboard controls, status communication, and confirmation dialogs.
- **Performance** — Verify normal household shopping lists load and update without noticeable delays.
- **Manual Exploratory** — Test empty lists, invalid items, mobile layouts, loading states, server errors, and unauthorized actions.

## 17. Documentation & Training

The project README should be updated to describe:

- The Shared Shopping List feature
- Shopping-list permissions
- Shopping API routes
- ShoppingItem data fields

N/A for separate end-user training because the feature should be understandable through the HomeBase interface.

## 18. Open Questions

1. Should every household role be allowed to add and edit shopping items?
2. Should purchased items remain visible until manually deleted, or should they be hidden automatically?
3. Should users be able to move a purchased item back to `needed`?
4. Should quantity remain free text or eventually use separate amount and unit fields?

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

After reviewing the AI-assisted draft, I kept the shopping feature focused on managing a simple shared household list. Grocery ordering, price comparison, meal planning, expense tracking, AI suggestions, and real-time updates were kept outside the MVP because they would make this feature much larger. I also made household access and permissions explicit instead of assuming that authentication alone would protect the list. Empty, loading, error, and unauthorized states were added to the UI plan. Each acceptance criterion was also connected to a specific test so the feature has a clear definition of done.