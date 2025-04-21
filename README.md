# Permisos Digitales

A modern permit application and management system.

[![Node.js CI](https://github.com/michaelfperla/permisos-digitales/actions/workflows/node-tests.yml/badge.svg)](https://github.com/michaelfperla/permisos-digitales/actions/workflows/node-tests.yml)

## Development Setup

This application uses a vanilla frontend (HTML, CSS, JS) with a Node.js Express backend.

### Port Configuration

The application uses the following ports:

- **3001**: Backend API server
- **3000**: Frontend development server (browser-sync)
- **3002**: Browser-sync UI (for development only)

### Quick Start

1. Install dependencies:

```bash
npm install
```

2. Set up the database:

```bash
npm run db:setup
```

3. Start the development servers:

```bash
npm run dev:all
```

This will start both the backend API server and the frontend development server concurrently.

### Development Scripts

- `npm start`: Start the production server
- `npm run dev`: Start the backend development server with nodemon
- `npm run dev:frontend`: Start the frontend development server with browser-sync
- `npm run dev:all`: Start both backend and frontend development servers
- `npm run migrate`: Run database migrations
- `npm run db:setup`: Set up the database schema
- `npm test`: Run all tests
- `npm run lint`: Run ESLint and Stylelint
- `npm run lint:fix`: Run ESLint with auto-fix

## Project Structure

- `frontend/`: Frontend code (HTML, CSS, JS)
  - `assets/`: Static assets (images, icons)
  - `src/`: Source code
    - `css/`: CSS stylesheets
    - `js/`: JavaScript modules
      - `components/`: UI components
      - `utils/`: Utility functions
  - `views/`: HTML templates

- `src/`: Backend code (Node.js Express)
  - `config/`: Application configuration
  - `controllers/`: Request handlers
  - `db/`: Database connection and migrations
  - `middleware/`: Express middleware
  - `repositories/`: Data access layer
  - `routes/`: API routes
  - `services/`: Business logic
  - `utils/`: Utility functions

## API Documentation

API documentation is available at `/api-docs` when the server is running.

## Continuous Integration

This project uses GitHub Actions for continuous integration. The CI pipeline runs on every push to the `main` and `develop` branches, as well as on pull requests to these branches.

The CI pipeline consists of three jobs:

1. **Lint**: Runs ESLint and Stylelint to check code quality
2. **Test**: Runs unit tests and integration tests with Redis support
3. **Build**: Verifies that the application can be built

You can view the CI configuration in the `.github/workflows/node-tests.yml` file.

## Environment Variables

The application uses the following environment variables:

- `NODE_ENV`: Environment mode (development, production, test)
- `PORT`: Backend server port (default: 3001)
- `APP_URL`: Main application URL (default: http://localhost:3001)
- `FRONTEND_URL`: Frontend development server URL (default: http://localhost:3000)
- `API_URL`: API base URL (default: http://localhost:3001/api)
- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Secret for session encryption

See the `.env` file for additional configuration options.