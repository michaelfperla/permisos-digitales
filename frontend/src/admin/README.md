# Admin Portal (`frontend/src/admin/`)

This directory contains a complete, separate React Single Page Application (SPA) for the administrative functions of Permisos Digitales.

## Overview

The Admin Portal is distinct from the main user-facing application and has its own:
*   Entry point (`main.tsx`)
*   Root component (`App.tsx`)
*   Routing configuration
*   State management setup (potentially including its own AuthContext for admin users)
*   Components, pages, services, hooks, and layouts tailored for administrative tasks.

This separation ensures that admin-specific code, dependencies, and styling do not impact the user portal, and vice-versa.

## Key Features

*   Secure login for administrators.
*   Dashboard for system overview.
*   User management (viewing, activating/deactivating accounts).
*   Review and processing of permit applications submitted by users.
*   Verification of payment proofs.
*   Viewing detailed application information and history.

## Development

*   The Admin Portal is typically served via a specific route from the backend (e.g., `/admin/*`) which serves the `frontend/admin.html` file.
*   Development often involves running the main backend and frontend dev servers simultaneously.
*   API calls from the admin portal use the same backend API but may hit admin-specific endpoints or have different authorization requirements.

## Structure

The internal structure of `frontend/src/admin/` mirrors a standard React application:
*   **`main.tsx`**: Entry point for the admin SPA.
*   **`App.tsx`**: Root component for the admin SPA.
*   **`components/`**: Reusable components specific to the admin interface.
*   **`pages/`**: Page components for different admin views (e.g., `DashboardPage.tsx`, `UsersPage.tsx`, `ApplicationDetailsPage.tsx`).
*   **`services/`**: Services for admin-specific API calls (e.g., `adminService.ts`, `authService.ts` for admin login).
*   **`contexts/`**: Contexts for admin-specific global state (e.g., admin authentication).
*   **`hooks/`**: Custom hooks used within the admin portal.
*   **`layouts/`**: Layout components for the admin interface.

Refer to the code within this directory for specific implementation details.
