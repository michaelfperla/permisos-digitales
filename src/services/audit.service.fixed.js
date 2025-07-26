const BaseService = require('./base.service');
const { sanitizeForLogging } = require('../utils/security-utils');

class AuditService extends BaseService {
  constructor(dependencies) {
    super(dependencies);
    this.db = dependencies.database;
    this.logger = dependencies.logger || console;
    this.redis = dependencies.redis;
    this.securityThresholds = {
      failedLoginAttempts: 5,
      bulkOperationThreshold: 50,
      rapidAccessThreshold: 100, // requests per minute
      largeDataExportThreshold: 1000 // records
    };
  }

  /**
   * Log an admin action
   * @param {number} adminId - ID of the admin performing the action
   * @param {string} action - Action being performed
   * @param {string} entityType - Type of entity being acted upon
   * @param {string|number} entityId - ID of the entity
   * @param {object} changes - Object containing before/after values
   * @param {object} req - Express request object
   */
  async logAdminAction(adminId, action, entityType, entityId, changes = null, req = null) {
    try {
      const auditData = {
        admin_id: adminId,
        action,
        entity_type: entityType,
        entity_id: entityId ? String(entityId) : null,
        changes: changes ? this.sanitizeChanges(changes) : null,
        ip_address: this.getClientIp(req),
        user_agent: req?.headers?.['user-agent'] || null,
        request_id: req?.id || null,
        session_id: req?.session?.id || null,
        metadata: {
          timestamp: new Date().toISOString(),
          path: req?.path,
          method: req?.method
        }
      };

      // Use pg-pool style query
      const result = await this.db.query(
        `INSERT INTO admin_audit_logs (admin_id, action, entity_type, entity_id, changes, ip_address, user_agent, request_id, session_id, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [auditData.admin_id, auditData.action, auditData.entity_type, auditData.entity_id, 
         JSON.stringify(auditData.changes), auditData.ip_address, auditData.user_agent, 
         auditData.request_id, auditData.session_id, JSON.stringify(auditData.metadata)]
      );
      
      // Check for security events
      await this.checkSecurityEvents(adminId, action, entityType, req);
      
      // Update admin activity cache
      await this.updateActivityCache(adminId, action);
      
      return result.rows[0];
    } catch (error) {
      this.logger.error('Failed to log admin action', { error, adminId, action });
      // Don't throw - audit logging should not break the main operation
    }
  }

  /**
   * Get audit logs with filtering and pagination
   */
  async getAuditLogs(filters = {}, pagination = {}) {
    try {
      const { page = 1, limit = 50 } = pagination;
      const offset = (page - 1) * limit;

      // Build the base query
      let whereConditions = [];
      let params = [];
      let paramIndex = 1;

      if (filters.adminId) {
        whereConditions.push(`admin_audit_logs.admin_id = $${paramIndex++}`);
        params.push(filters.adminId);
      }
      if (filters.action) {
        whereConditions.push(`admin_audit_logs.action = $${paramIndex++}`);
        params.push(filters.action);
      }
      if (filters.entityType) {
        whereConditions.push(`admin_audit_logs.entity_type = $${paramIndex++}`);
        params.push(filters.entityType);
      }
      if (filters.entityId) {
        whereConditions.push(`admin_audit_logs.entity_id = $${paramIndex++}`);
        params.push(String(filters.entityId));
      }
      if (filters.startDate) {
        whereConditions.push(`admin_audit_logs.created_at >= $${paramIndex++}`);
        params.push(filters.startDate);
      }
      if (filters.endDate) {
        whereConditions.push(`admin_audit_logs.created_at <= $${paramIndex++}`);
        params.push(filters.endDate);
      }
      if (filters.ipAddress) {
        whereConditions.push(`admin_audit_logs.ip_address = $${paramIndex++}`);
        params.push(filters.ipAddress);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Get total count
      const countResult = await this.db.query(
        `SELECT COUNT(*) as count FROM admin_audit_logs ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].count);

      // Get paginated results
      params.push(limit);
      params.push(offset);
      const logsResult = await this.db.query(
        `SELECT 
          admin_audit_logs.*,
          users.email as admin_email,
          users.full_name as admin_name
        FROM admin_audit_logs
        LEFT JOIN users ON admin_audit_logs.admin_id = users.id
        ${whereClause}
        ORDER BY admin_audit_logs.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        params
      );

      return {
        logs: logsResult.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      this.logger.error('Failed to get audit logs', { error, filters });
      throw error;
    }
  }

  /**
   * Get admin activity summary
   */
  async getAdminActivity(adminId, dateRange = {}) {
    try {
      const { startDate, endDate } = this.getDateRange(dateRange);

      // Get activity summary from cache first
      const cacheKey = `admin_activity:${adminId}:${startDate}:${endDate}`;
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Get activity counts by action
      const activityCountsResult = await this.db.query(
        `SELECT action, COUNT(*) as count
         FROM admin_audit_logs
         WHERE admin_id = $1 AND created_at BETWEEN $2 AND $3
         GROUP BY action
         ORDER BY count DESC`,
        [adminId, startDate, endDate]
      );

      // Get activity by entity type
      const entityActivityResult = await this.db.query(
        `SELECT entity_type, COUNT(*) as count
         FROM admin_audit_logs
         WHERE admin_id = $1 AND created_at BETWEEN $2 AND $3
         GROUP BY entity_type
         ORDER BY count DESC`,
        [adminId, startDate, endDate]
      );

      // Get recent activity
      const recentActivityResult = await this.db.query(
        `SELECT *
         FROM admin_audit_logs
         WHERE admin_id = $1 AND created_at BETWEEN $2 AND $3
         ORDER BY created_at DESC
         LIMIT 20`,
        [adminId, startDate, endDate]
      );

      // Get security events
      const securityEventsResult = await this.db.query(
        `SELECT *
         FROM admin_security_events
         WHERE admin_id = $1 AND created_at BETWEEN $2 AND $3
         ORDER BY created_at DESC`,
        [adminId, startDate, endDate]
      );

      const activity = {
        adminId,
        dateRange: { startDate, endDate },
        summary: {
          totalActions: activityCountsResult.rows.reduce((sum, a) => sum + parseInt(a.count), 0),
          actionBreakdown: activityCountsResult.rows,
          entityBreakdown: entityActivityResult.rows
        },
        recentActivity: recentActivityResult.rows,
        securityEvents: securityEventsResult.rows,
        lastActive: recentActivityResult.rows[0]?.created_at || null
      };

      // Cache for 5 minutes
      await this.redis.setex(cacheKey, 300, JSON.stringify(activity));

      return activity;
    } catch (error) {
      this.logger.error('Failed to get admin activity', { error, adminId });
      throw error;
    }
  }

  /**
   * Get entity history
   */
  async getEntityHistory(entityType, entityId) {
    try {
      const historyResult = await this.db.query(
        `SELECT 
          admin_audit_logs.*,
          users.email as admin_email,
          users.full_name as admin_name
         FROM admin_audit_logs
         LEFT JOIN users ON admin_audit_logs.admin_id = users.id
         WHERE admin_audit_logs.entity_type = $1 AND admin_audit_logs.entity_id = $2
         ORDER BY admin_audit_logs.created_at DESC`,
        [entityType, String(entityId)]
      );

      // Group changes by date
      const timeline = this.groupHistoryByDate(historyResult.rows);

      return {
        entityType,
        entityId,
        totalChanges: historyResult.rows.length,
        history: historyResult.rows,
        timeline
      };
    } catch (error) {
      this.logger.error('Failed to get entity history', { error, entityType, entityId });
      throw error;
    }
  }

  /**
   * Log security event
   */
  async logSecurityEvent(eventType, severity, description, metadata = {}, adminId = null, req = null) {
    try {
      const eventData = {
        admin_id: adminId,
        event_type: eventType,
        severity,
        description,
        ip_address: this.getClientIp(req),
        user_agent: req?.headers?.['user-agent'] || null,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
          path: req?.path,
          method: req?.method
        }
      };

      const result = await this.db.query(
        `INSERT INTO admin_security_events (admin_id, event_type, severity, description, ip_address, user_agent, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [eventData.admin_id, eventData.event_type, eventData.severity, eventData.description,
         eventData.ip_address, eventData.user_agent, JSON.stringify(eventData.metadata)]
      );

      // Alert if critical
      if (severity === 'critical') {
        await this.alertSecurityTeam(result.rows[0]);
      }

      return result.rows[0];
    } catch (error) {
      this.logger.error('Failed to log security event', { error, eventType });
    }
  }

