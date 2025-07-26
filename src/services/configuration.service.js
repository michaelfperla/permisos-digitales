// const { createServiceError } = require('../utils/error-helpers');

class ConfigurationService {
  constructor({ configurationRepository, redis, logger }) {
    this.configurationRepository = configurationRepository;
    this.redis = redis;
    this.logger = logger;
    this.cachePrefix = 'config:';
    this.cacheTTL = 300; // 5 minutes
  }

  /**
   * Get configuration value by key
   */
  async get(key) {
    try {
      // Check cache first
      const cacheKey = `${this.cachePrefix}${key}`;
      const cached = await this.redis.get(cacheKey);
      
      if (cached) {
        return this.parseValue(JSON.parse(cached));
      }

      // Get from database
      const config = await this.configurationRepository.findByKey(key);
      
      if (!config) {
        throw new Error(`Configuration not found: ${key}`);
      }

      // Cache the config
      await this.redis.setex(
        cacheKey,
        this.cacheTTL,
        JSON.stringify(config)
      );

      return this.parseValue(config);
    } catch (error) {
      this.logger.error('Error getting configuration', { error: error.message, key });
      throw error;
    }
  }

  /**
   * Get multiple configuration values
   */
  async getMultiple(keys) {
    try {
      const results = {};
      const uncachedKeys = [];

      // Check cache for each key
      for (const key of keys) {
        const cacheKey = `${this.cachePrefix}${key}`;
        const cached = await this.redis.get(cacheKey);
        
        if (cached) {
          results[key] = this.parseValue(JSON.parse(cached));
        } else {
          uncachedKeys.push(key);
        }
      }

      // Get uncached configs from database
      if (uncachedKeys.length > 0) {
        const configs = await this.configurationRepository.findByKeys(uncachedKeys);
        
        for (const config of configs) {
          results[config.key] = this.parseValue(config);
          
          // Cache the config
          const cacheKey = `${this.cachePrefix}${config.key}`;
          await this.redis.setex(
            cacheKey,
            this.cacheTTL,
            JSON.stringify(config)
          );
        }
      }

      return results;
    } catch (error) {
      this.logger.error('Error getting multiple configurations', { error: error.message, keys });
      throw error;
    }
  }

  /**
   * Get all configurations by category
   */
  async getByCategory(category) {
    try {
      const configs = await this.configurationRepository.findAll(category);
      
      // Parse values and create result object
      const result = {};
      for (const config of configs) {
        result[config.key] = this.parseValue(config);
      }
      
      return result;
    } catch (error) {
      this.logger.error('Error getting configurations by category', { error: error.message, category });
      throw error;
    }
  }

  /**
   * Get all configurations
   */
  async getAll() {
    try {
      const configs = await this.configurationRepository.findAll();
      
      // Group by category and parse values
      const result = {};
      for (const config of configs) {
        if (!result[config.category]) {
          result[config.category] = {};
        }
        result[config.category][config.key] = this.parseValue(config);
      }
      
      return result;
    } catch (error) {
      this.logger.error('Error getting all configurations', { error: error.message });
      throw error;
    }
  }

  /**
   * Set configuration value
   */
  async set(key, value, auditInfo) {
    try {
      // Get current config to validate data type
      const currentConfig = await this.configurationRepository.findByKey(key);
      
      if (!currentConfig) {
        throw new Error(`Configuration not found: ${key}`);
      }

      // Validate value against data type and rules
      const validatedValue = await this.validateValue(value, currentConfig);
      
      // Convert value to string for storage
      const stringValue = this.stringifyValue(validatedValue, currentConfig.data_type);

      // Update in database
      const updatedConfig = await this.configurationRepository.updateValue(
        key,
        stringValue,
        auditInfo
      );

      // Clear cache
      const cacheKey = `${this.cachePrefix}${key}`;
      await this.redis.del(cacheKey);

      return this.parseValue(updatedConfig);
    } catch (error) {
      this.logger.error('Error setting configuration', {
        error: error.message,
        key,
        value
      });
      throw error;
    }
  }

  /**
   * Bulk update configurations
   */
  async bulkSet(updates, auditInfo) {
    try {
      // Validate all updates first
      const validatedUpdates = [];
      
      for (const update of updates) {
        const currentConfig = await this.configurationRepository.findByKey(update.key);
        
        if (!currentConfig) {
          throw new Error(`Configuration not found: ${update.key}`);
        }

        const validatedValue = await this.validateValue(update.value, currentConfig);
        const stringValue = this.stringifyValue(validatedValue, currentConfig.data_type);
        
        validatedUpdates.push({
          key: update.key,
          value: stringValue,
          reason: update.reason
        });
      }

      // Perform bulk update
      const results = await this.configurationRepository.bulkUpdate(
        validatedUpdates,
        auditInfo
      );

      // Clear cache for all updated keys
      const cacheKeys = updates.map(u => `${this.cachePrefix}${u.key}`);
      if (cacheKeys.length > 0) {
        await this.redis.del(...cacheKeys);
      }

      // Parse and return results
      return results.map(config => this.parseValue(config));
    } catch (error) {
      this.logger.error('Error bulk setting configurations', {
        error: error.message,
        updateCount: updates.length
      });
      throw error;
    }
  }

