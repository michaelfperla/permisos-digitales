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
    // Fallback to creating a new instance with proper structure
    const AuditService = require('../services/audit.service');
    const mockDependencies = {
      database: require('../db'),
      redis: require('../utils/redis-client'),
      logger: require('../utils/logger').logger
    };
    return new AuditService(mockDependencies);
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