// const { createControllerError } = require('../utils/error-helpers');
const ApiResponse = require('../utils/api-response');
const { logger } = require('../utils/logger');
const ConfigurationService = require('../services/configuration.service');
const ConfigurationRepository = require('../repositories/configuration.repository');
const redis = require('../utils/redis-client');
const db = require('../db');

// Initialize configuration service
const configurationRepository = new ConfigurationRepository({ database: db, logger });
const configurationService = new ConfigurationService({ configurationRepository, redis, logger });

/**
 * Get all configurations
 * GET /admin/config
 */
exports.getAll = async (req, res) => {
  try {
    const { category } = req.query;
    
    let configurations;
    if (category) {
      configurations = await configurationService.getByCategory(category);
    } else {
      configurations = await configurationService.getAll();
    }

    return ApiResponse.success(res, configurations, 200, 'Configurations retrieved successfully');
  } catch (error) {
    logger.error('Error getting configurations', { error });
    return ApiResponse.error(res, error.message || 'Internal server error', 500);
  }
};

/**
 * Get specific configuration
 * GET /admin/config/:key
 */
exports.getByKey = async (req, res) => {
  try {
    const { key } = req.params;
    
    const configuration = await configurationService.get(key);
    
    return ApiResponse.success(res, configuration, 200, 'Configuration retrieved successfully');
  } catch (error) {
    logger.error('Error getting configuration', { 
      error,
      key: req.params.key 
    });
    return ApiResponse.error(res, error.message || 'Internal server error', 500);
  }
};

/**
 * Update configuration
 * PUT /admin/config/:key
 */
exports.update = async (req, res) => {
  try {
    const { key } = req.params;
    const { value, reason } = req.body;

    if (value === undefined) {
      throw new Error('Value is required');
    }

    const auditInfo = {
      userId: req.user.id,
      reason,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    };

    const updatedConfiguration = await configurationService.set(
      key,
      value,
      auditInfo
    );

    logger.info('Configuration updated', {
      key,
      userId: req.user.id,
      reason
    });

    return ApiResponse.success(res, updatedConfiguration, 200, 'Configuration updated successfully');
  } catch (error) {
    logger.error('Error updating configuration', { 
      error,
      key: req.params.key,
      userId: req.user.id
    });
    return ApiResponse.error(res, error.message || 'Internal server error', 500);
  }
};

/**
 * Bulk update configurations
 * POST /admin/config/bulk
 */
exports.bulkUpdate = async (req, res) => {
  try {
    const { updates, reason } = req.body;

    if (!Array.isArray(updates) || updates.length === 0) {
      throw new Error('Updates array is required');
    }

    // Validate each update
    for (const update of updates) {
      if (!update.key || update.value === undefined) {
        throw new Error('Each update must have key and value');
      }
    }

    const auditInfo = {
      userId: req.user.id,
      reason: reason || 'Bulk configuration update',
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    };

    const results = await configurationService.bulkSet(updates, auditInfo);

    logger.info('Bulk configuration update', {
      userId: req.user.id,
      updateCount: updates.length,
      reason
    });

    return ApiResponse.success(res, results, 200, 'Configurations updated successfully');
  } catch (error) {
    logger.error('Error bulk updating configurations', { 
      error,
      userId: req.user.id
    });
    return ApiResponse.error(res, error.message || 'Internal server error', 500);
  }
};

/**
 * Reset configuration to default
 * POST /admin/config/:key/reset
 */
exports.resetToDefault = async (req, res) => {
  try {
    const { key } = req.params;

    const auditInfo = {
      userId: req.user.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    };

    const updatedConfiguration = await configurationService.resetToDefault(
      key,
      auditInfo
    );

    logger.info('Configuration reset to default', {
      key,
      userId: req.user.id
    });

    return ApiResponse.success(
      res,
      updatedConfiguration,
      200,
      'Configuration reset to default successfully'
    );
  } catch (error) {
    logger.error('Error resetting configuration to default', { 
      error,
      key: req.params.key,
      userId: req.user.id
    });
    return ApiResponse.error(res, error.message || 'Internal server error', 500);
  }
};

/**
 * Get configuration audit history
 * GET /admin/config/:key/history
 */
exports.getHistory = async (req, res) => {
  try {
    const { key } = req.params;
    const { limit = 50 } = req.query;

    const history = await configurationService.getAuditHistory(
      key,
      parseInt(limit, 10)
    );

    return ApiResponse.success(res, history, 200, 'Configuration history retrieved successfully');
  } catch (error) {
    logger.error('Error getting configuration history', { 
      error,
      key: req.params.key
    });
    return ApiResponse.error(res, error.message || 'Internal server error', 500);
  }
};

/**
 * Export all configurations
 * GET /admin/config/export
 */
exports.export = async (req, res) => {
  try {
    const exportData = await configurationService.export();

    logger.info('Configuration export', {
      userId: req.user.id
    });

    // Set response headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="config-export-${new Date().toISOString().slice(0, 10)}.json"`
    );

    return res.json(exportData);
  } catch (error) {
    logger.error('Error exporting configurations', { 
      error,
      userId: req.user.id
    });
    return ApiResponse.error(res, error.message || 'Internal server error', 500);
  }
};

/**
 * Import configurations
 * POST /admin/config/import
 */
exports.import = async (req, res) => {
  try {
    const importData = req.body;

    if (!importData || typeof importData !== 'object') {
      throw new Error('Invalid import data');
    }

    const auditInfo = {
      userId: req.user.id,
      reason: 'Configuration import',
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    };

    const results = await configurationService.import(importData, auditInfo);

    logger.info('Configuration import', {
      userId: req.user.id,
      configCount: results.length
    });

    return ApiResponse.success(res, results, 200, 'Configurations imported successfully');
  } catch (error) {
    logger.error('Error importing configurations', { 
      error,
      userId: req.user.id
    });
    return ApiResponse.error(res, error.message || 'Internal server error', 500);
  }
};

/**
 * Get configuration schema
 * GET /admin/config/schema
 */
exports.getSchema = async (req, res) => {
  try {
    const schema = await configurationService.getSchema();
    
    return ApiResponse.success(res, schema, 200, 'Configuration schema retrieved successfully');
  } catch (error) {
    logger.error('Error getting configuration schema', { error });
    return ApiResponse.error(res, error.message || 'Internal server error', 500);
  }
};

/**
 * Get default values for all configurations
 * GET /admin/config/defaults
 */
exports.getDefaults = async (req, res) => {
  try {
    const configurations = await configurationService.getAll();
    
    // Extract default values
    const defaults = {};
    for (const [category, configs] of Object.entries(configurations)) {
      defaults[category] = {};
      for (const [key, config] of Object.entries(configs)) {
        if (config.defaultValue !== null) {
          defaults[category][key] = config.defaultValue;
        }
      }
    }

    return ApiResponse.success(res, defaults, 200, 'Default values retrieved successfully');
  } catch (error) {
    logger.error('Error getting default values', { error });
    return ApiResponse.error(res, error.message || 'Internal server error', 500);
  }
};

/**
 * Clear configuration cache
 * POST /admin/config/cache/clear
 */
exports.clearCache = async (req, res) => {
  try {
    await configurationService.clearCache();

    logger.info('Configuration cache cleared', {
      userId: req.user.id
    });

    return ApiResponse.success(res, null, 200, 'Configuration cache cleared successfully');
  } catch (error) {
    logger.error('Error clearing configuration cache', { 
      error,
      userId: req.user.id
    });
    return ApiResponse.error(res, error.message || 'Internal server error', 500);
  }
};
