# WhatsApp Webhook Security Setup

## Critical Security Update: Webhook Signature Validation

### Overview
Webhook signature validation has been implemented to prevent unauthorized webhook calls to our WhatsApp integration. This is a **CRITICAL SECURITY REQUIREMENT** for production.

### Setup Instructions

#### 1. Obtain Your WhatsApp App Secret

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Navigate to your WhatsApp Business App
3. Go to Settings > Basic
4. Find your **App Secret** (NOT the Access Token)
5. Copy the App Secret value

#### 2. Configure Production Environment

SSH into the production server and update BOTH configuration files:

```bash
# Connect to server
ssh -i docs/permisos-digitales-fresh.pem ubuntu@107.21.154.162

# Navigate to app directory
cd /home/ubuntu/app

# Add to .env file
echo "WHATSAPP_APP_SECRET=your_app_secret_here" >> .env

# Update ecosystem.production.config.js
nano ecosystem.production.config.js
```

In `ecosystem.production.config.js`, add the App Secret to the env section:
```javascript
env: {
  // ... existing variables ...
  WHATSAPP_APP_SECRET: "your_app_secret_here",
}
```

#### 3. Restart the Application

```bash
# Kill PM2 completely to ensure environment variables are reloaded
pm2 kill

# Start with new configuration
pm2 start ecosystem.production.config.js

# Verify the app is running
pm2 status

# Check logs for any errors
pm2 logs permisos-digitales-api --lines 50
```

### Testing Webhook Security

#### Valid Webhook Test
Once configured, Meta will automatically sign all webhooks. You can verify this in the logs:
```
WhatsApp webhook signature validated successfully
```

#### Invalid Webhook Test
Unauthorized webhook attempts will be rejected with a 401 status:
```
Invalid WhatsApp webhook signature
```

### Troubleshooting

#### Common Issues

1. **"WHATSAPP_APP_SECRET not configured" error**
   - Ensure the environment variable is set in BOTH .env and ecosystem.production.config.js
   - Make sure to use `pm2 kill` before restarting

2. **All webhooks failing with "Invalid signature"**
   - Verify you're using the App Secret, NOT the Access Token
   - Check that the App Secret is correctly copied (no extra spaces)
   - Ensure the webhook URL in Meta matches exactly

3. **Webhook body parsing issues**
   - The application now captures raw body for signature validation
   - Do not modify the request body before validation

### Security Implications

Without webhook signature validation:
- ❌ Anyone can send fake webhook requests
- ❌ Potential for spam or malicious messages
- ❌ No guarantee messages are from WhatsApp

With webhook signature validation:
- ✅ Only Meta can send valid webhooks
- ✅ Protection against replay attacks
- ✅ Compliance with Meta security requirements

### Monitoring

Monitor webhook validation in production:
```bash
# Check for validation successes
pm2 logs permisos-digitales-api | grep "signature validated successfully"

# Check for validation failures
pm2 logs permisos-digitales-api | grep "Invalid WhatsApp webhook signature"
```

### Next Steps

After enabling webhook security:
1. Monitor logs for 24 hours to ensure no legitimate webhooks are rejected
2. Set up alerts for repeated validation failures (potential attack)
3. Document the App Secret in your secure credentials storage