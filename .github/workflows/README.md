# GitHub Actions Workflows

This directory contains YAML configuration files for GitHub Actions, used for Continuous Integration (CI) and potentially Continuous Deployment (CD) of the Permisos Digitales application.

## Main Workflow: `node-tests.yml`

This is the primary CI workflow for the project. It is typically triggered on:
*   Pushes to main branches (e.g., `main`, `develop`).
*   Pull requests targeting these main branches.

### Key Jobs

The `node-tests.yml` workflow generally consists of the following jobs:

1.  **Lint**:
    *   **Purpose**: Checks the codebase for linting errors and style inconsistencies.
    *   **Actions**:
        *   Runs ESLint on backend (JavaScript/Node.js) and frontend (TypeScript/React) code.
        *   May run Stylelint on CSS or SCSS files.

2.  **Test**:
    *   **Purpose**: Executes automated tests for both backend and frontend to ensure code correctness and prevent regressions.
    *   **Actions**:
        *   Sets up the Node.js environment.
        *   Installs dependencies for both backend (`npm install`) and frontend (`cd frontend && npm install`).
        *   **Service Containers**: Often starts service containers for dependencies like PostgreSQL and Redis, making them available to integration tests. Environment variables for these services are configured within the workflow.
        *   **Database Setup**: Runs database migrations (`npm run migrate:up` or similar) on the test PostgreSQL instance.
        *   **Backend Tests**: Executes backend tests using `npm test` or `npm run test:cov`.
        *   **Frontend Tests**: Executes frontend tests using `cd frontend && npm test` (or `npm run test:coverage`).
        *   **Code Coverage**: Generates code coverage reports. Results are often uploaded to [Codecov](https://codecov.io/) or a similar service, and a badge may be displayed in the main `README.md`.
        *   **Artifacts**: May upload test results or build artifacts for inspection.

3.  **Build (Optional but Recommended)**:
    *   **Purpose**: Verifies that the application (both frontend and backend, if applicable) can be successfully built for production.
    *   **Actions**:
        *   Frontend: `cd frontend && npm run build`.
        *   Backend: While Node.js doesn't always have a "build" step like compiled languages, this job might check for packaging scripts or other build-related tasks if they exist.

### Workflow Triggers and Concurrency

*   The workflow specifies `on: [push, pull_request]` triggers with branch filters.
*   Concurrency settings might be used to cancel outdated workflow runs on the same branch/PR.

### Environment Variables in CI

The workflow file (`node-tests.yml`) defines various environment variables required for the jobs, especially for the test environment. These include:
*   Database connection details for the PostgreSQL service container.
*   Redis connection details.
*   `NODE_ENV=test`.
*   Secrets (like `CODECOV_TOKEN`) are usually managed via GitHub repository secrets.

## Other Workflows

If other workflow files exist in this directory (e.g., for deployment, scheduled tasks via GitHub Actions), they should also be documented here, outlining their purpose, triggers, and key jobs.

For the exact and most up-to-date details of the CI pipeline, always refer to the content of the `.github/workflows/node-tests.yml` file itself.
