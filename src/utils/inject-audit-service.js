/**
 * Helper to inject audit service into controllers
 * This is a temporary solution until the service container is properly integrated
 */

const getAuditService = () => {
  try {
    // Try to get from service container first
    const container = require('../core/service-container-singleton').getInstance();
    return container.get('auditService');
  } catch (error) {
    // Fallback to creating a new instance
    const AuditService = require('../services/audit.service');
    const mockContainer = {
      get: (serviceName) => {
        if (serviceName === 'database') return require('../db');
        if (serviceName === 'redis') return require('../utils/redis-client');
        if (serviceName === 'logger') return require('../utils/logger').logger;
        return null;
      }
    };
    return new AuditService(mockContainer);
  }
};

/**
 * Inject audit service into controllers that need it
 */
const injectAuditService = () => {
  const auditService = getAuditService();
  
  // Inject into admin controller
  try {
    const adminController = require('../controllers/admin.controller');
    if (adminController.setAuditService) {
      adminController.setAuditService(auditService);
    }
  } catch (error) {
    console.error('Failed to inject audit service into admin controller:', error.message);
  }
  
  // Inject into admin user controller
  try {
    const adminUserController = require('../controllers/admin/user.controller');
    if (adminUserController.setAuditService) {
      adminUserController.setAuditService(auditService);
    }
  } catch (error) {
    console.error('Failed to inject audit service into admin user controller:', error.message);
  }
  
  // Inject into auth controller
  try {
    const authController = require('../controllers/auth.controller');
    if (authController.setAuditService) {
      authController.setAuditService(auditService);
    }
  } catch (error) {
    console.error('Failed to inject audit service into auth controller:', error.message);
  }
};

// Auto-inject when this module is loaded
injectAuditService();

module.exports = {
  getAuditService,
  injectAuditService
};