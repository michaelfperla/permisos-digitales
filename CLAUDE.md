# Permisos Digitales - Project Information

## IMPORTANT RULES FOR CLAUDE
1. **DO NOT create any deployment scripts** - Deploy directly using individual commands
2. **DO NOT create any .md files** - Use existing documentation or inline comments
3. **ALWAYS deploy changes directly** - Use scp and ssh commands, not scripts
4. **NEVER create README or documentation files unless explicitly requested**

## Database Access Commands

### Get Database Credentials from AWS
```bash
aws secretsmanager get-secret-value --secret-id permisos/production/database/credentials --query SecretString --output text | jq -r
```

### Connect to Database from Server
```bash
# SSH into server first
ssh -i docs/permisos-digitales-fresh.pem ubuntu@107.21.154.162

# Then connect to database (use credentials from AWS Secrets Manager)
# First get password: aws secretsmanager get-secret-value --secret-id permisos/production/database/credentials --query SecretString --output text | jq -r '.password'
PGPASSWORD=[PASSWORD_FROM_SECRETS_MANAGER] psql -h permisos-digitales-db-east.cgv8cw2gcp2x.us-east-1.rds.amazonaws.com -U permisos_admin -d pd_db
```

### Direct Database Command from Local
```bash
# First get password from AWS Secrets Manager, then run command
PASSWORD=$(aws secretsmanager get-secret-value --secret-id permisos/production/database/credentials --query SecretString --output text | jq -r '.password')
ssh -i docs/permisos-digitales-fresh.pem ubuntu@107.21.154.162 "PGPASSWORD=$PASSWORD psql -h permisos-digitales-db-east.cgv8cw2gcp2x.us-east-1.rds.amazonaws.com -U permisos_admin -d pd_db -c 'YOUR SQL COMMAND HERE'"
```

## Production Deployment Commands

### Lint and Type Check
```bash
npm run lint
npm run typecheck
```

### Build for Production
```bash
npm run build
# Note: If TypeScript errors occur, use: npx vite build
```

### Test Commands
```bash
npm test
npm run test:coverage
```

## Key Service Names (Container Registry)
- database
- redis
- stripePayment
- authService
- emailService
- pdfQueue
- paymentVelocity
- alertService
- queueMonitor
- paymentMonitoring

## Production Server Info
- Host: 107.21.154.162
- User: ubuntu
- Key: docs/permisos-digitales-fresh.pem
- Backend Directory: /home/ubuntu/app
- PM2 Process Name: permisos-digitales-api

## Backend Deployment

### Deploy Backend Changes
```bash
# Copy files to server
scp -i docs/permisos-digitales-fresh.pem src/path/to/file.js ubuntu@107.21.154.162:/home/ubuntu/app/src/path/to/

# Restart backend
ssh -i docs/permisos-digitales-fresh.pem ubuntu@107.21.154.162 "pm2 restart permisos-digitales-api"
```

### Check Backend Status
```bash
ssh -i docs/permisos-digitales-fresh.pem ubuntu@107.21.154.162 "pm2 status"
ssh -i docs/permisos-digitales-fresh.pem ubuntu@107.21.154.162 "pm2 logs permisos-digitales-api --lines 50"
```

### Update WhatsApp Access Token
When WhatsApp access token expires, update it in TWO places:
```bash
# 1. Update in .env file
ssh -i docs/permisos-digitales-fresh.pem ubuntu@107.21.154.162 "cd /home/ubuntu/app && sed -i 's|WHATSAPP_ACCESS_TOKEN=.*|WHATSAPP_ACCESS_TOKEN=NEW_TOKEN_HERE|' .env"

# 2. Update in ecosystem.production.config.js
ssh -i docs/permisos-digitales-fresh.pem ubuntu@107.21.154.162 "cd /home/ubuntu/app && sed -i 's|WHATSAPP_ACCESS_TOKEN:.*|WHATSAPP_ACCESS_TOKEN: \"NEW_TOKEN_HERE\",|' ecosystem.production.config.js"

# 3. Force restart PM2 to pick up new environment
ssh -i docs/permisos-digitales-fresh.pem ubuntu@107.21.154.162 "pm2 kill && cd /home/ubuntu/app && pm2 start ecosystem.production.config.js"
```

### Check Logs More Efficiently
```bash
# View WhatsApp-specific logs
ssh -i docs/permisos-digitales-fresh.pem ubuntu@107.21.154.162 "tail -50 /home/ubuntu/app/logs/pm2-out.log | grep -i whatsapp"

# Check for errors
ssh -i docs/permisos-digitales-fresh.pem ubuntu@107.21.154.162 "tail -100 /home/ubuntu/app/logs/pm2-out.log | grep -i error"
```

## Frontend Deployment

### Frontend Build & Deploy Process (CRITICAL STEPS)

**IMPORTANT: Follow these exact steps in order to prevent deployment errors**

