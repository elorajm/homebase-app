# F7 — Household Dashboard

> Feature implementation plan for the Household Dashboard feature of HomeBase.

## Metadata

| Field | Value |
|---|---|
| **Feature ID** | F7 |
| **Section** | Household Dashboard |
| **Severity** | MAJOR |
| **Markets** | HomeBase household users |
| **Status (today)** | MISSING |
| **Estimated effort** | S (1 week) |
| **Owner (proposed)** | Project team |
| **Depends on** | F1, F2, F3, F4, F5, F6 |
| **Unblocks** | None |

---

## 1. Problem Statement

HomeBase includes several different areas for managing a household, including chores, shopping items, projects, and home maintenance. Without a central dashboard, users would need to visit each section individually just to see what needs their attention. The Household Dashboard will give users a simple overview of important household information in one place and provide quick access to the main HomeBase features.

## 2. Goals

- Give household members a clear overview of current household activity.
- Show useful information from chores, shopping, projects, and maintenance.
- Provide quick navigation to the main HomeBase features.
- Clearly show when there is no information available for a dashboard section.
- Keep the dashboard simple and useful on both desktop and mobile devices.

## 3. Non-Goals

- The dashboard will not replace the full Chores, Shopping, Projects, or Maintenance pages.
- Users will not perform full CRUD operations directly from the dashboard.
- Advanced charts and analytics are not included.
- AI-generated household recommendations are not included.
- A household messaging feed is not included.
- Calendar functionality is not included.
- Custom dashboard layouts are not included in the MVP.

## 4. Personas & User Stories

- **As a household member**, I want to see an overview of household activity so that I quickly know what needs attention.
- **As a household member**, I want to see upcoming chores so that I know what responsibilities are due.
- **As a household member**, I want to see shopping-list information so that I know whether items are still needed.
- **As a household member**, I want to see current household projects so that I know what the household is working on.
- **As a household member**, I want to see upcoming or overdue maintenance tasks so that important home maintenance is not forgotten.
- **As a household member**, I want quick links to each HomeBase feature so that I can easily manage the full information.

## 5. Functional Requirements

- **FR-1.** The system MUST provide an authenticated household member with a household dashboard.
- **FR-2.** The dashboard MUST only display information belonging to the user's household.
- **FR-3.** The dashboard MUST display a summary of current chores from F3.
- **FR-4.** The dashboard MUST display a summary of shopping-list information from F4.
- **FR-5.** The dashboard MUST display a summary of current household projects from F5.
- **FR-6.** The dashboard MUST display a summary of upcoming or overdue maintenance tasks from F6.
- **FR-7.** The dashboard MUST provide navigation to the full Chores, Shopping List, Projects, and Maintenance pages.
- **FR-8.** The dashboard MUST display an appropriate empty state when a feature has no current information.
- **FR-9.** The system MUST prevent users from viewing dashboard information belonging to another household.
- **FR-10.** The dashboard SHOULD prioritize incomplete, upcoming, or overdue information over completed information.
- **FR-11.** The dashboard SHOULD remain usable on mobile and desktop screen sizes.
- **FR-12.** The dashboard MAY support additional summaries or customization in a future version.

## 6. Non-Functional Requirements

- **Performance** — The dashboard should load quickly enough for normal household use even though it retrieves information from several HomeBase features.
- **Security** — Users must be authenticated and household membership must be verified before dashboard information is returned.
- **Privacy & Compliance** — Dashboard information must only contain data belonging to the authenticated user's household.
- **Accessibility** — Dashboard sections, headings, links, status information, and controls should be usable with a keyboard and understandable with assistive technology.
- **Scalability** — Dashboard queries should return limited summary information instead of unnecessarily loading every household record.
- **Reliability** — A failure in one dashboard section should not expose incorrect information from another household.
- **Observability** — Dashboard loading and authorization errors should be logged without exposing private household information.
- **Maintainability** — The dashboard should use the existing data and permission rules from F1–F6 rather than creating duplicate household logic.
- **Internationalization** — N/A. The first version of HomeBase will support English only.
- **Backward Compatibility** — N/A. The Household Dashboard is a new feature.

## 7. Acceptance Criteria

- **AC-1.** *Given* an authenticated user belongs to a household, *when* they open the dashboard, *then* the dashboard displays information for that household.

- **AC-2.** *Given* the household has incomplete chores, *when* the dashboard loads, *then* a chore summary is displayed with a link to the full Chores page.

- **AC-3.** *Given* the household has shopping items that are still needed, *when* the dashboard loads, *then* shopping-list information is displayed with a link to the full Shopping List page.

