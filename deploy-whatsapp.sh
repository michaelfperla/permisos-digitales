#!/bin/bash

echo "=== Deploying WhatsApp Service to Production ==="

# Check if key exists
if [ ! -f "docs/permisos-digitales-fresh.pem" ]; then
    echo "Error: SSH key not found at docs/permisos-digitales-fresh.pem"
    exit 1
fi

# Create WhatsApp directory on server if it doesn't exist
echo "Creating WhatsApp service directory..."
ssh -i docs/permisos-digitales-fresh.pem ubuntu@107.21.154.162 "mkdir -p /home/ubuntu/app/src/services/whatsapp"

# Copy WhatsApp service files
echo "Copying WhatsApp services..."
scp -i docs/permisos-digitales-fresh.pem src/services/whatsapp/*.js ubuntu@107.21.154.162:/home/ubuntu/app/src/services/whatsapp/

# Copy WhatsApp controllers
echo "Copying WhatsApp controllers..."
scp -i docs/permisos-digitales-fresh.pem src/controllers/whatsapp*.js ubuntu@107.21.154.162:/home/ubuntu/app/src/controllers/

# Copy WhatsApp routes
echo "Copying WhatsApp routes..."
scp -i docs/permisos-digitales-fresh.pem src/routes/whatsapp*.js ubuntu@107.21.154.162:/home/ubuntu/app/src/routes/

# Copy updated routes index (to ensure WhatsApp routes are registered)
echo "Copying routes index..."
scp -i docs/permisos-digitales-fresh.pem src/routes/index.js ubuntu@107.21.154.162:/home/ubuntu/app/src/routes/

echo ""
echo "=== Files deployed successfully ==="
echo ""
echo "Now you need to add WhatsApp configuration to the server."
echo ""
echo "1. SSH into the server:"
echo "   ssh -i docs/permisos-digitales-fresh.pem ubuntu@107.21.154.162"
echo ""
echo "2. Add these lines to /home/ubuntu/app/.env:"
echo ""
cat << 'EOF'
# WhatsApp Configuration
WHATSAPP_API_VERSION=v17.0
WHATSAPP_PHONE_NUMBER_ID=699741636556298
WHATSAPP_BUSINESS_ACCOUNT_ID=1027835752788113
WHATSAPP_VERIFY_TOKEN=permisos_digitales_whatsapp_2024
WHATSAPP_ACCESS_TOKEN=EAASmgvBGI4cBPIb7AatXykuGh4El6ZAMRTaFlrw9hvLZBKEInNYq21g76ErAtAFCKZBDWZCH3kLJQKwyWt29QChDZB9kOOtUs6CLhMezqd5ZCSbs4CDu0cJDXYCGF4jzhuBB9RIC9swnO1x2ulNFhfokiRTymrOCmjZBTCYaRzK6JdwB4nmazWjAZCOfZBYleOAZDZD
WHATSAPP_APP_SECRET=931f3a64a33745f2528e00fdf24124c3
EOF
echo ""
echo "3. Restart the application:"
echo "   cd /home/ubuntu/app && pm2 restart permisos-api"
echo ""
echo "4. Check logs to verify startup:"
echo "   pm2 logs permisos-api --lines 50"
echo ""
echo "5. Configure webhook in WhatsApp Business Platform:"
echo "   Webhook URL: https://api.permisosdigitales.com.mx/api/whatsapp/webhook"
echo "   Verify Token: permisos_digitales_whatsapp_2024"
echo "   Subscribe to: messages"
echo ""
echo "6. Test by sending a message to your WhatsApp Business number with:"
echo "   /permiso"