# AWS Deployment Guide for Permisos Digitales

This guide will walk you through deploying your digital permits application to AWS from scratch.

## 🎯 Architecture Overview

```
Users → CloudFront → S3 (Frontend)
Users → ALB → EC2 (Backend) → RDS (PostgreSQL)
                           → ElastiCache (Redis)
                           → S3 (File Storage)
```

## 📋 Prerequisites

- AWS Account with billing enabled
- Domain name (recommended: permisosdigitales.com.mx)
- AWS CLI installed and configured
- Basic terminal/command line knowledge

## 🚀 Phase 1: Initial AWS Setup

### 1.1 Install AWS CLI

**Windows:**
```bash
# Download from: https://aws.amazon.com/cli/
# Or use chocolatey:
choco install awscli
```

**Configure AWS CLI:**
```bash
aws configure
# access_key
# secret_access_key
# Default region: us-west-1
# Default output format: json
```

### 1.2 Create IAM User (if needed)

1. Go to AWS Console → IAM → Users
2. Click "Create User"
3. Username: `permisos-deployer`
4. Attach policies: `AdministratorAccess` (for initial setup)
5. Save Access Key and Secret Key

## 🗄️ Phase 2: Database Setup

### 2.1 Create RDS PostgreSQL

1. **Go to RDS Console**
2. **Create Database**:
   - Engine: PostgreSQL
   - Version: 15.x (latest)
   - Template: Production (or Dev/Test for testing)
   - DB Instance: `db.t3.micro` (free tier) or `db.t3.small`
   - Storage: 20GB GP2 SSD
   - **Database Settings**:
     - DB Name: `permisos_digitales`
     - Username: `permisos_admin`
     - Password: Generate strong password (save it!)
   - **Connectivity**:
     - VPC: Default VPC
     - Public Access: No
     - Security Group: Create new `permisos-db-sg`
   - **Additional Configuration**:
     - Initial database name: `permisos_digitales`
     - Backup retention: 7 days
     - Monitoring: Enable