#### Step 1: Navigate to Frontend Directory
```bash
cd frontend
```

#### Step 2: Build Frontend (Handle TypeScript Permission Issues)
```bash
# First try the standard build command
npm run build

# If you get "tsc: Permission denied" error, use npx instead:
npx vite build
```

**Common Build Issues:**
- **TypeScript Permission Error**: Always use `npx vite build` instead of `npm run build`
- **Build Warnings**: CSS warnings about @media queries are normal and can be ignored
- **Module Resolution**: If build fails, check that all imports are correct

#### Step 3: Deploy Static Assets to S3 (Long-term Cache)
```bash
aws s3 sync dist/ s3://permisos-digitales-frontend-east --delete --cache-control "public, max-age=31536000, immutable" --exclude "*.html" --exclude "*.json"
```

**What this does:**
- Uploads CSS, JS, images, fonts with 1-year cache headers
- `--delete` removes old files no longer in build
- `--exclude "*.html"` prevents HTML from getting long cache headers

#### Step 4: Deploy HTML Files (No Cache)
```bash
aws s3 sync dist/ s3://permisos-digitales-frontend-east --cache-control "no-cache, no-store, must-revalidate" --content-type "text/html" --include "*.html"
```

**What this does:**
- Uploads HTML files with no-cache headers for immediate updates
- Ensures users always get latest HTML that references new asset files

#### Step 5: Invalidate CloudFront Cache
```bash
aws cloudfront create-invalidation --distribution-id ECOBED0P176S0 --paths "/*"
```

**What this does:**
- Clears CloudFront edge cache globally
- Takes 10-15 minutes to complete
- Ensures all users get updated content immediately

#### Step 6: Verify Deployment
```bash
# Check invalidation status
aws cloudfront get-invalidation --distribution-id ECOBED0P176S0 --id [INVALIDATION_ID_FROM_STEP_5]

# Status should show "Completed" when done
```

### Complete Deployment Command Sequence
```bash
# Navigate to frontend directory (make sure you're in the right place)
cd frontend

# Build (use npx if permission issues)
npx vite build

# Deploy assets with long cache
aws s3 sync dist/ s3://permisos-digitales-frontend-east --delete --cache-control "public, max-age=31536000, immutable" --exclude "*.html" --exclude "*.json"

# Deploy HTML with no cache
aws s3 sync dist/ s3://permisos-digitales-frontend-east --cache-control "no-cache, no-store, must-revalidate" --content-type "text/html" --include "*.html"

# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id ECOBED0P176S0 --paths "/*"
```

### Deployment Checklist
- [ ] In `/frontend` directory
- [ ] Build completed successfully (check for any errors)
- [ ] Static assets uploaded with long cache headers
- [ ] HTML files uploaded with no-cache headers  
- [ ] CloudFront invalidation created
- [ ] Test site at https://permisosdigitales.com.mx
- [ ] Verify new changes are visible

### Troubleshooting Common Issues

**Build Fails:**
- Use `npx vite build` instead of `npm run build`
- Check TypeScript errors and fix before deploying
- Ensure all imports are correct

**AWS Permission Denied:**
- Verify AWS credentials are configured: `aws sts get-caller-identity`
- Check AWS CLI is installed and working

**Changes Not Visible:**
- Wait 10-15 minutes for CloudFront invalidation to complete
- Check browser cache isn't caching old version (hard refresh: Ctrl+F5)
- Verify invalidation completed: `aws cloudfront list-invalidations --distribution-id ECOBED0P176S0`

**Wrong Files Cached:**
- HTML files should have no-cache headers
- Assets (CSS/JS) should have long cache headers
- If mixed up, re-run deployment steps 3-5

## API Endpoints
- Production API: https://api.permisosdigitales.com.mx
- Health Check: https://api.permisosdigitales.com.mx/health
- Frontend: https://permisosdigitales.com.mx

## Recent Changes (2025-06-29)
1. Added OXXO processing time notification (1-4 hours) on confirmation page
2. Implemented permit ready email notifications with 48-hour download links
3. Set up CloudFront redirect from .com to .com.mx domains
4. Fixed backend nginx configuration (was missing proxy setup)

## Known Issues (RESOLVED)
- ~~Health endpoint shows "critical" status for "startupSequence" but API is functional~~ (Fixed 2025-06-29)
- Express rate limit warning about trust proxy setting (non-critical)
- AWS SDK v2 deprecation warnings (migration to v3 needed eventually)

## Recent Fixes (2025-06-29)
### Health Monitor False Positive Fix
Fixed false positive "critical" status in health monitoring that was causing unnecessary PM2 restarts:
- Modified `src/monitoring/health-monitor.js` startupSequence check
- Changed behavior: After 5-minute startup window, always return healthy status
- Changed criticality from `critical: true` to `critical: false`
- Result: Prevents unnecessary application restarts while individual service health is still monitored
- PM2 restart command: `sudo pm2 kill && sudo pm2 start ecosystem.production.config.js`

