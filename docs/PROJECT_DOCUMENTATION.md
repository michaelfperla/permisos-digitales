# Permisos Digitales - System Documentation

## Table of Contents
1.  [Project Overview](#1-project-overview)
    1.1. [Tech Stack](#11-tech-stack)
2.  [Setup and Development](#2-setup-and-development)
    2.1. [Prerequisites](#21-prerequisites)
    2.2. [Environment Configuration](#22-environment-configuration)
    2.3. [Installation](#23-installation)
    2.4. [Database Setup](#24-database-setup)
    2.5. [Running the Application](#25-running-the-application)
    2.6. [Available Scripts](#26-available-scripts)
    2.7. [Testing](#27-testing)
3.  [Backend Documentation](#3-backend-documentation)
    3.1. [Architecture](#31-architecture)
    3.2. [Core Functionalities](#32-core-functionalities)
    3.3. [Security Aspects](#33-security-aspects)
    3.4. [Database Interaction](#34-database-interaction)
    3.5. [API Documentation](#35-api-documentation)
    3.6. [Scheduled Jobs](#36-scheduled-jobs)
4.  [Frontend Documentation](#4-frontend-documentation)
    4.1. [Architecture](#41-architecture)
    4.2. [Core Functionalities](#42-core-functionalities)
    4.3. [State Management](#43-state-management)
    4.4. [Routing](#44-routing)
    4.5. [Service Worker](#45-service-worker)
5.  [Database Documentation](#5-database-documentation)
    5.1. [Schema Overview](#51-schema-overview)
    5.2. [Schema Migrations](#52-schema-migrations)

---

## 1. Project Overview

Permisos Digitales is a full-stack web application designed for the application, management, and issuance of digital vehicle permits. It aims to modernize and streamline the permit lifecycle for both applicants and administrative staff.

The system allows users to:
*   Register and manage their accounts.
*   Submit new applications for vehicle permits, providing necessary details and documentation.
*   Track the status of their applications.
*   Upload proof of payment for permit fees.
*   Download and print their digital permits once approved.
*   Renew existing permits.

Administrators have a separate portal to:
*   Manage user accounts.
*   Review and process permit applications.
*   Verify payments.
*   Oversee the overall system.

### 1.1. Tech Stack

The project is built using a modern technology stack:

*   **Backend**:
    *   Runtime: Node.js
    *   Framework: Express.js
    *   Language: JavaScript
    *   Database: PostgreSQL
    *   Primary Libraries: `pg` (PostgreSQL driver), `bcrypt` (hashing), `express-session` & `connect-pg-simple` (session management), `multer` (file uploads), `nodemailer` (email), `conekta` (payments), `helmet` (security), `winston` (logging).
*   **Frontend**:
    *   Framework: React
    *   Language: TypeScript
    *   Build Tool: Vite
    *   Primary Libraries: `axios` (HTTP client), `react-router-dom` (routing), `@tanstack/react-query` (server state), `vitest` & `@testing-library/react` (testing).
*   **DevOps & Tooling**:
    *   Version Control: Git, GitHub
    *   CI/CD: GitHub Actions
    *   Testing: Jest (backend), Vitest (frontend)
    *   Linting: ESLint, Stylelint
    *   Containerization (for development/testing dependencies): Docker (implied by GitHub Actions CI setup for services like PostgreSQL and Redis).

---

## 2. Setup and Development

This section provides a summary of how to set up and run the Permisos Digitales project for development. For detailed instructions, always refer to the primary `README.md` file in the root of the project, as well as `frontend/README.md` for frontend-specific setup.

### 2.1. Prerequisites

Ensure you have the following installed:
*   Node.js (version specified in `package.json` `engines` field, e.g., >=16.0.0)
*   npm (comes with Node.js)
*   PostgreSQL server
*   Optionally, Redis (if used for caching or features beyond session management, as `ioredis` is a dependency).

### 2.2. Environment Configuration

The application uses `.env` files for managing environment variables.
*   **Backend**: Create a `.env` file in the project root. Refer to `.env.example` for required variables such as database connection strings (`DATABASE_URL`), session secrets (`SESSION_SECRET`), email server details, and API keys for services like Conekta.
    *   **CRITICAL**: `SESSION_SECRET` must be a strong, unique random string.
*   **Frontend**: Create a `.env.local` file in the `frontend/` directory. Refer to `frontend/.env.example` if available, or configure `VITE_API_URL` to point to the backend API (e.g., `http://localhost:3001/api`).

### 2.3. Installation

1.  **Backend Dependencies**:
    ```bash
    npm install
    ```
2.  **Frontend Dependencies**:
    ```bash
    cd frontend
    npm install
    cd ..
    ```

### 2.4. Database Setup

1.  Ensure your PostgreSQL server is running and you have created the necessary database and user as per your `.env` configuration.
2.  Run the database setup script (this typically creates tables based on schema files and runs migrations):
    ```bash
    npm run db:setup
    ```
    Refer to `database/README.md` for more details on database tools and manual setup if needed.
3.  Apply migrations if they are not part of the setup script or if you need to update to the latest schema:
    ```bash
    npm run migrate:up # Using node-pg-migrate defined in package.json
    # or potentially custom scripts in database/tools/
    ```

### 2.5. Running the Application

*   **Backend Server**:
    ```bash
    npm run dev
    ```
    This typically starts the Node.js/Express server with `nodemon` for auto-reloading on port 3001 (by default).

*   **Frontend Development Server**:
    In a separate terminal:
    ```bash
    cd frontend
    npm run dev
    ```
    This starts the Vite development server, usually on port 3000 (by default).

The application should now be accessible, with the frontend at `http://localhost:3000` and the backend API at `http://localhost:3001`.

### 2.6. Available Scripts

The project contains numerous scripts defined in `package.json` (for backend) and `frontend/package.json` (for frontend). These cover tasks like:

*   Starting development and production servers.
*   Running tests (unit, integration, coverage).
*   Linting code.
*   Building the application for production.
*   Database operations (backup, restore, migrations).

Key scripts are detailed in the main `README.md`. Always refer to it for the most current list and usage.

### 2.7. Testing

*   **Backend (Jest)**:
    ```bash
    npm test # Run all backend tests
    npm run test:unit
    npm run test:integration
    npm run test:cov # For coverage
    ```
    Refer to `src/tests/README.md` for more on backend testing strategy.

*   **Frontend (Vitest)**:
    ```bash
    cd frontend
    npm test # Run all frontend tests
    npm run test:watch
    npm run test:coverage
    cd ..
    ```
---

## 3. Backend Documentation

The backend of Permisos Digitales is a robust Node.js application built with the Express.js framework. It serves as the API layer, handling business logic, data processing, and communication with the database.

### 3.1. Architecture

The backend follows a modular structure, primarily located within the `src/` directory:

*   **`src/server.js`**: The main entry point of the application, responsible for initializing Express, configuring middleware, setting up routes, and starting the server.
*   **`src/config/`**: Contains application configuration, including settings for database connections, payment gateways (Conekta), and environment-specific variables.
*   **`src/constants/`**: Defines constant values used throughout the backend.
*   **`src/controllers/`**: Houses controller functions that handle incoming HTTP requests, process input, and interact with services to generate responses. Key controllers include those for applications, authentication, users, payments, and admin operations.
*   **`src/db/`**: Manages database connectivity (using `pg` for PostgreSQL) and schema migrations (using `node-pg-migrate`). It includes the database pool setup and transaction utilities.
*   **`src/jobs/`**: Contains scheduled tasks (e.g., using `node-cron`) such as periodic data verification or cleanup processes.
*   **`src/middleware/`**: A collection of Express middleware functions used for various purposes, including:
    *   Authentication and authorization.
    *   CSRF protection (`@dr.pogodin/csurf`).
    *   Error handling.
    *   Request logging and correlation ID (`express-http-context`, `winston`).
    *   Input validation (`express-validator`).
    *   Rate limiting (`express-rate-limit`).
    *   Security headers (`helmet`).
    *   CORS handling.
*   **`src/repositories/`**: Implements the data access layer (DAL). Repositories are responsible for direct database interactions, abstracting SQL queries and providing a clean interface for services to fetch and persist data. Examples include `ApplicationRepository`, `UserRepository`, and `PaymentRepository`.
*   **`src/routes/`**: Defines the API endpoints. Routes connect HTTP methods and URL paths to specific controller functions. The main router is typically aggregated in `src/routes/index.js` and mounted in `server.js` under the `/api` prefix.
*   **`src/services/`**: Contains the core business logic of the application. Services orchestrate operations, calling repository methods for data access and implementing complex workflows. Key services include those for managing applications, user authentication, email notifications (`nodemailer`), PDF generation, and payment processing.
    *   **`src/services/storage/`**: Implements an abstraction layer for file storage, with providers for local file system and AWS S3. This is used for storing generated PDFs and uploaded payment proofs.
*   **`src/utils/`**: A suite of utility functions for common tasks such as formatting API responses, handling errors, password hashing (`bcrypt`), and setting up Swagger API documentation.
*   **`src/views/`**: Contains EJS templates, likely used for generating HTML content for emails or PDF documents (e.g., OXXO payment receipts).

Key dependencies include:
*   `express`: Web framework.
*   `pg`: PostgreSQL client.
*   `node-pg-migrate`: For database migrations.
*   `bcrypt`: For password hashing.
*   `express-session` and `connect-pg-simple`: For session management backed by PostgreSQL.
*   `multer`: For handling file uploads (e.g., payment proofs).
*   `nodemailer`: For sending emails.
*   `conekta`: For payment processing.
*   `winston`: For logging.
*   `helmet`: For securing HTTP headers.
*   `swagger-jsdoc` and `swagger-ui-express`: For API documentation.

### 3.2. Core Functionalities

The backend provides APIs for:
*   User registration, login, password management, and profile updates.
*   Creating, retrieving, updating, and managing permit applications.
*   Handling payment submissions and verification (including OXXO payments via Conekta).
*   Uploading files (e.g., payment proofs) associated with applications.
*   Generating PDF documents for permits.
*   Administrative functions: user management, application review and approval, system monitoring.

### 3.3. Security Aspects

Security is a key consideration, addressed through:
*   **Authentication**: User credentials are encrypted using `bcrypt`. Sessions are managed using `express-session` with PostgreSQL as the session store.
*   **Authorization**: Role-based access control is implemented to differentiate between regular users and administrators, restricting access to certain APIs.
*   **CSRF Protection**: The `@dr.pogodin/csurf` middleware is used to protect against Cross-Site Request Forgery attacks on state-changing requests. CSRF tokens are generated and validated.
*   **Security Headers**: `helmet` middleware is used to set various HTTP headers that protect against common web vulnerabilities (XSS, clickjacking, etc.).
*   **Rate Limiting**: `express-rate-limit` is configured to prevent abuse by limiting the number of requests from an IP address to certain endpoints.
*   **Input Validation**: `express-validator` is used to sanitize and validate incoming data in request bodies, query parameters, and headers.
*   **Secure Session Cookies**: Session cookies are configured with `httpOnly`, `secure` (in production), and `sameSite` attributes.

### 3.4. Database Interaction

*   The `src/repositories/` directory abstracts all database operations. Services call methods in repositories to interact with the database, keeping SQL queries and direct DB manipulation out of the business logic layer.
*   Database schema changes are managed through migration files located in `src/db/migrations/`. These migrations are run using the `node-pg-migrate` tool.

### 3.5. API Documentation

The backend API is documented using Swagger/OpenAPI. The documentation can be accessed at the `/api-docs` endpoint when the server is running. This UI provides detailed information about available endpoints, request parameters, and response structures.

### 3.6. Scheduled Jobs

The system utilizes `node-cron` (configured in `src/jobs/scheduler.js`) to run tasks at predefined intervals. These jobs might include:
*   Periodic verification of application statuses.
*   Data cleanup or archival.
*   Sending scheduled notifications.
Specific job details can be found in `src/jobs/`.

---

## 4. Frontend Documentation

The frontend of Permisos Digitales is a modern Single Page Application (SPA) built with React and TypeScript, using Vite as the build tool. It provides the user interface for interacting with the digital permit system.

### 4.1. Architecture

The frontend codebase is located in the `frontend/` directory. Its structure, primarily within `frontend/src/`, is organized as follows:

*   **`frontend/src/main.tsx`**: The entry point for the React application. It sets up the root component, providers (for routing, state management, etc.), and global styles.
*   **`frontend/src/App.tsx`**: The main root component that typically defines the overall layout structure and includes the primary router configuration.
*   **`frontend/src/admin/`**: This directory contains a *separate React SPA* dedicated to the admin portal. It has its own `main.tsx`, `App.tsx`, components, pages, services, and contexts, effectively creating a distinct application bundle for administrative functions. This ensures a clear separation between user-facing and admin-facing concerns.
*   **`frontend/src/components/`**: Contains reusable React components categorized by functionality or feature area:
    *   `auth/`: Components related to authentication (login, registration forms).
    *   `dashboard/`: Components for the user dashboard.
    *   `forms/`: Components for form handling, including multi-step wizards.
    *   `layout/`: Structural components like headers, footers, and sidebars.
    *   `navigation/`: Breadcrumbs, navigation menus.
    *   `payment/`: Components for payment forms and displaying payment information.
    *   `permit/`: Components related to permit display, status, and renewal.
    *   `permit-form/`: Components specifically for the multi-step permit application form.
    *   `ui/`: A library of generic, reusable UI elements like buttons, modals, cards, tables, alerts, and loading spinners.
*   **`frontend/src/constants/`**: Defines frontend-specific constant values.
*   **`frontend/src/contexts/`**: Provides React Context API implementations for managing global state, such as:
    *   `AuthContext.tsx`: Manages authentication state (user data, login/logout status).
    *   `ToastContext.tsx`: Manages system-wide toast notifications.
*   **`frontend/src/hooks/`**: Contains custom React hooks to encapsulate reusable logic and stateful behavior (e.g., `useAuth` for accessing auth context, `useBreadcrumbs`, `useMediaQuery` for responsive design, `usePermitFormValidation`).
*   **`frontend/src/layouts/`**: Defines different page layouts used across the application (e.g., `AuthLayout` for login/register pages, `MainLayout` for the main application interface, `UserLayout` for user-specific sections).
*   **`frontend/src/pages/`**: Contains top-level components that represent different views or pages of the application (e.g., `HomePage.tsx`, `LoginPage.tsx`, `PermitDetailsPage.tsx`, `ProfilePage.tsx`).
*   **`frontend/src/services/`**: Handles API communication with the backend. It typically includes:
    *   `api.ts`: A base Axios instance or utility for making HTTP requests, configured with base URL and potentially interceptors for auth tokens or error handling.
    *   Service-specific files (e.g., `applicationService.ts`, `authService.ts`, `userService.ts`, `paymentService.ts`) that group related API calls.
*   **`frontend/src/styles/`**: Includes global CSS styles (`global.css`), CSS variables, reset styles, and utility classes. CSS Modules are also used for component-level styling (evident from `*.module.css` files).
*   **`frontend/src/test/`**: Contains test setup (`setup.ts`), utilities (`test-utils.tsx`), and mocks for frontend testing with Vitest and React Testing Library.
*   **`frontend/src/types/`**: Stores TypeScript interface and type definitions for data structures used in the frontend.
*   **`frontend/src/utils/`**: Provides utility functions for various tasks like CSRF token handling, date formatting, input validation, and breadcrumb configuration.

Key dependencies include:
*   `react` & `react-dom`: Core React library.
*   `typescript`: For static typing.
*   `vite`: Build tool and development server.
*   `axios`: For making HTTP requests to the backend API.
*   `react-router-dom`: For client-side routing.
*   `@tanstack/react-query`: For managing server state (data fetching, caching, synchronization).
*   `react-icons`: For icon usage.
*   `vitest` & `@testing-library/react`: For unit and component testing.

### 4.2. Core Functionalities

**User-Facing Application:**
*   User registration, login, and password recovery.
*   A comprehensive multi-step form for applying for new vehicle permits.
*   Viewing details of existing permits, including status and history.
*   Functionality to renew eligible permits.
*   Uploading payment proofs.
*   Downloading/printing generated permit PDFs.
*   Managing user profiles and settings.

**Admin Portal (`frontend/src/admin/`):**
*   Separate login for administrators.
*   Dashboard for viewing system statistics and pending tasks.
*   Managing user accounts (viewing, activating/deactivating).
*   Reviewing submitted permit applications.
*   Verifying payment proofs.
*   Viewing application details and history.

### 4.3. State Management

The frontend employs a combination of state management strategies:
*   **`@tanstack/react-query` (React Query)**: Used for managing server state. This includes fetching data from the backend, caching it, handling loading and error states, and synchronizing data with the server (e.g., after mutations).
*   **React Context API**: Used for managing global UI state or shared application state that doesn't come directly from the server. Examples include:
    *   `AuthContext`: Stores user authentication status and user information.
    *   `ToastContext`: Manages the display of toast notifications across the application.
*   **Local Component State**: Standard React `useState` and `useReducer` hooks are used for managing component-specific local state.

### 4.4. Routing

Client-side routing is handled by `react-router-dom`. Routes are defined to map URL paths to specific page components, enabling navigation within the SPA without full page reloads. Separate routing configurations exist for the main user application and the admin portal.

### 4.5. Service Worker

In production mode, a service worker (`public/service-worker.js`) is registered. This enables Progressive Web App (PWA) features such as:
*   Offline capabilities (e.g., serving cached assets when the network is unavailable).
*   Improved performance through caching strategies.

---

## 5. Database Documentation

The Permisos Digitales application uses a PostgreSQL database to store all its data. The database schema is designed to support user management, permit applications, payments, and system auditing.

### 5.1. Schema Overview

While the exact schema details are defined in SQL files and migrations, the key tables and their general purpose include:

*   **`users`**: Stores information about registered users, including their credentials (hashed passwords), contact details, roles (e.g., 'client', 'admin'), and status (e.g., `is_active`, `is_verified`).
*   **`permit_applications`**: Contains all data related to permit applications submitted by users. This likely includes vehicle information, applicant details, permit type, status of the application (e.g., pending, approved, rejected), timestamps, and references to related documents like payment proofs or generated permits. It may also include fields like `desired_start_date`.
*   **`payment_events`** (or similar, based on `1746252561843_add-payment-events-table.js`): Logs events related to payments, possibly including transaction IDs from Conekta, payment status updates, amounts, and timestamps. This table would be crucial for tracking the payment lifecycle.
*   **`webhook_events`** (based on `20230815_create_webhook_events_table.sql`): Likely stores incoming webhook notifications, for example, from payment gateways like Conekta, to ensure reliable processing of asynchronous events.
*   **`password_reset_tokens`**: Stores tokens generated for the password reset process, linking them to users and tracking their expiry.
*   **`user_sessions`**: Used by `connect-pg-simple` to store active user session data, enabling persistent logins across server restarts.
*   **`payment_states`** (based on `20230815_add_payment_states_table.sql`): This might be a lookup table for different payment states or part of the payment tracking logic. (The main README also mentioned `payment_verification_log`).
*   **`security_audit_log`**: As mentioned in `database/README.md`, this table logs security-relevant events for auditing purposes (e.g., important changes, failed login attempts if configured).
*   **File Paths**: Columns like `placas_file_path` (mentioned in migrations `add_placas_file_path.sql` and `1746418800000_add-placas-file-path.js`) indicate that paths to stored files (e.g., uploaded vehicle registration documents or generated permits) are stored in relevant tables, linking records to files managed by the storage service.

The relationships between these tables would typically involve foreign keys linking applications to users, payments to applications, etc.

### 5.2. Schema Migrations

Database schema changes are managed through a migration system. The project uses `node-pg-migrate` for this purpose.
*   Migration files are located in `src/db/migrations/` (primarily for `node-pg-migrate` format) and potentially older ones in `database/migrations/` (some appear to be raw SQL).
*   These migrations are JavaScript or SQL files that define `up` (apply changes) and `down` (revert changes) operations.
*   Scripts like `npm run migrate` (or `npm run migrate:up`, `npm run migrate:down`) are used to apply or roll back migrations, ensuring that the database schema evolves consistently across different environments.
*   The `database/tools/` directory also contains scripts for running migrations, potentially offering more granular control or handling for the raw SQL migration files.

The `database/schema/` directory contains initial setup SQL scripts:
*   `1_create_database.sql`: For creating the database itself and the primary user.
*   `2_create_schema.sql`: For defining the initial set of tables, indexes, and other database objects.
*   `3_create_admin_user.sql`: For pre-populating admin users.
These are typically used for bootstrapping a new development or test environment.