  /**
   * Get security events
   */
  async getSecurityEvents(filters = {}, pagination = {}) {
    try {
      const { page = 1, limit = 50 } = pagination;
      const offset = (page - 1) * limit;

      // Build the base query
      let whereConditions = [];
      let params = [];
      let paramIndex = 1;

      if (filters.adminId) {
        whereConditions.push(`admin_security_events.admin_id = $${paramIndex++}`);
        params.push(filters.adminId);
      }
      if (filters.eventType) {
        whereConditions.push(`admin_security_events.event_type = $${paramIndex++}`);
        params.push(filters.eventType);
      }
      if (filters.severity) {
        whereConditions.push(`admin_security_events.severity = $${paramIndex++}`);
        params.push(filters.severity);
      }
      if (filters.resolved !== undefined) {
        whereConditions.push(`admin_security_events.resolved = $${paramIndex++}`);
        params.push(filters.resolved);
      }
      if (filters.startDate) {
        whereConditions.push(`admin_security_events.created_at >= $${paramIndex++}`);
        params.push(filters.startDate);
      }
      if (filters.endDate) {
        whereConditions.push(`admin_security_events.created_at <= $${paramIndex++}`);
        params.push(filters.endDate);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Get total count
      const countResult = await this.db.query(
        `SELECT COUNT(*) as count FROM admin_security_events ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].count);

      // Get paginated results
      params.push(limit);
      params.push(offset);
      const eventsResult = await this.db.query(
        `SELECT 
          admin_security_events.*,
          users.email as admin_email,
          users.full_name as admin_name,
          resolver.email as resolved_by_email,
          resolver.full_name as resolved_by_name
        FROM admin_security_events
        LEFT JOIN users ON admin_security_events.admin_id = users.id
        LEFT JOIN users as resolver ON admin_security_events.resolved_by = resolver.id
        ${whereClause}
        ORDER BY admin_security_events.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        params
      );

      return {
        events: eventsResult.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      this.logger.error('Failed to get security events', { error, filters });
      throw error;
    }
  }

  /**
   * Mark security event as resolved
   */
  async resolveSecurityEvent(eventId, resolvedBy) {
    try {
      const result = await this.db.query(
        `UPDATE admin_security_events
         SET resolved = true, resolved_at = NOW(), resolved_by = $1
         WHERE id = $2
         RETURNING *`,
        [resolvedBy, eventId]
      );

      return result.rows[0];
    } catch (error) {
      this.logger.error('Failed to resolve security event', { error, eventId });
      throw error;
    }
  }

  // Helper methods

  /**
   * Check for security events based on admin actions
   */
  async checkSecurityEvents(adminId, action, entityType, req) {
    try {
      // Check for failed login attempts
      if (action === 'failed_login') {
        await this.checkFailedLoginAttempts(adminId, req);
      }

      // Check for bulk operations
      if (action === 'bulk_operation') {
        await this.checkBulkOperations(adminId, entityType, req);
      }

      // Check for rapid access patterns
      await this.checkRapidAccess(adminId, req);

      // Check for unusual access patterns
      await this.checkUnusualAccessPatterns(adminId, action, req);
    } catch (error) {
      this.logger.error('Failed to check security events', { error });
    }
  }

  /**
   * Check failed login attempts
   */
  async checkFailedLoginAttempts(adminId, req) {
    const key = `failed_login:${adminId || this.getClientIp(req)}`;
    const attempts = await this.redis.incr(key);
    
    if (attempts === 1) {
      await this.redis.expire(key, 3600); // 1 hour window
    }

    if (attempts >= this.securityThresholds.failedLoginAttempts) {
      await this.logSecurityEvent(
        'failed_login_attempt',
        'warning',
        `${attempts} failed login attempts detected`,
        { attempts },
        adminId,
        req
      );
    }
  }

  /**
   * Check bulk operations
   */
  async checkBulkOperations(adminId, entityType, req) {
    const metadata = req?.body?.metadata || {};
    const recordCount = metadata.recordCount || 0;

    if (recordCount >= this.securityThresholds.bulkOperationThreshold) {
      await this.logSecurityEvent(
        'bulk_operation_detected',
        'warning',
        `Large bulk operation on ${entityType}: ${recordCount} records`,
        { entityType, recordCount },
        adminId,
        req
      );
    }
  }

  /**
   * Check rapid access patterns
   */
  async checkRapidAccess(adminId, req) {
    const key = `rapid_access:${adminId}`;
    const count = await this.redis.incr(key);
    
    if (count === 1) {
      await this.redis.expire(key, 60); // 1 minute window
    }

    if (count >= this.securityThresholds.rapidAccessThreshold) {
      await this.logSecurityEvent(
        'unusual_access_pattern',
        'warning',
        `Rapid access pattern detected: ${count} requests in 1 minute`,
        { requestCount: count },
        adminId,
        req
      );
    }
  }

  /**
   * Check unusual access patterns
   */
  async checkUnusualAccessPatterns(adminId, action, req) {
    // Check for access from new IP
    const ipAddress = this.getClientIp(req);
    if (ipAddress && adminId) {
      const knownIpsKey = `known_ips:${adminId}`;
      const knownIps = await this.redis.smembers(knownIpsKey);
      
      if (knownIps.length > 0 && !knownIps.includes(ipAddress)) {
        await this.logSecurityEvent(
          'unusual_access_pattern',
          'info',
          `Access from new IP address: ${ipAddress}`,
          { ipAddress, previousIps: knownIps },
          adminId,
          req
        );
      }
      
      // Add IP to known IPs
      await this.redis.sadd(knownIpsKey, ipAddress);
      await this.redis.expire(knownIpsKey, 86400 * 30); // 30 days
    }
  }

  /**
   * Update activity cache
   */
  async updateActivityCache(adminId, action) {
    try {
      const key = `admin_last_activity:${adminId}`;
      await this.redis.setex(key, 3600, JSON.stringify({
        action,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      this.logger.error('Failed to update activity cache', { error });
    }
  }

  /**
   * Alert security team about critical events
   */
  async alertSecurityTeam(event) {
    try {
      // Here you would integrate with your notification service
      this.logger.warn('Critical security event', { event });
      // Example: await this.notificationService.sendSecurityAlert(event);
    } catch (error) {
      this.logger.error('Failed to alert security team', { error });
    }
  }

  /**
   * Sanitize changes object to remove sensitive data
   */
  sanitizeChanges(changes) {
    if (!changes) return null;

    const sanitized = {};
    const sensitiveFields = ['password', 'token', 'secret', 'api_key', 'credit_card'];

    for (const [key, value] of Object.entries(changes)) {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        sanitized[key] = { before: '[REDACTED]', after: '[REDACTED]' };
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Get client IP address
   */
  getClientIp(req) {
    if (!req) return null;
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
           req.connection?.remoteAddress || 
           req.socket?.remoteAddress ||
           null;
  }

  /**
   * Get date range helper
   */
  getDateRange(dateRange) {
    const endDate = dateRange.endDate || new Date();
    const startDate = dateRange.startDate || new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    return { startDate, endDate };
  }

  /**
   * Group history by date
   */
  groupHistoryByDate(history) {
    const timeline = {};
    
    history.forEach(entry => {
      const date = new Date(entry.created_at).toISOString().split('T')[0];
      if (!timeline[date]) {
        timeline[date] = [];
      }
      timeline[date].push(entry);
    });

    return timeline;
  }

  /**
   * Export audit logs
   */
  async exportAuditLogs(filters = {}, format = 'csv') {
    try {
      const { logs } = await this.getAuditLogs(filters, { limit: 10000 });
      
      // Log the export action
      await this.logAdminAction(
        filters.exportedBy,
        'export',
        'audit_logs',
        null,
        { filters, recordCount: logs.length },
        null
      );

      // Check if large export
      if (logs.length >= this.securityThresholds.largeDataExportThreshold) {
        await this.logSecurityEvent(
          'data_export_large',
          'warning',
          `Large audit log export: ${logs.length} records`,
          { recordCount: logs.length, filters },
          filters.exportedBy
        );
      }

      if (format === 'csv') {
        return this.convertToCSV(logs);
      } else if (format === 'json') {
        return JSON.stringify(logs, null, 2);
      } else {
        throw new Error('Unsupported export format');
      }
    } catch (error) {
      this.logger.error('Failed to export audit logs', { error, filters });
      throw error;
    }
  }

  /**
   * Convert logs to CSV format
   */
  convertToCSV(logs) {
    if (logs.length === 0) return '';

    const headers = Object.keys(logs[0]).join(',');
    const rows = logs.map(log => 
      Object.values(log).map(value => 
        typeof value === 'object' ? JSON.stringify(value) : value
      ).join(',')
    );

    return [headers, ...rows].join('\n');
  }
}

module.exports = AuditService;