exports.up = async (pgm) => {
  // Create configuration categories enum
  pgm.createType('config_category', [
    'general',
    'email',
    'payment',
    'security',
    'features',
    'limits'
  ]);

  // Create configuration data types enum
  pgm.createType('config_data_type', [
    'string',
    'number',
    'boolean',
    'json'
  ]);

  // Create system_configurations table
  pgm.createTable('system_configurations', {
    id: 'id',
    key: {
      type: 'varchar(255)',
      notNull: true,
      unique: true
    },
    value: {
      type: 'text',
      notNull: true
    },
    data_type: {
      type: 'config_data_type',
      notNull: true
    },
    category: {
      type: 'config_category',
      notNull: true
    },
    description: {
      type: 'text'
    },
    is_sensitive: {
      type: 'boolean',
      default: false,
      notNull: true
    },
    default_value: {
      type: 'text'
    },
    validation_rules: {
      type: 'jsonb'
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp')
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp')
    }
  });

  // Create indexes
  pgm.createIndex('system_configurations', 'key');
  pgm.createIndex('system_configurations', 'category');

  // Create configuration audit trail table
  pgm.createTable('system_configuration_audits', {
    id: 'id',
    configuration_id: {
      type: 'integer',
      notNull: true,
      references: '"system_configurations"',
      onDelete: 'CASCADE'
    },
    changed_by: {
      type: 'integer',
      notNull: true,
      references: '"users"',
      onDelete: 'SET NULL'
    },
    old_value: {
      type: 'text'
    },
    new_value: {
      type: 'text',
      notNull: true
    },
    change_reason: {
      type: 'text'
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
      default: pgm.func('current_timestamp')
    }
  });

  // Create indexes for audit table
  pgm.createIndex('system_configuration_audits', 'configuration_id');
  pgm.createIndex('system_configuration_audits', 'changed_by');
  pgm.createIndex('system_configuration_audits', 'created_at');

  // Insert default configurations
  const defaultConfigs = [
    // General settings
    {
      key: 'site_name',
      value: 'Permisos Digitales',
      data_type: 'string',
      category: 'general',
      description: 'Name of the website displayed in emails and UI'
    },
    {
      key: 'maintenance_mode',
      value: 'false',
      data_type: 'boolean',
      category: 'general',
      description: 'Enable maintenance mode to prevent user access'
    },
    {
      key: 'support_email',
      value: 'support@permisosdigitales.com.mx',
      data_type: 'string',
      category: 'general',
      description: 'Email address for support inquiries'
    },
    {
      key: 'contact_phone',
      value: '+52 123 456 7890',
      data_type: 'string',
      category: 'general',
      description: 'Contact phone number for support'
    },

    // Email settings
    {
      key: 'email_from_name',
      value: 'Permisos Digitales',
      data_type: 'string',
      category: 'email',
      description: 'From name for system emails'
    },
    {
      key: 'email_from_address',
      value: 'noreply@permisosdigitales.com.mx',
      data_type: 'string',
      category: 'email',
      description: 'From email address for system emails'
    },
    {
      key: 'send_welcome_email',
      value: 'true',
      data_type: 'boolean',
      category: 'email',
      description: 'Send welcome email to new users'
    },
    {
      key: 'send_payment_confirmation',
      value: 'true',
      data_type: 'boolean',
      category: 'email',
      description: 'Send email confirmation after successful payment'
    },
    {
      key: 'send_permit_ready_notification',
      value: 'true',
      data_type: 'boolean',
      category: 'email',
      description: 'Send notification when permit is ready'
    },

    // Payment settings
    {
      key: 'payment_timeout_minutes',
      value: '15',
      data_type: 'number',
      category: 'payment',
      description: 'Minutes before payment session expires',
      validation_rules: '{"min": 5, "max": 60}'
    },
    {
      key: 'payment_retry_attempts',
      value: '3',
      data_type: 'number',
      category: 'payment',
      description: 'Maximum payment retry attempts',
      validation_rules: '{"min": 0, "max": 10}'
    },
    {
      key: 'oxxo_processing_hours_min',
      value: '1',
      data_type: 'number',
      category: 'payment',
      description: 'Minimum hours for OXXO payment processing',
      validation_rules: '{"min": 1, "max": 24}'
    },
    {
      key: 'oxxo_processing_hours_max',
      value: '4',
      data_type: 'number',
      category: 'payment',
      description: 'Maximum hours for OXXO payment processing',
      validation_rules: '{"min": 1, "max": 48}'
    },
    {
      key: 'enable_stripe_payments',
      value: 'true',
      data_type: 'boolean',
      category: 'payment',
      description: 'Enable Stripe card payments'
    },
    {
      key: 'enable_oxxo_payments',
      value: 'true',
      data_type: 'boolean',
      category: 'payment',
      description: 'Enable OXXO cash payments'
    },

    // Security settings
    {
      key: 'session_timeout_minutes',
      value: '120',
      data_type: 'number',
      category: 'security',
      description: 'Minutes before user session expires',
      validation_rules: '{"min": 15, "max": 1440}'
    },
    {
      key: 'max_login_attempts',
      value: '5',
      data_type: 'number',
      category: 'security',
      description: 'Maximum failed login attempts before lockout',
      validation_rules: '{"min": 3, "max": 10}'
    },
    {
      key: 'lockout_duration_minutes',
      value: '30',
      data_type: 'number',
      category: 'security',
      description: 'Minutes to lock account after max failed attempts',
      validation_rules: '{"min": 5, "max": 1440}'
    },
    {
      key: 'password_min_length',
      value: '8',
      data_type: 'number',
      category: 'security',
      description: 'Minimum password length',
      validation_rules: '{"min": 6, "max": 32}'
    },
    {
      key: 'require_email_verification',
      value: 'true',
      data_type: 'boolean',
      category: 'security',
      description: 'Require email verification for new accounts'
    },

    // Feature flags
    {
      key: 'enable_user_registration',
      value: 'true',
      data_type: 'boolean',
      category: 'features',
      description: 'Allow new user registrations'
    },
    {
      key: 'enable_permit_renewal',
      value: 'true',
      data_type: 'boolean',
      category: 'features',
      description: 'Allow users to renew permits'
    },
    {
      key: 'enable_document_upload',
      value: 'true',
      data_type: 'boolean',
      category: 'features',
      description: 'Allow users to upload documents'
    },
    {
      key: 'enable_pdf_generation',
      value: 'true',
      data_type: 'boolean',
      category: 'features',
      description: 'Enable automatic PDF permit generation'
    },
    {
      key: 'enable_email_notifications',
      value: 'true',
      data_type: 'boolean',
      category: 'features',
      description: 'Enable all email notifications'
    },

    // Limits
    {
      key: 'max_file_size_mb',
      value: '10',
      data_type: 'number',
      category: 'limits',
      description: 'Maximum file upload size in MB',
      validation_rules: '{"min": 1, "max": 50}'
    },
    {
      key: 'max_files_per_upload',
      value: '5',
      data_type: 'number',
      category: 'limits',
      description: 'Maximum files per upload',
      validation_rules: '{"min": 1, "max": 20}'
    },
    {
      key: 'rate_limit_requests_per_minute',
      value: '60',
      data_type: 'number',
      category: 'limits',
      description: 'API rate limit per minute per IP',
      validation_rules: '{"min": 10, "max": 1000}'
    },
    {
      key: 'max_active_sessions_per_user',
      value: '3',
      data_type: 'number',
      category: 'limits',
      description: 'Maximum concurrent sessions per user',
      validation_rules: '{"min": 1, "max": 10}'
    },
    {
      key: 'permit_download_expiry_hours',
      value: '48',
      data_type: 'number',
      category: 'limits',
      description: 'Hours before permit download link expires',
      validation_rules: '{"min": 1, "max": 168}'
    }
  ];

  // Insert default configurations
  for (const config of defaultConfigs) {
    await pgm.db.query(
      `INSERT INTO system_configurations (key, value, data_type, category, description, validation_rules, default_value)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        config.key,
        config.value,
        config.data_type,
        config.category,
        config.description,
        config.validation_rules || null,
        config.value // Set default_value same as initial value
      ]
    );
  }

  // Add trigger to update updated_at timestamp
  pgm.createTrigger('system_configurations', 'update_updated_at', {
    when: 'BEFORE',
    operation: 'UPDATE',
    function: 'update_updated_at_column',
    level: 'ROW'
  });
};

exports.down = async (pgm) => {
  // Drop triggers
  pgm.dropTrigger('system_configurations', 'update_updated_at');

  // Drop tables
  pgm.dropTable('system_configuration_audits');
  pgm.dropTable('system_configurations');

  // Drop types
  pgm.dropType('config_data_type');
  pgm.dropType('config_category');
};