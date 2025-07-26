# Log Analysis API

Documentation for log search, analysis, and monitoring endpoints.

## Overview

The Log Analysis API provides powerful log search, filtering, and analysis capabilities for system administrators. These endpoints enable real-time log monitoring, performance analysis, and troubleshooting.

## Base URL
```
/logs
```

## Authentication
- **Required**: Admin role only
- **Rate Limit**: 200 requests per 15 minutes (admin rate limit)
- **CSRF**: Required for state-changing operations

---

## Log Search

### POST /logs/search

Search through application logs with advanced filtering.

**Authentication**: Required (Admin only)  
**CSRF**: Required

#### Request Body
```json
{
  "query": "error payment stripe",
  "timeRange": {
    "start": "2025-01-24T00:00:00.000Z",
    "end": "2025-01-24T23:59:59.000Z"
  },
  "filters": {
    "level": ["error", "warn"],
    "service": ["payment", "stripe"],
    "userId": 123,
    "applicationId": 12345
  },
  "pagination": {
    "page": 1,
    "limit": 50
  },
  "sort": {
    "field": "timestamp",
    "order": "desc"
  }
}
```

#### Request Parameters
| Field | Type | Description |
|-------|------|-------------|
| `query` | string | Full-text search query |
| `timeRange.start` | datetime | Start time (ISO 8601) |
| `timeRange.end` | datetime | End time (ISO 8601) |
| `filters.level` | array | Log levels: error, warn, info, debug |
| `filters.service` | array | Service names |
| `filters.userId` | number | Filter by user ID |
| `filters.applicationId` | number | Filter by application ID |

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "timestamp": "2025-01-24T10:30:15.123Z",
        "level": "error",
        "service": "payment",
        "message": "Stripe payment failed: card_declined",
        "metadata": {
          "userId": 123,
          "applicationId": 12345,
          "paymentIntentId": "pi_1234567890",
          "errorCode": "card_declined",
          "amount": 150,
          "requestId": "req-abc123"
        },
        "stackTrace": "Error: Payment failed\n    at processPayment...",
        "source": {
          "file": "stripe-payment.service.js",
          "line": 125,
          "function": "processCardPayment"
        }
      }
    ],
    "pagination": {
      "total": 1234,
      "page": 1,
      "totalPages": 25,
      "limit": 50
    },
    "aggregations": {
      "by_level": {
        "error": 456,
        "warn": 234,
        "info": 544
      },
      "by_service": {
        "payment": 678,
        "auth": 234,
        "application": 322
      },
      "timeline": [
        {
          "hour": "2025-01-24T10:00:00.000Z",
          "count": 45,
          "error_count": 5
        }
      ]
    }
  }
}
```

---

## System Health Report

### GET /logs/health

Generate system health report from log analysis.

**Authentication**: Required (Admin only)

#### Query Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `hours` | number | 24 | Analysis time window |
| `includeMetrics` | boolean | true | Include performance metrics |

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "generated_at": "2025-01-24T10:00:00.000Z",
    "time_window": "24 hours",
    "summary": {
      "health_score": 85,
      "status": "healthy",
      "total_logs": 567890,
      "error_rate": 0.02,
      "warning_rate": 0.05
    },
    "services": {
      "payment": {
        "health_score": 95,
        "error_count": 12,
        "warning_count": 45,
        "total_requests": 5678,
        "avg_response_time": 125,
        "issues": []
      },
      "auth": {
        "health_score": 78,
        "error_count": 89,
        "warning_count": 123,
        "total_requests": 8765,
        "avg_response_time": 85,
        "issues": [
          "High rate of login failures detected"
        ]
      }
    },
    "error_analysis": {
      "top_errors": [
        {
          "message": "Database connection timeout",
          "count": 23,
          "first_seen": "2025-01-24T02:15:00.000Z",
          "last_seen": "2025-01-24T09:45:00.000Z",
          "severity": "high"
        }
      ],
      "error_trends": {
        "increasing": ["payment_timeout", "queue_overflow"],
        "decreasing": ["validation_error"],
        "stable": ["auth_failure"]
      }
    },
    "performance": {
      "response_times": {
        "p50": 125,
        "p95": 450,
        "p99": 1200
      },
      "throughput": {
        "requests_per_second": 45,
        "peak_rps": 120
      },
      "resource_usage": {
        "cpu_avg": 35.2,
        "memory_avg": 52.3,
        "disk_io_avg": 15.6
      }
    },
    "recommendations": [
      {
        "priority": "high",
        "category": "performance",
        "message": "Database connection pool exhaustion detected. Consider increasing pool size.",
        "affected_services": ["payment", "application"]
      }
    ]
  }
}
```

