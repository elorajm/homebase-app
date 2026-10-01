# HomeBase MVP Feature Inventory

HomeBase is a household management application designed to give families or people living together one place to organize everyday responsibilities. The MVP focuses on the main features needed to create a household, manage members, and keep track of chores, shopping, projects, and home maintenance.

## MVP Features

### F1 — Authentication & Profiles
**Type:** Infrastructure / Supporting  
**Depends on:** None

Users can create an account, log in, log out, and manage basic profile information. Authentication provides the user identity needed for the rest of HomeBase.

### F2 — Household & Member Management
**Type:** Blocked by F1  
**Depends on:** F1

Users can create or join a household and view household members. Household roles and permissions determine what members are allowed to manage.

### F3 — Shared Chores
**Type:** Blocked by F1 and F2  
**Depends on:** F1, F2

Household members can create, view, update, complete, and delete shared chores. Chores can be assigned to members of the same household and include due dates and completion status.

### F4 — Shared Shopping List
**Type:** Blocked by F1 and F2  
**Depends on:** F1, F2

Household members can maintain a shared shopping list by adding, viewing, editing, purchasing, and deleting items.

### F5 — Household Projects
**Type:** Blocked by F1 and F2  
**Depends on:** F1, F2

Household members can create and track larger household projects. Projects can include descriptions, assigned members, target dates, and progress statuses.

### F6 — Home Maintenance
**Type:** Blocked by F1 and F2  
**Depends on:** F1, F2

Household members can create and manage home maintenance tasks with due dates and completion statuses. Overdue maintenance tasks will be clearly identified.

### F7 — Household Dashboard
**Type:** Blocked by F1–F6  
**Depends on:** F1, F2, F3, F4, F5, F6

The dashboard gives household members a simple overview of chores, shopping items, projects, and maintenance tasks. It also provides quick navigation to each full HomeBase feature.

---

## Feature Dependency Map

The basic implementation flow is:

    F1 Authentication & Profiles
             |
             v
    F2 Household & Member Management
             |
             +----------------+----------------+----------------+
             |                |                |                |
             v                v                v                v
       F3 Chores       F4 Shopping      F5 Projects     F6 Maintenance
             \                |                |                /
              \_______________|________________|_______________/
                              |
                              v
                    F7 Household Dashboard

F1 must be completed first because HomeBase needs authenticated users. F2 comes next because the other household features need household membership and permissions. F3 through F6 can then be developed independently because they all use the same household foundation. F7 should be completed last because it depends on information from the other MVP features.

## MVP Scope

The MVP intentionally focuses on the basic household-management experience. Features such as notifications, messaging, advanced analytics, AI recommendations, project subtasks, expense tracking, grocery ordering, recurring maintenance, and custom dashboards are outside the initial scope. These could be considered as future improvements after the core HomeBase features are working.