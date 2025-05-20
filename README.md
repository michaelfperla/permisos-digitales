# Permisos Digitales

A modern digital permit application and management system built with Node.js, Express, React, and TypeScript.

[![Node.js CI](https://github.com/michaelfperla/permisos-digitales/actions/workflows/node-tests.yml/badge.svg)](https://github.com/michaelfperla/permisos-digitales/actions/workflows/node-tests.yml)

## Project Overview

Permisos Digitales is a full-stack web application for managing digital vehicle permits. The system consists of:

- **Backend**: Node.js/Express REST API with PostgreSQL database
- **Frontend**: React/TypeScript SPA built with Vite

The application allows users to:
- Apply for vehicle permits
- Upload payment proofs
- Download and print permits
- Renew existing permits
- Manage their user profile

For contribution guidelines, see [CONTRIBUTING.md](docs/project/CONTRIBUTING.md).

### Development Ports

The application uses the following development ports:

- **3001**: Backend API server
- **3000**: Frontend development server (Vite)

### Quick Start

1. Install dependencies for both backend and frontend:

```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..
```

2. Set up the database:

```bash
# Create a .env file with your database configuration
# See .env.example for required variables

# Set up the database schema
npm run db:setup
```

3. Start the development servers:

```bash
# Start backend server
npm run dev

# In a separate terminal, start frontend server
cd frontend
npm run dev
```

The backend will run on http://localhost:3001 and the frontend on http://localhost:3000.

### Development Scripts

#### Backend Scripts
- `npm start`: Start the production server
- `npm run dev`: Start the backend development server with nodemon
- `npm run migrate`: Run database migrations using node-pg-migrate
- `npm run db:setup`: Set up the database schema
- `npm run db:backup`: Create a database backup
- `npm run db:restore`: Restore a database from backup
- `npm run db:monitor`: Monitor database performance
- `npm run db:verify`: Verify database connection
- `npm run db:migrate`: Run database migrations using custom migration tool
- `npm test`: Run backend tests
- `npm run test:unit`: Run backend unit tests
- `npm run test:integration`: Run backend integration tests
- `npm run test:cov`: Run backend tests with coverage
- `npm run lint:js`: Run ESLint on backend code
- `npm run lint:fix`: Run ESLint with auto-fix

#### Frontend Scripts (run from frontend directory)
- `npm run dev`: Start the Vite development server
- `npm run build`: Build the frontend for production
- `npm run preview`: Preview the production build locally
- `npm run test`: Run frontend tests
- `npm run test:watch`: Run frontend tests in watch mode
- `npm run test:coverage`: Run frontend tests with coverage
- `npm run lint`: Run ESLint on frontend code

## Project Structure

### Frontend (React/TypeScript)
- `frontend/`: React frontend application
  - `public/`: Static assets and HTML template
  - `src/`: Source code
    - `assets/`: Images, icons, and other static assets
    - `components/`: Reusable React components
    - `contexts/`: React context providers (Auth, Toast, etc.)
    - `hooks/`: Custom React hooks
    - `layouts/`: Layout components (MainLayout, AuthLayout)
    - `pages/`: Page components
    - `services/`: API service functions
    - `styles/`: CSS styles
    - `test/`: Test utilities
    - `types/`: TypeScript interfaces and types
    - `utils/`: Utility functions
  - `node_modules/`: Frontend dependencies

### Backend (Node.js/Express)
- `src/`: Backend code (Node.js Express)
  - `config/`: Application configuration
  - `constants/`: Constant values and enums
  - `controllers/`: Request handlers
  - `db/`: Database connection and migrations
  - `jobs/`: Scheduled jobs
  - `middleware/`: Express middleware
  - `repositories/`: Data access layer
  - `routes/`: API routes
  - `services/`: Business logic
  - `utils/`: Utility functions
  - `tests/`: Test setup and utilities

### Database
- `database/`: Database-related files and tools
  - `schema/`: Database schema files
    - `1_create_database.sql`: Creates the database and user
    - `2_create_schema.sql`: Creates tables, indexes, and triggers
    - `3_create_admin_user.sql`: Creates admin users
  - `migrations/`: Database migration files
  - `backups/`: Database backup files
  - `tools/`: Database management scripts
  - `config/`: Database configuration files

### Configuration and Tools
- `config/`: Application configuration files
  - `bs-config.js`: Browser-sync configuration
  - `pgm-config.js`: PostgreSQL migration configuration

### Storage
- `storage/`: File storage for uploads and generated files
  - `pdfs/`: Generated permit PDFs
  - `payment_proofs/`: Uploaded payment proof images
  - `logs/`: Application logs

### Documentation
- `docs/`: Project documentation
  - `backend/`: Backend architecture and API documentation
  - `project/`: Project guidelines and setup instructions

## API Documentation

API documentation is available at `/api-docs` when the server is running.

## Testing

This project uses Jest for backend testing and Vitest for frontend testing.

### Backend Testing

Backend tests use Jest and are organized into:

1. **Unit Tests**: Test individual functions and components in isolation
2. **Integration Tests**: Test the interaction between components, including API endpoints

```bash
# Run all backend tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run tests with coverage
npm run test:cov
```

### Frontend Testing

Frontend tests use Vitest and React Testing Library:

```bash
# Navigate to frontend directory
cd frontend

# Run all frontend tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Structure

- **Backend Tests**:
  - Unit tests are located alongside the code they test in `__tests__` directories
  - Integration tests for API routes are in `src/routes/__tests__` with `.integration.test.js` naming convention
  - Test utilities and mocks are in `src/tests`

- **Frontend Tests**:
  - Component tests are in `frontend/src/test` directory
  - Tests use React Testing Library for component testing
  - Tests use MSW (Mock Service Worker) for API mocking

### Coverage Thresholds

The project has the following code coverage thresholds:

- **Backend**:
  - Global: 75% for functions, lines, and statements; 70% for branches
  - Controllers: 80% for all metrics
  - Services: 80% for all metrics

- **Frontend**:
  - Components: 80% for all metrics
  - Services: 80% for all metrics

For more detailed testing information, see [TESTING.md](docs/project/TESTING.md).

## Continuous Integration

This project uses GitHub Actions for continuous integration. The CI pipeline runs on every push to the `main` and `develop` branches, as well as on pull requests to these branches.

The CI pipeline consists of three jobs:

1. **Lint**: Runs ESLint and Stylelint to check code quality
2. **Test**: Runs all tests with coverage and uploads results to Codecov
3. **Build**: Verifies that the application can be built

[![codecov](https://codecov.io/gh/michaelfperla/permisos-digitales/branch/main/graph/badge.svg)](https://codecov.io/gh/michaelfperla/permisos-digitales)

You can view the CI configuration in the `.github/workflows/node-tests.yml` file.

For more details on CI integration, see [CI.md](docs/project/CI.md).

## Pre-Deployment Security Checks

**⚠️ CRITICAL SECURITY WARNING ⚠️**

Before deploying to staging or production environments, a series of mandatory security checks must be completed. These checks are documented in detail in the [DEPLOYMENT_CHECKS.md](DEPLOYMENT_CHECKS.md) file.

### Key Security Checks:

1. **Session Secret Verification**: Ensure strong, unique session secrets are set in all environments
2. **Database Connection Security**: Verify proper database credentials and security settings
3. **Redis Configuration**: Confirm Redis is properly secured
4. **HTTPS/TLS Setup**: Verify SSL certificates and security headers
5. **API Rate Limiting**: Confirm rate limiting is properly configured

**WARNING:** Deployment to Production **MUST NOT** proceed unless all checks in [DEPLOYMENT_CHECKS.md](DEPLOYMENT_CHECKS.md) are completed and verified. Using default or weak secrets poses a critical security risk.

## Environment Variables

The application uses the following environment variables:

### Backend Environment Variables

- `NODE_ENV`: Environment mode (development, production, test)
- `PORT`: Backend server port (default: 3001)
- `APP_URL`: Main application URL (default: http://localhost:3001)
- `FRONTEND_URL`: Frontend development server URL (default: http://localhost:3000)
- `API_URL`: API base URL (default: http://localhost:3001/api)
- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Secret for session encryption **(CRITICAL: Must be a strong, unique random string of at least 32 characters)**
- `REDIS_HOST`: Redis host for session storage
- `REDIS_PORT`: Redis port
- `EMAIL_HOST`: SMTP server for sending emails
- `EMAIL_PORT`: SMTP port
- `EMAIL_USER`: SMTP username
- `EMAIL_PASS`: SMTP password

### Frontend Environment Variables

- `VITE_API_URL`: Backend API URL (default: http://localhost:3001/api)
- `VITE_APP_URL`: Backend app URL (default: http://localhost:3001)

Create a `.env` file in the root directory for backend variables and a `.env.local` file in the frontend directory for frontend variables.