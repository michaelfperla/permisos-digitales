# AWS Infrastructure Documentation

This document contains all AWS configurations for the Permisos Digitales application.

Generated on: 2025-06-22

## Table of Contents
1. [RDS Database Configurations](#rds-database-configurations)
2. [ElastiCache/Redis Configurations](#elasticacheredis-configurations)
3. [S3 Buckets and Policies](#s3-buckets-and-policies)
4. [SSL Certificates (ACM)](#ssl-certificates-acm)
5. [Load Balancers](#load-balancers)
6. [Security Groups](#security-groups)
7. [SES Configuration](#ses-configuration)
8. [IAM Users, Roles, and Policies](#iam-users-roles-and-policies)
9. [VPC and Networking](#vpc-and-networking)
10. [EC2 Instances](#ec2-instances)
11. [CloudFront Distributions](#cloudfront-distributions)
12. [Route53 DNS](#route53-dns)
13. [Secrets Manager/Parameter Store](#secrets-managerparameter-store)
14. [CloudWatch Configurations](#cloudwatch-configurations)

---

## AWS Account Information
- **Account ID**: 654722280275
- **Current User**: permisos-deployer
- **User ARN**: arn:aws:iam::654722280275:user/permisos-deployer
- **Region**: us-east-1

## RDS Database Configurations

### Database Instance: permisos-digitales-db-east
- **Engine**: PostgreSQL 17.4
- **Instance Class**: db.t3.micro
- **Status**: available
- **Endpoint**: permisos-digitales-db-east.cgv8cw2gcp2x.us-east-1.rds.amazonaws.com:5432
- **Master Username**: permisos_admin
- **Allocated Storage**: 20 GB (gp2)
- **Storage Encrypted**: Yes (KMS Key: arn:aws:kms:us-east-1:654722280275:key/a65f0786-17bf-4729-8c74-a1c93321428a)
- **Multi-AZ**: No
- **Backup Retention**: 7 days
- **Backup Window**: 08:37-09:07
- **Maintenance Window**: fri:07:42-fri:08:12
- **Publicly Accessible**: Yes
- **VPC Security Group**: sg-01660322a7c648f03
- **DB Subnet Group**: permisos-db-subnet-group
  - VPC: vpc-091b7cd2e436ded05
  - Subnets: 
    - subnet-043e609c3861464d3 (us-east-1b)
    - subnet-0109effbafdf36c00 (us-east-1a)
- **Deletion Protection**: Disabled
- **Auto Minor Version Upgrade**: Enabled
- **Created**: 2025-05-30T02:41:58.256000+00:00

## ElastiCache/Redis Configurations

### Redis Replication Group: permisos-digitales-redis-secure
- **Description**: Permisos Digitales Redis cluster with TLS encryption
- **Status**: available
- **Cache Node Type**: cache.t3.micro
- **Engine**: Redis 7.1.0
- **Primary Endpoint**: master.permisos-digitales-redis-secure.cdnynp.use1.cache.amazonaws.com:6379
- **Reader Endpoint**: replica.permisos-digitales-redis-secure.cdnynp.use1.cache.amazonaws.com:6379
- **Cluster Node**: permisos-digitales-redis-secure-001
  - Address: permisos-digitales-redis-secure-001.permisos-digitales-redis-secure.cdnynp.use1.cache.amazonaws.com:6379
  - Availability Zone: us-east-1e
- **Security Group**: sg-074d46148d63b82e1
- **Transit Encryption**: Enabled (required mode)
- **At-Rest Encryption**: Enabled
- **Auth Token**: Disabled
- **Automatic Failover**: Disabled
- **Multi-AZ**: Disabled
- **Subnet Group**: default
- **Maintenance Window**: wed:09:00-wed:10:00
- **Snapshot Window**: 04:00-05:00
- **Created**: 2025-05-30T02:49:16.646000+00:00

## S3 Buckets and Policies

### Bucket: permisos-digitales-files-east
- **Created**: 2025-05-31T22:22:41+00:00
- **Purpose**: File storage for application

### Bucket: permisos-digitales-frontend-east
- **Created**: 2025-05-31T03:55:39+00:00
- **Purpose**: Frontend static files hosting

## SSL Certificates (ACM)

### Certificate 1: Main Domain
- **ARN**: arn:aws:acm:us-east-1:654722280275:certificate/9719682a-b11e-4158-a874-561a94e1dfcc
- **Domain**: permisosdigitales.com.mx
- **Alternative Names**: 
  - permisosdigitales.com.mx
  - www.permisosdigitales.com
  - permisosdigitales.com
  - www.permisosdigitales.com.mx
- **Status**: ISSUED
- **In Use**: Yes
- **Key Algorithm**: RSA-2048
- **Valid Until**: 2026-06-26T16:59:59-07:00

### Certificate 2: API Domain
- **ARN**: arn:aws:acm:us-east-1:654722280275:certificate/b67b263a-2bdd-4c3d-815a-f9cbe2a5d4a0
- **Domain**: api.permisosdigitales.com.mx
- **Status**: ISSUED
- **In Use**: Yes
- **Key Algorithm**: RSA-2048
- **Valid Until**: 2026-06-26T16:59:59-07:00

### Certificate 3: Unused Certificate
- **ARN**: arn:aws:acm:us-east-1:654722280275:certificate/8a4951f4-e7e0-4f97-a360-9bf231ff6dbe
- **Domain**: permisosdigitales.com.mx
- **Status**: ISSUED
- **In Use**: No
- **Key Algorithm**: RSA-2048
- **Valid Until**: 2026-06-26T16:59:59-07:00

## Load Balancers

### Application Load Balancer: permisos-api-alb
- **ARN**: arn:aws:elasticloadbalancing:us-east-1:654722280275:loadbalancer/app/permisos-api-alb/9c6ec4feb9bba63a
- **DNS Name**: permisos-api-alb-1264591724.us-east-1.elb.amazonaws.com
- **Scheme**: internet-facing
- **Type**: Application
- **Status**: active
- **VPC**: vpc-091b7cd2e436ded05
- **Security Groups**: sg-074d46148d63b82e1
- **Availability Zones**:
  - us-east-1a (subnet-0109effbafdf36c00)
  - us-east-1b (subnet-043e609c3861464d3)
  - us-east-1c (subnet-07273793a3008c18b)
- **Created**: 2025-05-30T02:11:50.499000+00:00

### Target Group: permisos-api-targets
- **ARN**: arn:aws:elasticloadbalancing:us-east-1:654722280275:targetgroup/permisos-api-targets/48b73344a31e1d31
- **Protocol**: HTTP
- **Port**: 3001
- **Health Check Path**: /health
- **Health Check Interval**: 30 seconds
- **Target**: i-0a647b6136a31ff24:3001 (currently unhealthy)

### Listeners
1. **HTTP (Port 80)**
   - Action: Redirect to HTTPS (301)
2. **HTTPS (Port 443)**
   - SSL Certificate: arn:aws:acm:us-east-1:654722280275:certificate/b67b263a-2bdd-4c3d-815a-f9cbe2a5d4a0
   - SSL Policy: ELBSecurityPolicy-2016-08
   - Action: Forward to permisos-api-targets

## Security Groups

### 1. permisos-db-sg (sg-01660322a7c648f03)
- **Description**: Security group for Permisos Digitales database
- **VPC**: vpc-091b7cd2e436ded05
- **Inbound Rules**:
  - PostgreSQL (5432) from sg-085403373dcd1d5b4
  - PostgreSQL (5432) from 177.236.55.40/32 (Temporary dev access - Michael)
  - PostgreSQL (5432) from 177.236.79.41/32 (Development access - Current IP)
  - PostgreSQL (5432) from 177.236.79.40/32 (Database access for MCP server setup)
- **Outbound Rules**: All traffic to 0.0.0.0/0

### 2. permisos-backend-sg (sg-085403373dcd1d5b4)
- **Description**: Security group for Permisos Digitales backend EC2 instance
- **VPC**: vpc-091b7cd2e436ded05
- **Inbound Rules**:
  - HTTP (80) from 0.0.0.0/0
  - SSH (22) from multiple IPs including 0.0.0.0/0
  - Redis (6379) from 177.236.79.41/32
  - API (3001) from sg-074d46148d63b82e1 and 0.0.0.0/0
- **Outbound Rules**: All traffic to 0.0.0.0/0

### 3. permisos-alb-sg (sg-074d46148d63b82e1)
- **Description**: Security group for Permisos Digitales Application Load Balancer
- **VPC**: vpc-091b7cd2e436ded05
- **Inbound Rules**:
  - HTTP (80) from 0.0.0.0/0
  - HTTPS (443) from 0.0.0.0/0
  - Redis (6379) from sg-085403373dcd1d5b4
- **Outbound Rules**: All traffic to 0.0.0.0/0

### 4. default (sg-07bc193285dec830c)
- **Description**: default VPC security group
- **VPC**: vpc-091b7cd2e436ded05
- **Inbound Rules**: All traffic from same security group
- **Outbound Rules**: All traffic to 0.0.0.0/0

## SES Configuration
- **Send Quota**: 50,000 emails per 24 hours
- **Send Rate**: 14 emails per second
- **Sent Last 24 Hours**: 0

### Configuration Sets
1. **permisos-digitales-events**
   - **Purpose**: Track email delivery events (bounce, complaint, delivery, etc.)
   - **Event Destination**: SNS Topic (arn:aws:sns:us-east-1:654722280275:permisos-digitales-ses-events)
   - **Events Tracked**: bounce, complaint, delivery, send, reject, open, click, renderingFailure
   - **Created**: 2025-06-23

### SNS Topics for SES Events
1. **permisos-digitales-ses-events**
   - **ARN**: arn:aws:sns:us-east-1:654722280275:permisos-digitales-ses-events
   - **Purpose**: Receive SES event notifications
   - **Subscriptions**:
     - HTTPS webhook: https://api.permisosdigitales.com.mx/webhook/ses (Pending Confirmation)
   - **Created**: 2025-06-23

### Email Configuration Set Usage
- All emails sent through the system include the header: `X-SES-CONFIGURATION-SET: permisos-digitales-events`
- This enables tracking of delivery, bounces, complaints, opens, and clicks
- Webhook endpoint handles automatic blacklist management for bounces and complaints

## IAM Users, Roles, and Policies

### IAM Users
1. **permisos-deployer**
   - **ARN**: arn:aws:iam::654722280275:user/permisos-deployer
   - **Created**: 2025-05-27T21:11:25+00:00
   - **Purpose**: Deployment and CI/CD operations

2. **permisos-smtp-user**
   - **ARN**: arn:aws:iam::654722280275:user/permisos-smtp-user
   - **Created**: 2025-05-28T19:25:03+00:00
   - **Purpose**: SMTP authentication for email sending

### IAM Roles
1. **PermisosDigitalesBackendRole**
   - **ARN**: arn:aws:iam::654722280275:role/PermisosDigitalesBackendRole
   - **Trust**: EC2 service
   - **Purpose**: Role for backend EC2 instances

2. **Service-Linked Roles**:
   - AWSServiceRoleForElastiCache
   - AWSServiceRoleForElasticLoadBalancing
   - AWSServiceRoleForRDS
   - AWSServiceRoleForSupport
   - AWSServiceRoleForTrustedAdvisor
   - rds-monitoring-role

## VPC and Networking

### VPC: vpc-091b7cd2e436ded05
- **CIDR Block**: 172.31.0.0/16
- **State**: available
- **Default VPC**: Yes
- **Instance Tenancy**: default

### Subnets
1. **subnet-0109effbafdf36c00** (us-east-1a)
   - CIDR: 172.31.16.0/20
   - Available IPs: 4089
   - Public IP on Launch: Yes

2. **subnet-043e609c3861464d3** (us-east-1b)
   - CIDR: 172.31.32.0/20
   - Available IPs: 4089
   - Public IP on Launch: Yes

3. **subnet-07273793a3008c18b** (us-east-1c)
   - CIDR: 172.31.0.0/20
   - Available IPs: 4090
   - Public IP on Launch: Yes

4. **subnet-0f0c9f0a5e3592921** (us-east-1d)
   - CIDR: 172.31.80.0/20
   - Available IPs: 4091
   - Public IP on Launch: Yes

5. **subnet-0ab6cec2c99715105** (us-east-1e)
   - CIDR: 172.31.48.0/20
   - Available IPs: 4090
   - Public IP on Launch: Yes

6. **subnet-01e848d8c8207bb86** (us-east-1f)
   - CIDR: 172.31.64.0/20
   - Available IPs: 4091
   - Public IP on Launch: Yes

## EC2 Instances

### Instance: i-0a647b6136a31ff24
- **Name**: permisos-digitales-backend-fresh
- **Type**: t3.small
- **State**: running
- **AMI**: ami-0a7d80731ae1b2435
- **Public IP**: 107.21.154.162
- **Private IP**: 172.31.17.222
- **Public DNS**: ec2-107-21-154-162.compute-1.amazonaws.com
- **Private DNS**: ip-172-31-17-222.ec2.internal
- **VPC**: vpc-091b7cd2e436ded05
- **Subnet**: subnet-0109effbafdf36c00 (us-east-1a)
- **Security Group**: sg-085403373dcd1d5b4 (permisos-backend-sg)
- **IAM Instance Profile**: PermisosDigitalesBackendInstanceProfile
- **Key Pair**: permisos-digitales-fresh
- **EBS Volume**: vol-0705788ad12006c9b (Root device)
- **Launched**: 2025-05-31T23:22:25+00:00

## CloudFront Distributions

### Distribution: ECOBED0P176S0
- **Domain Name**: d2gtd1yvnspajh.cloudfront.net
- **Status**: Deployed
- **Aliases**:
  - permisosdigitales.com.mx
  - www.permisosdigitales.com
  - permisosdigitales.com
  - www.permisosdigitales.com.mx
- **Origin**: permisos-digitales-frontend-east.s3.amazonaws.com
- **Origin Access Control**: E1HT5A24RC88DY
- **Viewer Protocol Policy**: redirect-to-https
- **SSL Certificate**: arn:aws:acm:us-east-1:654722280275:certificate/9719682a-b11e-4158-a874-561a94e1dfcc
- **Price Class**: PriceClass_100
- **HTTP Version**: HTTP2
- **IPv6 Enabled**: Yes
- **Custom Error Responses**:
  - 403 → 200 (index.html)
  - 404 → 200 (index.html)
- **Cache Behavior**:
  - Default TTL: 86400
  - Max TTL: 31536000
  - Compress: Enabled

## Route53 DNS

### Hosted Zone 1: permisosdigitales.com.mx
- **Zone ID**: Z08403932H0BODY2FQKYS
- **Record Sets**: 24
- **Type**: Public
- **Comment**: Hosted zone for Permisos Digitales

### Hosted Zone 2: permisosdigitales.com
- **Zone ID**: Z08068042FDNG14V3DYLW
- **Record Sets**: 6
- **Type**: Public

## Secrets Manager/Parameter Store
- **Secrets Manager**: No secrets configured
- **Parameter Store**: No parameters configured

## CloudWatch Configurations
- **Monitoring**: Standard monitoring enabled for various services
- **EC2 Monitoring**: Disabled for backend instance
- **RDS Monitoring**: Standard monitoring with 60-second interval

## S3 Bucket Details

### permisos-digitales-frontend-east
- **Policy**: Public read access for all objects
- **Used for**: CloudFront distribution origin
- **Versioning**: Not enabled
- **Encryption**: Default encryption not configured

### permisos-digitales-files-east
- **Policy**: No bucket policy (private)
- **Used for**: Application file storage
- **Encryption**: AES256 server-side encryption enabled

## IAM Policies (Custom)

1. **PermisosDigitalesS3Access**
   - **ARN**: arn:aws:iam::654722280275:policy/PermisosDigitalesS3Access
   - **Created**: 2025-05-28T03:51:34+00:00
   - **Attachment Count**: 0

2. **PermisosDigitalesSESPolicy**
   - **ARN**: arn:aws:iam::654722280275:policy/PermisosDigitalesSESPolicy
   - **Created**: 2025-05-31T22:08:14+00:00
   - **Attachment Count**: 1

3. **PermisosDigitalesBackendPolicy**
   - **ARN**: arn:aws:iam::654722280275:policy/PermisosDigitalesBackendPolicy
   - **Created**: 2025-05-31T22:02:24+00:00
   - **Last Updated**: 2025-05-31T22:27:33+00:00
   - **Attachment Count**: 1
   - **Version**: v3

## CloudWatch Alarms

### Active Alarms
1. **permisos-api-health-check** (ALARM)
   - **Description**: Alert when API health endpoint fails
   - **Metric**: HealthCheckStatus (AWS/Route53)
   - **Threshold**: < 1.0
   - **Period**: 60 seconds
   - **SNS Topic**: arn:aws:sns:us-east-1:654722280275:permisos-digitales-alerts

2. **permisos-high-cpu** (OK)
   - **Description**: Alert when CPU exceeds 80%
   - **Metric**: CPUUtilization (AWS/EC2)
   - **Instance**: i-0a647b6136a31ff24
   - **Threshold**: > 80%
   - **Period**: 300 seconds

3. **permisos-instance-status-check** (OK)
   - **Description**: Alert when instance status check fails
   - **Metric**: StatusCheckFailed (AWS/EC2)
   - **Instance**: i-0a647b6136a31ff24
   - **Threshold**: >= 1.0
   - **Period**: 300 seconds

4. **permisos-rds-cpu-high**
   - **Description**: Alert when RDS CPU exceeds 75%
   - **Metric**: CPUUtilization (AWS/RDS)
   - **Threshold**: > 75%

## Summary

### Key Infrastructure Components
- **Region**: us-east-1
- **Account**: 654722280275
- **Main Domain**: permisosdigitales.com.mx
- **API Domain**: api.permisosdigitales.com.mx

### Architecture Overview
1. **Frontend**: CloudFront + S3 (static hosting)
2. **Backend**: EC2 instance behind ALB
3. **Database**: RDS PostgreSQL 17.4
4. **Cache**: ElastiCache Redis 7.1.0
5. **Email**: SES with SMTP user
6. **DNS**: Route53 with 2 hosted zones
7. **SSL**: ACM certificates for domains

### Security Highlights
- RDS encryption at rest enabled
- Redis transit encryption required
- S3 bucket encryption for files
- Multiple security groups with specific rules
- IAM roles and policies for least privilege

### Monitoring
- CloudWatch alarms for CPU, health checks
- Standard monitoring on all services
- SNS topic for alerts

### Important Notes
- EC2 instance health check currently failing
- No Secrets Manager or Parameter Store usage
- No auto-scaling configured
- Single EC2 instance (no redundancy)

---

Generated on: 2025-06-22
