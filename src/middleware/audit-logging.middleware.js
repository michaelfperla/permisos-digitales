/**
 * Middleware to automatically log admin actions
 */
class AuditLoggingMiddleware {
  constructor(container) {
    if (container && typeof container.get === 'function') {
      this.auditService = container.get('auditService');
      this.logger = container.get('logger');
      this.container = container;
    } else {
      // Fallback for when container is not available
      this.logger = require('../utils/logger').logger;
      this.container = null;
      this.auditService = null;
    }
  }
  
  /**
   * Get audit service lazily
   */
  getAuditService() {
    if (this.auditService) return this.auditService;
    
    try {
      const { getAuditService } = require('../utils/inject-audit-service');
      this.auditService = getAuditService();
      return this.auditService;
    } catch (error) {
      this.logger.error('Failed to get audit service:', error);
      return null;
    }
  }

  /**
   * Automatically log admin actions based on route and method
   */
  logAdminAction() {
    return async (req, res, next) => {
      // Skip if not an admin user
      if (!req.user || req.user.role !== 'admin') {
        return next();
      }

      // Store original methods
      const originalJson = res.json;
      const originalSend = res.send;
      const originalStatus = res.status;

      // Capture the response status
      let responseStatus = 200;
      res.status = function(status) {
        responseStatus = status;
        return originalStatus.call(this, status);
      };

      // Helper to log action after response
      const logAction = async (body) => {
        try {
          // Skip if request failed
          if (responseStatus >= 400) {
            return;
          }

          const actionDetails = this.getActionDetails(req);
          if (!actionDetails) {
            return;
          }

          const { action, entityType, entityId } = actionDetails;
          
          // Extract changes if applicable
          let changes = null;
          if (req.method === 'PUT' || req.method === 'PATCH' || req.method === 'POST') {
            changes = this.extractChanges(req, body);
          }

          const auditService = this.getAuditService();
          if (auditService) {
            await auditService.logAdminAction(
              req.user.id,
              action,
              entityType,
              entityId,
              changes,
              req
            );
          }
        } catch (error) {
          this.logger.error('Failed to log admin action', { error, path: req.path });
        }
      };

      // Override response methods
      res.json = function(body) {
        logAction(body);
        return originalJson.call(this, body);
      };

      res.send = function(body) {
        logAction(body);
        return originalSend.call(this, body);
      };

      next();
    };
  }

  /**
   * Extract action details from request
   */
  getActionDetails(req) {
    const path = req.route?.path || req.path;
    const method = req.method;
    
    // Map of route patterns to action details
    const routeMap = {
      // User management
      'GET /admin/users': { action: 'view', entityType: 'user_list' },
      'GET /admin/users/:id': { action: 'view', entityType: 'user', entityId: req.params.id },
      'PUT /admin/users/:id': { action: 'update', entityType: 'user', entityId: req.params.id },
      'POST /admin/users/:id/suspend': { action: 'suspend', entityType: 'user', entityId: req.params.id },
      'POST /admin/users/:id/activate': { action: 'activate', entityType: 'user', entityId: req.params.id },
      'DELETE /admin/users/:id': { action: 'delete', entityType: 'user', entityId: req.params.id },
      
      // Application management
      'GET /admin/applications': { action: 'view', entityType: 'application_list' },
      'GET /admin/applications/:id': { action: 'view', entityType: 'application', entityId: req.params.id },
      'PUT /admin/applications/:id': { action: 'update', entityType: 'application', entityId: req.params.id },
      'POST /admin/applications/:id/approve': { action: 'approve', entityType: 'application', entityId: req.params.id },
      'POST /admin/applications/:id/reject': { action: 'reject', entityType: 'application', entityId: req.params.id },
      'DELETE /admin/applications/:id': { action: 'delete', entityType: 'application', entityId: req.params.id },
      
      // Payment management
      'GET /admin/payments': { action: 'view', entityType: 'payment_list' },
      'GET /admin/payments/:id': { action: 'view', entityType: 'payment', entityId: req.params.id },
      'POST /admin/payments/:id/refund': { action: 'update', entityType: 'payment', entityId: req.params.id },
      
      // System configuration
      'GET /admin/config': { action: 'view', entityType: 'configuration' },
      'PUT /admin/config': { action: 'configuration_change', entityType: 'configuration' },
      
      // Bulk operations
      'POST /admin/bulk/approve': { action: 'bulk_operation', entityType: 'applications' },
      'POST /admin/bulk/reject': { action: 'bulk_operation', entityType: 'applications' },
      'POST /admin/bulk/delete': { action: 'bulk_operation', entityType: req.body.entityType || 'unknown' },
      
      // Exports
      'GET /admin/export/users': { action: 'export', entityType: 'users' },
      'GET /admin/export/applications': { action: 'export', entityType: 'applications' },
      'GET /admin/export/payments': { action: 'export', entityType: 'payments' },
      
      // Email operations
      'POST /admin/email/send': { action: 'email_sent', entityType: 'email' },
      'POST /admin/email/bulk': { action: 'bulk_operation', entityType: 'email' },
      
      // Failed permits
      'GET /admin/failed-permits': { action: 'view', entityType: 'failed_permit_list' },
      'POST /admin/failed-permits/:id/retry': { action: 'update', entityType: 'failed_permit', entityId: req.params.id },
      
      // Login/logout (handled separately but included for completeness)
      'POST /admin/login': { action: 'login', entityType: 'auth' },
      'POST /admin/logout': { action: 'logout', entityType: 'auth' }
    };

    // Find matching route
    const routeKey = `${method} ${path}`;
    return routeMap[routeKey] || null;
  }