  /**
   * Reset configuration to default value
   */
  async resetToDefault(key, auditInfo) {
    try {
      const updatedConfig = await this.configurationRepository.resetToDefault(key, auditInfo);

      // Clear cache
      const cacheKey = `${this.cachePrefix}${key}`;
      await this.redis.del(cacheKey);

      return this.parseValue(updatedConfig);
    } catch (error) {
      this.logger.error('Error resetting configuration to default', {
        error: error.message,
        key
      });
      throw error;
    }
  }

  /**
   * Get configuration audit history
   */
  async getAuditHistory(key, limit = 50) {
    try {
      const history = await this.configurationRepository.getAuditHistory(key, limit);
      
      // Parse values in history
      return history.map(entry => ({
        ...entry,
        oldValue: this.parseStoredValue(entry.old_value, entry.data_type),
        newValue: this.parseStoredValue(entry.new_value, entry.data_type)
      }));
    } catch (error) {
      this.logger.error('Error getting configuration audit history', {
        error: error.message,
        key
      });
      throw error;
    }
  }

  /**
   * Get configuration schema for UI
   */
  async getSchema() {
    try {
      return await this.configurationRepository.getSchema();
    } catch (error) {
      this.logger.error('Error getting configuration schema', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Export all configurations
   */
  async export() {
    try {
      const configs = await this.configurationRepository.findAll();
      
      // Create export format
      const exportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        configurations: {}
      };

      for (const config of configs) {
        exportData.configurations[config.key] = {
          value: this.parseStoredValue(config.value, config.data_type),
          dataType: config.data_type,
          category: config.category,
          description: config.description,
          isSensitive: config.is_sensitive
        };
      }

      return exportData;
    } catch (error) {
      this.logger.error('Error exporting configurations', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Import configurations
   */
  async import(importData, auditInfo) {
    try {
      if (!importData.configurations) {
        throw new Error('Invalid import data format');
      }

      const updates = [];
      
      for (const [key, config] of Object.entries(importData.configurations)) {
        updates.push({
          key,
          value: config.value,
          reason: `Imported from backup (${importData.exportedAt || 'unknown date'})`
        });
      }

      return await this.bulkSet(updates, auditInfo);
    } catch (error) {
      this.logger.error('Error importing configurations', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Parse configuration value from storage
   */
  parseValue(config) {
    return {
      key: config.key,
      value: this.parseStoredValue(config.value, config.data_type),
      dataType: config.data_type,
      category: config.category,
      description: config.description,
      isSensitive: config.is_sensitive,
      updatedAt: config.updated_at
    };
  }

  /**
   * Parse stored string value to appropriate type
   */
  parseStoredValue(value, dataType) {
    if (value === null || value === undefined) {
      return null;
    }

    switch (dataType) {
      case 'number':
        return Number(value);
      case 'boolean':
        return value === 'true';
      case 'json':
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      case 'string':
      default:
        return value;
    }
  }

  /**
   * Convert value to string for storage
   */
  stringifyValue(value, dataType) {
    switch (dataType) {
      case 'json':
        return JSON.stringify(value);
      case 'boolean':
        return value ? 'true' : 'false';
      default:
        return String(value);
    }
  }

  /**
   * Validate value against data type and rules
   */
  async validateValue(value, config) {
    // Type validation
    switch (config.data_type) {
      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          throw new Error(`Invalid number value for ${config.key}`);
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean') {
          throw new Error(`Invalid boolean value for ${config.key}`);
        }
        break;
      case 'json':
        if (typeof value !== 'object') {
          throw new Error(`Invalid JSON value for ${config.key}`);
        }
        break;
      case 'string':
        if (typeof value !== 'string') {
          throw new Error(`Invalid string value for ${config.key}`);
        }
        break;
    }

    // Additional validation rules
    if (config.validation_rules) {
      const rules = config.validation_rules;
      
      if (config.data_type === 'number') {
        if (rules.min !== undefined && value < rules.min) {
          throw new Error(`Value for ${config.key} must be at least ${rules.min}`);
        }
        if (rules.max !== undefined && value > rules.max) {
          throw new Error(`Value for ${config.key} must be at most ${rules.max}`);
        }
      }

      if (config.data_type === 'string') {
        if (rules.minLength !== undefined && value.length < rules.minLength) {
          throw new Error(`Value for ${config.key} must be at least ${rules.minLength} characters`);
        }
        if (rules.maxLength !== undefined && value.length > rules.maxLength) {
          throw new Error(`Value for ${config.key} must be at most ${rules.maxLength} characters`);
        }
        if (rules.pattern) {
          const regex = new RegExp(rules.pattern);
          if (!regex.test(value)) {
            throw new Error(`Value for ${config.key} does not match required pattern`);
          }
        }
      }
    }

    return value;
  }

  /**
   * Clear all configuration cache
   */
  async clearCache() {
    try {
      const keys = await this.redis.keys(`${this.cachePrefix}*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
      this.logger.info('Configuration cache cleared', { keyCount: keys.length });
    } catch (error) {
      this.logger.error('Error clearing configuration cache', {
        error: error.message
      });
      // Don't throw - cache clear is not critical
    }
  }
}

module.exports = ConfigurationService;