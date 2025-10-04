const BaseController = require('./base.controller');
const { ApiError } = require('../utils/api-response');

class AdminAuditController extends BaseController {
  constructor(container) {
    super(container);
    this.auditService = container.get('auditService');
    this.logger = container.get('logger');
  }

  /**
   * Get audit logs with filtering and pagination
   * GET /admin/audit-logs
   */
  async getAuditLogs(req, res, next) {
    try {
      const filters = {
        adminId: req.query.adminId ? parseInt(req.query.adminId) : undefined,
        action: req.query.action,
        entityType: req.query.entityType,
        entityId: req.query.entityId,
        startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate) : undefined,
        ipAddress: req.query.ipAddress
      };

      const pagination = {
        page: parseInt(req.query.page) || 1,
        limit: Math.min(parseInt(req.query.limit) || 50, 100)
      };

      const result = await this.auditService.getAuditLogs(filters, pagination);

      // Log viewing of audit logs
      await this.auditService.logAdminAction(
        req.user.id,
        'view',
        'audit_logs',
        null,
        { filters },
        req
      );

      return res.json({
        success: true,
        data: result.logs,
        pagination: result.pagination
      });
    } catch (error) {
      this.logger.error('Failed to get audit logs', { error, userId: req.user.id });
      next(error);
    }
  }

  /**
   * Get entity history
   * GET /admin/audit-logs/:entityType/:entityId
   */
  async getEntityHistory(req, res, next) {
    try {
      const { entityType, entityId } = req.params;

      if (!entityType || !entityId) {
        throw new ApiError('Entity type and ID are required', 400);
      }

      const history = await this.auditService.getEntityHistory(entityType, entityId);

      // Log viewing of entity history
      await this.auditService.logAdminAction(
        req.user.id,
        'view',
        'entity_history',
        entityId,
        { entityType },
        req
      );

      return res.json({
        success: true,
        data: history
      });
    } catch (error) {
      this.logger.error('Failed to get entity history', { 
        error, 
        userId: req.user.id,
        entityType: req.params.entityType,
        entityId: req.params.entityId 
      });
      next(error);
    }
  }

  /**
   * Get admin activity
   * GET /admin/activity/:adminId
   */
  async getAdminActivity(req, res, next) {
    try {
      const adminId = parseInt(req.params.adminId);
      
      if (!adminId) {
        throw new ApiError('Admin ID is required', 400);
      }

      // Check if user can view other admin's activity
      if (req.user.id !== adminId && !req.user.permissions?.includes('view_all_admin_activity')) {
        throw new ApiError('Unauthorized to view this admin activity', 403);
      }

      const dateRange = {
        startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate) : undefined
      };

      const activity = await this.auditService.getAdminActivity(adminId, dateRange);

      // Log viewing of admin activity
      await this.auditService.logAdminAction(
        req.user.id,
        'view',
        'admin_activity',
        adminId,
        { dateRange },
        req
      );

      return res.json({
        success: true,
        data: activity
      });
    } catch (error) {
      this.logger.error('Failed to get admin activity', { 
        error, 
        userId: req.user.id,
        targetAdminId: req.params.adminId 
      });
      next(error);
    }
  }

  /**
   * Get security events
   * GET /admin/security-events
   */
  async getSecurityEvents(req, res, next) {
    try {
      const filters = {
        adminId: req.query.adminId ? parseInt(req.query.adminId) : undefined,
        eventType: req.query.eventType,
        severity: req.query.severity,
        resolved: req.query.resolved !== undefined ? req.query.resolved === 'true' : undefined,
        startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate) : undefined
      };

      const pagination = {
        page: parseInt(req.query.page) || 1,
        limit: Math.min(parseInt(req.query.limit) || 50, 100)
      };

      const result = await this.auditService.getSecurityEvents(filters, pagination);

      // Log viewing of security events
      await this.auditService.logAdminAction(
        req.user.id,
        'view',
        'security_events',
        null,
        { filters },
        req
      );

      return res.json({
        success: true,
        data: result.events,
        pagination: result.pagination
      });
    } catch (error) {
      this.logger.error('Failed to get security events', { error, userId: req.user.id });
      next(error);
    }
  }

  /**
   * Resolve security event
   * POST /admin/security-events/:eventId/resolve
   */
  async resolveSecurityEvent(req, res, next) {
    try {
      const eventId = parseInt(req.params.eventId);
      
      if (!eventId) {
        throw new ApiError('Event ID is required', 400);
      }

      const event = await this.auditService.resolveSecurityEvent(eventId, req.user.id);

      // Log resolution of security event
      await this.auditService.logAdminAction(
        req.user.id,
        'update',
        'security_event',
        eventId,
        { resolved: { before: false, after: true } },
        req
      );

      return res.json({
        success: true,
        data: event
      });
    } catch (error) {
      this.logger.error('Failed to resolve security event', { 
        error, 
        userId: req.user.id,
        eventId: req.params.eventId 
      });
      next(error);
    }
  }

  /**
   * Export audit logs
   * GET /admin/audit-logs/export
   */
  async exportAuditLogs(req, res, next) {
    try {
      const filters = {
        adminId: req.query.adminId ? parseInt(req.query.adminId) : undefined,
        action: req.query.action,
        entityType: req.query.entityType,
        entityId: req.query.entityId,
        startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate) : undefined,
        exportedBy: req.user.id
      };

      const format = req.query.format || 'csv';
      const data = await this.auditService.exportAuditLogs(filters, format);

      const contentType = format === 'csv' ? 'text/csv' : 'application/json';
      const filename = `audit-logs-${new Date().toISOString().split('T')[0]}.${format}`;

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      return res.send(data);
    } catch (error) {
      this.logger.error('Failed to export audit logs', { error, userId: req.user.id });
      next(error);
    }
  }

  /**
   * Get audit statistics
   * GET /admin/audit-logs/stats
   */
  async getAuditStats(req, res, next) {
    try {
      const dateRange = {
        startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate) : undefined
      };

      // Get various statistics
      const stats = await this.getAuditStatistics(dateRange);

      // Log viewing of audit statistics
      await this.auditService.logAdminAction(
        req.user.id,
        'view',
        'audit_statistics',
        null,
        { dateRange },
        req
      );

      return res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      this.logger.error('Failed to get audit statistics', { error, userId: req.user.id });
      next(error);
    }
  }

  /**
   * Get my activity (current admin)
   * GET /admin/my-activity
   */
  async getMyActivity(req, res, next) {
    try {
      const dateRange = {
        startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate) : undefined
      };

      const activity = await this.auditService.getAdminActivity(req.user.id, dateRange);

      return res.json({
        success: true,
        data: activity
      });
    } catch (error) {
      this.logger.error('Failed to get my activity', { error, userId: req.user.id });
      next(error);
    }
  }

  // Helper methods

  /**
   * Get audit statistics
   */
  async getAuditStatistics(dateRange) {
    const { startDate, endDate } = this.auditService.getDateRange(dateRange);
    const db = this.container.get('database');

    // Most active admins
    const mostActiveAdmins = await db('admin_audit_logs')
      .select('admin_id', 'users.account_email', 'users.full_name')
      .count('* as action_count')
      .leftJoin('users', 'admin_audit_logs.admin_id', 'users.id')
      .whereBetween('admin_audit_logs.created_at', [startDate, endDate])
      .groupBy('admin_id', 'users.account_email', 'users.full_name')
      .orderBy('action_count', 'desc')
      .limit(10);

    // Most common actions
    const mostCommonActions = await db('admin_audit_logs')
      .select('action')
      .count('* as count')
      .whereBetween('created_at', [startDate, endDate])
      .groupBy('action')
      .orderBy('count', 'desc')
      .limit(10);

    // Activity by hour
    const activityByHour = await db.raw(`
      SELECT 
        EXTRACT(HOUR FROM created_at) as hour,
        COUNT(*) as count
      FROM admin_audit_logs
      WHERE created_at BETWEEN ? AND ?
      GROUP BY EXTRACT(HOUR FROM created_at)
      ORDER BY hour
    `, [startDate, endDate]);

    // Security event summary
    const securityEventSummary = await db('admin_security_events')
      .select('event_type', 'severity')
      .count('* as count')
      .whereBetween('created_at', [startDate, endDate])
      .groupBy('event_type', 'severity');

    return {
      dateRange: { startDate, endDate },
      mostActiveAdmins: mostActiveAdmins.rows || mostActiveAdmins,
      mostCommonActions: mostCommonActions,
      activityByHour: activityByHour.rows || activityByHour,
      securityEventSummary
    };
  }
}

module.exports = AdminAuditController;