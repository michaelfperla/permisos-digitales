# Configuration Files

This directory contains configuration files for various tools used in the project.

## Files

- `bs-config.js` - Configuration for Browser-Sync, used for frontend development
- `pgm-config.js` - Configuration for PostgreSQL migrations

## Usage

These configuration files are referenced in the package.json scripts. For example:

```json
"dev:frontend": "browser-sync start --config config/bs-config.js"
```
