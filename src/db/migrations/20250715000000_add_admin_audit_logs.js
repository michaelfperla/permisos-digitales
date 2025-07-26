exports.up = async (pgm) => {
  // Create admin_audit_logs table
  pgm.createTable('admin_audit_logs', {
    id: 'id',
    admin_id: {
      type: 'integer',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE'
    },
    action: {
      type: 'varchar(100)',
      notNull: true
    },
    entity_type: {
      type: 'varchar(50)',
      notNull: true
    },
    entity_id: {
      type: 'varchar(255)',
      notNull: false
    },
    changes: {
      type: 'jsonb',
      notNull: false
    },
    ip_address: {
      type: 'varchar(45)',
      notNull: false
    },
    user_agent: {
      type: 'text',
      notNull: false
    },
    request_id: {
      type: 'varchar(100)',
      notNull: false
    },
    session_id: {
      type: 'varchar(100)',
      notNull: false
    },
    metadata: {
      type: 'jsonb',
      notNull: false,
      default: '{}'
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp')
    }
  });

  // Create indexes for performance
  pgm.createIndex('admin_audit_logs', 'admin_id');
  pgm.createIndex('admin_audit_logs', 'entity_type');
  pgm.createIndex('admin_audit_logs', 'entity_id');
  pgm.createIndex('admin_audit_logs', 'action');
  pgm.createIndex('admin_audit_logs', 'created_at');
  pgm.createIndex('admin_audit_logs', ['entity_type', 'entity_id']);
  pgm.createIndex('admin_audit_logs', 'ip_address');

  // Create security events table for tracking suspicious activities
  pgm.createTable('admin_security_events', {
    id: 'id',
    admin_id: {
      type: 'integer',
      notNull: false,
      references: 'users',
      onDelete: 'CASCADE'
    },
    event_type: {
      type: 'varchar(50)',
      notNull: true
    },
    severity: {
      type: 'varchar(20)',
      notNull: true,
      default: 'info'
    },
    description: {
      type: 'text',
      notNull: true
    },
    ip_address: {
      type: 'varchar(45)',
      notNull: false
    },
    user_agent: {
      type: 'text',
      notNull: false
    },
    metadata: {
      type: 'jsonb',
      notNull: false,
      default: '{}'
    },
    resolved: {
      type: 'boolean',
      notNull: true,
      default: false
    },
    resolved_at: {
      type: 'timestamp',
      notNull: false
    },
    resolved_by: {
      type: 'integer',
      notNull: false,
      references: 'users',
      onDelete: 'SET NULL'
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp')
    }
  });

  // Create indexes for security events
  pgm.createIndex('admin_security_events', 'admin_id');
  pgm.createIndex('admin_security_events', 'event_type');
  pgm.createIndex('admin_security_events', 'severity');
  pgm.createIndex('admin_security_events', 'created_at');
  pgm.createIndex('admin_security_events', 'resolved');
  pgm.createIndex('admin_security_events', 'ip_address');

  // Create enum for audit actions
  pgm.sql(`
    CREATE TYPE admin_audit_action AS ENUM (
      'login',
      'logout',
      'failed_login',
      'view',
      'create',
      'update',
      'delete',
      'approve',
      'reject',
      'suspend',
      'activate',
      'export',
      'bulk_operation',
      'configuration_change',
      'permission_change',
      'password_reset',
      'email_sent',
      'api_key_generated',
      'system_maintenance'
    );
  `);

  // Create enum for security event types
  pgm.sql(`
    CREATE TYPE admin_security_event_type AS ENUM (
      'failed_login_attempt',
      'suspicious_activity',
      'unauthorized_access',
      'rate_limit_exceeded',
      'bulk_operation_detected',
      'unusual_access_pattern',
      'permission_violation',
      'data_export_large',
      'configuration_tampering',
      'session_hijacking_suspected'
    );
  `);

  // Create enum for severity levels
  pgm.sql(`
    CREATE TYPE security_severity AS ENUM (
      'info',
      'warning',
      'critical'
    );
  `);
};

exports.down = async (pgm) => {
  // Drop enums
  pgm.sql('DROP TYPE IF EXISTS security_severity CASCADE');
  pgm.sql('DROP TYPE IF EXISTS admin_security_event_type CASCADE');
  pgm.sql('DROP TYPE IF EXISTS admin_audit_action CASCADE');
  
  // Drop tables
  pgm.dropTable('admin_security_events');
  pgm.dropTable('admin_audit_logs');
};