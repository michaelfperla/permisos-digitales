# React Contexts (`frontend/src/contexts/`)

This directory holds React Context API implementations used for managing global or widely shared state across the Permisos Digitales frontend application.

## Role

Context provides a way to pass data through the component tree without having to pass props down manually at every level. It's suitable for state that can be considered "global" for a part of the component tree.

## Key Contexts

*   **`AuthContext.tsx`**:
    *   Manages user authentication state, including the current user object, authentication status (e.g., logged in/out), and potentially authentication tokens.
    *   Provides functions for login, logout, and registration.
    *   Wraps parts of the application (or the entire app) that require access to authentication information.
    *   Often consumed via the `useAuth` custom hook.

*   **`ToastContext.tsx`**:
    *   Manages the display of toast notifications (small, temporary messages) across the application.
    *   Provides functions to show success, error, warning, or informational toasts.
    *   Allows any component to trigger a toast message without complex prop drilling.

## Usage

1.  **Provider**: The context provider component (e.g., `<AuthProvider>`, `<ToastProvider>`) is wrapped around the part of the component tree that needs access to the context. This is often done in `App.tsx` or `main.tsx`.
2.  **Consumer**: Components that need to access the context data or functions can use the `useContext` hook directly or, more commonly, a custom hook provided by the context module (e.g., `useAuth()`, `useToast()`).

```typescript
// Conceptual: Using AuthContext via a custom hook
import { useAuth } from './hooks/useAuth'; // Assuming useAuth consumes AuthContext

function UserProfile() {
  const { user } = useAuth();
  return <div>Welcome, {user?.name}!</div>;
}

// Conceptual: Using ToastContext
import { useToast } from './hooks/useToast'; // Assuming useToast consumes ToastContext

function SubmitButton() {
  const { showToast } = useToast();
  const handleSubmit = () => {
    // ... submit logic
    showToast('Data submitted successfully!', 'success');
  };
  return <button onClick={handleSubmit}>Submit</button>;
}
```
The admin portal (`frontend/src/admin/contexts/`) may have its own separate contexts, such as an `AuthContext` specific to admin users.