  /**
   * Extract changes from request
   */
  extractChanges(req, responseBody) {
    try {
      const changes = {};
      
      // For updates, try to get before/after values
      if (req.method === 'PUT' || req.method === 'PATCH') {
        // If the response includes the updated object
        if (responseBody?.data) {
          const updatedFields = Object.keys(req.body);
          updatedFields.forEach(field => {
            if (req.body[field] !== undefined) {
              changes[field] = {
                before: '[Previous Value]', // In real implementation, you'd fetch this
                after: req.body[field]
              };
            }
          });
        }
      }
      
      // For creates, just log what was created
      if (req.method === 'POST' && responseBody?.data) {
        changes.created = req.body;
      }
      
      // For bulk operations
      if (req.body?.ids && Array.isArray(req.body.ids)) {
        changes.affectedRecords = req.body.ids.length;
        changes.recordIds = req.body.ids;
      }
      
      return Object.keys(changes).length > 0 ? changes : null;
    } catch (error) {
      this.logger.error('Failed to extract changes', { error });
      return null;
    }
  }

  /**
   * Log failed admin login attempts
   */
  logFailedLogin() {
    return async (req, res, next) => {
      const originalJson = res.json;
      
      res.json = async function(body) {
        try {
          // Check if this is a failed login
          if (req.path === '/admin/login' && body?.success === false) {
            const email = req.body?.email;
            const adminUser = email ? await this.getAdminByEmail(email) : null;
            
            const auditService = this.getAuditService();
          if (auditService) {
            await auditService.logAdminAction(
              adminUser?.id || null,
              'failed_login',
              'auth',
              null,
              { email },
              req
            );
          }
          }
        } catch (error) {
          this.logger.error('Failed to log failed login', { error });
        }
        
        return originalJson.call(this, body);
      }.bind(this);
      
      next();
    };
  }

  /**
   * Get admin user by email (helper method)
   */
  async getAdminByEmail(email) {
    try {
      let db;
      if (this.container && typeof this.container.get === 'function') {
        db = this.container.get('database');
      } else {
        db = require('../db');
      }
      
      const result = await db.query(
        'SELECT * FROM users WHERE email = $1 AND role = $2 LIMIT 1',
        [email, 'admin']
      );
      return result.rows[0] || null;
    } catch (error) {
      this.logger.error('Failed to get admin by email:', error);
      return null;
    }
  }
}

// Create a singleton instance
const auditLoggingMiddleware = new AuditLoggingMiddleware();

module.exports = {
  AuditLoggingMiddleware,
  logAdminAction: auditLoggingMiddleware.logAdminAction.bind(auditLoggingMiddleware),
  logFailedLogin: auditLoggingMiddleware.logFailedLogin.bind(auditLoggingMiddleware)
};