/**
 * Auth Validation Routes
 * Provides endpoints for debugging and validating authentication issues
 */

const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');

/**
 * Session validation endpoint - helps debug login issues
 */
router.get('/auth/validate-session', (req, res) => {
  try {
    const sessionInfo = {
      hasSession: !!req.session,
      sessionId: req.session?.id,
      isAuthenticated: !!req.session?.userId,
      userId: req.session?.userId,
      userEmail: req.session?.userEmail,
      cookieInfo: {
        domain: req.session?.cookie?.domain,
        secure: req.session?.cookie?.secure,
        httpOnly: req.session?.cookie?.httpOnly,
        sameSite: req.session?.cookie?.sameSite,
        maxAge: req.session?.cookie?.maxAge,
        expires: req.session?.cookie?.expires
      },
      headers: {
        host: req.get('host'),
        origin: req.get('origin'),
        cookie: req.get('cookie') ? 'present' : 'missing',
        userAgent: req.get('user-agent')
      }
    };

    logger.info('[Auth Validation] Session check:', sessionInfo);

    res.json({
      success: true,
      data: sessionInfo
    });
  } catch (error) {
    logger.error('[Auth Validation] Error checking session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate session'
    });
  }
});

/**
 * Clear session endpoint - helps users fix stuck sessions
 */
router.post('/auth/clear-session', (req, res) => {
  try {
    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          logger.error('[Auth Validation] Error destroying session:', err);
          return res.status(500).json({
            success: false,
            error: 'Failed to clear session'
          });
        }

        res.clearCookie('permisos.sid');
        res.json({
          success: true,
          message: 'Session cleared successfully'
        });
      });
    } else {
      res.json({
        success: true,
        message: 'No session to clear'
      });
    }
  } catch (error) {
    logger.error('[Auth Validation] Error clearing session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear session'
    });
  }
});

module.exports = router;