- **AC-4.** *Given* the household has active projects, *when* the dashboard loads, *then* project information is displayed with a link to the full Projects page.

- **AC-5.** *Given* the household has upcoming or overdue maintenance tasks, *when* the dashboard loads, *then* maintenance information is displayed with a link to the full Maintenance page.

- **AC-6.** *Given* one dashboard category contains no current information, *when* the dashboard loads, *then* that section displays an appropriate empty state instead of an error.

- **AC-7.** *Given* a user does not belong to a household, *when* they attempt to access another household's dashboard information, *then* access is denied.

- **AC-8.** *Given* the user is viewing the dashboard on a smaller screen, *when* the page loads, *then* the dashboard sections remain readable and usable without horizontal scrolling.

## 8. Data Model

The Household Dashboard does not require a new primary data model.

It will read existing information from:

### F1 — Authentication & Profiles

Provides the authenticated user.

### F2 — Household & Member Management

Provides:

- Household information
- Household membership
- Household permissions

### F3 — Shared Chores

Provides:

- Chore title
- Assigned user
- Due date
- Completion status

### F4 — Shared Shopping List

Provides:

- Shopping item name
- Quantity when available
- Purchase status

### F5 — Household Projects

Provides:

- Project title
- Assigned user when available
- Target date
- Project status

### F6 — Home Maintenance

Provides:

- Maintenance task title
- Due date
- Completion status
- Overdue information

No new database table is required for the MVP dashboard.

No migration or backfill is required.

## 9. API Surface

The dashboard may use a dedicated summary route:

    GET /api/households/:householdId/dashboard

Authentication is required.

The system must verify that the authenticated user belongs to the requested household.

A successful response may contain information similar to:

    {
      "chores": [],
      "shoppingItems": [],
      "projects": [],
      "maintenance": []
    }

Each section should return only the information needed for the dashboard summary.

The dashboard MAY instead use existing F3–F6 API routes if that approach is more appropriate for the stack selected during implementation.

The implementation should avoid unnecessary duplicate requests or loading complete datasets when only summary information is needed.

WebSockets are N/A because real-time dashboard updates are outside the MVP.

Special rate limits are N/A beyond the application's normal API protections.

API documentation should be updated if a dedicated dashboard endpoint is created.

## 10. UI / UX

The Household Dashboard will act as the main landing page after a household user logs in.

The page should include summary sections for:

- Chores
- Shopping List
- Household Projects
- Home Maintenance

Each section should have a clear link or button to open the full feature page.

### Dashboard Flow

1. The user logs into HomeBase.
2. The system identifies the user's household.
3. The dashboard loads household summary information.
4. The user sees the household areas that need attention.
5. The user selects a section to open its full page.

### Chores Section

The dashboard should show a small number of relevant incomplete or upcoming chores.

A **View Chores** link should open the full Chores page.

### Shopping Section

The dashboard should show a summary of items that are still needed.

A **View Shopping List** link should open the full Shopping List page.

### Projects Section

The dashboard should show current planned or in-progress projects.

A **View Projects** link should open the full Projects page.

### Maintenance Section

The dashboard should show upcoming or overdue maintenance tasks.

A **View Maintenance** link should open the full Maintenance page.

### Empty States

Each dashboard section should have its own empty state.

Examples:

> No chores need attention.

> Your shopping list is empty.

> No active projects.

> No maintenance tasks need attention.

One empty feature should not cause the entire dashboard to appear empty.

### Loading State

The dashboard should display a loading state while household summary information is being retrieved.

### Error State

If the dashboard cannot load, the user should receive a clear error message and an option to try again when appropriate.

If only one section fails and the implementation allows the remaining sections to load safely, the available sections should still be displayed.

### Responsive Behavior

On larger screens, dashboard sections may appear in multiple columns.

On smaller screens, sections should stack vertically and remain readable without horizontal scrolling.

### Accessibility

Dashboard sections should use meaningful headings. Links and buttons should have descriptive labels and be keyboard accessible. Status information such as overdue or completed must not rely only on color.

## 11. AI / ML Considerations

N/A. The Household Dashboard does not use AI or machine learning.

## 12. Integration Points

This feature depends on:

- F1 Authentication & Profiles
- F2 Household & Member Management
- F3 Shared Chores
- F4 Shared Shopping List
- F5 Household Projects
- F6 Home Maintenance

No external services or APIs are required for the MVP.

The dashboard should reuse existing household authorization rules rather than creating a separate permission system.

## 13. Dependencies & Sequencing

- **Must ship after:** F1, F2, F3, F4, F5, and F6.
- **Must ship before:** N/A. This is the final planned MVP feature.
- **Shared infrastructure needed:** Authentication, user records, household membership, household permissions, chores, shopping items, projects, and maintenance tasks.

