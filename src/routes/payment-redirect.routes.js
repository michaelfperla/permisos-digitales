/**
 * Payment Redirect Routes
 * Handles short URL redirects to Stripe payment links
 */

const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const urlShortener = require('../services/whatsapp/url-shortener.service');

/**
 * Redirect short payment URL to Stripe
 * GET /pago/:shortCode
 */
router.get('/pago/:shortCode', async (req, res) => {
  try {
    const { shortCode } = req.params;
    
    logger.info('Payment redirect requested', { shortCode, userAgent: req.headers['user-agent'] });
    
    // Resolve the short URL
    const longUrl = await urlShortener.resolveShortUrl(shortCode);
    
    if (!longUrl) {
      logger.warn('Payment link not found', { shortCode });
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Link No Encontrado - Permisos Digitales</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
        </head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1>❌ Link No Encontrado</h1>
          <p>El link de pago ha expirado o no es válido.</p>
          <p>Por favor, solicita un nuevo permiso en WhatsApp:</p>
          <a href="https://wa.me/5216641633345" style="background: #25D366; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 20px;">
            💬 Ir a WhatsApp
          </a>
        </body>
        </html>
      `);
    }
    
    logger.info('Redirecting to Stripe', { shortCode, destination: longUrl.substring(0, 50) + '...' });
    
    // Add tracking headers for analytics
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    // Redirect to Stripe payment page
    res.redirect(302, longUrl);
    
  } catch (error) {
    logger.error('Error in payment redirect', { error: error.message, shortCode: req.params.shortCode });
    
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Error - Permisos Digitales</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
      </head>
      <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
        <h1>❌ Error Temporal</h1>
        <p>Hubo un problema procesando tu solicitud.</p>
        <p>Por favor, intenta nuevamente en WhatsApp:</p>
        <a href="https://wa.me/5216641633345" style="background: #25D366; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 20px;">
          💬 Ir a WhatsApp
        </a>
      </body>
      </html>
    `);
  }
});

/**
 * Health check for payment redirect service
 */
router.get('/pago/health/check', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'payment-redirect',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;