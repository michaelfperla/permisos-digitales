# Queue Management API

Documentation for PDF generation queue management and monitoring endpoints.

## Overview

The Queue API provides real-time status tracking and management capabilities for the PDF generation queue system. The system handles permit document generation with automatic retry logic, priority processing, and comprehensive monitoring.

## Base URL
```
/queue
```

---

## Queue Status

### GET /queue/status/:applicationId

Get the current queue status for a specific application.

**Authentication**: Required  
**Ownership**: User must own the application

#### URL Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `applicationId` | number | Application ID |

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "inQueue": true,
    "position": 5,
    "estimatedWaitTime": "5-10 minutes",
    "status": "waiting",
    "progress": 0,
    "retryCount": 0,
    "priority": 0,
    "createdAt": "2025-06-24T10:00:00.000Z"
  }
}
```

#### Response Fields
| Field | Type | Description |
|-------|------|-------------|
| `inQueue` | boolean | Whether application is in queue |
| `position` | number | Position in queue (0 if processing) |
| `estimatedWaitTime` | string | Human-readable wait time estimate |
| `status` | string | Job status: waiting, active, completed, failed |
| `progress` | number | Progress percentage (0-100) |
| `retryCount` | number | Number of retry attempts |
| `priority` | number | Job priority (higher = more urgent) |

#### Not in Queue Response
```json
{
  "success": true,
  "data": {
    "inQueue": false,
    "message": "Application is not currently in the PDF generation queue"
  }
}
```

---

## Queue Statistics

### GET /queue/stats

Get overall queue statistics and performance metrics.

**Authentication**: Required  
**Role**: Admin only

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "queue": {
      "name": "pdf-generation",
      "status": "active",
      "isPaused": false
    },
    "jobs": {
      "waiting": 12,
      "active": 3,
      "completed": 1547,
      "failed": 23,
      "delayed": 0,
      "total": 1585
    },
    "performance": {
      "averageWaitTime": 180000,
      "averageProcessingTime": 45000,
      "successRate": 0.985,
      "throughput": {
        "hourly": 25,
        "daily": 450
      }
    },
    "workers": {
      "count": 2,
      "concurrency": 5,
      "utilization": 0.6
    },
    "health": {
      "status": "healthy",
      "lastJobCompletedAt": "2025-06-24T10:45:00.000Z",
      "oldestWaitingJob": "2025-06-24T10:40:00.000Z"
    }
  }
}
```

---

## Queue Health Check

### GET /queue/health

Public health check endpoint for monitoring systems.

**Authentication**: Not required

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "queueConnected": true,
    "redisConnected": true,
    "issues": [],
    "metrics": {
      "queueDepth": 12,
      "processingRate": 25,
      "errorRate": 0.015,
      "avgProcessingTime": 45000
    }
  }
}
```

#### Unhealthy Response (503 Service Unavailable)
```json
{
  "success": false,
  "error": {
    "code": "QUEUE_UNHEALTHY",
    "message": "Queue system is experiencing issues",
    "details": {
      "issues": [
        "High error rate detected (15%)",
        "Queue depth exceeds threshold (>100)"
      ]
    }
  }
}
```

---

## Failed Jobs Management

### GET /queue/failed

Get list of all failed jobs in the queue.

**Authentication**: Required  
**Role**: Admin only

#### Query Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page (max: 100) |

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "jobs": [
      {
        "id": "pdf-job-12345",
        "applicationId": 12345,
        "failedAt": "2025-06-24T09:30:00.000Z",
        "reason": "Puppeteer timeout: Navigation timeout of 30000 ms exceeded",
        "attemptsMade": 3,
        "data": {
          "userId": 123,
          "permitType": "temporary"
        },
        "stackTrace": "Error: Navigation timeout...",
        "canRetry": true
      }
    ],
    "pagination": {
      "total": 23,
      "page": 1,
      "totalPages": 2
    }
  }
}
```

---

## Retry Failed Job

### POST /queue/retry/:applicationId

Retry a failed PDF generation job.

**Authentication**: Required  
**Role**: Admin only  
**CSRF**: Required