F7 should be implemented last because it summarizes information created by the other HomeBase features. Building it earlier could require temporary data structures or APIs that later need to be rewritten.

## 14. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Dashboard exposes another household's information | M | H | Verify household membership before retrieving dashboard data |
| Dashboard becomes too complicated | M | M | Keep the MVP limited to simple summaries and navigation |
| Loading several features makes the dashboard slow | M | M | Retrieve only the summary data needed for the dashboard |
| One empty feature causes confusing UI | M | L | Give each dashboard section its own empty state |
| One failed request prevents all information from displaying | M | M | Handle section failures safely where the selected implementation allows |
| Dashboard information becomes inconsistent with feature pages | M | M | Use the same source data and status definitions as F3–F6 |

## 15. Rollout Plan

A feature flag is N/A because the Household Dashboard is part of the HomeBase MVP.

F1 through F6 should be working before dashboard implementation begins.

The dashboard layout can be created first using the finalized information requirements from the other features. The data/API integration should then connect each summary section to the existing HomeBase data.

The dashboard should be tested with:

- A household containing information in every feature
- A household with some empty sections
- A household with no current activity
- Unauthorized users
- Mobile and desktop screen sizes

If a dashboard integration causes problems with an existing feature, the integration should be corrected without changing the working feature unnecessarily.

## 16. Test Plan

### Acceptance Criteria Test Mapping

| Acceptance Criterion | Test |
|---|---|
| AC-1 | Log in as a household member, open the dashboard, and verify only that household's information is displayed. |
| AC-2 | Create an incomplete chore and verify it appears in the dashboard chore summary with a working Chores link. |
| AC-3 | Create a needed shopping item and verify shopping information appears with a working Shopping List link. |
| AC-4 | Create an active project and verify it appears in the project summary with a working Projects link. |
| AC-5 | Create an upcoming or overdue maintenance task and verify it appears with a working Maintenance link. |
| AC-6 | Use a household with an empty feature and verify that section displays its empty state without breaking the dashboard. |
| AC-7 | Attempt to access another household's dashboard information and verify access is denied. |
| AC-8 | Open the dashboard at a mobile screen size and verify sections remain readable and usable without horizontal scrolling. |

### Additional Testing

- **Unit** — Test dashboard summary filtering and selection rules.
- **Integration** — Test retrieval of household-specific data from F2–F6.
- **End-to-End** — Test login → dashboard → view summaries → navigate to each full feature page.
- **Security** — Verify dashboard information cannot be accessed by users outside the household.
- **Accessibility** — Test headings, keyboard navigation, descriptive links, status information, and screen-reader structure.
- **Performance** — Verify dashboard summary queries do not unnecessarily load complete household datasets.
- **Manual Exploratory** — Test households with full data, partial data, no activity, overdue items, loading failures, mobile layouts, and unauthorized access.

## 17. Documentation & Training

The project README should be updated to describe:

- The Household Dashboard
- Information displayed on the dashboard
- Dashboard navigation
- Dashboard API route if one is created
- Dependencies on F1–F6

N/A for separate end-user training because the dashboard should provide clear navigation to the main HomeBase features.

## 18. Open Questions

1. How many items from each feature should appear on the dashboard?
2. Should the dashboard show only the current user's chores or all household chores?
3. Should shopping information show individual items or only the number of items still needed?
4. How far into the future should maintenance tasks be considered "upcoming"?
5. Should projects display target dates on the dashboard?
6. Should the implementation use one dashboard API endpoint or combine existing feature endpoints?

These decisions can be finalized during implementation without expanding the MVP.

## 19. References

- HomeBase Project Specification
- HomeBase MVP Feature Inventory
- WDD 430 Feature Implementation Plan Template
- `docs/plans/README.md`
- Related plan: `F1-authentication-profiles.md`
- Related plan: `F2-household-members.md`
- Related plan: `F3-shared-chores.md`
- Related plan: `F4-shopping-list.md`
- Related plan: `F5-household-projects.md`
- Related plan: `F6-home-maintenance.md`

---

## Human Review Notes

After reviewing the AI-assisted draft, I kept the dashboard focused on showing simple summaries instead of turning it into another place to manage every feature. Full CRUD actions, analytics, custom layouts, calendars, messaging, and AI recommendations were kept outside the MVP. I also made the dependency order clearer because the dashboard cannot be fully implemented until the chores, shopping, projects, and maintenance features provide the information it needs. Separate empty, loading, and error states were included so one missing type of household information does not make the whole dashboard confusing. Finally, each acceptance criterion was connected to a specific test so the dashboard has a clear definition of done.