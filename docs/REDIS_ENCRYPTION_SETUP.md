# Redis Session Encryption Setup

## Overview
This guide explains how to enable encryption for Redis session data in the WhatsApp bot, providing an additional layer of security for user conversation states.

## Features
- AES-256-GCM encryption for all session data
- Automatic encryption/decryption on read/write
- Backward compatibility with unencrypted data
- Migration tool for existing data
- Secure key management

## Setup Instructions

### 1. Generate Encryption Key

First, generate a secure 256-bit encryption key:

```bash
node scripts/migrate-redis-encryption.js --generate-key
```

This will output:
```
Generated encryption key:
a1b2c3d4e5f6... (64 hex characters)

Add this to your environment variables:
REDIS_ENCRYPTION_KEY=a1b2c3d4e5f6...
```

### 2. Configure Environment

Add the following to your environment configuration:

#### Development (.env)
```bash
REDIS_ENCRYPTION_KEY=your_generated_key_here
ENABLE_REDIS_ENCRYPTION=true
```

#### Production (ecosystem.production.config.js)
```javascript
env: {
  // ... existing variables ...
  REDIS_ENCRYPTION_KEY: "your_generated_key_here",
  ENABLE_REDIS_ENCRYPTION: "true"
}
```

### 3. Deploy Configuration

```bash
# Update production server
ssh -i docs/permisos-digitales-fresh.pem ubuntu@107.21.154.162

# Update .env file
echo "REDIS_ENCRYPTION_KEY=your_key_here" >> /home/ubuntu/app/.env
echo "ENABLE_REDIS_ENCRYPTION=true" >> /home/ubuntu/app/.env

# Update ecosystem config
nano /home/ubuntu/app/ecosystem.production.config.js
# Add the environment variables
```

### 4. Migrate Existing Data

Before enabling encryption in production, migrate existing data:

```bash
# On production server
cd /home/ubuntu/app
node scripts/migrate-redis-encryption.js
```

Expected output:
```
Starting Redis encryption migration
Redis connection verified
Migrating WhatsApp state data...
WhatsApp state migration completed { migrated: 42, failed: 0, total: 42 }
Migration completed { totalMigrated: 42, totalFailed: 0, success: true }
```

### 5. Restart Application

```bash
pm2 restart permisos-digitales-api
```

## Security Benefits

1. **Data at Rest Protection**: All session data in Redis is encrypted
2. **Authentication**: GCM mode provides built-in authentication
3. **Key Rotation**: Easy to rotate keys with migration tool
4. **Compliance**: Helps meet data protection requirements

## Technical Details

### Encryption Method
- Algorithm: AES-256-GCM
- Key Size: 256 bits (32 bytes)
- IV Size: 128 bits (16 bytes)
- Tag Size: 128 bits (16 bytes)

### Data Format
Encrypted data is stored as Base64:
```
[IV (16 bytes)][Auth Tag (16 bytes)][Encrypted Data]
```

### Performance Impact
- Minimal overhead (~1-2ms per operation)
- No impact on Redis memory usage
- Transparent to application logic

## Monitoring

Check encryption status in logs:
```bash
pm2 logs permisos-digitales-api | grep "Redis encryption"
```

You should see:
```
StateManager: Redis encryption enabled
```

## Troubleshooting

### Issue: "Invalid encryption key length"
**Solution**: Ensure your key is exactly 64 hex characters (32 bytes)

### Issue: "Failed to decrypt Redis data"
**Solution**: Data may be corrupted. The system will automatically clear it and recreate.

### Issue: Performance degradation
**Solution**: 
1. Check Redis connection latency
2. Consider disabling encryption for non-sensitive data
3. Monitor CPU usage during encryption operations

## Key Management Best Practices

1. **Never commit keys to version control**
2. **Use different keys for each environment**
3. **Rotate keys every 90 days**
4. **Store keys in secure credential management systems**
5. **Backup keys securely**

## Disabling Encryption

To disable encryption:

1. Set `ENABLE_REDIS_ENCRYPTION=false`
2. Restart the application
3. Existing encrypted data will be read but new data won't be encrypted

## Future Enhancements

- [ ] Automatic key rotation
- [ ] Hardware security module (HSM) support
- [ ] Encryption metrics and monitoring
- [ ] Per-user encryption keys