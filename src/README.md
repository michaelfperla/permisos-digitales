# Backend Source (`src/`)

This directory contains the source code for the Node.js/Express.js backend of the Permisos Digitales application.

## Overview

The backend is responsible for:
*   Providing a RESTful API for the frontend application.
*   Handling business logic and data processing.
*   Interacting with the PostgreSQL database.
*   Managing user authentication and authorization.
*   Serving generated documents (like PDFs).
*   Executing scheduled tasks.

For a comprehensive understanding of the backend architecture, components, and functionalities, please refer to the [Backend Documentation section in the main System Documentation](../docs/PROJECT_DOCUMENTATION.md#3-backend-documentation).

## Key Subdirectories

*   **`config/`**: Application configuration files (e.g., payment gateways, environment settings).
*   **`constants/`**: Defines global constants and enumerated values.
*   **`controllers/`**: Request handlers that interface between HTTP requests and backend services. See `controllers/README.md`.
*   **`db/`**: Database connection setup, `node-pg-migrate` migration files, and transaction utilities.
*   **`jobs/`**: Scheduled tasks and cron job definitions (e.g., using `node-cron`).
*   **`middleware/`**: Custom Express middleware for concerns like authentication, CSRF protection, error handling, logging, and input validation. See `middleware/README.md`.
*   **`repositories/`**: Data Access Layer (DAL) responsible for direct database interactions. See `repositories/README.md`.
*   **`routes/`**: API route definitions, mapping URL paths to controller actions.
*   **`services/`**: Core business logic layer, orchestrating operations and data transformations. See `services/README.md`.
*   **`tests/`**: Backend automated tests (unit, integration) using Jest. See `tests/README.md`.
*   **`utils/`**: Utility functions and helper modules used across the backend.
*   **`views/`**: EJS templates, primarily used for generating HTML content for emails or PDF documents.

## Main Entry Point
*   **`server.js`**: Initializes the Express application, configures middleware, mounts routes, and starts the HTTP server.
