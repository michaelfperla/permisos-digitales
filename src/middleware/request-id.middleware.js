// src/middleware/request-id.middleware.js
const crypto = require('crypto');

/**
 * Middleware to generate and attach a unique request ID to each request
 * This helps with tracing requests through logs and debugging
 */
function requestIdMiddleware(req, res, next) {
  // Generate a random request ID if not already set
  // Format: timestamp-randomhex (e.g., 1621234567890-a1b2c3d4e5f6)
  const requestId = req.headers['x-request-id'] || 
                   `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
  
  // Attach the request ID to the request object
  req.id = requestId;
  
  // Add the request ID to the response headers
  res.setHeader('X-Request-ID', requestId);
  
  // Continue to the next middleware
  next();
}

module.exports = requestIdMiddleware;
