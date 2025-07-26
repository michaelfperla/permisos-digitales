# Frontend Testing Guide

This document outlines the comprehensive testing strategy and utilities for the Permisos Digitales frontend application.

## Overview

The frontend consists of two main applications:
- **Client App** (`src/`): User-facing permit application system
- **Admin App** (`src/admin/`): Administrative interface for managing applications and users

## Testing Architecture

### Test Types

1. **Unit Tests**: Individual component and function testing
2. **Integration Tests**: Multi-component workflow testing
3. **Service Tests**: API service layer testing
4. **Admin Tests**: Admin-specific functionality testing

### Test Structure

```
src/
├── test/                           # Core testing utilities
│   ├── setup.ts                   # Global test configuration
│   ├── test-utils.tsx             # Client app test utilities
│   ├── factories/                 # Test data factories
│   ├── mocks/                     # Service mocks
│   └── integration/               # Integration test utilities
├── admin/
│   └── test/                      # Admin-specific test utilities
├── components/
│   └── **/__tests__/              # Component unit tests
├── pages/
│   └── **/__tests__/              # Page component tests
├── services/
│   └── **/__tests__/              # Service layer tests
└── hooks/
    └── **/__tests__/              # Custom hook tests
```

## Test Utilities

### Core Test Utils (`src/test/test-utils.tsx`)

Provides wrapped render functions with all necessary providers:

```tsx
import { render, screen } from '../test/test-utils';

// Automatically includes QueryClient, Router, Auth, and Toast providers
render(<MyComponent />);

// With custom auth state
render(<MyComponent />, {
  authContextProps: {
    isAuthenticatedByDefault: false
  }
});
```

### Admin Test Utils (`src/admin/test/admin-test-utils.tsx`)

Admin-specific testing utilities:

```tsx
import { renderAdmin } from '../../admin/test/admin-test-utils';

renderAdmin(<AdminComponent />, {
  authContextProps: {
    initialUser: createMockAdminUser()
  }
});
```

### Integration Test Utils (`src/test/integration/integration-test-utils.tsx`)

For testing complete user flows:

```tsx
import { renderUserFlow, renderAdminFlow } from '../integration/integration-test-utils';

// Test complete user workflows
renderUserFlow(<App />, {
  initialEntries: ['/dashboard'],
  mockServices: { applicationService: mockService }
});
```

## Test Data Factories

Located in `src/test/factories/index.ts`, provides consistent test data:

```tsx
import { 
  createMockUser, 
  createMockAdminUser,
  createMockApplication,
  createValidPermitFormData 
} from '../test/factories';

const user = createMockUser({ email: 'custom@example.com' });
const application = createDraftApplication();
const formData = createValidPermitFormData();
```

### Available Factories

- `createMockUser()` - Standard user
- `createMockAdminUser()` - Admin user
- `createMockApplication()` - Base application
- `createDraftApplication()` - Draft status application
- `createSubmittedApplication()` - Submitted status application
- `createApprovedApplication()` - Approved status application
- `createRejectedApplication()` - Rejected status application
- `createValidLoginData()` - Login form data
- `createValidRegisterData()` - Registration form data
- `createValidPermitFormData()` - Permit form data
- `createQueryResult()` - React Query result
- `createLoadingQueryResult()` - Loading state
- `createErrorQueryResult()` - Error state

## Running Tests

### Basic Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

### Specific Test Categories

```bash
# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Admin app tests only
npm run test:admin

# Client app tests only
npm run test:client

# CI pipeline (with coverage and verbose output)
npm run test:ci
```

## Writing Tests

### Component Tests

```tsx
import { render, screen, fireEvent, waitFor } from '../test/test-utils';
import { createMockUser } from '../test/factories';
import MyComponent from './MyComponent';

describe('MyComponent', () => {
  it('renders correctly for authenticated user', () => {
    render(<MyComponent />, {
      authContextProps: {
        initialUser: createMockUser()
      }
    });
    
    expect(screen.getByText('Welcome')).toBeInTheDocument();
  });
});
```

### Service Tests

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSuccessResponse, createErrorResponse } from '../test/factories';
import myService from './myService';

// Mock axios
const mockGet = vi.fn();
vi.mock('axios', () => ({
  default: { create: () => ({ get: mockGet }) }
}));

describe('myService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches data successfully', async () => {
    mockGet.mockResolvedValue({ data: createSuccessResponse({ id: 1 }) });
    
    const result = await myService.getData();
    
    expect(result.success).toBe(true);
    expect(result.data.id).toBe(1);
  });
});
```

### Integration Tests

```tsx
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderUserFlow } from '../integration/integration-test-utils';
import { createValidPermitFormData } from '../../factories';
import App from '../../../App';

describe('Permit Application Flow', () => {
  it('completes full application process', async () => {
    const user = userEvent.setup();
    
    renderUserFlow(<App />, {
      initialEntries: ['/permits/new'],
      mockServices: {
        applicationService: mockApplicationService
      }
    });

    // Fill form and submit
    const formData = createValidPermitFormData();
    await user.type(screen.getByLabelText(/project name/i), formData.projectName);
    await user.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(screen.getByText(/success/i)).toBeInTheDocument();
    });
  });
});
```

## Best Practices

### 1. Use Factories for Test Data
Always use factories instead of hardcoded test data for consistency and maintainability.

### 2. Mock External Dependencies
Mock all external services and APIs to ensure tests are isolated and fast.

### 3. Test User Interactions
Focus on testing user interactions and workflows rather than implementation details.

### 4. Use Descriptive Test Names
Test names should clearly describe what is being tested and the expected outcome.

### 5. Group Related Tests
Use `describe` blocks to group related tests and share setup code.

### 6. Clean Up After Tests
Always clean up mocks and state between tests using `beforeEach` and `afterEach`.

## Coverage Requirements

The project maintains high coverage standards:
- **Statements**: 70%
- **Branches**: 65%
- **Functions**: 70%
- **Lines**: 70%

## Debugging Tests

### Common Issues

1. **QueryClient not provided**: Use test utilities that include QueryClientProvider
2. **Router context missing**: Use test utilities with MemoryRouter
3. **Auth context missing**: Use appropriate auth context props
4. **Async operations**: Use `waitFor` for async assertions

### Debug Tips

```tsx
// Debug rendered output
render(<Component />);
screen.debug(); // Prints current DOM

// Debug specific element
screen.debug(screen.getByRole('button'));

// Use data-testid for complex queries
<button data-testid="submit-btn">Submit</button>
screen.getByTestId('submit-btn');
```

## Continuous Integration

Tests run automatically on:
- Pull requests
- Main branch pushes
- Release builds

CI configuration includes:
- Full test suite execution
- Coverage reporting
- Performance benchmarks
- Accessibility checks
