# Middleware (`src/middleware/`)

This directory contains custom Express middleware used in the Permisos Digitales backend. Middleware functions have access to the request object (req), the response object (res), and the next middleware function in the application’s request-response cycle.

## Role

Middleware functions are used for a variety of purposes, including:

*   **Authentication & Authorization**: Verifying user identity (e.g., checking session tokens) and ensuring users have the necessary permissions to access certain routes (e.g., `auth.middleware.js`).
*   **CSRF Protection**: Implementing measures to prevent Cross-Site Request Forgery attacks (e.g., `csrf.middleware.js`).
*   **Error Handling**: Catching errors from route handlers and sending standardized error responses (e.g., `error-handler.middleware.js`).
*   **Input Validation**: Validating incoming request data (e.g., body, query parameters) before it reaches controller actions (e.g., `validation.middleware.js`, often used with `express-validator`).
*   **Logging**: Recording information about incoming requests or system events (e.g., `audit.middleware.js`, or parts of `enhanced-logger.js` used as middleware).
*   **Rate Limiting**: Limiting the number of requests a client can make to certain endpoints to prevent abuse (e.g., `rate-limit.middleware.js`).
*   **Security Headers**: Setting various HTTP headers to improve application security (though `helmet` is often applied globally in `server.js`, specific middleware could augment this).
*   **CORS**: Handling Cross-Origin Resource Sharing headers (e.g., `cors.middleware.js`).
*   **Request ID & Context**: Attaching unique IDs to requests for tracking and setting up request-specific context (e.g., `request-id.middleware.js`, `express-http-context`).
*   **File Uploads**: Handling `multipart/form-data` for file uploads, often using `multer` (configuration might be wrapped in a custom middleware).

## Key Middleware (Examples)

Based on the file listing and `server.js` setup:

*   **`auth.middleware.js`**: Likely contains logic for `ensureAuthenticated` (checking if a user is logged in) and `ensureAdmin` (checking for admin privileges).
*   **`csrf.middleware.js`**: Configures and manages CSRF token generation and validation.
*   **`error-handler.middleware.js`**: The global error handler for the application.
*   **`rate-limit.middleware.js`**: Defines various rate limiting rules for different parts of the API.
*   **`validation.middleware.js`**: Probably includes helper functions to use `express-validator` results.
*   **`audit.middleware.js`**: For logging specific actions or events for security auditing.
*   **`cors.middleware.js`**: Manages CORS headers.
*   **`request-id.middleware.js`**: Adds a unique ID to each request.

Refer to the individual files in this directory for specific implementation details.
