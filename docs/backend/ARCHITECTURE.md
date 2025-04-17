# Permisos Digitales: Backend Architecture Documentation

## Overview

The Permisos Digitales backend is a Node.js application built with Express.js following a structured architecture that emphasizes security, maintainability, and scalability. This document provides comprehensive documentation of the system's components and how they interact.

## Table of Contents

1. [Architectural Pattern](#architectural-pattern)
2. [Core Components](#core-components)
   - [Server Configuration](#1-server-configuration-srcserverjs)
   - [Configuration Management](#2-configuration-management-srcconfigindexjs)
   - [Database Layer](#3-database-layer)
   - [Repository Layer](#4-repository-layer)
   - [Service Layer](#5-service-layer)
   - [Controller Layer](#6-controller-layer)
   - [Middleware](#7-middleware)
   - [Routes](#8-routes)
   - [Utilities](#9-utilities)
   - [Scheduled Jobs](#10-scheduled-jobs)
3. [Authentication Flow](#authentication-flow)
4. [Permit Application Flow](#permit-application-flow)
5. [Error Handling Strategy](#error-handling-strategy)
6. [Performance Monitoring](#performance-monitoring)
7. [Security Features](#security-features)
8. [API Documentation](#api-documentation)
9. [Development Guidelines](#development-guidelines)

## Architectural Pattern

The backend follows a layered architecture with clear separation of concerns:

- **Controllers**: Handle HTTP requests/responses
- **Services**: Implement business logic
- **Repositories**: Manage data access
- **Middleware**: Process requests before they reach controllers
- **Utils**: Provide cross-cutting functionality

This architecture promotes:
- **Maintainability**: Each layer has a specific responsibility
- **Testability**: Components can be tested in isolation
- **Reusability**: Common functionality is abstracted
- **Security**: Multiple layers of validation and authorization

## Core Components

### 1. Server Configuration (`/src/server.js`)

The application entry point that:
- Initializes Express application
- Configures middleware
- Connects to database
- Registers routes
- Implements graceful shutdown

```javascript
// Simplified server initialization flow
const app = express();
setupMiddleware(app);
connectToDatabase();
registerRoutes(app);
startServer(app);
```

Key features:
- Structured initialization sequence
- Environment-specific configuration
- Graceful shutdown handling
- Comprehensive error handling
- Health check endpoints

### 2. Configuration Management (`/src/config/index.js`)

Centralized configuration using environment variables with sensible defaults:
- Database connection parameters
- Security settings
- Feature flags
- Environment-specific configurations

Configuration is loaded from:
1. Environment variables
2. `.env` file
3. Default values

All configuration access should go through this module to ensure consistency.

### 3. Database Layer

#### Database Connection (`/src/db/index.js`)
- Manages PostgreSQL connection pool
- Provides query execution methods
- Handles connection errors
- Implements connection retry logic
- Tracks query performance metrics

Sample usage:
```javascript
const db = require('../db');
const result = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
```

#### Transaction Management (`/src/db/transaction.js`)
- Implements ACID transactions
- Provides transaction helpers
- Automatic rollback on errors
- Connection pooling optimization
- Transaction tracking for debugging

Sample usage:
```javascript
const { withTransaction } = require('../db/transaction');

await withTransaction(async (client) => {
  await client.query('INSERT INTO applications (user_id, status) VALUES ($1, $2)', [userId, 'PENDING']);
  await client.query('INSERT INTO payment_logs (application_id, amount) VALUES ($1, $2)', [appId, amount]);
});
```

#### Migrations (`/src/db/migrations/`)
- Database schema versioning
- SQL migration scripts
- Migration runner
- Schema validation
- Rollback capability

Migrations are stored in SQL files with version numbers and applied in sequence.

### 4. Repository Layer

#### Base Repository (`/src/repositories/base.repository.js`)
- Abstract CRUD operations
- Query building
- Error handling
- Entity mapping
- Pagination support

#### Entity Repositories
- **User Repository** (`/src/repositories/user.repository.js`): User management
  - User registration
  - Profile management
  - User lookup and search
  - Account status management

- **Application Repository** (`/src/repositories/application.repository.js`): Permit application data
  - Permit creation
  - Status updates
  - Document association
  - History tracking
  - Search and filtering

- **Security Repository** (`/src/repositories/security.repository.js`): Security logs and auditing
  - Login attempts
  - Security events
  - Account lockouts
  - Suspicious activity

### 5. Service Layer

#### Authentication & Security
- **Auth Security Service** (`/src/services/auth-security.service.js`): Authentication logic
  - Login/logout operations
  - Session management
  - Password validation
  - Account lockout handling
  - Multi-factor authentication (if implemented)

- **Security Service** (`/src/services/security.service.js`): Security auditing
  - Security event logging
  - Threat detection
  - Rate limit tracking
  - Audit trail management

- **Password Reset Service** (`/src/services/password-reset.service.js`): Password management
  - Token generation and validation
  - Secure reset process
  - Email notification
  - Password policy enforcement

#### Core Business Logic
- **Application Service** (`/src/services/application.service.js`): Permit application processing
  - Form submission processing
  - Validation workflows
  - Status transition management
  - Notification triggering
  - Fee calculation

- **Email Service** (`/src/services/email.service.js`): Email notifications
  - Template rendering
  - Email scheduling
  - Delivery status tracking
  - Attachment handling
  - Templated emails for various workflows

- **PDF Service** (`/src/services/pdf-service.js`): Document generation
  - Permit document creation
  - Template-based PDF generation
  - Digital signatures (if implemented)
  - Watermarking and security features

#### Infrastructure Services
- **Storage Service** (`/src/services/storage.service.js`): File storage
  - File uploads/downloads
  - Storage optimization
  - Path management
  - Cleanup routines
  - Secure file handling

- **Puppeteer Service** (`/src/services/puppeteer.service.js`): Screenshot capture
  - Form screenshot capturing
  - PDF generation from HTML
  - Visual verification process
  - Browser automation

### 6. Controller Layer

- **Auth Controller** (`/src/controllers/auth.controller.js`): Authentication endpoints
  - Login
  - Registration
  - Password reset requests
  - Account verification
  - Session management

- **Application Controller** (`/src/controllers/application.controller.js`): Permit operations
  - Permit creation
  - Status updates
  - Document uploads
  - Payment processing
  - Application history

- **Admin Controller** (`/src/controllers/admin.controller.js`): Administrative functions
  - User management
  - Application review
  - System configuration
  - Reporting endpoints

- **Password Reset Controller** (`/src/controllers/password-reset.controller.js`): Reset flow
  - Reset token validation
  - Password update
  - Token expiration handling

### 7. Middleware

#### Security Middleware
- **Auth Middleware** (`/src/middleware/auth.middleware.js`): Authentication verification
  - Session validation
  - Role-based access control
  - Token verification
  - Portal-specific authentication

- **CSRF Middleware** (`/src/middleware/csrf.middleware.js`): CSRF protection
  - Token generation
  - Request validation
  - Exempt routes management

- **Rate Limit Middleware** (`/src/middleware/rate-limit.middleware.js`): Request throttling
  - Route-specific limits
  - Client identification
  - Sliding window implementation
  - Limit bypass for trusted clients

- **Security Headers Middleware** (`/src/middleware/security-headers.middleware.js`): HTTP headers
  - Content Security Policy
  - X-XSS-Protection
  - X-Frame-Options
  - Referrer-Policy
  - Feature-Policy

#### Request Processing
- **Content Type Middleware** (`/src/middleware/content-type.middleware.js`): Validates content types
  - Enforce content-type requirements
  - Request body size limits
  - Content validation

- **Request ID Middleware** (`/src/middleware/request-id.middleware.js`): Adds correlation IDs
  - UUID generation
  - Header propagation
  - Request tracing

- **Error Handler Middleware** (`/src/middleware/error-handler.middleware.js`): Centralizes error handling
  - Error categorization
  - Environment-specific responses
  - Error logging
  - Client-friendly error messages

- **Validation Middleware** (`/src/middleware/validation.middleware.js`): Input validation
  - Schema-based validation
  - Sanitization
  - Custom validation rules
  - Consistent error formatting

### 8. Routes

- **Auth Routes** (`/src/routes/auth.routes.js`): Login, registration, logout
  - POST /api/auth/login
  - POST /api/auth/register
  - POST /api/auth/logout
  - GET /api/auth/profile

- **Application Routes** (`/src/routes/applications.routes.js`): Permit CRUD operations
  - GET /api/applications
  - POST /api/applications
  - GET /api/applications/:id
  - PUT /api/applications/:id
  - POST /api/applications/:id/submit
  - POST /api/applications/:id/payment
  - GET /api/applications/:id/document

- **Admin Routes** (`/src/routes/admin.routes.js`): Administrative endpoints
  - GET /api/admin/users
  - PUT /api/admin/applications/:id/status
  - GET /api/admin/reports
  - POST /api/admin/verify-payment/:id

- **Password Reset Routes** (`/src/routes/password-reset.routes.js`): Password management
  - POST /api/password-reset/request
  - POST /api/password-reset/validate-token
  - POST /api/password-reset/reset

- **Health Routes** (`/src/routes/health.routes.js`): System health checks
  - GET /health/liveness
  - GET /health/readiness
  - GET /health/version

- **Metrics Routes** (`/src/routes/metrics.routes.js`): Performance monitoring
  - GET /metrics
  - GET /metrics/performance
  - GET /metrics/application

### 9. Utilities

#### Error Handling
- **Error Handler** (`/src/utils/error-handler.js`): Error processing
  - Custom error classes
  - Error serialization
  - Chain of responsibility pattern
  - Contextual error enhancement

- **Custom Errors** (`/src/utils/errors/index.js`): Application-specific error types
  - ValidationError
  - AuthenticationError
  - AuthorizationError
  - ResourceNotFoundError
  - DatabaseError
  - ApplicationError

#### Logging
- **Logger** (`/src/utils/logger.js`): Basic logging
  - Consistent log format
  - Log levels
  - Standard log patterns

- **Enhanced Logger** (`/src/utils/enhanced-logger.js`): Advanced structured logging
  - JSON structured logging
  - Context propagation
  - Correlation ID tracking
  - Log rotation
  - Multiple transport support

- **Request Logger** (`/src/utils/request-logger.js`): HTTP request logging
  - Request/response logging
  - Performance timing
  - Sensitive data masking
  - Correlation ID tracking

#### Other Utilities
- **API Response** (`/src/utils/api-response.js`): Standardized responses
  - Consistent response structure
  - Status code mapping
  - Error response formatting
  - Success response formatting

- **Password Utils** (`/src/utils/password.js`): Password hashing
  - Bcrypt implementation
  - Salt management
  - Hash verification
  - Password strength validation

- **Metrics** (`/src/utils/metrics.js`): Performance monitoring
  - Prometheus metrics collection
  - Custom counters and gauges
  - Performance histograms
  - System resource monitoring

### 10. Scheduled Jobs

- **Scheduler** (`/src/jobs/scheduler.js`): Job scheduling system
  - Task registration
  - Cron-based scheduling
  - Error handling
  - Logging
  - Job prioritization

- **Scheduled Verification** (`/src/jobs/scheduled-verification.js`): Automated verification tasks
  - Payment verification
  - Document expiration checks
  - Reminder notifications
  - Status updates
  - Cleanup tasks

## Authentication Flow

1. **User Registration**:
   - Input validation
   - Password hashing with bcrypt
   - User record creation in database
   - Email verification token generation
   - Welcome email delivery
   - Initial profile setup

2. **Login Process**:
   - Credential validation
   - Password verification against stored hash
   - Account status check (locked, disabled, etc.)
   - Session creation with expiration
   - Security activity logging
   - Failed attempt tracking

3. **Session Management**:
   - PostgreSQL session storage via connect-pg-simple
   - Absolute timeout (max session duration)
   - Sliding timeout (inactivity reset)
   - CSRF token generation for state-changing operations
   - Session regeneration on privilege change

4. **Password Reset**:
   - Rate-limited token generation
   - Secure token storage with expiration
   - Email delivery with reset link
   - Token verification on reset attempt
   - Password policy enforcement
   - Audit logging of reset events

## Permit Application Flow

1. **Submission**:
   - Multi-step form with validation at each step
   - File uploads (ID documents, supporting files)
   - Payment processing and verification
   - Database transaction to ensure data integrity
   - Application ID generation
   - Confirmation notifications

2. **Processing**:
   - Status updates (SUBMITTED → IN_REVIEW → APPROVED/REJECTED)
   - Email notifications at each status change
   - Document generation (permit PDF)
   - Internal notes and activity logging
   - SLA tracking

3. **Verification**:
   - Admin review queue
   - Document validation
   - Payment verification process
   - Approval/rejection with notes
   - Manual override capabilities
   - Audit trail of all review actions

4. **Renewal**:
   - Eligibility checking based on permit type
   - Simplified form pre-filled with existing data
   - Fee calculation based on permit type and duration
   - Document update with new expiration
   - Notification system for upcoming expiration

## Error Handling Strategy

The system implements a sophisticated error handling approach:

- **Error Hierarchy**: Custom error types with appropriate HTTP status codes
  - `BaseError`: The root of all application errors
  - `ValidationError`: For input validation failures
  - `AuthenticationError`: For login/authentication issues
  - `AuthorizationError`: For permission-related issues
  - `ResourceNotFoundError`: For missing resources
  - `DatabaseError`: For database-related failures
  - `ExternalServiceError`: For third-party service issues

- **Centralized Handling**: All errors processed through error handler middleware
  - Environment-specific error details (verbose in development, limited in production)
  - Consistent error response format
  - Error logging with context
  - Status code mapping

- **Transaction Rollbacks**: Automatic database transaction rollback on errors
  - Ensures data consistency
  - Prevents partial updates
  - Maintains referential integrity

- **Structured Logging**: Error details logged in structured format with correlation IDs
  - Stack traces in development
  - Error context and request information
  - Alerts for critical errors
  - Aggregation for pattern detection

## Performance Monitoring

- **Prometheus Metrics**: Key performance indicators exposed via metrics endpoint
  - Request counts by endpoint
  - Response times
  - Error rates
  - Application-specific metrics (permits issued, etc.)

- **Query Performance**: Database query timing and optimization
  - Slow query tracking
  - Query timing histograms
  - Connection pool utilization
  - Query cache effectiveness

- **Resource Utilization**: Memory and CPU tracking
  - Heap usage monitoring
  - GC statistics
  - CPU utilization
  - Memory leak detection

- **Request Timing**: Response time monitoring
  - End-to-end timing
  - Middleware timing breakdown
  - Database operation timing
  - External service call timing

## Security Features

- **Parameter Validation**: All input validated before processing
  - Schema-based validation
  - Type checking
  - Range/constraint validation
  - Sanitization of user input

- **SQL Injection Protection**: Parameterized queries
  - No direct string concatenation in queries
  - Prepared statements
  - ORM/query builder usage
  - Input sanitization

- **XSS Prevention**: Content Security Policy and output encoding
  - HTTP headers configuration
  - Template system with automatic escaping
  - Input sanitization
  - Content-Type enforcement

- **CSRF Protection**: Token validation for state-changing operations
  - Double Submit Cookie pattern
  - Token rotation
  - Same-Site cookie attributes
  - Origin validation

- **Rate Limiting**: Tiered rate limits to prevent abuse
  - IP-based limiting
  - User-based limiting
  - Endpoint-specific thresholds
  - Progressive throttling

- **Security Headers**: Comprehensive HTTP security headers
  - Content-Security-Policy
  - X-Content-Type-Options
  - X-Frame-Options
  - Strict-Transport-Security
  - Referrer-Policy

- **Audit Logging**: Security events recorded for auditing
  - Login attempts (success/failure)
  - Password changes
  - Permission changes
  - Admin actions
  - Suspicious activity

## API Documentation

The API is documented using Swagger/OpenAPI:

- Interactive documentation available at `/api-docs` when in development mode
- JSON schema at `/api-docs.json`
- Documentation includes:
  - Endpoint descriptions
  - Request/response schemas
  - Authentication requirements
  - Example requests/responses
  - Error codes

## Development Guidelines

### Code Organization
- Follow the established layered architecture
- Maintain separation of concerns
- Use the appropriate layer for each type of logic

### Error Handling
- Use custom error classes from `/src/utils/errors`
- Always catch and properly handle async errors
- Include appropriate context in error objects

### Database Operations
- Use the transaction helpers for multi-step operations
- Always use parameterized queries
- Include appropriate indexes for frequent queries
- Close connections appropriately

### Security Considerations
- Never store sensitive data in plaintext
- Always validate and sanitize user input
- Use the authentication middleware for protected routes
- Follow least privilege principle

### Logging
- Use the enhanced logger for all logging operations
- Include appropriate context in log messages
- Use appropriate log levels
- Avoid logging sensitive information

### Testing
- Write unit tests for all business logic
- Use integration tests for API endpoints
- Mock external dependencies
- Test both success and error cases