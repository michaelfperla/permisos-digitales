# Health Check API

Documentation for system health monitoring endpoints.

## Overview

The Health Check API provides comprehensive system health monitoring capabilities for both external monitoring systems and internal diagnostics. These endpoints help ensure system reliability and enable proactive issue detection.

## Base URL
```
/health
```

## Authentication
- **Public endpoints**: No authentication required
- **Internal endpoints**: Require API key

---

## Basic Health Check

### GET /health

Simple health check endpoint for basic monitoring.

**Authentication**: Not required  
**Use Case**: Load balancer health checks, uptime monitoring

#### Success Response (200 OK)
```json
{
  "status": "UP",
  "timestamp": "2025-01-24T10:00:00.000Z"
}
```

#### Error Response (503 Service Unavailable)
```json
{
  "status": "DOWN",
  "timestamp": "2025-01-24T10:00:00.000Z",
  "error": "Database connection failed"
}
```

---

## Detailed Health Check

### GET /health/details

Comprehensive health check with component status.

**Authentication**: Not required  
**Use Case**: Detailed monitoring dashboards

#### Success Response (200 OK)
```json
{
  "status": "UP",
  "timestamp": "2025-01-24T10:00:00.000Z",
  "components": {
    "database": {
      "status": "UP",
      "latency": 5,
      "details": {
        "activeConnections": 15,
        "maxConnections": 100,
        "version": "PostgreSQL 14.5"
      }
    },
    "redis": {
      "status": "UP",
      "latency": 2,
      "details": {
        "connected": true,
        "memoryUsage": "125MB",
        "uptimeHours": 720
      }
    },
    "storage": {
      "status": "UP",
      "details": {
        "type": "local",
        "available": true,
        "freeSpace": "45GB"
      }
    },
    "stripe": {
      "status": "UP",
      "latency": 150,
      "details": {
        "mode": "live",
        "webhookStatus": "active"
      }
    },
    "email": {
      "status": "UP",
      "details": {
        "provider": "AWS SES",
        "verified": true,
        "sendingRate": "14/second"
      }
    }
  },
  "system": {
    "uptime": 2592000,
    "memory": {
      "used": "2.1GB",
      "free": "1.9GB",
      "total": "4GB",
      "percentage": 52.5
    },
    "cpu": {
      "usage": 35.2,
      "loadAverage": [1.2, 1.5, 1.8]
    }
  },
  "application": {
    "version": "2.0.0",
    "environment": "production",
    "node": {
      "version": "18.17.0",
      "memory": {
        "rss": "125MB",
        "heapUsed": "85MB",
        "heapTotal": "150MB"
      }
    }
  }
}
```

#### Degraded Response (200 OK)
```json
{
  "status": "DEGRADED",
  "timestamp": "2025-01-24T10:00:00.000Z",
  "components": {
    "database": {
      "status": "UP"
    },
    "redis": {
      "status": "DOWN",
      "error": "Connection timeout",
      "impact": "Session management degraded, using fallback"
    }
  }
}
```

---

## Readiness Check

### GET /health/readiness

Kubernetes readiness probe endpoint.

**Authentication**: Not required  
**Use Case**: Container orchestration readiness checks

#### Ready Response (200 OK)
```json
{
  "ready": true,
  "checks": {
    "database": "ready",
    "migrations": "completed",
    "requiredServices": "available"
  }
}
```

#### Not Ready Response (503 Service Unavailable)
```json
{
  "ready": false,
  "checks": {
    "database": "ready",
    "migrations": "pending",
    "requiredServices": "available"
  },
  "message": "Application not ready: Database migrations pending"
}
```

---

## Liveness Check

### GET /health/liveness

Kubernetes liveness probe endpoint.

**Authentication**: Not required  
**Use Case**: Container restart detection

#### Alive Response (200 OK)
```json
{
  "alive": true,
  "pid": 1234,
  "uptime": 86400
}
```

#### Dead Response (503 Service Unavailable)
Application would not respond in this case - container should restart.

---

## Comprehensive Health Check

### GET /health/comprehensive

Complete system health analysis with performance metrics.

**Authentication**: Not required  
**Rate Limit**: 1 request per minute  
**Use Case**: Detailed diagnostics, troubleshooting