---

## Recent Events

### GET /logs/recent

Get recent log events from memory buffer.

**Authentication**: Required (Admin only)

#### Query Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 100 | Number of events (max: 1000) |
| `level` | string | - | Filter by log level |
| `service` | string | - | Filter by service |

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "events": [
      {
        "timestamp": "2025-01-24T10:59:45.123Z",
        "level": "info",
        "service": "application",
        "message": "New application created",
        "metadata": {
          "userId": 789,
          "applicationId": 12350,
          "vehicleType": "Toyota Corolla"
        }
      }
    ],
    "buffer_info": {
      "size": 1000,
      "oldest_event": "2025-01-24T09:30:00.000Z",
      "events_per_second": 5.2
    }
  }
}
```

---

## Performance Metrics

### GET /logs/performance

Get performance baselines and metrics from logs.

**Authentication**: Required (Admin only)

#### Query Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `period` | string | 24h | Time period: 1h, 24h, 7d |
| `service` | string | - | Filter by service |

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "period": "24h",
    "performance": {
      "api_endpoints": [
        {
          "endpoint": "/applications",
          "method": "GET",
          "requests": 15432,
          "avg_response_time": 125,
          "p95_response_time": 450,
          "error_rate": 0.01,
          "slowest_requests": [
            {
              "timestamp": "2025-01-24T10:30:00.000Z",
              "response_time": 2500,
              "user_id": 123,
              "request_id": "req-abc123"
            }
          ]
        }
      ],
      "database": {
        "avg_query_time": 12,
        "slow_queries": [
          {
            "query": "SELECT * FROM applications WHERE...",
            "duration": 2500,
            "timestamp": "2025-01-24T10:15:00.000Z",
            "frequency": 234
          }
        ],
        "connection_pool": {
          "avg_utilization": 0.6,
          "max_utilization": 0.9,
          "timeouts": 3
        }
      },
      "queue": {
        "avg_processing_time": 45000,
        "queue_depth_avg": 12,
        "queue_depth_max": 156,
        "failed_jobs": 23,
        "retry_rate": 0.05
      }
    },
    "trends": {
      "response_times": "stable",
      "error_rates": "decreasing",
      "throughput": "increasing"
    }
  }
}
```

---

## Alert Rules

### GET /logs/alerts/rules

Get configured alert rules for log monitoring.

