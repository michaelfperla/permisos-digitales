# Custom Hooks (`frontend/src/hooks/`)

This directory contains custom React hooks used throughout the Permisos Digitales frontend application. Custom hooks are a way to extract component logic into reusable functions.

## Role

*   Share stateful logic between multiple components.
*   Abstract complex logic away from UI components, making them cleaner.
*   Improve code reusability and maintainability.

## Key Hooks (Examples)

Based on the file listing, examples might include:

*   **`useAuth.ts`**: Provides easy access to authentication status, user data, and login/logout functions from `AuthContext`.
*   **`useBreadcrumbs.ts`**: Manages breadcrumb generation based on the current route or application state.
*   **`useMediaQuery.ts`** or **`useResponsive.ts`**: Helps in creating responsive UIs by detecting screen size or device capabilities.
*   **`usePermitFormValidation.ts`**: Encapsulates complex validation logic specific to the multi-step permit application form.

## Usage

Custom hooks are used within functional components or other custom hooks just like standard React hooks (e.g., `useState`, `useEffect`).

```typescript
// Conceptual example
import { useAuth } from './hooks/useAuth';

function MyComponent() {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <p>Please log in.</p>;
  }

  return <p>Welcome, {user?.firstName}!</p>;
}
```

Refer to individual hook files for their specific purpose, parameters, and return values.