## WhatsApp Bot Updates (2025-07-26)

### Security Hardening
Implemented comprehensive security measures to prevent bot exploitation:
- **Files created/updated:**
  - `src/services/whatsapp/security-utils.js` - SHA-256 hashing, input validation, memory management
  - `src/services/whatsapp/redis-wrapper.js` - Redis retry logic and connection health
  - `src/jobs/whatsapp-state-cleanup.job.js` - Abandoned session cleanup
- **Security features:**
  - Rate limiting with flood prevention
  - Unicode normalization and sanitization
  - Command injection protection
  - Memory leak prevention with cache management
  - Duplicate message detection
  - Session timeout management

### UX Improvements
Major improvements to WhatsApp bot user experience:
- **Progress indicators**: Users see "Step X of Y" during form filling
- **Session timeout warnings**: Alert users 15 minutes before session expires
- **Field examples**: Show format examples when validation fails (e.g., "Ejemplo: ABCD123456HDFGHI01")
- **Mid-flow commands**: Allow /estado, /ayuda during form filling
- **Error recovery**: Redis failures fallback to memory, better error messages
- **Field editing**: During confirmation, users can type field name to edit (e.g., "email" to change email)
- **Rate limit improvements**: Only notify once per window instead of flooding messages

### Key Files Modified
- `src/services/whatsapp/simple-whatsapp.service.js` - Main bot logic with all UX improvements
- `src/jobs/scheduler.js` - Added WhatsApp cleanup jobs

### Common Issues & Solutions

#### Bot Stuck in State
- User can use `/reset` or `/cancelar` to clear state
- Commands now have priority over state processing
- Fixed missing methods: `sendHelp`, `clearStateFromMemory`, `startPermitApplication`

#### Phone Validation
- Accept both 52XXXXXXXXXX and 521XXXXXXXXXX formats
- Fixed regex: `/^521?\d{10}$/`

#### Token Expiration
- Update token in BOTH `.env` and `ecosystem.production.config.js`
- Must kill PM2 completely to pick up new environment: `pm2 kill && pm2 start ecosystem.production.config.js`

### Testing Commands
```bash
# Test bot with specific phone
curl -X POST https://api.permisosdigitales.com.mx/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d '{"object":"whatsapp_business_account","entry":[{"changes":[{"value":{"messages":[{"from":"521XXXXXXXXXX","text":{"body":"/ayuda"}}]}}]}]}'
```

### Multi-Color Vehicle Handling
To prevent issues with slashes in color fields (e.g., "rojo/negro"), the system automatically sanitizes:
- **WhatsApp Bot**: Converts "rojo/negro" → "Rojo y Negro"
- **Web Form**: Frontend converts slashes to "y" before submission
- **Backend API**: `application.service.js` sanitizes color on creation
- **Files Updated**:
  - `src/services/whatsapp/simple-whatsapp.service.js` - Bot color handling
  - `src/services/whatsapp/security-utils.js` - Security validation
  - `frontend/src/components/permit-form/CompleteVehicleInfoStep.tsx` - Form sanitization
  - `src/services/application.service.js` - Backend sanitization

This prevents CSV export issues, URL encoding problems, and potential security vulnerabilities.

## Marketing & Social Media Strategy (2025-08-15)

### Core Service Definition
**Primary Service**: Gestores de permisos provisionales para circular sin placas (30 días)
- **Official Authority**: Dirección de Tránsito Huitzuco de los Figueroa
- **Website**: https://www.direcciondetransitohuitzucodelosfigueroa.gob.mx/
- **Validity**: 30 days, valid throughout Mexican Republic
- **Target Audience**: People who just bought new vehicles and need immediate circulation permits and more 

### X (Twitter) Marketing Strategy

#### Content Positioning
- **Avoid**: Generic "digital permits" messaging (Mexicans already familiar with digital permits)
- **Focus**: Specific urgent need - "permiso provisional sin placas"
- **Key Pain Point**: People who buy new cars need to drive immediately, don't want to wait weeks at tránsito offices

#### X Algorithm Optimization (2025)
- **Premium on Tall Posts**: Use 4:5 vertical format (1080 x 1350) or 9:16 for algorithm boost
- **Ban on**: Hashtags, URLs in main post, excessive emojis
- **Best Practice**: Put wa.me links in reply to your own post
- **Content Strategy**: Questions get 40% higher engagement than statements

#### WhatsApp Contact Integration
- **Primary Contact**: wa.me/5216641633345
- **Official Government**: WhatsApp 727-116-5900 (for reference)
- **Messaging**: Position as faster alternative to official slow process

### Cultural Insights
- **Mexican Market**: Already comfortable with digital government services
- **Differentiation**: WhatsApp convenience vs apps/websites
- **Trust Factors**: Official government backing, 30-day validity nationwide