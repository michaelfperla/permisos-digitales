# Repositories (`src/repositories/`)

Repositories form the Data Access Layer (DAL) of the application. They are responsible for all direct interactions with the PostgreSQL database, abstracting the underlying data storage and retrieval logic from the rest of the application (primarily services).

## Role

*   Provide a clear API for querying and manipulating data in the database.
*   Encapsulate SQL queries or ORM (Object-Relational Mapper) interactions if one were used (though this project appears to use raw SQL or a light query builder via the `pg` driver).
*   Map database results to application-specific data structures or objects.
*   Ensure that services are decoupled from the specific database implementation details.

## Key Repositories

*   **`user.repository.js`**: Handles database operations related to the `users` table (e.g., finding users by email or ID, creating new users, updating user information).
*   **`application.repository.js`**: Manages database operations for the `permit_applications` table (e.g., creating applications, querying applications by status or user, updating application details).
*   **`payment.repository.js`**: Interacts with payment-related tables (e.g., `payment_events`, `webhook_events`) to store and retrieve payment transaction information and statuses.
*   **`security.repository.js`**: Handles database operations for security-related data, such as storing password reset tokens or audit logs.
*   **`base.repository.js`**: May contain common database interaction logic or helper methods inherited or used by other repositories.

Repositories are primarily used by services to fetch and persist data. They should not contain business logic.
