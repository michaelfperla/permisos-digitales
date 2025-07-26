# Metrics API

Documentation for application metrics and monitoring endpoints.

## Overview

The Metrics API provides comprehensive application and business metrics in multiple formats, supporting various monitoring and observability platforms. These endpoints enable real-time monitoring, alerting, and performance analysis.

## Base URL
```
/metrics
```

## Authentication
- **Public endpoints**: Basic metrics available without authentication
- **Detailed endpoints**: Require internal API key

---

## Prometheus Metrics

### GET /metrics

Export metrics in Prometheus format for scraping.

**Authentication**: Not required  
**Format**: Prometheus text format  
**Use Case**: Prometheus monitoring, Grafana dashboards

#### Response (200 OK)
```
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",endpoint="/applications",status="200"} 15432
http_requests_total{method="POST",endpoint="/auth/login",status="200"} 8765
http_requests_total{method="POST",endpoint="/auth/login",status="401"} 234

# HELP http_request_duration_seconds HTTP request latencies
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{endpoint="/applications",le="0.005"} 1000
http_request_duration_seconds_bucket{endpoint="/applications",le="0.01"} 1500
http_request_duration_seconds_bucket{endpoint="/applications",le="0.025"} 2000
http_request_duration_seconds_sum{endpoint="/applications"} 125.5
http_request_duration_seconds_count{endpoint="/applications"} 15432

# HELP application_status_total Applications by status
# TYPE application_status_total gauge
application_status_total{status="AWAITING_PAYMENT"} 45
application_status_total{status="PERMIT_READY"} 2890
application_status_total{status="FAILED"} 23

# HELP payment_total Total payments processed
# TYPE payment_total counter
payment_total{method="card",status="success"} 12345
payment_total{method="card",status="failed"} 123
payment_total{method="oxxo",status="success"} 4567
payment_total{method="oxxo",status="pending"} 89

# HELP nodejs_memory_heap_used_bytes Process heap memory used
# TYPE nodejs_memory_heap_used_bytes gauge
nodejs_memory_heap_used_bytes 89128960

# HELP nodejs_memory_heap_total_bytes Process heap memory total
# TYPE nodejs_memory_heap_total_bytes gauge
nodejs_memory_heap_total_bytes 157286400

# HELP queue_depth Current queue depth by queue name
# TYPE queue_depth gauge
queue_depth{queue="pdf-generation"} 12
queue_depth{queue="email-notifications"} 5

# HELP queue_processing_duration_seconds Queue job processing time
# TYPE queue_processing_duration_seconds histogram
queue_processing_duration_seconds_bucket{queue="pdf-generation",le="10"} 100
queue_processing_duration_seconds_bucket{queue="pdf-generation",le="30"} 450
queue_processing_duration_seconds_bucket{queue="pdf-generation",le="60"} 480
```

---

## Business Metrics

### GET /metrics/business

Get business-focused metrics in JSON format.

**Authentication**: Not required  
**Format**: JSON  
**Use Case**: Business dashboards, KPI monitoring

#### Success Response (200 OK)
```json
{
  "timestamp": "2025-06-24T10:00:00.000Z",
  "period": "current",
  "metrics": {
    "users": {
      "total": 15678,
      "active_30d": 4567,
      "active_7d": 2345,
      "active_1d": 567,
      "new_today": 45,
      "verified": 14890,
      "growth": {
        "daily": 0.02,
        "weekly": 0.05,
        "monthly": 0.12
      }
    },
    "applications": {
      "total": 45678,
      "today": 123,
      "this_week": 890,
      "this_month": 3456,
      "by_status": {
        "awaiting_payment": 45,
        "processing": 12,
        "completed": 43210,
        "failed": 234
      },
      "completion_rate": 0.95,
      "avg_processing_time": 180
    },
    "revenue": {
      "today": 18450,
      "this_week": 133500,
      "this_month": 518400,
      "this_year": 6220800,
      "currency": "MXN",
      "average_transaction": 150,
      "by_payment_method": {
        "card": {
          "amount": 4668600,
          "percentage": 0.75
        },
        "oxxo": {
          "amount": 1552200,
          "percentage": 0.25
        }
      }
    },
    "permits": {
      "active": 38945,
      "expiring_7d": 234,
      "expiring_30d": 1234,
      "expired": 4567,
      "renewal_rate": 0.82
    },
    "operational": {
      "pdf_generation": {
        "success_rate": 0.98,
        "avg_time_seconds": 45,
        "queue_depth": 12
      },
      "payment_processing": {
        "success_rate": 0.97,
        "avg_time_ms": 1250,
        "declined_rate": 0.02
      },
      "email_delivery": {
        "sent_today": 567,
        "delivery_rate": 0.98,
        "bounce_rate": 0.01,
        "complaint_rate": 0.001
      }
    }
  }
}
```

