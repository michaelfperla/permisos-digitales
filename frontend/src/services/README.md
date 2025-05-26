# Services (`frontend/src/services/`)

This directory is responsible for all communication with the backend API. It abstracts the details of HTTP requests, data fetching, and data submission.

## Role

- Provide a clean and reusable API for components and hooks to interact with backend data.
- Encapsulate `axios` (or other HTTP client) calls.
- Handle request/response transformations if necessary.
- Often used in conjunction with React Query for managing server state.

## Structure

- **`api.ts`** (or similar): Typically contains the base `axios` instance configuration. This includes:
  - Setting the `baseURL` (e.g., from `VITE_API_URL`).
  - Configuring interceptors for request headers (e.g., adding authentication tokens like CSRF tokens or JWTs).
  - Configuring interceptors for response handling (e.g., global error handling or data unwrapping).
- **Service-specific files** (e.g., `authService.ts`, `applicationService.ts`, `userService.ts`, `paymentService.ts`):
  - These files group related API calls for a specific resource or domain.
  - They import the configured `axios` instance from `api.ts`.
  - Functions within these files make the actual GET, POST, PUT, DELETE requests to specific backend endpoints.
  - They define the request payload structure and expected response types (using TypeScript interfaces).

## Usage Example (Conceptual)

```typescript
// Example in a component or hook
import { useQuery } from '@tanstack/react-query';
import { getApplicationDetails } from './services/applicationService'; // Assuming this function exists

function PermitDetails({ permitId }) {
  const { data, isLoading, error } = useQuery(['application', permitId], () =>
    getApplicationDetails(permitId),
  );

  // ... render logic
}
```

This structure helps keep API interaction logic organized and separate from UI components.
