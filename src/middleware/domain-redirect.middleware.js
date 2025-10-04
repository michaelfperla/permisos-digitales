/**
 * Domain Redirect Middleware
 * Ensures all traffic uses the primary .com.mx domain to avoid cross-domain session issues
 */

const { logger } = require('../utils/logger');

/**
 * Redirect .com domains to .com.mx equivalents
 * This ensures sessions work correctly across all subdomains
 */
const domainRedirectMiddleware = (req, res, next) => {
  // Only redirect in production
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  const host = (req.get('host') || '').toLowerCase();

  // Check if this is a .com domain that needs redirecting
  if (host.includes('.com') && !host.includes('.com.mx')) {
    // Map .com domains to .com.mx equivalents
    const redirectMap = {
      'permisosdigitales.com': 'permisosdigitales.com.mx',
      'www.permisosdigitales.com': 'www.permisosdigitales.com.mx',
      'api.permisosdigitales.com': 'api.permisosdigitales.com.mx',
      'admin.permisosdigitales.com': 'admin.permisosdigitales.com.mx'
    };

    const hostname = host.replace(/:\d+$/, ''); // Remove port
    const targetHost = redirectMap[hostname];

    if (targetHost) {
      const protocol = req.secure ? 'https' : 'http';
      const redirectUrl = `${protocol}://${targetHost}${req.originalUrl}`;

      logger.info('[Domain Redirect] Redirecting .com to .com.mx:', {
        from: host,
        to: targetHost,
        url: req.originalUrl,
        method: req.method
      });

      // Use 308 for POST/PUT/PATCH/DELETE to preserve method and body
      // Use 301 for GET/HEAD for SEO benefits
      const statusCode = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) ? 308 : 301;

      return res.redirect(statusCode, redirectUrl);
    }
  }

  // Continue if no redirect needed
  next();
};

module.exports = domainRedirectMiddleware;