# Permisos Digitales Documentation

Welcome to the Permisos Digitales documentation. This documentation provides comprehensive information about the application architecture, components, and development guidelines.

## Table of Contents

### Backend Documentation
- [Backend Architecture](./backend/ARCHITECTURE.md) - Detailed overview of the backend architecture, components, and flows

### Frontend Documentation
- [Frontend Modernization Plan](../FRONTEND-MODERNIZATION.md) - Plan for modernizing the frontend codebase
- The frontend documentation is currently being developed as part of the modernization process

### Tools and Utilities
- [Admin Tools](../tools/admin/README.md) - Documentation for administrative tools
- [Database Tools](../tools/database/README.md) - Documentation for database management tools
- [Monitoring Tools](../tools/monitoring/README.md) - Documentation for system monitoring tools
- [Testing Tools](../tools/testing/README.md) - Documentation for testing utilities

### Development Processes
- [CI Setup](./CI-SETUP.md) - Setting up and configuring Continuous Integration

## Getting Started

### Prerequisites
- Node.js v16.0.0 or higher
- PostgreSQL
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Set up environment variables (copy `.env.example` to `.env` and update values)
4. Set up the database:
   ```
   npm run db:setup
   ```
5. Create an admin user:
   ```
   npm run admin:create
   ```
6. Start the application:
   ```
   npm run dev
   ```

### Running Tests
```
npm run test
```

## Development Workflow

1. Create a feature branch from `main`
2. Implement your changes
3. Write tests for your changes
4. Run tests and linting
5. Submit a pull request

## Deployment

The application can be deployed using the following command:

```
npm run build && npm start
```

For production deployments, ensure all environment variables are properly configured.

## Contributing

Please see the [CONTRIBUTING.md](../CONTRIBUTING.md) file for details on our code of conduct and the process for submitting pull requests.