---

## Summary Metrics

### GET /metrics/summary

Get a summary of key metrics.

**Authentication**: Not required  
**Format**: JSON  
**Use Case**: Quick status checks, executive dashboards

#### Success Response (200 OK)
```json
{
  "timestamp": "2025-06-24T10:00:00.000Z",
  "summary": {
    "health_score": 95,
    "active_users": 4567,
    "revenue_today": 18450,
    "applications_today": 123,
    "system_load": 0.45,
    "error_rate": 0.02,
    "response_time_p95": 450
  },
  "alerts": [
    {
      "level": "warning",
      "metric": "queue_depth",
      "value": 156,
      "threshold": 100,
      "message": "PDF queue depth exceeds threshold"
    }
  ],
  "trends": {
    "users": "up",
    "revenue": "up", 
    "errors": "stable",
    "performance": "improving"
  }
}
```

---

## Detailed Metrics

### GET /metrics/detailed

Get comprehensive metrics with historical data.

**Authentication**: Required (API Key)  
**Headers**: `x-internal-api-key: your-api-key`  
**Query Parameters**:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `period` | string | 24h | Time period: 1h, 24h, 7d, 30d |
| `resolution` | string | auto | Data points: minute, hour, day |

#### Success Response (200 OK)
```json
{
  "timestamp": "2025-06-24T10:00:00.000Z",
  "period": "24h",
  "resolution": "hour",
  "metrics": {
    "application": {
      "performance": {
        "response_times": {
          "p50": [120, 125, 118, ...],
          "p95": [450, 480, 445, ...],
          "p99": [1200, 1150, 1180, ...]
        },
        "throughput": [450, 480, 520, ...],
        "error_rates": [0.02, 0.01, 0.02, ...]
      },
      "endpoints": [
        {
          "path": "/applications",
          "method": "GET",
          "calls": 15432,
          "avg_duration": 125,
          "error_rate": 0.01
        },
        {
          "path": "/auth/login",
          "method": "POST",
          "calls": 8765,
          "avg_duration": 85,
          "error_rate": 0.05
        }
      ]
    },
    "infrastructure": {
      "cpu": {
        "usage": [35.2, 38.1, 32.5, ...],
        "load_average": [[1.2, 1.5, 1.8], [1.3, 1.6, 1.9], ...]
      },
      "memory": {
        "heap_used": [85, 92, 88, ...],
        "heap_total": [150, 150, 155, ...],
        "rss": [125, 130, 128, ...],
        "system_free": [1900, 1850, 1920, ...]
      },
      "disk": {
        "usage_percent": [55, 55, 56, ...],
        "io_wait": [0.5, 0.8, 0.4, ...]
      }
    },
    "database": {
      "connections": {
        "active": [15, 18, 14, ...],
        "idle": [35, 32, 36, ...],
        "waiting": [0, 1, 0, ...]
      },
      "performance": {
        "query_time_avg": [12, 15, 11, ...],
        "slow_queries": [2, 3, 1, ...],
        "transactions_per_sec": [120, 135, 115, ...]
      }
    },
    "business": {
      "hourly_revenue": [750, 1200, 1500, ...],
      "hourly_applications": [5, 8, 10, ...],
      "hourly_logins": [45, 67, 89, ...],
      "conversion_rate": [0.65, 0.70, 0.68, ...]
    }
  },
  "aggregates": {
    "total_requests": 567890,
    "unique_users": 4567,
    "total_revenue": 18450,
    "uptime_percentage": 99.95
  }
}
```

