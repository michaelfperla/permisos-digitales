/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * Migration to add payment_events table and payment_processor_order_id column
 * to permit_applications table for Conekta payment gateway integration
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
  // Add payment_processor_order_id column to permit_applications table if it doesn't exist
  pgm.addColumns('permit_applications', {
    payment_processor_order_id: {
      type: 'varchar(255)',
      comment: 'Order ID from the payment processor (e.g., Conekta)'
    }
  }, {
    ifNotExists: true
  });

  // Create payment_events table
  pgm.createTable('payment_events', {
    id: 'id',
    application_id: {
      type: 'integer',
      notNull: true,
      references: 'permit_applications(id)',
      onDelete: 'CASCADE'
    },
    order_id: {
      type: 'varchar(255)',
      notNull: true,
      comment: 'Order ID from the payment processor (e.g., Conekta)'
    },
    event_type: {
      type: 'varchar(100)',
      notNull: true,
      comment: 'Type of payment event (e.g., order.paid, charge.created)'
    },
    event_data: {
      type: 'jsonb',
      comment: 'JSON data from the payment processor webhook'
    },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('current_timestamp')
    }
  }, {
    ifNotExists: true,
    comment: 'Stores payment events from the payment processor webhook'
  });

  // Create indexes
  pgm.createIndex('payment_events', 'application_id', {
    name: 'idx_payment_events_application_id'
  });

  pgm.createIndex('payment_events', 'order_id', {
    name: 'idx_payment_events_order_id'
  });

  pgm.createIndex('payment_events', 'event_type', {
    name: 'idx_payment_events_event_type'
  });

  pgm.createIndex('payment_events', 'created_at', {
    name: 'idx_payment_events_created_at'
  });

  // Create index on permit_applications.payment_processor_order_id
  pgm.createIndex('permit_applications', 'payment_processor_order_id', {
    name: 'idx_permit_applications_payment_processor_order_id'
  });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  // Drop indexes
  pgm.dropIndex('permit_applications', 'payment_processor_order_id', {
    name: 'idx_permit_applications_payment_processor_order_id',
    ifExists: true
  });

  pgm.dropIndex('payment_events', 'created_at', {
    name: 'idx_payment_events_created_at',
    ifExists: true
  });

  pgm.dropIndex('payment_events', 'event_type', {
    name: 'idx_payment_events_event_type',
    ifExists: true
  });

  pgm.dropIndex('payment_events', 'order_id', {
    name: 'idx_payment_events_order_id',
    ifExists: true
  });

  pgm.dropIndex('payment_events', 'application_id', {
    name: 'idx_payment_events_application_id',
    ifExists: true
  });

  // Drop payment_events table
  pgm.dropTable('payment_events', {
    ifExists: true,
    cascade: true
  });

  // Drop payment_processor_order_id column from permit_applications table
  pgm.dropColumns('permit_applications', ['payment_processor_order_id'], {
    ifExists: true
  });
};