#### URL Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `applicationId` | number | Application ID |

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "jobId": "pdf-job-12345-retry-1",
    "status": "waiting",
    "position": 8,
    "message": "Job requeued successfully"
  }
}
```

#### Error Response (404 Not Found)
```json
{
  "success": false,
  "error": {
    "code": "JOB_NOT_FOUND",
    "message": "No failed job found for this application"
  }
}
```

---

## Clean Old Jobs

### POST /queue/clean

Remove old completed and failed jobs from the queue.

**Authentication**: Required  
**Role**: Admin only  
**CSRF**: Required

#### Request Body
```json
{
  "gracePeriodHours": 24,
  "jobTypes": ["completed", "failed"]
}
```

#### Request Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `gracePeriodHours` | number | 24 | Keep jobs newer than this |
| `jobTypes` | array | ["completed", "failed"] | Job types to clean |

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "cleaned": {
      "completed": 450,
      "failed": 18,
      "total": 468
    },
    "message": "Successfully cleaned 468 old jobs"
  }
}
```

---

## Pause Queue

### POST /queue/pause

Pause all queue processing.

**Authentication**: Required  
**Role**: Admin only  
**CSRF**: Required

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "status": "paused",
    "message": "Queue processing paused successfully"
  }
}
```

---

## Resume Queue

### POST /queue/resume

Resume queue processing after pause.

**Authentication**: Required  
**Role**: Admin only  
**CSRF**: Required

#### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "status": "active",
    "message": "Queue processing resumed successfully"
  }
}
```

---

## Queue Implementation Details

### Queue Configuration
```javascript
{
  "concurrency": 5,          // Max parallel jobs
  "maxRetriesPerJob": 3,     // Retry attempts
  "retryDelay": 60000,       // 1 minute between retries
  "jobTimeout": 300000,      // 5 minute timeout
  "removeOnComplete": 100,   // Keep last 100 completed
  "removeOnFail": 50         // Keep last 50 failed
}
```

### Job Priority Levels
| Priority | Use Case | Description |
|----------|----------|-------------|
| 0 | Normal | Standard processing |
| 1 | Retry | Failed job retries |
| 2 | Admin | Admin-triggered jobs |
| 3 | Critical | System-critical jobs |

### Wait Time Estimation
```
Base time: 45 seconds per job
Estimated wait = (position * baseTime) / workerCount
```

### Job States
| State | Description | Next State |
|-------|-------------|------------|
| `waiting` | In queue, waiting to process | `active` |
| `active` | Currently being processed | `completed` or `failed` |
| `completed` | Successfully processed | Terminal state |
| `failed` | Processing failed | Can be retried |
| `delayed` | Scheduled for later | `waiting` |

---

## Error Handling

### Common Queue Errors

| Code | Description | Resolution |
|------|-------------|------------|
| `QUEUE_UNAVAILABLE` | Redis/Queue connection lost | Check Redis connection |
| `JOB_NOT_FOUND` | Job doesn't exist | Verify application ID |
| `QUEUE_PAUSED` | Queue is paused | Resume queue processing |
| `MAX_RETRIES_EXCEEDED` | Job failed too many times | Manual intervention required |
| `TIMEOUT` | Job processing timeout | Increase timeout or optimize |

### Automatic Retry Logic
1. **First retry**: After 1 minute
2. **Second retry**: After 2 minutes  
3. **Third retry**: After 5 minutes
4. **Failed permanently**: After 3 retries

### Monitoring Alerts
- Queue depth > 100 jobs
- Error rate > 10%
- No jobs completed in 10 minutes
- Worker utilization > 90%

---

## Performance Optimization

### Best Practices
1. Monitor queue depth regularly
2. Scale workers based on load
3. Clean old jobs periodically
4. Set appropriate timeouts
5. Use priority for urgent jobs

### Scaling Guidelines
| Queue Depth | Recommended Workers |
|-------------|-------------------|
| < 50 | 1-2 workers |
| 50-200 | 3-5 workers |
| 200-500 | 5-10 workers |
| > 500 | Consider horizontal scaling |

---

**Last Updated**: June 24, 2025 | **Version**: 2.0