3. **Configure Security Group**:
   - Edit `permisos-db-sg`
   - Add Inbound Rule:
     - Type: PostgreSQL
     - Port: 5432
     - Source: Custom (we'll update this with EC2 security group later)

### 2.2 Create ElastiCache Redis

1. **Go to ElastiCache Console**
2. **Create Redis Cluster**:
   - Cluster Mode: Disabled
   - Node Type: `cache.t3.micro`
   - Number of Replicas: 0 (for cost savings)
   - Subnet Group: Default
   - Security Group: Create new `permisos-redis-sg`

## 📁 Phase 3: File Storage Setup

### 3.1 Create S3 Buckets

**Frontend Bucket:**
```bash
aws s3 mb s3://permisos-digitales-frontend-YOUR_UNIQUE_ID
```

**Files Bucket:**
```bash
aws s3 mb s3://permisos-digitales-files-YOUR_UNIQUE_ID
```

### 3.2 Configure S3 Bucket Policies

1. Go to S3 Console
2. Select your files bucket
3. Go to Permissions → Bucket Policy
4. Add policy for your application to access files

## 🖥️ Phase 4: Backend Deployment

### 4.1 Create EC2 Instance

1. **Launch Instance**:
   - AMI: Amazon Linux 2023
   - Instance Type: `t3.small`
   - Key Pair: Create new or select existing
   - **Security Group** (`permisos-backend-sg`):
     - SSH (22): Your IP only
     - HTTP (80): 0.0.0.0/0
     - HTTPS (443): 0.0.0.0/0
     - Custom TCP (3001): 0.0.0.0/0 (temporary, will restrict later)

2. **Connect to Instance**:
   ```bash
   ssh -i your-key.pem ec2-user@your-instance-public-ip
   ```

### 4.2 Setup Server Environment

```bash
# Update system
sudo yum update -y

# Install Node.js 18
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Install Git
sudo yum install -y git

# Create application directory
sudo mkdir -p /var/www/permisos-digitales
sudo chown ec2-user:ec2-user /var/www/permisos-digitales
```

### 4.3 Deploy Application

```bash
# Clone repository
cd /var/www/permisos-digitales
git clone https://github.com/michaelfperla/permisos-digitales.git .

# Install dependencies
npm install --production

# Copy and configure environment
cp .env.production .env
```

### 4.4 Configure Environment Variables

Edit `.env` file with your actual AWS values:

```bash
nano .env
```

Update these values:
- `DATABASE_URL`: Your RDS endpoint
- `REDIS_HOST`: Your ElastiCache endpoint
- `S3_BUCKET`: Your S3 bucket name
- `S3_ACCESS_KEY_ID`: Your AWS access key
- `S3_SECRET_ACCESS_KEY`: Your AWS secret key
- `MAILGUN_API_KEY`: Your Mailgun API key
- `MAILGUN_DOMAIN`: Your Mailgun domain

### 4.5 Run Database Migrations

```bash
npm run migrate:up
```

### 4.6 Start Application

```bash
# Start with PM2
pm2 start src/server.js --name permisos-digitales

# Setup PM2 to start on boot
pm2 startup
pm2 save
```

## 🌐 Phase 5: Frontend Deployment

### 5.1 Build Frontend

On your local machine:

```bash
cd frontend
npm run build
```

### 5.2 Upload to S3

```bash
aws s3 sync dist/ s3://your-frontend-bucket-name --delete
```

### 5.3 Setup CloudFront

1. Go to CloudFront Console
2. Create Distribution:
   - Origin Domain: your-frontend-bucket.s3.amazonaws.com
   - Origin Access: Origin Access Control
   - Default Root Object: index.html
   - Error Pages: Add custom error response for SPA routing

## 🔧 Phase 6: Load Balancer & SSL

### 6.1 Create Application Load Balancer

1. Go to EC2 Console → Load Balancers
2. Create Application Load Balancer:
   - Name: `permisos-alb`
   - Scheme: Internet-facing
   - IP address type: IPv4
   - VPC: Default VPC
   - Subnets: Select all available
   - Security Group: Create new `permisos-alb-sg`

### 6.2 Configure Target Group

1. Create Target Group:
   - Type: Instances
   - Protocol: HTTP
   - Port: 3001
   - Health Check Path: `/status`

2. Register your EC2 instance

### 6.3 Setup SSL Certificate

1. Go to Certificate Manager
2. Request public certificate for your domain
3. Add certificate to ALB HTTPS listener

## 🌍 Phase 7: Domain Configuration

### 7.1 Route 53 Setup

1. Create Hosted Zone for your domain
2. Create A records:
   - `permisosdigitales.com.mx` → CloudFront distribution
   - `api.permisosdigitales.com.mx` → Application Load Balancer

## ✅ Phase 8: Final Configuration

### 8.1 Update Security Groups

1. Update `permisos-backend-sg`:
   - Remove port 3001 from 0.0.0.0/0
   - Add port 3001 from ALB security group only

2. Update `permisos-db-sg`:
   - Add PostgreSQL access from backend security group

### 8.2 Test Deployment

1. Test API: `https://api.permisosdigitales.com.mx/status` (Industry Standard: Clean Subdomain Routing)
2. Test Frontend: `https://permisosdigitales.com.mx`

## 🔍 Monitoring & Maintenance

### Daily Checks
- Check PM2 status: `pm2 status`
- Check logs: `pm2 logs permisos-digitales`
- Monitor AWS costs in billing dashboard

### Backup Strategy
- RDS automated backups (7 days retention)
- S3 versioning enabled for files
- Regular database snapshots

## 🆘 Troubleshooting

### Common Issues

1. **Application won't start**:
   ```bash
   pm2 logs permisos-digitales
   ```

2. **Database connection issues**:
   - Check security groups
   - Verify DATABASE_URL format
   - Test connection: `npm run db:verify`

3. **File upload issues**:
   - Check S3 permissions
   - Verify AWS credentials
   - Check bucket policy

### Useful Commands

```bash
# Restart application
pm2 restart permisos-digitales

# View logs
pm2 logs permisos-digitales --lines 100

# Check system resources
htop

# Test database connection
npm run db:verify
```

## 💰 Cost Estimation

**Monthly costs (approximate):**
- EC2 t3.small: $15-20
- RDS db.t3.micro: $15-20
- ElastiCache t3.micro: $10-15
- S3 storage: $5-10
- CloudFront: $5-10
- **Total: ~$50-75/month**

## 🔄 Deployment Updates

For future updates, use the deployment script:

```bash
cd /var/www/permisos-digitales
chmod +x scripts/deploy-aws.sh
./scripts/deploy-aws.sh
```

---

**Need Help?**
- Check AWS documentation
- Review application logs
- Contact support if needed
