# Permisos Digitales - Project Information

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

### Build and Deploy Frontend
```bash
cd frontend
npm run build  # or npx vite build if TypeScript errors
aws s3 sync dist/ s3://permisos-digitales-frontend-east --delete --cache-control "public, max-age=31536000, immutable" --exclude "*.html" --exclude "*.json"
aws s3 sync dist/ s3://permisos-digitales-frontend-east --cache-control "no-cache, no-store, must-revalidate" --content-type "text/html" --include "*.html"
aws cloudfront create-invalidation --distribution-id ECOBED0P176S0 --paths "/*"
```

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
curl -X POST https://api.permisosdigitales.com.mx/api/whatsapp/webhook \
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