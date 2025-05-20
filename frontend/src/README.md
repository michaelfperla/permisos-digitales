# Frontend Source (`frontend/src/`)

This directory is the heart of the Permisos Digitales frontend application, containing all React components, pages, services, hooks, contexts, and utilities written in TypeScript.

## Overview

The frontend is structured to provide a clear separation of concerns, enabling maintainability and scalability. It includes two main application experiences:
1.  **User Portal**: The primary interface for applicants to apply for and manage their permits.
2.  **Admin Portal**: A separate interface for administrators to manage users and applications (located in `admin/`).

For a high-level architectural overview, refer to the [Frontend Documentation section in the main System Documentation](../../docs/PROJECT_DOCUMENTATION.md#4-frontend-documentation).

## Key Subdirectories

*   **`admin/`**: Contains the complete source code for the separate Admin Portal SPA. See `admin/README.md`.
*   **`App.tsx`**: The root React component for the main user-facing application.
*   **`main.tsx`**: The entry point for the main user-facing React application, responsible for rendering `App.tsx` and setting up providers.
*   **`assets/`**: Static assets like images, icons, etc., that are imported into components (Note: Confirm if this directory exists and is used this way).
*   **`components/`**: Shared, reusable React components used across various parts of the application. See `components/README.md`.
*   **`constants/`**: Application-wide constants, such as enums or configuration values.
*   **`contexts/`**: React Context API providers for managing global state (e.g., authentication, notifications). See `contexts/README.md`.
*   **`hooks/`**: Custom React hooks that encapsulate reusable stateful logic. See `hooks/README.md`.
*   **`layouts/`**: Components that define the overall structure and layout for different types of pages. See `layouts/README.md`.
*   **`pages/`**: Top-level components representing distinct views or pages of the application. See `pages/README.md`.
*   **`services/`**: Modules responsible for making API calls to the backend and managing data fetching logic. See `services/README.md`.
*   **`styles/`**: Global stylesheets, CSS variables, and utility classes.
*   **`test/`**: Test setup, mocks, and utilities for Vitest and React Testing Library.
*   **`types/`**: TypeScript type definitions and interfaces.
*   **`utils/`**: Utility functions used throughout the frontend.

## State Management

*   **React Query (`@tanstack/react-query`)**: Used for managing server state (fetching, caching, updating data from the backend).
*   **Context API**: Used for global UI state and authentication state.
*   **Local Component State**: Standard `useState` and `useReducer` for component-level state.

## Routing
Client-side routing is handled by `react-router-dom`.
