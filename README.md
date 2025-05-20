# Permisos Digitales

Permisos Digitales is a comprehensive web application designed to modernize the process of applying for and managing digital vehicle permits. It provides a user-friendly platform for applicants and a robust management interface for administrators.

[![Node.js CI](https://github.com/michaelfperla/permisos-digitales/actions/workflows/node-tests.yml/badge.svg)](https://github.com/michaelfperla/permisos-digitales/actions/workflows/node-tests.yml)
[![codecov](https://codecov.io/gh/michaelfperla/permisos-digitales/branch/main/graph/badge.svg)](https://codecov.io/gh/michaelfperla/permisos-digitales)

For detailed system architecture, component breakdown, and in-depth explanations, please see the [Comprehensive System Documentation](docs/PROJECT_DOCUMENTATION.md).

## Key Features

**User Portal:**
*   User Registration and Authentication
*   New Digital Permit Applications
*   Permit Status Tracking
*   Payment Proof Upload
*   Permit PDF Download
*   Permit Renewal

**Admin Portal:**
*   Secure Admin Login
*   User Management
*   Application Review and Processing
*   Payment Verification
*   System Overview and Dashboards

## Tech Stack

*   **Backend**: Node.js, Express.js, PostgreSQL, JavaScript
    *   Key Libraries: `pg`, `bcrypt`, `express-session`, `multer`, `nodemailer`, `conekta`, `helmet`
*   **Frontend**: React, TypeScript, Vite
    *   Key Libraries: `axios`, `react-router-dom`, `@tanstack/react-query`
*   **Testing**: Jest (Backend), Vitest (Frontend)
*   **CI/CD**: GitHub Actions

## Prerequisites

Before you begin, ensure you have the following installed:
*   Node.js (Recommended: Version specified in `package.json` engines, e.g., >=16.0.0)
*   npm (Bundled with Node.js)
*   PostgreSQL Server
*   Git

## Development Setup

### 1. Clone the Repository
```bash
git clone https://github.com/michaelfperla/permisos-digitales.git
cd permisos-digitales
```

### 2. Environment Configuration

This project uses `.env` files for environment variables.

*   **Backend (`.env`)**:
    *   Copy `.env.example` to a new file named `.env` in the project root: `cp .env.example .env`
    *   Update the `.env` file with your local settings:
        *   `DATABASE_URL`: Your PostgreSQL connection string (e.g., `postgresql://user:password@localhost:5432/permisos_digitales_dev`)
        *   `SESSION_SECRET`: A strong, unique random string for session encryption. **Generate a new one.**
        *   `FRONTEND_URL`: (e.g., `http://localhost:3000`)
        *   `API_URL`: (e.g., `http://localhost:3001/api`)
        *   Email server details (`EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`) if email sending is required for local development.
        *   Conekta API keys if testing payment functionalities.
*   **Frontend (`frontend/.env.local`)**:
    *   Navigate to the `frontend` directory: `cd frontend`
    *   Create a `.env.local` file (e.g., `cp .env.example .env.local` if an example exists, otherwise create it).
    *   Set the following variable:
        *   `VITE_API_URL=http://localhost:3001/api` (or your backend API URL)
    *   Return to the root directory: `cd ..`

### 3. Install Dependencies

*   **Backend**:
    ```bash
    npm install
    ```
*   **Frontend**:
    ```bash
    cd frontend
    npm install
    cd ..
    ```

### 4. Database Setup

1.  Ensure your PostgreSQL server is running.
2.  Create your development database (e.g., `permisos_digitales_dev`) and a dedicated user with appropriate permissions, matching your `DATABASE_URL` configuration.
3.  Run the database setup script. This script typically creates the schema and runs initial migrations.
    ```bash
    npm run db:setup
    ```
    For more detailed information on database tools and manual migration execution, refer to `database/README.md`.

## Running the Application

The application consists of a backend server and a frontend development server, which should be run in separate terminals.

1.  **Start the Backend Server**:
    ```bash
    npm run dev
    ```
    The backend API will typically run on `http://localhost:3001`.

2.  **Start the Frontend Development Server**:
    ```bash
    cd frontend
    npm run dev
    ```
    The frontend application will typically be accessible at `http://localhost:3000`.

## Testing

*   **Backend (Jest)**:
    ```bash
    npm test                # Run all backend tests
    npm run test:unit       # Run unit tests
    npm run test:integration # Run integration tests
    npm run test:cov        # Generate coverage report
    ```
    For more details, see `src/tests/README.md`.

*   **Frontend (Vitest)**:
    ```bash
    cd frontend
    npm test                # Run all frontend tests (usually in watch mode by default with Vitest)
    npm run test:coverage   # Generate coverage report
    cd ..
    ```
    For more details, see `frontend/README.md`.

## Repository Structure

A brief overview of the main directories:

*   `.github/`: GitHub Actions workflows and templates.
*   `config/`: Application-level configuration files (e.g. for BrowserSync, some migration settings). See `config/README.md`.
*   `database/`: Database schema, migration files, and utility scripts. See `database/README.md`.
*   `docs/`: Project documentation, including the [Comprehensive System Documentation](docs/PROJECT_DOCUMENTATION.md).
*   `frontend/`: React/TypeScript frontend application. See `frontend/README.md`.
    *   `frontend/src/`: Source code for the frontend SPA. See `frontend/src/README.md`.
*   `scripts/`: Miscellaneous helper scripts. See `scripts/README.md`.
*   `src/`: Node.js/Express backend source code. See `src/README.md`.
    *   `src/controllers/`: Request handlers. See `src/controllers/README.md`.
    *   `src/services/`: Business logic. See `src/services/README.md`.
    *   `src/repositories/`: Data access layer. See `src/repositories/README.md`.
    *   `src/middleware/`: Express middleware. See `src/middleware/README.md`.
    *   `src/db/`: Database connection and new migrations.
    *   `src/tests/`: Backend tests. See `src/tests/README.md`.

## Contributing

Please refer to `CONTRIBUTING.md` for contribution guidelines (Note: Create or verify `CONTRIBUTING.md` file).

## License

This project is licensed under the MIT License. See the `LICENSE` file for details (Note: Verify `LICENSE` file exists).