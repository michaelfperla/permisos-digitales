# Backend Automated Tests (`src/tests/`)

This directory and its subdirectories (often `__tests__` alongside source files) contain automated tests for the Permisos Digitales backend, primarily using the [Jest](https://jestjs.io/) testing framework.

For a general overview of testing scripts, refer to the main project [README.md](../../README.md#testing).

## Test Philosophy

*   **Unit Tests**: Focus on testing individual functions, modules, or classes in isolation. Dependencies are typically mocked to ensure that only the unit under test is being evaluated.
*   **Integration Tests**: Test the interaction between multiple components or modules, including API endpoint testing (request/response behavior). These tests may involve real database connections (to a test database) or other infrastructure components.

## Test Structure

*   **Unit Tests (`__tests__` directories)**: Test files for specific modules (e.g., services, utils) are often located in a `__tests__` subdirectory alongside the file they are testing (e.g., `src/services/__tests__/application.service.test.js`).
*   **Integration Tests (`src/routes/__tests__` or similar)**: API endpoint integration tests are commonly found in `src/routes/__tests__/` and often use libraries like `supertest` to make HTTP requests to the test server.
*   **Global Test Setup (`src/tests/setup.js`)**: This file (if it exists, or a similar Jest setup file specified in `jest.config.js`) is used for global test environment configuration. This can include:
    *   Setting up mock environments (e.g., for environment variables).
    *   Global mocks for common dependencies (e.g., loggers, database clients for certain test types).
    *   Providing utility functions or test helpers.
*   **Test Helpers (`src/tests/helpers/`)**: May contain reusable helper functions or modules for setting up test data, authenticating test users, or interacting with a test server instance.

## Running Tests

Use the following npm scripts (defined in the root `package.json`) to run backend tests:

*   **Run all backend tests**:
    ```bash
    npm test
    ```
*   **Run only unit tests** (based on naming conventions or path matching in Jest config):
    ```bash
    npm run test:unit
    ```
*   **Run only integration tests**:
    ```bash
    npm run test:integration
    ```
*   **Run tests in watch mode** (Jest will re-run tests when files change):
    ```bash
    npm run test:watch
    ```
*   **Generate a code coverage report**:
    ```bash
    npm run test:cov
    ```
    The coverage report will typically be generated in a `coverage/` directory.

## Writing Tests

*   Follow the **Arrange-Act-Assert** pattern for structuring tests.
*   Use Jest's mocking capabilities (`jest.mock`, `jest.fn`, `jest.spyOn`) extensively for unit tests.
*   Ensure tests are independent and can be run in any order.
*   Use descriptive names for test suites (`describe`) and individual tests (`it` or `test`).
*   Clean up any resources or reset mocks in `afterEach` or `afterAll` hooks if necessary.
*   For API integration tests, ensure the test database is properly seeded and cleaned up if tests modify data.
