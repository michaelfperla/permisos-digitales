# WhatsApp Bot Deployment Checklist

## 1. Environment Variables
Add to production `.env`:
```bash
# WhatsApp Configuration
WHATSAPP_API_VERSION=v17.0
WHATSAPP_PHONE_NUMBER_ID=699741636556298
WHATSAPP_BUSINESS_ACCOUNT_ID=1027835752788113
WHATSAPP_VERIFY_TOKEN=permisos_digitales_whatsapp_2024
WHATSAPP_ACCESS_TOKEN=EAASmgvBGI4cBPIb7AatXykuGh4El6ZAMRTaFlrw9hvLZBKEInNYq21g76ErAtAFCKZBDWZCH3kLJQKwyWt29QChDZB9kOOtUs6CLhMezqd5ZCSbs4CDu0cJDXYCGF4jzhuBB9RIC9swnO1x2ulNFhfokiRTymrOCmjZBTCYaRzK6JdwB4nmazWjAZCOfZBYleOAZDZD
WHATSAPP_APP_SECRET=931f3a64a33745f2528e00fdf24124c3
```

## 2. Deploy Code
```bash
# Copy WhatsApp files to server
scp -i docs/permisos-digitales-fresh.pem -r src/services/whatsapp ubuntu@107.21.154.162:/home/ubuntu/app/src/services/
scp -i docs/permisos-digitales-fresh.pem src/controllers/whatsapp-simple.controller.js ubuntu@107.21.154.162:/home/ubuntu/app/src/controllers/
scp -i docs/permisos-digitales-fresh.pem src/routes/whatsapp-simple.routes.js ubuntu@107.21.154.162:/home/ubuntu/app/src/routes/

# Update routes/index.js on server to include:
# const whatsappRoutes = require('./whatsapp-simple.routes');
# router.use('/whatsapp', whatsappRoutes);
```

## 3. Database Migration (Optional)
```bash
# SSH to server
ssh -i docs/permisos-digitales-fresh.pem ubuntu@107.21.154.162

# Run migration to add WhatsApp fields
cd /home/ubuntu/app
npx node-pg-migrate up
```

## 4. Restart Server
```bash
pm2 restart permisos-api
pm2 logs permisos-api --lines 50
```

## 5. Configure WhatsApp Dashboard

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Select your app
3. Go to **WhatsApp > Configuration**
4. Set:
   - **Callback URL**: `https://api.permisosdigitales.com.mx/api/whatsapp/webhook`
   - **Verify token**: `permisos_digitales_whatsapp_2024`
5. Click **Verify and save**
6. Subscribe to webhook fields:
   - ✅ messages
   - ✅ message_status (optional)

## 6. Test Webhook Verification
```bash
# From your local machine
curl -X GET "https://api.permisosdigitales.com.mx/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=permisos_digitales_whatsapp_2024&hub.challenge=test123"

# Should return: test123
```

## 7. Test Bot
1. Send "Hola" to your WhatsApp Business number
2. Send "/permiso" to start application flow
3. Complete all 9 fields
4. Verify payment link is generated

## 8. Monitor Logs
```bash
# Watch for WhatsApp messages
pm2 logs permisos-api | grep -i whatsapp
```

## 9. Update Payment Webhook
In your payment confirmation handler, add:
```javascript
// When payment is confirmed
if (application.source === 'whatsapp' && application.source_metadata?.phone_number) {
  await axios.post(
    'https://api.permisosdigitales.com.mx/api/whatsapp/payment-confirmed',
    {
      applicationId: application.id,
      phoneNumber: application.source_metadata.phone_number
    },
    {
      headers: { 'Authorization': `Bearer ${systemToken}` }
    }
  );
}
```

## 10. Update Permit Ready Handler
When permit PDF is generated:
```javascript
// When permit is ready
if (application.source === 'whatsapp' && application.source_metadata?.phone_number) {
  await axios.post(
    'https://api.permisosdigitales.com.mx/api/whatsapp/permit-ready',
    {
      applicationId: application.id,
      permitUrl: signedS3Url,
      phoneNumber: application.source_metadata.phone_number
    },
    {
      headers: { 'Authorization': `Bearer ${systemToken}` }
    }
  );
}
```

## Common Issues

### Webhook not receiving messages
- Check callback URL is correct
- Verify token matches exactly
- Ensure port 443 is open
- Check SSL certificate is valid

### Messages not sending
- Verify access token is valid
- Check phone number format (international)
- Ensure WhatsApp number is verified

### Bot not responding
- Check Redis is running
- Check pm2 logs for errors
- Verify environment variables are loaded

## Testing Commands
- `/permiso` - Start new application
- `/ayuda` - Get help
- `/cancelar` - Cancel current application

## Production Notes
- Access token may expire - get permanent token from System User
- Monitor WhatsApp API rate limits (80 messages/second)
- Keep messages under 1024 characters
- Respond to webhooks within 20 seconds