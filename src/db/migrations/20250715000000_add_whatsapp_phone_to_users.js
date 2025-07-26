/**
 * Add WhatsApp phone field to users table
 * 
 * Client requirement: "Solicitar WhatsApp a los clientes al momento de hacer su registro de usuario"
 */

exports.up = async function(pgm) {
  // Add whatsapp_phone column to users table
  pgm.addColumn('users', {
    whatsapp_phone: {
      type: 'varchar(20)',
      notNull: false,
      comment: 'WhatsApp phone number for user communication'
    }
  });

  // Add index for faster lookups by WhatsApp phone
  pgm.createIndex('users', 'whatsapp_phone', {
    name: 'idx_users_whatsapp_phone',
    where: 'whatsapp_phone IS NOT NULL'
  });
};

exports.down = async function(pgm) {
  // Drop the index first
  pgm.dropIndex('users', 'whatsapp_phone', {
    name: 'idx_users_whatsapp_phone'
  });
  
  // Drop the column
  pgm.dropColumn('users', 'whatsapp_phone');
};