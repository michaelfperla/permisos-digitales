# Security Policy

## Supported Versions

We actively support the following versions of this project:

| Version | Supported          |
| ------- | ------------------ |
| main    | :white_check_mark: |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security vulnerability, please follow these steps:

### 1. Do NOT create a public issue

Please do not report security vulnerabilities through public GitHub issues.

### 2. Contact us privately

Send an email to: michael@clixhouse.com

Include the following information:
- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact
- Any suggested fixes (if you have them)

### 3. Response timeline

- **Initial response**: Within 48 hours
- **Status update**: Within 7 days
- **Resolution**: Varies based on complexity, but we aim for 30 days maximum

### 4. Disclosure policy

- We will acknowledge receipt of your vulnerability report
- We will confirm the vulnerability and determine its impact
- We will release a fix as soon as possible
- We will publicly disclose the vulnerability after a fix is available

## Security Best Practices

When contributing to this project, please follow these security guidelines:

### Code Security
- Never commit sensitive information (passwords, API keys, etc.)
- Use environment variables for configuration
- Validate all user inputs
- Use parameterized queries to prevent SQL injection
- Implement proper authentication and authorization

### Dependencies
- Keep dependencies up to date
- Regularly run `npm audit` to check for vulnerabilities
- Use `npm audit fix` to automatically fix issues when possible

### Infrastructure
- Use HTTPS in production
- Implement proper CORS policies
- Use secure headers
- Implement rate limiting
- Use secure session management

## Security Tools

This project uses the following security tools:

- **npm audit**: Automated vulnerability scanning for dependencies
- **GitHub Security Advisories**: Automated vulnerability alerts
- **Dependabot**: Automated dependency updates
- **CodeQL**: Static code analysis (if enabled)

## Acknowledgments

We appreciate the security research community and will acknowledge researchers who responsibly disclose vulnerabilities to us.
