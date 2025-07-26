# Services (`src/services/`)

The services layer contains the core business logic of the Permisos Digitales backend. Services are responsible for orchestrating operations, processing data, and interacting with repositories for data persistence.

## Role

*   Encapsulate complex business rules and workflows.
*   Mediate between controllers and repositories.
*   Perform data validation and transformation not covered by basic input validation.
*   Interact with external services (e.g., email providers, payment gateways) via helper modules or dedicated service clients.
*   Ensure data integrity and consistency.

## Key Services

*   **`auth.service.js`** (or `auth-security.service.js`): Handles user registration logic, password hashing and comparison, session management logic, and security token generation/validation.
*   **`user.service.js`**: Manages user profile data updates and retrieval.
*   **`application.service.js`**: Contains logic for creating, processing, and managing permit applications, including status transitions and business rule enforcement.
*   **`stripe-payment.service.js`**: Implements payment processing workflows, interacts with the Stripe payment gateway, verifies payment statuses, and updates application records accordingly.
*   **`email.service.js`**: Responsible for sending emails (e.g., account verification, password reset, notifications) using `nodemailer`.
*   **`pdf-service.js`**: Generates PDF documents, such as digital permits, potentially using libraries like Puppeteer.
*   **`storage.service.js`** (and `storage/pdf-storage-service.js`): Manages file uploads and storage, providing an abstraction over storage providers (e.g., local disk, S3). This is used for payment proofs and generated PDFs.
*   **`password-reset.service.js`**: Handles the logic for generating and validating password reset tokens.
*   **`notification.service.js`**: Manages the creation and potential sending of notifications within the system or to users.
*   **`security.service.js`**: May handle specific security-related tasks like audit logging or fraud detection logic.

Services are designed to be reusable and are typically injected or imported into controllers.
