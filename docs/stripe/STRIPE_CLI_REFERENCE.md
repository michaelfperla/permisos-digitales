# Stripe CLI Reference Guide

This guide provides essential Stripe CLI commands for managing and monitoring the Permisos Digitales Stripe integration.

## Installation & Setup

### Install Stripe CLI
```bash
# macOS
brew install stripe/stripe-cli/stripe

# Windows
scoop install stripe

# Linux
curl -s https://packages.stripe.dev/api/security/keypair/stripe-cli-gpg/public | gpg --dearmor | sudo tee /usr/share/keyrings/stripe.gpg
echo "deb [signed-by=/usr/share/keyrings/stripe.gpg] https://packages.stripe.dev/stripe-cli-debian-local stable main" | sudo tee -a /etc/apt/sources.list.d/stripe.list
sudo apt update
sudo apt install stripe
```

### Authentication
```bash
# Login to Stripe
stripe login

# Login with API key (non-interactive)
stripe login --api-key sk_test_...

# Check current configuration
stripe config --list
```

## Account Information

### Account Details
```bash
# Get account information
stripe accounts retrieve

# Get balance
stripe balance retrieve

# Get balance transactions
stripe balance_transactions list --limit 10
```

## Customer Management

### List Customers
```bash
# List all customers
stripe customers list --limit 100

# Search by email
stripe customers list --email "user@example.com"

# Get specific customer
stripe customers retrieve cus_xxx
```

### Create Test Customers
```bash
# Create a customer
stripe customers create \
  --email "test@example.com" \
  --name "Test User" \
  --metadata "source=permisos_digitales"
```

## Payment Intents

### List Payment Intents
```bash
# List recent payment intents
stripe payment_intents list --limit 20

# Filter by status
stripe payment_intents list --limit 10 \
  --query "status:'succeeded'"

# Filter by date
stripe payment_intents list \
  --created ">=2024-01-01" \
  --created "<=2024-12-31"
```

### Retrieve Payment Intent
```bash
# Get payment intent details
stripe payment_intents retrieve pi_xxx

# Include full details
stripe payment_intents retrieve pi_xxx \
  --expand charges \
  --expand customer
```

### Create Test Payment Intent
```bash
# Card payment intent
stripe payment_intents create \
  --amount 15000 \
  --currency mxn \
  --payment-method-types card \
  --metadata "application_id=123" \
  --metadata "source=permisos_digitales"

# OXXO payment intent
stripe payment_intents create \
  --amount 15000 \
  --currency mxn \
  --payment-method-types oxxo \
  --payment-method-options "oxxo[expires_after_days]=3"
```

## Charges

### List Charges
```bash
# List recent charges
stripe charges list --limit 20

# Filter by payment intent
stripe charges list --payment-intent pi_xxx

# Filter by status
stripe charges list --limit 10 \
  --query "status:'succeeded' AND amount:>10000"
```

## Webhook Management

### List Webhook Endpoints
```bash
# List all webhook endpoints
stripe webhook_endpoints list

# Get specific endpoint
stripe webhook_endpoints retrieve we_xxx
```

### Create Webhook Endpoint
```bash
stripe webhook_endpoints create \
  --url "https://api.permisosdigitales.com.mx/stripe-payment/webhook/stripe" \
  --enabled-events "payment_intent.succeeded" \
  --enabled-events "payment_intent.payment_failed" \
  --enabled-events "charge.updated"
```

### Test Webhooks Locally
```bash
# Forward webhooks to local server
stripe listen --forward-to localhost:3001/stripe-payment/webhook/stripe

# Print webhook secret for testing
stripe listen --print-secret

# Forward specific events only
stripe listen --forward-to localhost:3001/stripe-payment/webhook/stripe \
  --events payment_intent.succeeded,charge.updated

# Trigger test events
stripe trigger payment_intent.succeeded
stripe trigger charge.updated
```

## Events

### List Events
```bash
# List recent events
stripe events list --limit 20

# Filter by type
stripe events list --types "payment_intent.*"

# Get specific event
stripe events retrieve evt_xxx
```

### Resend Events
```bash
# Resend a specific event to webhook
stripe events resend evt_xxx \
  --webhook-endpoint we_xxx
```

## Products and Prices

### List Products
```bash
# List all products
stripe products list

# Create a product
stripe products create \
  --name "Permiso de Circulación" \
  --description "Permiso vehicular anual"
```

