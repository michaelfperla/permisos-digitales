# Permisos Digitales - Frontend

This directory contains the frontend application for Permisos Digitales, a modern Single Page Application (SPA) built with React, TypeScript, and Vite.

For a comprehensive understanding of the overall project architecture, including how the frontend interacts with the backend, please see the [main System Documentation](../docs/PROJECT_DOCUMENTATION.md).

## Development

### Prerequisites

- Node.js (version compatible with Vite and project dependencies, e.g., >=16.0.0)
- npm (bundled with Node.js)

### Environment Configuration

- Create a `.env.local` file in this `frontend/` directory.
- Set the `VITE_API_URL` variable to point to your running backend API. Example:
  ```
  VITE_API_URL=http://localhost:3001
  ```

### Installation

1.  Navigate to this directory: `cd frontend`
2.  Install dependencies:
    ```bash
    npm install
    ```

### Running the Development Server

```bash
npm run dev
```

This command starts the Vite development server, typically available at `http://localhost:3000`. The server supports Hot Module Replacement (HMR) for a fast development experience.

## Building for Production

```bash
npm run build
```

This command compiles the TypeScript code, bundles the application using Vite, and outputs static assets to the `dist/` directory (configurable in `vite.config.ts`).

## Testing (Vitest)

```bash
npm test                # Run all tests (usually in watch mode by default)
npm run test:coverage   # Generate test coverage report
```

Tests are written using [Vitest](https://vitest.dev/) and [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/). Test files are typically located alongside the code they test (e.g., in `__tests__` subdirectories) or within `src/test/`.

## Linting

```bash
npm run lint
```

This project uses ESLint for code quality and style checking. Configuration can be found in `.eslintrc.json` or similar.

## Project Structure Overview

- **`public/`**: Static assets that are copied directly to the build output (e.g., `favicon.svg`, `service-worker.js`).
- **`src/`**: Contains all the React/TypeScript source code. See `src/README.md` for a detailed breakdown.
- **`vite.config.ts`**: Vite build and development server configuration.
- **`tsconfig.json`**: TypeScript compiler options.
- **`package.json`**: Project metadata, dependencies, and scripts.

For more details on the frontend architecture, see the [Frontend Documentation section in the main System Documentation](../docs/PROJECT_DOCUMENTATION.md#4-frontend-documentation).