**Authentication**: Required (Admin only)

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "rules": [
      {
        "id": "high-error-rate",
        "name": "High Error Rate",
        "condition": "error_rate > 0.05",
        "window": "5m",
        "severity": "high",
        "enabled": true,
        "notifications": ["email", "slack"],
        "last_triggered": "2025-01-20T14:30:00.000Z"
      },
      {
        "id": "database-slow-queries",
        "name": "Database Slow Queries",
        "condition": "slow_query_count > 10",
        "window": "10m",
        "severity": "medium",
        "enabled": true,
        "notifications": ["email"]
      }
    ],
    "active_alerts": [
      {
        "rule_id": "queue-backlog",
        "triggered_at": "2025-01-24T10:45:00.000Z",
        "current_value": 156,
        "threshold": 100,
        "message": "PDF queue depth exceeds threshold"
      }
    ]
  }
}
```

---

### POST /logs/alerts/rules

Create or update alert rule.

**Authentication**: Required (Admin only)  
**CSRF**: Required

#### Request Body
```json
{
  "name": "Payment Failure Rate",
  "condition": "payment_failure_rate > 0.10",
  "window": "15m",
  "severity": "high",
  "enabled": true,
  "notifications": ["email", "slack"],
  "description": "Alert when payment failure rate exceeds 10%"
}
```

#### Success Response (201 Created)
```json
{
  "success": true,
  "data": {
    "rule": {
      "id": "payment-failure-rate",
      "name": "Payment Failure Rate",
      "condition": "payment_failure_rate > 0.10",
      "window": "15m",
      "severity": "high",
      "enabled": true,
      "created_at": "2025-01-24T10:00:00.000Z"
    }
  }
}
```

---

## Log Export

### POST /logs/export

Export logs for external analysis.

**Authentication**: Required (Admin only)  
**CSRF**: Required

#### Request Body
```json
{
  "timeRange": {
    "start": "2025-01-20T00:00:00.000Z",
    "end": "2025-01-24T23:59:59.000Z"
  },
  "filters": {
    "level": ["error", "warn"],
    "service": ["payment"]
  },
  "format": "json",
  "includeStackTraces": true
}
```

#### Success Response (202 Accepted)
```json
{
  "success": true,
  "data": {
    "export_id": "export-123456",
    "status": "processing",
    "estimated_size": "15MB",
    "estimated_time": "2-3 minutes",
    "download_url": "/logs/export/123456/download"
  }
}
```

---

## Log Retention

### GET /logs/retention

Get log retention policy and storage information.

**Authentication**: Required (Admin only)

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "retention": {
      "error_logs": "90 days",
      "warn_logs": "30 days", 
      "info_logs": "7 days",
      "debug_logs": "1 day"
    },
    "storage": {
      "total_size": "2.5GB",
      "by_level": {
        "error": "500MB",
        "warn": "800MB",
        "info": "1GB",
        "debug": "200MB"
      },
      "oldest_log": "2025-01-01T00:00:00.000Z",
      "cleanup_schedule": "daily at 02:00 UTC"
    },
    "indices": {
      "current_index": "logs-2025-01-24",
      "total_indices": 24,
      "index_size_avg": "100MB"
    }
  }
}
```

---

## Real-time Log Streaming

### WebSocket: /logs/stream

Stream logs in real-time for monitoring dashboards.

**Authentication**: Required (Admin only)  
**Protocol**: WebSocket

#### Connection
```javascript
const ws = new WebSocket('wss://api.permisos.com/logs/stream?token=AUTH_TOKEN');
```

#### Message Format
```json
{
  "type": "log_event",
  "timestamp": "2025-01-24T10:30:15.123Z",
  "level": "error",
  "service": "payment",
  "message": "Payment processing failed",
  "metadata": {
    "userId": 123,
    "errorCode": "card_declined"
  }
}
```

#### Filter Messages
```json
{
  "type": "filter",
  "filters": {
    "level": ["error", "warn"],
    "service": ["payment", "auth"]
  }
}
```

---

## Security Considerations

1. **Access Control**: Only admin users can access log endpoints
2. **Data Sanitization**: Sensitive data is masked in logs
3. **Audit Trail**: All log access is audited
4. **Rate Limiting**: Prevents log query abuse
5. **Retention**: Logs are automatically purged per policy

---

## Best Practices

1. **Efficient Queries**: Use time ranges and filters to limit results
2. **Regular Monitoring**: Set up alerts for critical issues
3. **Log Hygiene**: Regularly review and clean old logs
4. **Performance**: Large queries may impact system performance
5. **Security**: Never log sensitive information like passwords

---

**Last Updated**: June 24, 2025 | **Version**: 2.0