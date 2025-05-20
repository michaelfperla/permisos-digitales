# Tool Configuration Files

This directory stores configuration files for development tools and utilities used in the Permisos Digitales project.

## Files

*   **`bs-config.js`**: Configuration file for [BrowserSync](https://browsersync.io/). BrowserSync is used via the `npm run dev:frontend` script (though this script might be outdated if Vite is handling live reload for the frontend directly). It can be useful for synchronized browser testing or specific proxying needs during development.
*   **`pgm-config.js`**: Configuration file for `node-pg-migrate`, the tool used for managing PostgreSQL database migrations. This file typically specifies database connection details for migrations, the directory where migration files are stored (`src/db/migrations/`), and other migration settings. It's used by scripts like `npm run migrate`.

## Usage

These configuration files are generally invoked by scripts defined in `package.json`. For example:

*   The `migrate` scripts (`npm run migrate`, `npm run migrate:up`, etc.) use the settings in `pgm-config.js` to connect to the database and apply schema changes.
*   If BrowserSync is actively used, scripts like `npm run dev:frontend` (or similar) would reference `config/bs-config.js`.

**Note**: Application-specific runtime configuration (e.g., API keys, database URLs for the running application) is managed via environment variables and the `.env` file, as detailed in the main project `README.md`. The backend also has its own `src/config/` directory for application-level configuration code.
