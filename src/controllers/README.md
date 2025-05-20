# Controllers (`src/controllers/`)

Controllers are responsible for handling incoming HTTP requests from the client, validating input (often with the help of validation middleware), interacting with services to perform business logic, and sending appropriate HTTP responses.

## Role

*   Act as the entry point for API requests after routing.
*   Parse request parameters, body, and headers.
*   Invoke appropriate service methods to handle the request.
*   Format data returned by services into HTTP responses (e.g., JSON).
*   Handle HTTP status codes and error responses.

## Key Controllers

*   **`auth.controller.js`**: Manages user authentication (login, registration, logout, password reset requests, CSRF token generation).
*   **`user.controller.js`**: Handles user profile management (viewing, updating profile information, changing password).
*   **`application.controller.js`**: Manages permit applications (creation, retrieval, updates, status changes).
*   **`payment.controller.js`**: Processes payment-related requests, interacts with payment gateways (e.g., Conekta), and handles payment callbacks/webhooks.
*   **`oxxo-payment.controller.js`**: Specifically handles OXXO payment processes.
*   **`admin.controller.js`** & **`admin/user.controller.js`**: Handle requests for the admin portal, such as user management by administrators and application review functionalities.
*   **`notification.controller.js`**: May handle notification-related actions or webhook events for notifications.

For more details on specific controller logic, refer to the source files within this directory and the API documentation available at `/api-docs` when the server is running.
