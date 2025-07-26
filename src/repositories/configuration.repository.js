const BaseRepository = require('./base.repository');
// const { sanitizeSQLLog } = require('../utils/error-helpers');

class ConfigurationRepository extends BaseRepository {
  constructor({ database, logger }) {
    super('system_configurations');
    this.db = database;
    this.logger = logger;
    this.auditTable = 'system_configuration_audits';
  }

  /**
   * Get all configurations, optionally filtered by category
   */
  async findAll(category = null) {
    try {
      let query = `
        SELECT 
          id,
          key,
          value,
          data_type,
          category,
          description,
          is_sensitive,
          default_value,
          validation_rules,
          created_at,
          updated_at
        FROM ${this.tableName}
      `;
      
      const params = [];
      if (category) {
        query += ' WHERE category = $1';
        params.push(category);
      }
      
      query += ' ORDER BY category, key';
      
      const result = await this.db.query(query, params);
      return result.rows;
    } catch (error) {
      this.logger.error('Error finding all configurations', {
        error: error.message,
        category
      });
      throw error;
    }
  }

  /**
   * Get configuration by key
   */
  async findByKey(key) {
    try {
      const query = `
        SELECT 
          id,
          key,
          value,
          data_type,
          category,
          description,
          is_sensitive,
          default_value,
          validation_rules,
          created_at,
          updated_at
        FROM ${this.tableName}
        WHERE key = $1
      `;
      
      const result = await this.db.query(query, [key]);
      return result.rows[0];
    } catch (error) {
      this.logger.error('Error finding configuration by key', {
        error: error.message,
        key
      });
      throw error;
    }
  }

  /**
   * Get multiple configurations by keys
   */
  async findByKeys(keys) {
    try {
      const query = `
        SELECT 
          id,
          key,
          value,
          data_type,
          category,
          description,
          is_sensitive,
          default_value,
          validation_rules,
          created_at,
          updated_at
        FROM ${this.tableName}
        WHERE key = ANY($1)
      `;
      
      const result = await this.db.query(query, [keys]);
      return result.rows;
    } catch (error) {
      this.logger.error('Error finding configurations by keys', {
        error: error.message,
        keys
      });
      throw error;
    }
  }

