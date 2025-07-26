# AWS Infrastructure & Services

This directory contains all AWS-related documentation and configuration for Permisos Digitales.

## 📁 Directory Structure

```
aws/
├── README.md                          # This file
├── infrastructure-docs/               # General AWS infrastructure documentation
│   ├── AWS_INFRASTRUCTURE_DOCUMENTATION.md  # Complete AWS resource inventory
│   ├── DEPLOYMENT_CHECKLIST.md              # Production deployment checklist
│   └── SERVER_STARTUP_GUIDE.md              # EC2 server startup guide
└── secrets-manager/                   # AWS Secrets Manager implementation
    ├── README.md                      # Secrets Manager overview
    ├── docs/                          # Secrets-specific documentation
    ├── policies/                      # IAM policies
    └── scripts/                       # Setup and migration scripts
```

## 🏗️ Infrastructure Overview

### Current AWS Services Used

1. **Compute**
   - EC2: `i-0a647b6136a31ff24` (t3.small)
   - Application Load Balancer

2. **Database**
   - RDS PostgreSQL 17.4
   - ElastiCache Redis 7.1.0

3. **Storage**
   - S3: `permisos-digitales-files-east` (documents)
   - S3: `permisos-digitales-frontend-east` (static hosting)

4. **Networking**
   - VPC: `vpc-091b7cd2e436ded05`
   - CloudFront CDN
   - Route53 DNS

5. **Security**
   - IAM Users & Roles
   - Security Groups
   - ACM SSL Certificates
   - Secrets Manager

6. **Email**
   - SES (Simple Email Service)

7. **Monitoring**
   - CloudWatch Alarms

## 📚 Documentation

### Infrastructure Documentation
- **[Complete AWS Infrastructure](infrastructure-docs/AWS_INFRASTRUCTURE_DOCUMENTATION.md)** - Detailed inventory of all AWS resources
- **[Deployment Checklist](infrastructure-docs/DEPLOYMENT_CHECKLIST.md)** - Step-by-step deployment guide
- **[Server Startup Guide](infrastructure-docs/SERVER_STARTUP_GUIDE.md)** - EC2 server configuration

### Secrets Manager Documentation
- **[Secrets Manager Implementation](secrets-manager/README.md)** - Complete secrets management system
- **[Architecture](secrets-manager/docs/SECRETS_ARCHITECTURE.md)** - System design
- **[Quick Start](secrets-manager/docs/SECRETS_QUICK_START.md)** - 5-minute setup

## 💰 Monthly AWS Costs (Estimated)

| Service | Configuration | Monthly Cost |
|---------|--------------|--------------|
| EC2 | t3.small (1 instance) | ~$15 |
| RDS | db.t3.micro | ~$15 |
| ElastiCache | cache.t3.micro | ~$13 |
| S3 | Storage + requests | ~$5 |
| CloudFront | CDN traffic | ~$10 |
| Route53 | 2 hosted zones | ~$1 |
| Load Balancer | ALB | ~$16 |
| Secrets Manager | 6 secrets | ~$2.50 |
| **Total** | | **~$77.50/month** |

## 🔑 Key Resources

### Production Endpoints
- **Frontend**: https://permisosdigitales.com.mx
- **API**: https://api.permisosdigitales.com.mx
- **CloudFront**: d2gtd1yvnspajh.cloudfront.net

### Critical Resource IDs
- **Account**: 654722280275
- **Region**: us-east-1
- **EC2 Instance**: i-0a647b6136a31ff24
- **RDS Instance**: permisos-digitales-db-east
- **Redis Cluster**: permisos-digitales-redis-secure

## 🚀 Quick Commands

```bash
# Check AWS identity
aws sts get-caller-identity

# List all secrets
aws secretsmanager list-secrets --query "SecretList[?contains(Name, 'permisos')]"

# SSH to EC2
ssh -i your-key.pem ec2-user@107.21.154.162

# View CloudWatch logs
aws logs tail /aws/your-log-group --follow
```

## 🔐 Security Notes

1. **Never commit AWS credentials** to git
2. **Use IAM roles** for EC2 instances (not access keys)
3. **Enable MFA** for all IAM users
4. **Rotate secrets** regularly
5. **Monitor CloudTrail** for suspicious activity

## 📞 Support

For AWS infrastructure issues:
1. Check CloudWatch logs first
2. Review the infrastructure documentation
3. Contact the DevOps team

---

Last updated: 2025-06-22