### List Prices
```bash
# List all prices
stripe prices list

# Create a price
stripe prices create \
  --product prod_xxx \
  --unit-amount 15000 \
  --currency mxn
```

## Testing

### Test Payment Methods
```bash
# Create test payment method (card)
stripe payment_methods create \
  --type card \
  --card "number=4242424242424242" \
  --card "exp_month=12" \
  --card "exp_year=2025" \
  --card "cvc=123"

# Create test payment method (OXXO)
stripe payment_methods create \
  --type oxxo
```

### Simulate Payment Confirmation
```bash
# Confirm a payment intent
stripe payment_intents confirm pi_xxx \
  --payment-method pm_card_visa

# Cancel a payment intent
stripe payment_intents cancel pi_xxx
```

## Monitoring & Debugging

### Real-time Event Monitoring
```bash
# Monitor all events in real-time
stripe logs tail

# Filter logs by request ID
stripe logs tail --filter-request-id req_xxx

# Filter by status code
stripe logs tail --filter-http-status 400

# Filter by resource
stripe logs tail --filter-resource "payment_intent"
```

### API Request Logs
```bash
# List recent API requests
stripe logs list --limit 20

# Get specific request details
stripe requests retrieve req_xxx
```

## Reporting

### Generate Reports
```bash
# Export transactions
stripe transactions list \
  --created ">=2024-01-01" \
  --format csv > transactions.csv

# Export customers
stripe customers list \
  --limit 1000 \
  --format json > customers.json
```

### Revenue Analysis
```bash
# Get daily revenue
stripe charges list \
  --created ">=2024-01-01" \
  --created "<=2024-01-31" \
  --query "status:'succeeded'" \
  --expand "data.balance_transaction" \
  | jq '[.data[] | {date: .created, amount: .amount}]'
```

## Useful Aliases

Add to your shell profile:
```bash
# Quick payment intent lookup
alias stripe-pi="stripe payment_intents retrieve"

# Monitor webhooks
alias stripe-webhooks="stripe listen --forward-to localhost:3001/stripe-payment/webhook/stripe"

# List recent successful payments
alias stripe-payments="stripe payment_intents list --limit 20 --query \"status:'succeeded'\""

# Check account balance
alias stripe-balance="stripe balance retrieve"
```

## Production Commands

### Monitor Production Events
```bash
# Use production API key
export STRIPE_API_KEY=sk_live_xxx

# Monitor payment failures
stripe events list \
  --types "payment_intent.payment_failed" \
  --limit 50

# Check webhook delivery
stripe events list \
  --delivery-success false \
  --limit 20
```

### Webhook Health Check
```bash
# Check webhook endpoint status
stripe webhook_endpoints list | \
  jq '.data[] | {url: .url, enabled: .status, events: .enabled_events}'

# Get webhook attempt details
stripe events retrieve evt_xxx \
  --expand "data.request"
```

## Troubleshooting Commands

### Debug Payment Issues
```bash
# Get full payment intent history
stripe events list \
  --query "data.object.id:'pi_xxx'" \
  --limit 100

# Check customer's payment history
stripe payment_intents list \
  --customer cus_xxx \
  --limit 50
```

### Verify Webhook Signatures
```bash
# Generate test webhook signature
stripe webhooks sign \
  --payload '{"id":"evt_test"}' \
  --secret whsec_xxx
```

## Best Practices

1. **Always use test mode for development**
   ```bash
   export STRIPE_API_KEY=sk_test_xxx
   ```

2. **Use query filters to reduce data**
   ```bash
   stripe charges list --query "amount:>10000 AND status:'succeeded'"
   ```

3. **Export data for analysis**
   ```bash
   stripe payment_intents list --format csv > payments.csv
   ```

4. **Monitor webhook reliability**
   ```bash
   stripe events list --delivery-success false
   ```

5. **Use expand for detailed information**
   ```bash
   stripe payment_intents retrieve pi_xxx \
     --expand customer \
     --expand charges.data.balance_transaction
   ```

## Quick Reference Card

```bash
# Authentication
stripe login

# List payments
stripe payment_intents list

# Get payment details
stripe payment_intents retrieve pi_xxx

# Monitor webhooks
stripe listen --forward-to localhost:3001/webhook

# Check balance
stripe balance retrieve

# List events
stripe events list

# Debug logs
stripe logs tail
```


For when testing in dev env stripe: listen --forward-to localhost:3001/webhook/stripe