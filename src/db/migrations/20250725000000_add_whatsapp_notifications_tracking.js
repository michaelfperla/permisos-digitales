exports.up = async (pgm) => {
  // Create table for tracking WhatsApp notifications
  pgm.createTable('whatsapp_notifications', {
    id: {
      type: 'serial',
      primaryKey: true
    },
    application_id: {
      type: 'integer',
      notNull: true,
      references: {
        name: 'permit_applications',
        column: 'id'
      },
      onDelete: 'CASCADE'
    },
    user_id: {
      type: 'integer',
      notNull: true,
      references: {
        name: 'users',
        column: 'id'
      },
      onDelete: 'CASCADE'
    },
    phone_number: {
      type: 'varchar(20)',
      notNull: true
    },
    notification_type: {
      type: 'varchar(50)',
      notNull: true,
      comment: 'Type of notification: permit_ready, payment_confirmation, etc.'
    },
    message_content: {
      type: 'text',
      notNull: false
    },
    permit_url: {
      type: 'text',
      notNull: false
    },
    status: {
      type: 'varchar(20)',
      notNull: true,
      default: 'pending',
      comment: 'pending, sent, failed, expired'
    },
    retry_count: {
      type: 'integer',
      notNull: true,
      default: 0
    },
    last_error: {
      type: 'text',
      notNull: false
    },
    sent_at: {
      type: 'timestamp',
      notNull: false
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('NOW()')
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('NOW()')
    }
  });

  // Add indexes
  pgm.createIndex('whatsapp_notifications', 'application_id');
  pgm.createIndex('whatsapp_notifications', 'user_id');
  pgm.createIndex('whatsapp_notifications', 'phone_number');
  pgm.createIndex('whatsapp_notifications', 'status');
  pgm.createIndex('whatsapp_notifications', ['status', 'retry_count'], {
    where: "status IN ('pending', 'failed')"
  });

  // Add trigger for updated_at
  pgm.sql(`
    CREATE TRIGGER update_whatsapp_notifications_updated_at
    BEFORE UPDATE ON whatsapp_notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  `);
};

exports.down = (pgm) => {
  pgm.dropTable('whatsapp_notifications');
};