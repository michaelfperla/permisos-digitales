/**
 * Privacy Export Token Cleanup Job
 * Removes expired export tokens to maintain compliance and database hygiene
 */

const { logger } = require('../utils/logger');
const db = require('../db');

/**
 * Clean up expired privacy export tokens
 * Runs daily to remove tokens older than 24 hours
 */
async function cleanupExpiredExportTokens() {
  try {
    logger.info('[PrivacyExportCleanup] Starting cleanup of expired export tokens');
    
    // Delete expired tokens (older than 24 hours)
    const deleteQuery = `
      DELETE FROM privacy_export_tokens
      WHERE expires_at < NOW()
      OR (accessed_at IS NOT NULL AND accessed_at < NOW() - INTERVAL '1 hour')
      RETURNING id, user_id, token
    `;
    
    const result = await db.query(deleteQuery);
    
    if (result.rows.length > 0) {
      logger.info('[PrivacyExportCleanup] Cleaned up expired export tokens', {
        count: result.rows.length,
        tokens: result.rows.map(r => ({
          id: r.id,
          userId: r.user_id,
          tokenPrefix: r.token.substring(0, 8) + '...'
        }))
      });
    } else {
      logger.info('[PrivacyExportCleanup] No expired export tokens to clean up');
    }
    
    // Also log statistics
    const statsQuery = `
      SELECT 
        COUNT(*) as total_tokens,
        COUNT(CASE WHEN accessed_at IS NOT NULL THEN 1 END) as accessed_tokens,
        COUNT(CASE WHEN expires_at < NOW() THEN 1 END) as expired_tokens
      FROM privacy_export_tokens
    `;
    
    const stats = await db.query(statsQuery);
    logger.info('[PrivacyExportCleanup] Export token statistics', stats.rows[0]);
    
    return {
      success: true,
      deletedCount: result.rows.length
    };
    
  } catch (error) {
    logger.error('[PrivacyExportCleanup] Error cleaning up export tokens', {
      error: error.message,
      stack: error.stack
    });
    
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  cleanupExpiredExportTokens
};