---

## Custom Metrics Query

### POST /metrics/query

Query specific metrics with custom filters.

**Authentication**: Required (API Key)  
**CSRF**: Required

#### Request Body
```json
{
  "metrics": ["response_time", "error_rate", "throughput"],
  "filters": {
    "endpoint": "/applications",
    "method": "GET",
    "status": "2xx"
  },
  "period": "7d",
  "groupBy": "day",
  "aggregation": "avg"
}
```

#### Success Response (200 OK)
```json
{
  "query": {
    "executed_at": "2025-01-24T10:00:00.000Z",
    "duration_ms": 125
  },
  "results": [
    {
      "date": "2025-01-18",
      "response_time": 125,
      "error_rate": 0.01,
      "throughput": 450
    },
    {
      "date": "2025-01-19",
      "response_time": 130,
      "error_rate": 0.02,
      "throughput": 480
    }
  ]
}
```

---

## Metrics Export

### GET /metrics/export

Export metrics data for analysis.

**Authentication**: Required (API Key)  
**Query Parameters**:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `format` | string | csv | Export format: csv, json, xlsx |
| `period` | string | 7d | Time period to export |
| `metrics` | string | all | Comma-separated metric names |

#### Success Response (200 OK)
- **CSV Format**: Returns CSV file with headers
- **JSON Format**: Returns complete metrics dataset
- **XLSX Format**: Returns Excel file with multiple sheets

---

## Real-time Metrics

### WebSocket: /metrics/realtime

Connect for real-time metrics updates.

**Authentication**: Required (API Key in connection params)  
**Protocol**: WebSocket

#### Connection
```javascript
const ws = new WebSocket('wss://api.permisos.com/metrics/realtime?key=API_KEY');
```

#### Message Format
```json
{
  "type": "metric_update",
  "timestamp": "2025-06-24T10:00:00.000Z",
  "metrics": {
    "active_users": 234,
    "requests_per_second": 45,
    "queue_depth": 12,
    "error_rate": 0.01
  }
}
```

---

## Metric Types

### Counter Metrics
- Total requests
- Total payments
- User registrations
- Failed operations

### Gauge Metrics
- Active users
- Queue depth
- Memory usage
- Connection pool size

### Histogram Metrics
- Response times
- Processing duration
- Payment amounts
- Query execution time

### Summary Metrics
- Request latency percentiles
- Error rate percentages
- Success rate percentages

---

## Integration Examples

### Grafana Dashboard Query
```sql
SELECT
  time,
  avg(response_time_p95) as "95th Percentile",
  avg(response_time_p99) as "99th Percentile"
FROM metrics
WHERE endpoint = '/applications'
GROUP BY time(5m)
```

### Datadog Custom Metric
```javascript
const datadog = require('datadog-metrics');
datadog.gauge('permisos.queue.depth', queueDepth, ['queue:pdf-generation']);
```

### CloudWatch Metric
```javascript
await cloudwatch.putMetricData({
  Namespace: 'Permisos/API',
  MetricData: [{
    MetricName: 'ApplicationsCreated',
    Value: count,
    Unit: 'Count'
  }]
}).promise();
```

---

## Alerting Rules

### Example Prometheus Alert Rules
```yaml
groups:
  - name: permisos_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        annotations:
          summary: "High error rate detected"
          
      - alert: QueueBacklog
        expr: queue_depth{queue="pdf-generation"} > 100
        for: 10m
        annotations:
          summary: "PDF queue backlog detected"
```

---

## Performance Considerations

1. **Metric Collection**: Minimal overhead (<1% CPU)
2. **Storage**: Metrics retained for 30 days
3. **Cardinality**: Limited labels to prevent explosion
4. **Sampling**: High-volume metrics sampled at 10%
5. **Aggregation**: Pre-aggregated for common queries

---

**Last Updated**: June 24, 2025 | **Version**: 2.0