#### Success Response (200 OK)
```json
{
  "status": "HEALTHY",
  "score": 95,
  "timestamp": "2025-01-24T10:00:00.000Z",
  "summary": {
    "healthy": 8,
    "degraded": 1,
    "down": 0
  },
  "checks": {
    "database": {
      "status": "HEALTHY",
      "responseTime": 5,
      "metrics": {
        "connectionPool": {
          "active": 15,
          "idle": 35,
          "waiting": 0,
          "max": 50
        },
        "performance": {
          "avgQueryTime": 12,
          "slowQueries": 2,
          "deadlocks": 0
        }
      }
    },
    "redis": {
      "status": "HEALTHY",
      "responseTime": 2,
      "metrics": {
        "memory": {
          "used": "125MB",
          "peak": "200MB",
          "fragmentation": 1.2
        },
        "stats": {
          "hits": 45678,
          "misses": 234,
          "hitRate": 0.995
        }
      }
    },
    "queue": {
      "status": "DEGRADED",
      "issues": ["High queue depth"],
      "metrics": {
        "depth": 156,
        "processing": 5,
        "failed": 3,
        "avgWaitTime": 300000
      }
    },
    "payments": {
      "status": "HEALTHY",
      "metrics": {
        "successRate": 0.98,
        "avgProcessingTime": 1250,
        "recentFailures": 2
      }
    }
  },
  "performance": {
    "api": {
      "avgResponseTime": 125,
      "p95ResponseTime": 450,
      "p99ResponseTime": 1200,
      "requestsPerSecond": 45
    },
    "database": {
      "avgQueryTime": 12,
      "connectionWaitTime": 0,
      "transactionRate": 120
    }
  },
  "resources": {
    "memory": {
      "process": "350MB",
      "system": "2.1GB/4GB"
    },
    "disk": {
      "app": "1.2GB",
      "logs": "500MB", 
      "uploads": "15GB",
      "available": "45GB"
    }
  },
  "recommendations": [
    {
      "component": "queue",
      "severity": "warning",
      "message": "Queue depth exceeds threshold. Consider scaling workers.",
      "metric": "depth > 100"
    }
  ]
}
```

---

## Internal Health Check

### GET /health/internal

Protected endpoint with sensitive system information.

**Authentication**: Required (API Key)  
**Headers**: `x-internal-api-key: your-api-key`  
**Use Case**: Internal monitoring systems

#### Request
```
GET /health/internal
x-internal-api-key: internal-monitoring-key-123
```

#### Success Response (200 OK)
```json
{
  "status": "UP",
  "timestamp": "2025-01-24T10:00:00.000Z",
  "internal": {
    "database": {
      "host": "db.internal",
      "connections": {
        "active": 15,
        "idle": 35,
        "total": 50
      },
      "replication": {
        "lag": 0,
        "status": "streaming"
      }
    },
    "cache": {
      "hitRate": 0.95,
      "evictions": 1234,
      "memory": "125MB/512MB"
    },
    "secrets": {
      "loaded": true,
      "provider": "environment",
      "lastRotated": "2025-01-01T00:00:00.000Z"
    },
    "queues": {
      "pdf-generation": {
        "workers": 2,
        "active": 3,
        "waiting": 45,
        "failed": 2
      },
      "email": {
        "workers": 1,
        "active": 0,
        "waiting": 12,
        "failed": 0
      }
    },
    "integrations": {
      "stripe": {
        "mode": "live",
        "webhookSigningConfigured": true,
        "lastWebhook": "2025-01-24T09:45:00.000Z"
      },
      "aws": {
        "ses": "verified",
        "s3": "connected",
        "region": "us-east-1"
      }
    }
  },
  "alerts": [
    {
      "level": "warning",
      "component": "database",
      "message": "Connection pool usage above 70%",
      "since": "2025-01-24T09:30:00.000Z"
    }
  ]
}
```

#### Unauthorized Response (401 Unauthorized)
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or missing API key"
  }
}
```

---

## Health Check Response Codes

| Status | HTTP Code | Description |
|--------|-----------|-------------|
| `UP` / `HEALTHY` | 200 | All systems operational |
| `DEGRADED` | 200 | Some components have issues but system is functional |
| `DOWN` / `UNHEALTHY` | 503 | Critical components are down |

---

## Component Status Values

| Status | Description | Action Required |
|--------|-------------|-----------------|
| `UP` | Component is working normally | None |
| `DEGRADED` | Component has issues but is functional | Monitor closely |
| `DOWN` | Component is not working | Immediate attention |

---

## Monitoring Best Practices

1. **Frequency**: 
   - Basic health: Every 30 seconds
   - Detailed health: Every 5 minutes
   - Comprehensive: Every 15 minutes
   - Internal: Every 5 minutes

2. **Alerting Thresholds**:
   - Immediate: Any component DOWN
   - Warning: Component DEGRADED for >5 minutes
   - Critical: Multiple components DEGRADED

3. **Response Time Thresholds**:
   - Database: <50ms
   - Redis: <10ms  
   - API: <500ms (p95)
   - Stripe: <2000ms

4. **Resource Thresholds**:
   - Memory: Alert at 80%
   - CPU: Alert at 70% sustained
   - Disk: Alert at 85%
   - Connections: Alert at 80%

---

## Integration Examples

### Prometheus
```yaml
- job_name: 'permisos-api'
  scrape_interval: 30s
  static_configs:
    - targets: ['api.permisos.com']
  metrics_path: '/metrics'
```

### Datadog
```yaml
init_config:

instances:
  - url: https://api.permisos.com/health/details
    name: permisos_api
    timeout: 10
    skip_event: true
```

### New Relic
```javascript
const newrelic = require('newrelic');
// Health checks are automatically instrumented
```

---

**Last Updated**: June 24, 2025 | **Version**: 2.0