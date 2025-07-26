# Server Startup Guide - Bulletproof Production Setup

## Quick Start (Emergency)

If a customer has paid and needs their PDF immediately:

```bash
# Run the emergency start script
./scripts/emergency-start.sh
```

This will start the server with minimal checks and get it running as quickly as possible.

## Normal Startup Process

### 1. Verify Requirements

```bash
# Run the verification script
node scripts/verify-startup.js
```

This checks:
- Node.js version (>= 18.12.0)
- Environment files
- Critical npm packages
- Redis connection
- Database connection
- Required directories
- PM2 installation

### 2. Test Redis Connection

```bash
# Test Redis independently
node scripts/test-redis-connection.js
```

### 3. Start the Server

#### Development
```bash
npm run dev
```

#### Production with PM2
```bash
# Start
npm run pm2:start:prod

# View logs
npm run pm2:logs

# Monitor
npm run pm2:monit

# Restart
npm run pm2:restart:prod

# Stop
npm run pm2:stop
```

#### Direct Node.js (fallback)
```bash
NODE_ENV=production node --require ./scripts/load-env.js src/server.js
```

## Key Features of the Bulletproof Server

### 1. Redis Session Store with Fallback
- Primary: Redis with connect-redis v9.0.0
- Fallback: In-memory session store (memorystore)
- Automatic fallback if Redis fails

### 2. Comprehensive Error Handling
- Graceful error messages
- No crashes on module loading failures
- Fallback options for non-critical services

### 3. Production-Ready Configuration
- SSL/TLS support for AWS services
- Proper session security
- CSRF protection
- Rate limiting
- Helmet security headers

### 4. Graceful Shutdown
- Handles SIGTERM, SIGINT, SIGUSR2
- Closes all connections properly
- 10-second force shutdown timeout

### 5. Critical Service Priority
- Database connection verified first
- Stripe webhooks configured early
- PDF generation services started
- Queue monitors initialized

## Troubleshooting

### "RedisStore is not a constructor"
**Fixed**: The new server.js uses the correct import syntax for connect-redis v9:
```javascript
const RedisStore = require('connect-redis').default;
```

### PostgreSQL Session Store Hanging
**Fixed**: Switched to Redis sessions with proper error handling and fallback.

### Server Won't Start
1. Check logs: `pm2 logs permisos-backend --err`
2. Run verification: `node scripts/verify-startup.js`
3. Use emergency start: `./scripts/emergency-start.sh`

### Redis Connection Failed
The server will automatically fall back to in-memory sessions and continue running.

### Environment Variables Not Loading
Check:
1. `.env` or `.env.production` file exists
2. PM2 is using the correct environment
3. Run: `NODE_ENV=production node scripts/test-env-loading.js`

## Important Files

- `/src/server.js` - Main server file (bulletproof version)
- `/scripts/emergency-start.sh` - Quick start for emergencies
- `/scripts/verify-startup.js` - Pre-flight checks
- `/scripts/test-redis-connection.js` - Redis connection tester
- `/ecosystem.config.js` - PM2 configuration

## Production Checklist

- [ ] Node.js 18+ installed
- [ ] PM2 installed globally
- [ ] `.env.production` configured
- [ ] Redis accessible (AWS ElastiCache)
- [ ] PostgreSQL accessible (AWS RDS)
- [ ] SSL certificates valid
- [ ] Ports 3001 open
- [ ] Logs directory writable

## AWS-Specific Configuration

The server is configured for AWS services:
- **ElastiCache**: TLS enabled, rejectUnauthorized: false
- **RDS**: SSL connections supported
- **EC2**: Trust proxy enabled
- **S3**: Configured for permit storage

## Emergency Contact

If the server crashes and a customer is waiting:
1. Run `./scripts/emergency-start.sh`
2. Check `/health` endpoint
3. Monitor logs: `pm2 logs --lines 100`
4. Check Redis: `node scripts/test-redis-connection.js`
5. Verify database: `node scripts/verify-startup.js`