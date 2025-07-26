# How to Integrate AWS Secrets Manager into Your Server

Since you're refactoring your server, here's how to add secrets management without creating a whole new server file.

## Step 1: Add to Your Server Startup

```javascript
// In your main server file (e.g., src/server.js)

const { initializeSecrets, getDatabaseConfig, getRedisConfig } = require('./startup/secrets-initializer');

async function startServer() {
  try {
    // 1. Load secrets first (before anything else)
    if (process.env.USE_SECRETS_MANAGER !== 'false') {
      await initializeSecrets();
    }
    
    // 2. Initialize database with secrets
    const dbConfig = process.env.USE_SECRETS_MANAGER !== 'false' 
      ? getDatabaseConfig() 
      : require('./config/database'); // fallback to old config
    
    const db = await initializeDatabase(dbConfig);
    
    // 3. Initialize Redis with secrets
    const redisConfig = process.env.USE_SECRETS_MANAGER !== 'false'
      ? getRedisConfig()
      : require('./config/redis'); // fallback to old config
      
    await redisClient.initialize(redisConfig);
    
    // 4. Continue with rest of your server setup...
    const app = express();
    // ... your existing server code
  } catch (error) {
    console.error('Server startup failed:', error);
    process.exit(1);
  }
}
```

## Step 2: Update Service Initializations

### For Stripe:
```javascript
// In your payment service or controller
const { getStripeConfig } = require('../startup/secrets-initializer');

function initializeStripe() {
  const config = getStripeConfig();
  return require('stripe')(config.privateKey);
}
```

### For Email:
```javascript
// In your email service
const { getEmailConfig } = require('../startup/secrets-initializer');

function createTransporter() {
  const config = getEmailConfig();
  return nodemailer.createTransport({
    host: config.host || 'email-smtp.us-east-1.amazonaws.com',
    port: config.port || 587,
    auth: {
      user: config.auth.user,
      pass: config.auth.pass
    }
  });
}
```

### For Sessions:
```javascript
// In your session middleware setup
const { getSecurityConfig } = require('../startup/secrets-initializer');

const securityConfig = getSecurityConfig();

app.use(session({
  secret: securityConfig.sessionSecret,
  // ... rest of session config
}));
```

## Step 3: Environment Variable for Toggle

Add this to your `.env` for easy switching:

```bash
# Use AWS Secrets Manager (set to false to use env vars)
USE_SECRETS_MANAGER=true
```

## Step 4: Update PM2 Configuration

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'permisos-api',
    script: './src/server.js', // Your existing server file
    env: {
      NODE_ENV: 'production',
      USE_SECRETS_MANAGER: 'true',
      AWS_REGION: 'us-east-1',
      // Only non-sensitive config here
    }
  }]
};
```

## Benefits of This Approach

1. **No duplicate server files** - Integrate into your existing server
2. **Easy toggle** - Switch between secrets and env vars with one setting
3. **Gradual migration** - Test with some services before going all-in
4. **Fallback support** - Can fall back to env vars if needed

## Testing

```bash
# Test with secrets
USE_SECRETS_MANAGER=true npm start

# Test with env vars (old way)
USE_SECRETS_MANAGER=false npm start
```