# GitHub Actions Workflows

This directory contains GitHub Actions workflow configurations for continuous integration and deployment.

## Available Workflows

### `node-tests.yml`

This workflow runs on every push to `main` and `develop` branches, as well as on pull requests to these branches.

It consists of three jobs:

1. **Lint**: Runs ESLint and Stylelint to check code quality
2. **Test**: Runs unit tests and integration tests with Redis support
3. **Build**: Verifies that the application can be built

#### Job Details

##### Lint
- Runs ESLint on JavaScript files
- Runs Stylelint on CSS files

##### Test
- Starts Redis and PostgreSQL service containers for integration tests
- Sets up the test database schema using migrations
- Creates test storage directory for file uploads
- Runs all tests (unit and integration) with coverage
- Generates test coverage report
- Uploads test results as artifacts
- Uploads coverage report to Codecov

##### Build
- Verifies that the application can be built

## Environment Variables

The following environment variables are set for the test job:

- `REDIS_HOST`: localhost
- `REDIS_PORT`: 6379
- `NODE_ENV`: test
- `TEST_DB_HOST`: localhost
- `TEST_DB_PORT`: 5432
- `TEST_DB_USER`: postgres
- `TEST_DB_PASSWORD`: postgres
- `TEST_DB_NAME`: test_permisos_digitales
- `TEST_STORAGE_PATH`: ./test-storage
- `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`: PostgreSQL connection parameters for migrations

## Adding New Workflows

To add a new workflow:

1. Create a new YAML file in this directory
2. Define the workflow triggers, jobs, and steps
3. Update this README with information about the new workflow

## Best Practices

- Keep workflows focused on specific tasks
- Use descriptive names for workflows, jobs, and steps
- Reuse steps and actions where possible
- Use service containers for dependencies like databases and Redis
- Upload artifacts for test results and build outputs
- Use environment variables for configuration