  /**
   * Update configuration value with audit trail
   */
  async updateValue(key, newValue, auditInfo) {
    const client = await this.db.getPool().connect();
    
    try {
      await client.query('BEGIN');

      // Get current configuration
      const currentConfig = await this.findByKey(key);
      if (!currentConfig) {
        throw new Error(`Configuration key not found: ${key}`);
      }

      // Update configuration
      const updateQuery = `
        UPDATE ${this.tableName}
        SET 
          value = $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE key = $2
        RETURNING *
      `;
      
      const updateResult = await client.query(updateQuery, [newValue, key]);
      const updatedConfig = updateResult.rows[0];

      // Create audit record
      const auditQuery = `
        INSERT INTO ${this.auditTable} (
          configuration_id,
          changed_by,
          old_value,
          new_value,
          change_reason,
          ip_address,
          user_agent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;
      
      await client.query(auditQuery, [
        currentConfig.id,
        auditInfo.userId,
        currentConfig.value,
        newValue,
        auditInfo.reason || null,
        auditInfo.ipAddress || null,
        auditInfo.userAgent || null
      ]);

      await client.query('COMMIT');
      
      return updatedConfig;
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Error updating configuration', {
        error: error.message,
        key,
        newValue
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Bulk update configurations
   */
  async bulkUpdate(updates, auditInfo) {
    const client = await this.db.getPool().connect();
    
    try {
      await client.query('BEGIN');

      const results = [];
      
      for (const update of updates) {
        // Get current configuration
        const currentQuery = `
          SELECT * FROM ${this.tableName} WHERE key = $1
        `;
        const currentResult = await client.query(currentQuery, [update.key]);
        const currentConfig = currentResult.rows[0];
        
        if (!currentConfig) {
          throw new Error(`Configuration key not found: ${update.key}`);
        }

        // Update configuration
        const updateQuery = `
          UPDATE ${this.tableName}
          SET 
            value = $1,
            updated_at = CURRENT_TIMESTAMP
          WHERE key = $2
          RETURNING *
        `;
        
        const updateResult = await client.query(updateQuery, [update.value, update.key]);
        const updatedConfig = updateResult.rows[0];

        // Create audit record
        const auditQuery = `
          INSERT INTO ${this.auditTable} (
            configuration_id,
            changed_by,
            old_value,
            new_value,
            change_reason,
            ip_address,
            user_agent
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `;
        
        await client.query(auditQuery, [
          currentConfig.id,
          auditInfo.userId,
          currentConfig.value,
          update.value,
          auditInfo.reason || `Bulk update: ${update.reason || 'No reason provided'}`,
          auditInfo.ipAddress || null,
          auditInfo.userAgent || null
        ]);

        results.push(updatedConfig);
      }

      await client.query('COMMIT');
      
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Error bulk updating configurations', {
        error: error.message,
        updateCount: updates.length
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get configuration audit history
   */
  async getAuditHistory(key, limit = 50) {
    try {
      const query = `
        SELECT 
          a.id,
          a.configuration_id,
          a.old_value,
          a.new_value,
          a.change_reason,
          a.ip_address,
          a.user_agent,
          a.created_at,
          u.email as changed_by_email,
          u.name as changed_by_name
        FROM ${this.auditTable} a
        JOIN ${this.tableName} c ON c.id = a.configuration_id
        LEFT JOIN users u ON u.id = a.changed_by
        WHERE c.key = $1
        ORDER BY a.created_at DESC
        LIMIT $2
      `;
      
      const result = await this.db.query(query, [key, limit]);
      return result.rows;
    } catch (error) {
      this.logger.error('Error getting configuration audit history', {
        error: error.message,
        key
      });
      throw error;
    }
  }

  /**
   * Reset configuration to default value
   */
  async resetToDefault(key, auditInfo) {
    const client = await this.db.getPool().connect();
    
    try {
      await client.query('BEGIN');

      // Get configuration with default value
      const configQuery = `
        SELECT * FROM ${this.tableName} WHERE key = $1
      `;
      const configResult = await client.query(configQuery, [key]);
      const config = configResult.rows[0];
      
      if (!config) {
        throw new Error(`Configuration key not found: ${key}`);
      }

      if (!config.default_value) {
        throw new Error(`No default value set for configuration: ${key}`);
      }

      // Update to default value
      const updateQuery = `
        UPDATE ${this.tableName}
        SET 
          value = default_value,
          updated_at = CURRENT_TIMESTAMP
        WHERE key = $1
        RETURNING *
      `;
      
      const updateResult = await client.query(updateQuery, [key]);
      const updatedConfig = updateResult.rows[0];

      // Create audit record
      const auditQuery = `
        INSERT INTO ${this.auditTable} (
          configuration_id,
          changed_by,
          old_value,
          new_value,
          change_reason,
          ip_address,
          user_agent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;
      
      await client.query(auditQuery, [
        config.id,
        auditInfo.userId,
        config.value,
        config.default_value,
        'Reset to default value',
        auditInfo.ipAddress || null,
        auditInfo.userAgent || null
      ]);

      await client.query('COMMIT');
      
      return updatedConfig;
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Error resetting configuration to default', {
        error: error.message,
        key
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get configuration schema for UI
   */
  async getSchema() {
    try {
      const query = `
        SELECT 
          key,
          data_type,
          category,
          description,
          is_sensitive,
          default_value,
          validation_rules
        FROM ${this.tableName}
        ORDER BY category, key
      `;
      
      const result = await this.db.query(query);
      
      // Group by category
      const schema = {};
      for (const row of result.rows) {
        if (!schema[row.category]) {
          schema[row.category] = [];
        }
        schema[row.category].push({
          key: row.key,
          dataType: row.data_type,
          description: row.description,
          isSensitive: row.is_sensitive,
          defaultValue: row.default_value,
          validationRules: row.validation_rules
        });
      }
      
      return schema;
    } catch (error) {
      this.logger.error('Error getting configuration schema', {
        error: sanitizeSQLLog(error)
      });
      throw error;
    }
  }
}

module.exports = ConfigurationRepository;