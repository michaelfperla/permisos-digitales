# WhatsApp Business Cloud API Complete Setup Manual

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Phone Number Setup](#phone-number-setup)
3. [Token Generation](#token-generation)
4. [Phone Registration](#phone-registration)
5. [Business Name Verification & Certificate Association](#business-name-verification)
6. [Webhook Configuration](#webhook-configuration)
7. [Production Deployment](#production-deployment)
8. [Testing & Validation](#testing-validation)
9. [Common Errors & Solutions](#common-errors)

---

## 1. Prerequisites

### Required Accounts
- Meta Business Account (verified)
- Facebook Developer Account
- Facebook App created with WhatsApp product added

### Required Information
```bash
# You'll need these from Meta Developer Dashboard
APP_ID="1308981213930375"
APP_SECRET="931f3a64a33745f2528e00fdf24124c3"
```

---

## 2. Phone Number Setup

### Step 1: Add Phone Number to WhatsApp Business Account

1. Go to: https://business.facebook.com/wa/manage/phone-numbers/
2. Click **"Add Phone Number"**
3. Enter phone number (e.g., +52 1 664 163 3345)
4. Select verification method (SMS or Voice)
5. Enter verification code
6. Wait for "Display Name Approval" (1-24 hours)

### Step 2: Get Phone Number Details

Once approved, the phone status changes from "Pending" to "Connected". You'll get:
- **Phone Number ID**: `662001287007491`
- **WhatsApp Business Account ID**: `730341602968484`

⚠️ **Important**: If you see "Download Certificate" or "Phone number registration required"
- **This is NOT an error** - certificates are still used for business name changes in Cloud API
- **See Section 5** for certificate association procedures

---

## 3. Token Generation

### Step 1: Generate Temporary Token (For Testing)

1. Go to: https://developers.facebook.com/tools/explorer/
2. Select your app: "Permisos Digitales"
3. Add permissions:
   - `whatsapp_business_management`
   - `whatsapp_business_messaging`
4. Click "Generate Access Token"

### Step 2: Create Permanent System User Token (For Production)

1. Go to: https://business.facebook.com/settings
2. Navigate to **Users → System Users**
3. Click **Add → Create System User**
4. Name: "WhatsApp API Bot", Role: **Admin**
5. Click on System User → **Add Assets**:
   - Apps → Select "Permisos Digitales" → Full Control
   - WhatsApp Accounts → Select your WABA → Full Control
6. Click **Generate Token**:
   - Select app: "Permisos Digitales"
   - Add permissions:
     - `whatsapp_business_messaging`
     - `whatsapp_business_management`
   - Generate and **SAVE TOKEN**

### Step 3: Verify Token Permissions

```bash
# Check token details
ACCESS_TOKEN="YOUR_TOKEN_HERE"
APP_ID="1308981213930375"
APP_SECRET="931f3a64a33745f2528e00fdf24124c3"

curl -s "https://graph.facebook.com/v21.0/debug_token?input_token=$ACCESS_TOKEN&access_token=$APP_ID|$APP_SECRET" | jq '.data | {type, expires_at, scopes}'
```

Expected output for permanent token:
```json
{
  "type": "SYSTEM_USER",
  "expires_at": 1760107197,  // Far future date
  "scopes": ["whatsapp_business_management", "whatsapp_business_messaging"]
}
```

---

## 4. Phone Registration

### Step 1: Register Phone with Cloud API

```bash
# Set variables
ACCESS_TOKEN="YOUR_PERMANENT_TOKEN"
PHONE_NUMBER_ID="662001287007491"

# Register with PIN (choose any 6-digit PIN)
curl -X POST "https://graph.facebook.com/v21.0/$PHONE_NUMBER_ID/register" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"messaging_product":"whatsapp","pin":"123456"}' | jq
```

Expected response:
```json
{"success": true}
```

### Step 2: Verify Registration

```bash
# Check phone status
curl -s "https://graph.facebook.com/v21.0/$PHONE_NUMBER_ID?fields=display_phone_number,verified_name,quality_rating,status,account_mode" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq
```

Expected output:
```json
{
  "display_phone_number": "+52 1 664 163 3345",
  "verified_name": "Permisos Digitales",
  "quality_rating": "UNKNOWN",
  "status": "CONNECTED",
  "account_mode": "LIVE"
}
```

---

## 5. Business Name Verification & Certificate Association

### When Do You Need This?

You'll need to associate a certificate when:
1. **Changing your business display name** (e.g., from "Business by Company" to "Business Name")
2. **Meta sends you an email** with subject: "Certificate with your submitted display name [NAME] is now available"
3. **WhatsApp Manager shows** "Phone number registration required" or "Download Certificate"

### Step 1: Request Business Name Change

1. Go to: https://business.facebook.com/settings/info
2. Update your business name in Meta Business Manager
3. Submit for verification
4. Wait for Meta's email with certificate (usually 1-3 business days)

### Step 2: Receive Certificate Email

Meta will send an email like:
```
Subject: Certificate with your submitted display name [YOUR_NAME] for your WhatsApp business account [ACCOUNT_NAME] is now available for download.

To connect a phone number to send messages to your customers:
- Download the certificate or copy it to your clipboard
- Follow these instructions to confirm your number
```

The email contains a base64-encoded certificate string like:
```
CnIKLgiNqcv377mWAxIGZW50OndhIhVQZXJtaXNvcyBEaWdpdGFsZXMgTVhQjZX+xAYaQC...
```

### Step 3: Associate Certificate with Phone Number

⚠️ **Important**: Even though Meta directs you to "On-Premises" documentation, the Cloud API uses the same endpoint for certificate association.

```bash
# Set your variables
ACCESS_TOKEN="YOUR_PERMANENT_TOKEN"
PHONE_NUMBER_ID="662001287007491"
CERTIFICATE="YOUR_CERTIFICATE_STRING_FROM_EMAIL"

# Associate certificate with phone number
curl -X POST "https://graph.facebook.com/v21.0/$PHONE_NUMBER_ID/register" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"messaging_product\": \"whatsapp\",
    \"pin\": \"123456\",
    \"certificate\": \"$CERTIFICATE\"
  }" | jq
```

Expected response:
```json
{"success": true}
```

### Step 4: Verify Name Change

```bash
# Check that verified name has been updated
curl -s "https://graph.facebook.com/v21.0/$PHONE_NUMBER_ID?fields=display_phone_number,verified_name,quality_rating,status,account_mode" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq
```

Expected output:
```json
{
  "display_phone_number": "+52 1 664 163 3345",
  "verified_name": "Your New Business Name",
  "quality_rating": "GREEN",
  "status": "CONNECTED",
  "account_mode": "LIVE"
}
```

### Troubleshooting Certificate Association

**Error: "The parameter pin is required"**
- Solution: Include both `pin` and `certificate` parameters (PIN can be any 6-digit number)

**Error: "Invalid certificate"**  
- Solution: Ensure you copied the complete certificate string from Meta's email
- Certificate should be base64-encoded without line breaks

**Name doesn't update immediately**
- Solution: Wait 5-10 minutes and check again
- Sometimes takes time to propagate across Meta's systems

---

## 6. Webhook Configuration

### Step 1: Configure Webhook in Meta Dashboard

1. Go to: https://developers.facebook.com/apps/1308981213930375/webhooks/
2. Select **"WhatsApp Business Account"**
3. Configure:
   - **Callback URL**: `https://api.permisosdigitales.com.mx/whatsapp/webhook`
   - **Verify Token**: `permisos_digitales_whatsapp_2024`
4. Click **"Verify and Save"**
5. Subscribe to fields:
   - `messages`
   - `message_template_status_update`
   - `phone_number_quality_update`

### Step 2: Subscribe App to WABA

```bash
WABA_ID="730341602968484"
ACCESS_TOKEN="YOUR_TOKEN"

# Subscribe app to WhatsApp Business Account
curl -X POST "https://graph.facebook.com/v21.0/$WABA_ID/subscribed_apps" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq
```

### Step 3: Verify Webhook Configuration

```bash
# Check webhook subscriptions
APP_ID="1308981213930375"
APP_SECRET="931f3a64a33745f2528e00fdf24124c3"

curl -s "https://graph.facebook.com/v21.0/$APP_ID/subscriptions?access_token=$APP_ID|$APP_SECRET" | jq '.data[] | select(.object=="whatsapp_business_account")'
```

Expected output shows webhook is active with correct URL.

---

## 6. Production Deployment

### Step 1: Update Environment Variables

```bash
# SSH into server
ssh -i docs/permisos-digitales-fresh.pem ubuntu@107.21.154.162

# Update .env file
cd /home/ubuntu/app
sed -i 's|WHATSAPP_PHONE_NUMBER_ID=.*|WHATSAPP_PHONE_NUMBER_ID=662001287007491|' .env
sed -i 's|WHATSAPP_BUSINESS_ACCOUNT_ID=.*|WHATSAPP_BUSINESS_ACCOUNT_ID=730341602968484|' .env
sed -i 's|WHATSAPP_ACCESS_TOKEN=.*|WHATSAPP_ACCESS_TOKEN=YOUR_PERMANENT_TOKEN|' .env
```

### Step 2: Update PM2 Configuration

```bash
# Update ecosystem.production.config.js
sed -i 's|WHATSAPP_PHONE_NUMBER_ID:.*|WHATSAPP_PHONE_NUMBER_ID: "662001287007491",|' ecosystem.production.config.js
sed -i 's|WHATSAPP_BUSINESS_ACCOUNT_ID:.*|WHATSAPP_BUSINESS_ACCOUNT_ID: "730341602968484",|' ecosystem.production.config.js
sed -i 's|WHATSAPP_ACCESS_TOKEN:.*|WHATSAPP_ACCESS_TOKEN: "YOUR_PERMANENT_TOKEN",|' ecosystem.production.config.js
```

### Step 3: Restart Services

```bash
# Kill PM2 completely and restart (ensures env vars are reloaded)
pm2 kill
pm2 start ecosystem.production.config.js
pm2 status
```

---

## 7. Testing & Validation

### Step 1: Test Webhook Endpoint

```bash
# Test webhook is responding
curl -X GET "https://api.permisosdigitales.com.mx/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=permisos_digitales_whatsapp_2024&hub.challenge=test123"
```

Should return: `test123`

### Step 2: Send Test Message

```bash
# Create test script
cat > /tmp/test-message.sh << 'EOF'
#!/bin/bash
TOKEN="YOUR_TOKEN"
PHONE_ID="662001287007491"
TO_NUMBER="526646038416"  # Your WhatsApp number

curl -X POST "https://graph.facebook.com/v21.0/$PHONE_ID/messages" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"messaging_product\": \"whatsapp\",
    \"to\": \"$TO_NUMBER\",
    \"type\": \"text\",
    \"text\": {
      \"body\": \"Test message from WhatsApp Bot\"
    }
  }" | jq
EOF

chmod +x /tmp/test-message.sh
/tmp/test-message.sh
```

### Step 3: Monitor Incoming Messages

```bash
# Monitor logs for incoming messages
ssh -i docs/permisos-digitales-fresh.pem ubuntu@107.21.154.162 \
  "tail -f /home/ubuntu/app/logs/pm2-out.log | grep -i whatsapp"
```

---

## 8. Common Errors & Solutions

### Error: "Phone number registration required" 
**Issue**: Meta UI showing certificate association needed
**Solution**: This means you need to associate a certificate for business name change (see Section 5)

### Error: "(#100) The parameter messaging_product is required"
**Issue**: API version or format issue
**Solution**: Ensure using v21.0+ and correct JSON format

### Error: "Message undeliverable"
**Issue**: Recipient hasn't opened 24-hour window
**Solution**: User must message bot first, or use approved template

### Error: No webhook callbacks received
**Issue**: Multiple possible causes
**Solution Checklist**:
1. Verify webhook URL in Meta Dashboard
2. Check webhook is subscribed to "messages" field
3. Ensure not testing from admin account (Meta blocks these)
4. Verify phone is in LIVE mode, not TEST mode
5. Re-subscribe app to WABA

### Error: "Account does not exist in Cloud API"
**Issue**: Phone not registered with Cloud API
**Solution**: Run registration command with PIN (Step 4.1)

### Error: Token expires quickly
**Issue**: Using user token instead of system user token
**Solution**: Create permanent system user token (Step 3.2)

### Error: "The parameter pin is required" (during certificate association)
**Issue**: Missing PIN parameter when associating certificate
**Solution**: Include both `pin` and `certificate` parameters - PIN can be any 6-digit number

### Error: Certificate association fails
**Issue**: Invalid certificate format or incomplete certificate string
**Solution**: 
1. Copy the complete certificate string from Meta's email
2. Ensure no line breaks or extra characters
3. Certificate should be base64-encoded string

### Error: Business name doesn't update after certificate association
**Issue**: Name change propagation delay
**Solution**: 
1. Wait 5-10 minutes and check again
2. Verify certificate was applied successfully (`"success": true`)
3. Check phone number status to confirm `verified_name` field updated

---

## Quick Reference Commands

```bash
# Check everything is configured
ACCESS_TOKEN="YOUR_TOKEN"
PHONE_ID="662001287007491"
WABA_ID="730341602968484"

# 1. Check phone status
curl -s "https://graph.facebook.com/v21.0/$PHONE_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq

# 2. Check webhook subscriptions
curl -s "https://graph.facebook.com/v21.0/1308981213930375/subscriptions?access_token=1308981213930375|931f3a64a33745f2528e00fdf24124c3" | jq

# 3. Check WABA subscribed apps
curl -s "https://graph.facebook.com/v21.0/$WABA_ID/subscribed_apps" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq

# 4. Associate certificate for business name change
CERTIFICATE="YOUR_CERTIFICATE_FROM_META_EMAIL"
curl -X POST "https://graph.facebook.com/v21.0/$PHONE_ID/register" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"messaging_product\":\"whatsapp\",\"pin\":\"123456\",\"certificate\":\"$CERTIFICATE\"}" | jq

# 5. Send test message
curl -X POST "https://graph.facebook.com/v21.0/$PHONE_ID/messages" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"messaging_product":"whatsapp","to":"526646038416","type":"text","text":{"body":"Test"}}' | jq

# 6. Check server logs
ssh -i docs/permisos-digitales-fresh.pem ubuntu@107.21.154.162 \
  "tail -50 /home/ubuntu/app/logs/pm2-out.log | grep -i whatsapp"
```

---

## Final Checklist

- [ ] Phone number verified and shows "Connected"
- [ ] System User token created with WhatsApp permissions
- [ ] Phone registered with Cloud API using PIN
- [ ] Certificate associated for business name verification (if needed)
- [ ] Verified business name displays correctly in phone number info
- [ ] Webhook configured and verified
- [ ] App subscribed to WABA
- [ ] Production environment variables updated
- [ ] PM2 restarted with new configuration
- [ ] Test message sent successfully
- [ ] Incoming messages reaching webhook

**Remember**: Users must message your bot first to open a 24-hour conversation window. After 24 hours of inactivity, you need approved templates to reinitiate conversation.