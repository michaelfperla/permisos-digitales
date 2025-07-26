# System Monitoring and Health Check Documentation

## Overview

The system monitoring service provides comprehensive real-time monitoring, health checks, and alerting for the Permisos Digitales application. It tracks system performance, component health, and critical metrics across all services.

## Architecture

### Core Components

1. **SystemMonitoringService** (`src/services/system-monitoring.service.js`)
   - Central monitoring service that aggregates metrics from all components
   - Implements caching to reduce load on monitored systems
   - Provides alert triggering based on configurable thresholds

2. **AdminMonitoringController** (`src/controllers/admin-monitoring.controller.js`)
   - REST API endpoints for accessing monitoring data
   - Provides both detailed and aggregated views of system health

3. **Monitoring Middleware** (`src/middleware/monitoring.middleware.js`)
   - Tracks API response times
   - Records database query performance
   - Captures and categorizes errors

4. **Database Tables** (Migration: `20250715000000_add_monitoring_tables.js`)
   - `queue_metrics` - PDF generation queue statistics
   - `email_logs` - Email delivery tracking
   - `error_logs` - Application error tracking
   - `request_logs` - API request performance
   - `query_logs` - Database query performance

## API Endpoints

All endpoints require admin authentication.

### System Health
- `GET /admin/system/health` - Overall system health status
- `GET /admin/system/realtime` - Real-time system metrics (CPU, memory, etc.)

### Component Monitoring
- `GET /admin/system/queues` - Queue status and statistics
- `GET /admin/system/stats/email` - Email delivery metrics
- `GET /admin/system/stats/pdf` - PDF generation statistics
- `GET /admin/system/stats/database` - Database performance metrics
- `GET /admin/system/stats/payments` - Payment system metrics

### Metrics and Errors
- `GET /admin/system/metrics` - Comprehensive system metrics
- `GET /admin/system/errors` - Error statistics and recent errors
- `GET /admin/system/dashboard` - Aggregated dashboard data

### Utilities
- `POST /admin/system/cache/clear` - Clear monitoring cache
- `POST /admin/system/alert/test` - Test alert system

## Monitored Metrics

### System Health
- Overall system status (healthy/degraded/critical)
- Component-level health checks
- Uptime tracking
- Resource utilization

### Performance Metrics
- API response times
- Database query performance
- Queue processing times
- Memory usage (system and process)
- CPU utilization
- Connection pool status

### Queue Metrics
- Queue length and active jobs
- Processing times (average, min, max)
- Success/failure rates
- Stuck application detection

### Payment Metrics
- Transaction success/failure rates
- Processing times
- Revenue tracking
- Error categorization
- Consecutive failure tracking

### Email Metrics
- Delivery success rates
- Bounce tracking
- Email types breakdown
- Recent activity

### PDF Generation Metrics
- Generation success rates
- Processing times
- Failure reasons
- Queue backlog

### Error Tracking
- Error categorization by type and severity
- Recent error history
- Critical error alerts
- Error rate monitoring

## Alert System

### Alert Thresholds
```javascript
{
  memoryUsagePercent: 85,
  cpuUsagePercent: 90,
  errorRatePerMinute: 10,
  responseTimeMs: 3000,
  dbConnectionPoolUsage: 90,
  queueBacklog: 100
}
```

### Alert Types
- **System Alerts** - Infrastructure and resource issues
- **Payment Alerts** - Payment processing failures
- **Security Alerts** - Security-related incidents
- **Database Alerts** - Database connection or performance issues

### Alert Channels
- Email notifications
- Webhook integration (Slack, Discord, etc.)
- Console logging
- Future: SMS alerts

## Usage Examples

### Accessing System Health
```bash
curl -X GET https://api.permisosdigitales.com.mx/admin/system/health \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2025-07-15T12:00:00.000Z",
  "uptime": 86400,
  "components": {
    "database": {
      "status": "healthy",
      "responseTime": 45,
      "pool": {
        "total": 10,
        "idle": 7,
        "waiting": 0
      },
      "usagePercent": 30
    },
    "redis": {
      "status": "healthy",
      "responseTime": 5,
      "memoryUsage": "15.2M",
      "connectedClients": 5
    },
    "queue": {
      "status": "healthy",
      "queueLength": 5,
      "activeJobs": 2,
      "failureRate": 2.5,
      "avgProcessingTime": 8500
    },
    "payments": {
      "status": "healthy",
      "metrics": {
        "successRate": "95.0",
        "failureRate": "5.0",
        "avgProcessingTime": 2500,
        "totalPayments": 1500,
        "revenue": 225000
      }
    }
  }
}
```

### Getting Queue Status
```bash
curl -X GET https://api.permisosdigitales.com.mx/admin/system/queues \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Testing Alerts
```bash
curl -X POST https://api.permisosdigitales.com.mx/admin/system/alert/test \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "TEST_ALERT",
    "message": "This is a test alert"
  }'
```

## Performance Considerations

### Caching
- All monitoring endpoints implement a 30-second cache
- Cache can be manually cleared via the API
- Prevents excessive load on monitored systems

### Resource Usage
- Monitoring adds minimal overhead (<1% CPU, <10MB memory)
- Database queries are optimized with proper indexes
- Metrics are aggregated periodically to reduce storage

### Data Retention
- Request logs: 7 days
- Error logs: 30 days
- Queue metrics: 30 days
- Email logs: 90 days

## Configuration

### Environment Variables
```bash
# Alert Configuration
ALERT_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
ALERT_EMAIL_TO=admin@example.com
ALERT_SMS_ENABLED=false

# Monitoring Configuration
MONITORING_INTERVAL=60000  # 1 minute
HEALTH_CHECK_INTERVAL=300000  # 5 minutes
METRICS_RETENTION_DAYS=30
```

### Alert Threshold Customization
Thresholds can be modified in `system-monitoring.service.js`:
```javascript
this.alertThresholds = {
  memoryUsagePercent: 85,
  cpuUsagePercent: 90,
  errorRatePerMinute: 10,
  responseTimeMs: 3000,
  dbConnectionPoolUsage: 90,
  queueBacklog: 100
};
```

## Troubleshooting

### Common Issues

1. **Missing Metrics Data**
   - Check if monitoring tables exist in database
   - Verify monitoring middleware is properly configured
   - Check service container initialization

2. **Alerts Not Sending**
   - Verify alert channel configuration
   - Check email service configuration
   - Review alert service logs

3. **High Memory Usage**
   - Clear monitoring cache
   - Check for memory leaks in monitored services
   - Review data retention policies

### Debug Mode
Enable detailed monitoring logs:
```javascript
process.env.MONITORING_DEBUG = 'true';
```

## Future Enhancements

1. **Grafana Integration**
   - Export metrics to Prometheus format
   - Create pre-built dashboards

2. **Machine Learning**
   - Anomaly detection
   - Predictive alerting
   - Capacity planning

3. **Additional Metrics**
   - Network I/O tracking
   - Disk I/O monitoring
   - Third-party API response times

4. **Advanced Alerting**
   - Alert suppression and grouping
   - Escalation policies
   - On-call rotation integration