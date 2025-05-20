# Project Scripts

This directory contains utility and helper scripts for the Permisos Digitales project.

## Available Scripts

*   **`create-admin-user.js`**:
    *   **Purpose**: A Node.js script to interactively create a new administrative user in the database.
    *   **Usage**:
        ```bash
        node scripts/create-admin-user.js
        ```
    *   It will prompt for the new admin user's email, password, first name, and last name.
    *   **Dependencies**: This script might require certain Node.js packages to be installed (e.g., `bcrypt` for password hashing, `pg` for database interaction, `readline` for prompts). If running it standalone outside of the main application's `npm install` context, you might need to install these. Refer to the script's content for its specific dependencies.
    *   **Note**: This script is an alternative to using pre-defined admin credentials (if any are set up by database seeds) or managing users through an admin interface.

*   **(Other scripts, if any)**:
    *   If other `.js` or shell scripts are present in this directory, they should be documented here with their purpose and usage instructions.

## General Notes

*   Ensure that any script interacting with the database has access to the necessary database connection details, typically through environment variables (as configured in your `.env` file for the main application).
*   Review script dependencies if running them in an environment where `node_modules` from the root project are not directly accessible.
