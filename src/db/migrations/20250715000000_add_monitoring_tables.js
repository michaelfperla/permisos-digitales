// Migration: Add monitoring tables
exports.up = async (pgm) => {
  // Create queue_metrics table (already referenced in monitoring repository)
  pgm.createTable('queue_metrics', {
    id: {
      type: 'serial',
      primaryKey: true
    },
    queue_length: {
      type: 'integer',
      notNull: true,
      default: 0
    },
    active_jobs: {
      type: 'integer',
      notNull: true,
      default: 0
    },
    average_wait_time_ms: {
      type: 'integer',
      notNull: true,
      default: 0
    },
    average_processing_time_ms: {
      type: 'integer',
      notNull: true,
      default: 0
    },
    total_completed: {
      type: 'integer',
      notNull: true,
      default: 0
    },
    total_failed: {
      type: 'integer',
      notNull: true,
      default: 0
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('NOW()')
    }
  });

  // Create index for time-based queries
  pgm.createIndex('queue_metrics', 'created_at');

  // Create email_logs table for tracking email delivery
  pgm.createTable('email_logs', {
    id: {
      type: 'serial',
      primaryKey: true
    },
    email_type: {
      type: 'varchar(100)',
      notNull: true
    },
    recipient: {
      type: 'varchar(255)',
      notNull: true
    },
    subject: {
      type: 'text'
    },
    status: {
      type: 'varchar(50)',
      notNull: true,
      default: 'sent'
    },
    message_id: {
      type: 'varchar(255)'
    },
    error_message: {
      type: 'text'
    },
    metadata: {
      type: 'jsonb'
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('NOW()')
    }
  });

  // Create indexes for email_logs
  pgm.createIndex('email_logs', 'email_type');
  pgm.createIndex('email_logs', 'status');
  pgm.createIndex('email_logs', 'created_at');
  pgm.createIndex('email_logs', 'recipient');

  // Create error_logs table for tracking application errors
  pgm.createTable('error_logs', {
    id: {
      type: 'serial',
      primaryKey: true
    },
    error_type: {
      type: 'varchar(100)',
      notNull: true
    },
    error_code: {
      type: 'varchar(100)'
    },
    message: {
      type: 'text',
      notNull: true
    },
    stack_trace: {
      type: 'text'
    },
    severity: {
      type: 'varchar(20)',
      notNull: true,
      default: 'error'
    },
    path: {
      type: 'varchar(500)'
    },
    method: {
      type: 'varchar(10)'
    },
    user_id: {
      type: 'uuid',
      references: 'users(id)',
      onDelete: 'SET NULL'
    },
    metadata: {
      type: 'jsonb'
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('NOW()')
    }
  });

  // Create indexes for error_logs
  pgm.createIndex('error_logs', 'error_type');
  pgm.createIndex('error_logs', 'error_code');
  pgm.createIndex('error_logs', 'severity');
  pgm.createIndex('error_logs', 'created_at');

  // Create request_logs table for tracking API requests (optional, for request rate calculation)
  pgm.createTable('request_logs', {
    id: {
      type: 'serial',
      primaryKey: true
    },
    method: {
      type: 'varchar(10)',
      notNull: true
    },
    path: {
      type: 'varchar(500)',
      notNull: true
    },
    status_code: {
      type: 'integer'
    },
    response_time_ms: {
      type: 'integer'
    },
    user_id: {
      type: 'uuid',
      references: 'users(id)',
      onDelete: 'SET NULL'
    },
    ip_address: {
      type: 'varchar(45)'
    },
    user_agent: {
      type: 'text'
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('NOW()')
    }
  });

  // Create indexes for request_logs
  pgm.createIndex('request_logs', 'created_at');
  pgm.createIndex('request_logs', 'path');
  pgm.createIndex('request_logs', 'method');
  pgm.createIndex('request_logs', 'status_code');

  // Create query_logs table for tracking slow database queries (optional)
  pgm.createTable('query_logs', {
    id: {
      type: 'serial',
      primaryKey: true
    },
    query: {
      type: 'text',
      notNull: true
    },
    duration: {
      type: 'float',
      notNull: true
    },
    rows_affected: {
      type: 'integer'
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('NOW()')
    }
  });

  // Create index for query_logs
  pgm.createIndex('query_logs', 'created_at');
  pgm.createIndex('query_logs', 'duration');
};

exports.down = async (pgm) => {
  // Drop tables in reverse order
  pgm.dropTable('query_logs');
  pgm.dropTable('request_logs');
  pgm.dropTable('error_logs');
  pgm.dropTable('email_logs');
  pgm.dropTable('queue_metrics');
};