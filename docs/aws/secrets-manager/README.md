# AWS Secrets Manager Implementation

This directory contains all files related to AWS Secrets Manager integration for Permisos Digitales.

## 📁 Directory Structure

```
aws/secrets-manager/
├── README.md                          # This file
├── policies/                          # IAM policies
│   └── iam-policy-secrets-manager.json
├── scripts/                           # Setup and migration scripts
│   ├── setup-secrets-manager.sh       # Bash script to create secrets
│   ├── migrate-env-to-secrets.js      # Interactive migration tool
│   └── quick-migrate-secrets.js       # Quick migration from .env
└── docs/                             # Documentation
    ├── SECRETS_ARCHITECTURE.md       # System architecture
    ├── SECRETS_DEPLOYMENT_GUIDE.md   # Step-by-step deployment
    ├── SECRETS_QUICK_START.md        # 5-minute guide
    └── AWS_SECRETS_MANAGER_SUMMARY.md # Complete summary
```

## 🚀 Quick Start

1. **Migrate your secrets** (if you have .env.production):
   ```bash
   node aws/secrets-manager/scripts/quick-migrate-secrets.js
   ```

2. **Deploy IAM policy**:
   ```bash
   aws iam create-policy \
     --policy-name PermisosDigitalesSecretsManagerAccess \
     --policy-document file://aws/secrets-manager/policies/iam-policy-secrets-manager.json
   ```

3. **Update your server** to use `src/server-with-secrets.js`

## 📚 Documentation

- **[Architecture Guide](docs/SECRETS_ARCHITECTURE.md)** - How it all works
- **[Deployment Guide](docs/SECRETS_DEPLOYMENT_GUIDE.md)** - Production deployment
- **[Quick Start Guide](docs/SECRETS_QUICK_START.md)** - Get running in 5 minutes

## 🔧 Related Application Files

### Core Services
- `src/services/secrets/secrets-manager.service.js` - Main secrets service
- `src/config/secrets/secrets-config-loader.js` - Configuration loader

### Server Implementation
- `src/server-with-secrets.js` - New server entry point
- `src/db/index-with-secrets.js` - Database with secrets
- `src/utils/redis-client-with-secrets.js` - Redis with secrets

### Tests
- `src/services/secrets/secrets-manager.service.test.js` - Unit tests

## 💰 Cost

~$2.50/month for all secrets with intelligent caching

## 🔐 Security

- All secrets encrypted with AWS KMS
- Access controlled by IAM policies
- Full audit trail via CloudTrail
- No secrets in code or environment variables