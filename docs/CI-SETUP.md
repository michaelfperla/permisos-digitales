# Setting Up Continuous Integration

This document explains how to set up and configure the Continuous Integration (CI) pipeline for the Permisos Digitales project.

## GitHub Actions

This project uses GitHub Actions for CI. The configuration is stored in the `.github/workflows/node-tests.yml` file.

### CI Pipeline Overview

The CI pipeline consists of three jobs:

1. **Lint**: Runs ESLint and Stylelint to check code quality
2. **Test**: Runs unit tests and integration tests with Redis support
3. **Build**: Verifies that the application can be built

### Setting Up GitHub Actions

1. **Create a GitHub Repository**:
   - If you haven't already, create a GitHub repository for your project.
   - Push your code to the repository.

2. **Configure GitHub Actions**:
   - The `.github/workflows/node-tests.yml` file should already be in your repository.
   - GitHub will automatically detect and run the workflow when you push to the repository.

3. **View CI Results**:
   - Go to the "Actions" tab in your GitHub repository to view the results of the CI pipeline.
   - You can click on a specific workflow run to see detailed logs for each job.

### Customizing the CI Pipeline

You can customize the CI pipeline by editing the `.github/workflows/node-tests.yml` file:

- **Change the Trigger Branches**:
  ```yaml
  on:
    push:
      branches: [ main, develop ]
    pull_request:
      branches: [ main, develop ]
  ```

- **Add or Remove Jobs**:
  ```yaml
  jobs:
    lint:
      # Lint job configuration
    test:
      # Test job configuration
    build:
      # Build job configuration
  ```

- **Modify Environment Variables**:
  ```yaml
  env:
    REDIS_HOST: localhost
    REDIS_PORT: 6379
    NODE_ENV: test
  ```

## Setting Up CI Badges

The CI badge is already added to the README.md file:

```markdown
[![Node.js CI](https://github.com/michaelfperla/permisos-digitales/actions/workflows/node-tests.yml/badge.svg)](https://github.com/michaelfperla/permisos-digitales/actions/workflows/node-tests.yml)
```

Make sure to replace `yourusername` with your actual GitHub username or organization name.

## Best Practices

1. **Keep the CI Pipeline Fast**:
   - Optimize tests to run quickly
   - Use caching for dependencies
   - Run only necessary tests for each change

2. **Maintain Test Quality**:
   - Ensure tests are reliable and don't produce false positives or negatives
   - Keep test coverage high
   - Write tests for new features and bug fixes

3. **Monitor CI Results**:
   - Regularly check CI results
   - Fix failing tests promptly
   - Use CI status as a gate for merging pull requests

4. **Secure Sensitive Information**:
   - Use GitHub Secrets for sensitive information like API keys
   - Never commit sensitive information to the repository

## Troubleshooting

### Common Issues

1. **Tests Pass Locally But Fail in CI**:
   - Check for environment differences
   - Ensure all dependencies are properly installed in CI
   - Look for race conditions or timing issues in tests

2. **CI Pipeline Takes Too Long**:
   - Optimize slow tests
   - Use test splitting or parallelization
   - Cache dependencies and build artifacts

3. **Redis Connection Issues**:
   - Ensure Redis service is properly configured in the workflow
   - Check Redis connection settings in tests

### Getting Help

If you encounter issues with the CI pipeline, you can:

1. Check the GitHub Actions logs for detailed error messages
2. Consult the [GitHub Actions documentation](https://docs.github.com/en/actions)
3. Search for similar issues in the GitHub community forums
4. Reach out to the project maintainers for assistance
