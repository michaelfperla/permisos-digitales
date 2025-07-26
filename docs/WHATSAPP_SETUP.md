# WhatsApp Bot Setup Guide for Permisos Digitales

## Overview

This guide explains how to set up and configure the WhatsApp integration for Permisos Digitales, allowing customers to apply for vehicle permits through WhatsApp conversations.

## Architecture

The WhatsApp bot is built directly into the Permisos Digitales Node.js backend with the following components:

1. **WhatsApp Client Service** - Handles Meta WhatsApp Business API communication
2. **Conversation Manager** - Manages conversation state using Redis
3. **AI Processor** - Uses OpenAI/GPT-4 for natural language understanding
4. **Permit Conversation Service** - Orchestrates the permit application flow

## Prerequisites

1. **WhatsApp Business Account** with Meta
2. **WhatsApp Business API Access** (Cloud API)
3. **OpenAI API Key** for AI processing
4. **Redis** installed and running
5. **Verified Phone Number** for WhatsApp Business

## Environment Variables

Add these to your `.env` file:

```bash
# WhatsApp Configuration
WHATSAPP_API_VERSION=v17.0
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_ACCESS_TOKEN=your_permanent_access_token
WHATSAPP_VERIFY_TOKEN=your_custom_verify_token
WHATSAPP_APP_SECRET=your_app_secret

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key
AI_MODEL=gpt-4-turbo-preview

# Optional: Override default Redis settings
REDIS_URL=redis://localhost:6379
```

## Setup Steps

### 1. Meta Business Setup

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Create a new app or use existing one
3. Add WhatsApp product to your app
4. Get your Phone Number ID and temporary access token
5. Generate a permanent access token

### 2. Configure Webhook

1. In your Meta app dashboard, go to WhatsApp > Configuration
2. Set webhook URL: `https://api.permisosdigitales.com.mx/api/whatsapp/webhook`
3. Set verify token to match `WHATSAPP_VERIFY_TOKEN` in your .env
4. Subscribe to webhook fields:
   - `messages`
   - `message_template_status_update`

### 3. Phone Number Verification

1. Add and verify your WhatsApp Business phone number
2. Create a display name for your business
3. Complete business verification (if required)

### 4. Update Application Routes

In `src/routes/index.js`, add the WhatsApp routes:

```javascript
const whatsappRoutes = require('./whatsapp.routes');

// Add this line with other route definitions
router.use('/whatsapp', whatsappRoutes);
```

### 5. Install Required Dependencies

```bash
npm install openai
```

### 6. Update Payment Webhook

In your payment confirmation handler, add WhatsApp notification:

```javascript
// In payment webhook handler
if (application.source === 'whatsapp') {
  await axios.post(
    `${process.env.API_URL}/api/whatsapp/webhook/payment-confirmed`,
    {
      applicationId: application.id,
      paymentStatus: 'succeeded'
    },
    {
      headers: {
        'Authorization': `Bearer ${systemToken}`
      }
    }
  );
}
```

### 7. Update Permit Generation

In your permit generation completion handler:

```javascript
// When permit is ready
if (application.source === 'whatsapp') {
  await axios.post(
    `${process.env.API_URL}/api/whatsapp/webhook/permit-ready`,
    {
      applicationId: application.id,
      permitUrl: signedUrl
    },
    {
      headers: {
        'Authorization': `Bearer ${systemToken}`
      }
    }
  );
}
```

## Testing

### 1. Webhook Verification

Test the webhook verification:
```bash
curl -X GET "https://api.permisosdigitales.com.mx/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=your_verify_token&hub.challenge=test_challenge"
```

### 2. Send Test Message

Use the admin endpoint to send a test message:
```bash
curl -X POST https://api.permisosdigitales.com.mx/api/whatsapp/send-test \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "521234567890",
    "message": "Hola! Esta es una prueba del bot de Permisos Digitales."
  }'
```

### 3. Test Conversation Flow

Send these messages to your WhatsApp Business number:
1. `/permiso` - Start new application
2. Provide personal information when prompted
3. Provide vehicle information when prompted
4. Confirm details
5. Complete payment
6. Receive permit

## Production Deployment

### 1. Security Considerations

- Enable webhook signature validation in production
- Use permanent access tokens (not temporary)
- Implement rate limiting per phone number
- Set up monitoring for failed messages

### 2. Monitoring

Monitor these metrics:
- Message delivery rates
- Conversation completion rates
- Payment conversion rates
- Error rates by type

### 3. Scaling Considerations

- Redis connection pooling
- Implement message queue for async processing
- Consider read replicas for high volume

## Common Issues

### Issue: Webhook not receiving messages
- Verify webhook URL is publicly accessible
- Check webhook subscriptions in Meta dashboard
- Ensure verify token matches

### Issue: Messages not sending
- Check access token validity
- Verify phone number is registered and active
- Check rate limits

### Issue: AI extraction errors
- Monitor OpenAI API limits
- Implement fallback patterns
- Log failed extractions for analysis

## User Commands

The bot supports these commands:
- `/permiso` - Start new permit application
- `/ayuda` - Get help and FAQ
- `/estado` - Check application status
- `/cancelar` - Cancel current application
- `/reiniciar` - Start over

## Conversation Flow

1. **Welcome** → User sends `/permiso`
2. **Personal Info Collection**
   - Full name
   - CURP/RFC
   - Address
3. **Vehicle Info Collection**
   - Brand (marca)
   - Model (linea)
   - Color
   - VIN (numero_serie)
   - Engine number (numero_motor)
   - Year (ano_modelo)
4. **Confirmation** → Review all details
5. **Payment** → Stripe payment link
6. **Processing** → Generate permit
7. **Delivery** → Send PDF via WhatsApp

## Support

For issues or questions:
- Check Meta Business Support
- Review WhatsApp Business API documentation
- Contact technical support team