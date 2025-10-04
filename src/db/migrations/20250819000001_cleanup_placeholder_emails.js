/**
 * Migration: Clean up placeholder emails
 * - Set placeholder emails to NULL for WhatsApp users
 * - This completes the migration away from fake domain emails
 */

exports.up = async function(knex) {
  // Update placeholder emails to NULL
  const placeholderEmailUpdate = await knex('users')
    .where('account_email', 'like', '%@whatsapp.permisos.mx')
    .orWhere('account_email', 'like', '%@permisos.mx')
    .update({
      account_email: null
    });
  
  console.log(`✅ Updated ${placeholderEmailUpdate} placeholder emails to NULL`);
  
  // Log remaining email patterns for verification
  const remainingEmails = await knex('users')
    .select('account_email')
    .whereNotNull('account_email')
    .limit(5);
    
  console.log('Sample remaining emails:', remainingEmails.map(r => r.account_email));
};

exports.down = async function(knex) {
  // Reverse is not possible - we can't recreate fake emails
  // This is intentional as placeholder emails were problematic
  console.log('✅ Cleanup of placeholder emails cannot be reversed (this is intentional)');
};