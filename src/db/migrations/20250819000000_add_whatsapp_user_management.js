/**
 * Migration: Add WhatsApp-first user management
 * - Add whatsapp_phone column to users
 * - Rename email to account_email (remove UNIQUE)
 * - Add delivery_email to permit_applications
 * - Add indexes for performance
 */

exports.up = async function(knex) {
  // 1. Add whatsapp_phone column to users table
  await knex.schema.alterTable('users', function(table) {
    table.string('whatsapp_phone', 20).unique();
    table.index(['whatsapp_phone'], 'idx_users_whatsapp_phone');
  });

  // 2. Rename email to account_email and remove UNIQUE constraint
  await knex.schema.alterTable('users', function(table) {
    table.renameColumn('email', 'account_email');
  });

  // Remove the unique constraint on account_email (email can now be duplicated)
  await knex.schema.raw('ALTER TABLE users DROP INDEX IF EXISTS users_email_unique');
  await knex.schema.raw('ALTER TABLE users DROP INDEX IF EXISTS email');

  // 3. Add delivery_email to permit_applications
  await knex.schema.alterTable('permit_applications', function(table) {
    table.string('delivery_email', 255).nullable();
    table.integer('renewed_from_id').nullable();
    
    // Add indexes for performance
    table.index(['user_id'], 'idx_applications_user_id');
    table.index(['renewed_from_id'], 'idx_applications_renewed_from');
  });

  // 4. Migrate existing data: copy account_email to account_email (no change needed)
  // This ensures existing email-only users keep their accounts working

  console.log('✅ WhatsApp user management schema updated');
};

exports.down = async function(knex) {
  // Reverse the changes
  
  // 1. Remove whatsapp_phone from users
  await knex.schema.alterTable('users', function(table) {
    table.dropIndex(['whatsapp_phone'], 'idx_users_whatsapp_phone');
    table.dropColumn('whatsapp_phone');
  });

  // 2. Rename account_email back to email and add UNIQUE constraint
  await knex.schema.alterTable('users', function(table) {
    table.renameColumn('account_email', 'email');
  });
  
  await knex.schema.raw('ALTER TABLE users ADD UNIQUE INDEX users_email_unique (email)');

  // 3. Remove columns from permit_applications
  await knex.schema.alterTable('permit_applications', function(table) {
    table.dropIndex(['user_id'], 'idx_applications_user_id');
    table.dropIndex(['renewed_from_id'], 'idx_applications_renewed_from');
    table.dropColumn('delivery_email');
    table.dropColumn('renewed_from_id');
  });

  console.log('✅ WhatsApp user management schema reverted');
};