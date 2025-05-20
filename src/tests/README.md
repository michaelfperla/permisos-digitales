# Automated Testing with Jest

This directory contains automated tests for the Permisos Digitales backend using Jest.

## Test Structure

Tests are organized into the following categories:

1. **Unit Tests**: Test individual functions and modules in isolation
   - Located in `__tests__` directories alongside the code they test
   - Example: `src/utils/__tests__/password.test.js`

2. **Integration Tests**: Test how components work together
   - Located in `__tests__` directories with `.integration.test.js` suffix
   - Example: `src/routes/__tests__/auth.integration.test.js`

## Running Tests

The following npm scripts are available for running tests:

```bash
# Run all tests
npm test

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run tests in watch mode (automatically re-run when files change)
npm run test:watch

# Run tests with coverage report
npm run test:cov
```

## Test Setup

The global test setup is defined in `src/tests/setup.js`. This file:

1. Sets up the test environment
2. Mocks common dependencies like the database and logger
3. Provides utility functions for testing

## Writing Tests

### Unit Tests

Unit tests should focus on testing a single function or module in isolation. Dependencies should be mocked.

Example:

```javascript
// src/utils/__tests__/example.test.js
const { myFunction } = require('../example');

// Mock dependencies
jest.mock('../../some-dependency', () => ({
  someDependencyFunction: jest.fn()
}));

describe('My Function', () => {
  it('should do something specific', () => {
    // Arrange
    const input = 'test';
    
    // Act
    const result = myFunction(input);
    
    // Assert
    expect(result).toBe('expected output');
  });
});
```

### Integration Tests

Integration tests should focus on testing how components work together. They may use real dependencies or mocks depending on the test.

Example:

```javascript
// src/routes/__tests__/example.integration.test.js
const request = require('supertest');
const express = require('express');
const exampleRoutes = require('../example.routes');

// Mock only external dependencies
jest.mock('../../db', () => ({
  query: jest.fn()
}));

describe('Example Routes', () => {
  let app;
  
  beforeEach(() => {
    // Create a new Express app for each test
    app = express();
    app.use(express.json());
    app.use('/api/example', exampleRoutes);
  });
  
  it('should return data from GET /api/example', async () => {
    // Arrange
    const mockData = [{ id: 1, name: 'Test' }];
    require('../../db').query.mockResolvedValue({ rows: mockData });
    
    // Act
    const response = await request(app).get('/api/example');
    
    // Assert
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(mockData);
  });
});
```

## Best Practices

1. **Arrange-Act-Assert**: Structure tests with clear arrangement, action, and assertion phases
2. **Mock Dependencies**: Use Jest's mocking capabilities to isolate the code being tested
3. **Test Edge Cases**: Include tests for error conditions and edge cases
4. **Keep Tests Independent**: Each test should be able to run independently of others
5. **Descriptive Names**: Use descriptive test names that explain what is being tested
6. **Clean Up**: Reset mocks and clean up resources in `afterEach` or `afterAll` hooks

## Debugging Tests

To debug tests:

1. Use `console.log` statements (these will appear in the test output)
2. Run a single test with `npx jest path/to/test.js`
3. Use the `--verbose` flag for more detailed output: `npx jest --verbose`
4. Use the `--detectOpenHandles` flag to find tests that don't clean up properly
