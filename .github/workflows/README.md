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
- Starts a Redis service container for integration tests
- Runs unit tests
- Runs integration tests
- Generates test coverage report
- Uploads test results as artifacts

##### Build
- Verifies that the application can be built

## Environment Variables

The following environment variables are set for the test job:

- `REDIS_HOST`: localhost
- `REDIS_PORT`: 6379
- `NODE_ENV`: test

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
