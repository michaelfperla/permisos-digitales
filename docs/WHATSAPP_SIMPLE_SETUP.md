# Simple WhatsApp Bot Setup

## Overview

A simple, no-AI WhatsApp bot for Permisos Digitales that uses pattern matching to collect permit application data.

## How It Works

1. **Linear Flow**: Asks 9 questions in order
2. **Pattern Matching**: Uses regex to validate CURP/RFC, VIN, years
3. **Simple State**: Stores progress in Redis (current field index + collected data)
4. **No AI**: No OpenAI/GPT costs or complexity

## Environment Variables

```bash
# WhatsApp
WHATSAPP_PHONE_NUMBER_ID=your_phone_id
WHATSAPP_ACCESS_TOKEN=your_access_token
WHATSAPP_VERIFY_TOKEN=your_custom_verify_token
```

## Setup Steps

### 1. Meta/WhatsApp Configuration

1. Create app at developers.facebook.com
2. Add WhatsApp product
3. Get Phone Number ID and Access Token
4. Set webhook URL: `https://api.permisosdigitales.com.mx/api/whatsapp/webhook`
5. Set verify token (must match env variable)

### 2. Update Routes

In `src/routes/index.js`, change:
```javascript
const whatsappRoutes = require('./whatsapp-simple.routes');
// ...
router.use('/whatsapp', whatsappRoutes);
```

### 3. Database Migration (Optional)

If you want to track WhatsApp users:
```sql
ALTER TABLE users ADD COLUMN whatsapp_phone VARCHAR(20);
ALTER TABLE applications ADD COLUMN source VARCHAR(50) DEFAULT 'web';
ALTER TABLE applications ADD COLUMN source_metadata JSONB;
```

### 4. Test the Bot

Send to your WhatsApp number:
- `/permiso` - Start application
- Answer the 9 questions
- Confirm with "SI"
- Get payment link

## Conversation Example

```
User: /permiso
Bot: 🚗 ¡Bienvenido a Permisos Digitales!
     Te haré 9 preguntas para tu permiso.
     Costo: $150 MXN
     
     ¿Cuál es tu nombre completo?

User: Juan Pérez García
Bot: ✅ Guardado. ¿Cuál es tu CURP o RFC? (sin espacios ni guiones)

User: PEGA900101HDFRZN01
Bot: ✅ Guardado. ¿Cuál es tu domicilio completo?

User: Calle Flores 123, Col Centro, Guadalajara
Bot: ✅ Guardado. Ahora los datos del vehículo. ¿Cuál es la marca?

User: Toyota
Bot: ✅ Guardado. ¿Cuál es la línea o modelo?

User: Corolla
Bot: ✅ Guardado. ¿De qué color es?

User: Rojo
Bot: ✅ Guardado. ¿Cuál es el número de serie (VIN)? 17 caracteres

User: 1HGCM82633A123456
Bot: ✅ Guardado. ¿Cuál es el número de motor?

User: 4A123456
Bot: ✅ Guardado. ¿Cuál es el año del modelo?

User: 2020
Bot: 📋 **CONFIRMA TUS DATOS**
     [Shows all data]
     ¿Todo correcto? Responde SI o NO

User: SI
Bot: ⏳ Creando tu solicitud...
     ✅ ¡Solicitud creada!
     📱 Folio: 12345
     💳 Paga aquí: https://pay.stripe.com/xxx
```

## Pattern Validation

- **CURP/RFC**: `[A-Z]{3,4}[0-9]{6}[A-Z0-9]{3,8}`
- **VIN**: Exactly 17 alphanumeric characters
- **Year**: 4 digits between 1900-2025
- **Colors**: Matches common Spanish colors
- **Name**: Must have at least 2 words

## Error Handling

- Invalid input: Ask again with same prompt
- Commands always work (override current flow)
- State expires after 1 hour
- Network errors: Generic error message

## Monitoring

Check Redis for active conversations:
```bash
redis-cli KEYS "wa:*"
```

View conversation state:
```bash
redis-cli GET "wa:521234567890"
```

## Production Considerations

1. **Rate Limiting**: WhatsApp has strict limits
2. **Phone Number Format**: Always normalize to international format
3. **Message Length**: Keep under 1024 characters
4. **Response Time**: Must respond to webhook within 20 seconds
5. **Duplicate Messages**: Redis deduplication not implemented (keep simple)

## Costs

- **WhatsApp**: ~$0.005 USD per message sent
- **No AI costs**: No OpenAI/GPT charges
- **Redis**: Minimal (small state objects)
- **Compute**: Very low (no AI processing)

## Future Improvements (if needed)

1. Add voice message support (transcription)
2. Handle corrections better ("change color to blue")
3. Add progress indicator ("3 of 9 complete")
4. Support resuming interrupted applications
5. Add admin commands for support