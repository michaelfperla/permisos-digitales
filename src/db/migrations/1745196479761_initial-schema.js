/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * Initial schema migration
 *
 * This migration creates the baseline schema for the Permisos Digitales application.
 * It includes all tables, indexes, constraints, functions, and triggers that
 * currently exist in the production database.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
  // Create the update_modified_column function for automatic timestamp updates
  pgm.createFunction(
    'update_modified_column',
    [],
    {
      returns: 'trigger',
      language: 'plpgsql',
      ifNotExists: true
    },
    `
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    `
  );

  // Create users table
  pgm.createTable('users', {
    id: 'id',
    email: { type: 'varchar(255)', notNull: true, unique: true },
    password_hash: { type: 'varchar(255)', notNull: true },
    first_name: { type: 'varchar(100)' },
    last_name: { type: 'varchar(100)' },
    role: { type: 'varchar(50)', notNull: true, default: '\'client\'' },
    account_type: { type: 'varchar(50)', notNull: true, default: '\'client\'' },
    created_by: { type: 'integer', references: 'users' },
    is_admin_portal: { type: 'boolean', notNull: true, default: false },
    account_created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('current_timestamp')
    },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('current_timestamp')
    },
    updated_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('current_timestamp')
    }
  }, {
    ifNotExists: true
  });

  // Create index on users.email
  pgm.createIndex('users', 'email', { unique: true, name: 'idx_users_email_unique', ifNotExists: true });

  // Create permit_applications table
  pgm.createTable('permit_applications', {
    id: 'id',
    user_id: {
      type: 'integer',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE'
    },
    status: {
      type: 'varchar(50)',
      notNull: true
    },
    payment_processor_order_id: { type: 'varchar(255)' },
    permit_file_path: { type: 'varchar(512)' },
    recibo_file_path: { type: 'text' },
    certificado_file_path: { type: 'text' },
    nombre_completo: { type: 'varchar(255)', notNull: true },
    curp_rfc: { type: 'varchar(50)', notNull: true },
    domicilio: { type: 'text', notNull: true },
    marca: { type: 'varchar(100)', notNull: true },
    linea: { type: 'varchar(100)', notNull: true },
    color: { type: 'varchar(100)', notNull: true },
    numero_serie: { type: 'varchar(50)', notNull: true },
    numero_motor: { type: 'varchar(50)', notNull: true },
    ano_modelo: { type: 'varchar(20)', notNull: true },
    folio: { type: 'varchar(50)', unique: true },
    importe: { type: 'numeric(10,2)' },
    fecha_expedicion: { type: 'date' },
    fecha_vencimiento: { type: 'date' },
    renewed_from_id: {
      type: 'integer',
      references: 'permit_applications(id)',
      onDelete: 'SET NULL'
    },
    renewal_count: {
      type: 'integer',
      notNull: true,
      default: 0
    },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('current_timestamp')
    },
    updated_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('current_timestamp')
    }
  }, {
    ifNotExists: true
  });

  // Create indexes on permit_applications
  pgm.createIndex('permit_applications', 'user_id', { name: 'idx_permit_applications_user_id', ifNotExists: true });
  pgm.createIndex('permit_applications', 'status', { name: 'idx_permit_applications_status', ifNotExists: true });
  pgm.createIndex('permit_applications', 'folio', { name: 'idx_permit_applications_folio', ifNotExists: true });
  pgm.createIndex('permit_applications', 'numero_serie', { name: 'idx_permit_applications_numero_serie', ifNotExists: true });
  pgm.createIndex('permit_applications', 'renewed_from_id', { name: 'idx_permit_applications_renewed_from_id', ifNotExists: true });
  pgm.createIndex('permit_applications', ['user_id', 'created_at'], { name: 'idx_permit_applications_user_id_created_at', ifNotExists: true });

  // Create password_reset_tokens table
  pgm.createTable('password_reset_tokens', {
    id: 'id',
    user_id: {
      type: 'integer',
      notNull: true,
      references: 'users(id)'
    },
    token: { type: 'varchar(255)', notNull: true },
    expires_at: { type: 'timestamp with time zone', notNull: true },
    used: { type: 'boolean', default: false },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('current_timestamp')
    }
  }, {
    ifNotExists: true
  });

  // Create index on password_reset_tokens.token
  pgm.createIndex('password_reset_tokens', 'token', { name: 'idx_password_reset_tokens_token', ifNotExists: true });

  // Create security_audit_log table
  pgm.createTable('security_audit_log', {
    id: 'id',
    user_id: {
      type: 'integer',
      references: 'users(id)',
      onDelete: 'SET NULL'
    },
    action_type: { type: 'varchar(100)', notNull: true },
    ip_address: { type: 'varchar(45)' },
    user_agent: { type: 'text' },
    details: { type: 'jsonb' },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('current_timestamp')
    }
  }, {
    ifNotExists: true
  });

  // Create indexes on security_audit_log
  pgm.createIndex('security_audit_log', 'user_id', { name: 'idx_security_audit_log_user_id', ifNotExists: true });
  pgm.createIndex('security_audit_log', 'action_type', { name: 'idx_security_audit_log_action_type', ifNotExists: true });
  pgm.createIndex('security_audit_log', 'created_at', { name: 'idx_security_audit_log_created_at', ifNotExists: true });

  // Create user_sessions table
  pgm.createTable('user_sessions', {
    sid: { type: 'varchar', primaryKey: true },
    sess: { type: 'json', notNull: true },
    expire: { type: 'timestamp(6) without time zone', notNull: true }
  }, {
    ifNotExists: true
  });

  // Create index on user_sessions.expire
  pgm.createIndex('user_sessions', 'expire', { name: 'IDX_user_sessions_expire', ifNotExists: true });

  // Create triggers for automatic timestamp updates
  pgm.createTrigger('users', 'update_users_modtime', {
    when: 'BEFORE',
    operation: 'UPDATE',
    level: 'ROW',
    function: 'update_modified_column',
    ifNotExists: true
  });

  pgm.createTrigger('permit_applications', 'update_permit_applications_modtime', {
    when: 'BEFORE',
    operation: 'UPDATE',
    level: 'ROW',
    function: 'update_modified_column',
    ifNotExists: true
  });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  // Drop triggers
  pgm.dropTrigger('permit_applications', 'update_permit_applications_modtime', { ifExists: true });
  pgm.dropTrigger('users', 'update_users_modtime', { ifExists: true });

  // Drop tables in reverse order (respecting foreign key constraints)
  pgm.dropTable('user_sessions', { ifExists: true, cascade: true });
  pgm.dropTable('security_audit_log', { ifExists: true, cascade: true });
  pgm.dropTable('password_reset_tokens', { ifExists: true, cascade: true });
  pgm.dropTable('permit_applications', { ifExists: true, cascade: true });
  pgm.dropTable('users', { ifExists: true, cascade: true });

  // Drop the update_modified_column function
  pgm.dropFunction('update_modified_column', [], { ifExists: true, cascade: true });
};