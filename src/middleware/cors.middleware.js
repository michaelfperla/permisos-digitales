const cors = require('cors');
const { logger } = require('../utils/logger');

// Simple CORS configuration that explicitly handles production domains
const corsOptions = {
  origin: function (origin, callback) {
    // Always allow requests with no origin (e.g., same-origin, Postman, curl)
    if (!origin) {
      return callback(null, true);
    }

    const allowedOrigins = process.env.NODE_ENV === 'production'
      ? [
        'https://permisosdigitales.com.mx',
        'https://www.permisosdigitales.com.mx',
        'https://permisosdigitales.com',
        'https://www.permisosdigitales.com',
        'https://d2gtd1yvnspajh.cloudfront.net',
        'https://api.permisosdigitales.com.mx',
      ]
      : [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002',
        'http://localhost:3003',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
        'http://127.0.0.1:3002',
        'http://127.0.0.1:3003',
      ];

    // Add WSL IP addresses if in WSL environment (development only)
    if (process.env.NODE_ENV !== 'production' && process.env.WSL_ENVIRONMENT === 'true' && process.env.WSL_IP) {
      const wslIP = process.env.WSL_IP;
      allowedOrigins.push(
        `http://${wslIP}:3000`,
        `http://${wslIP}:3001`,
        `http://${wslIP}:3002`,
        `http://${wslIP}:3003`
      );
    }

    // Check if origin is allowed
    if (allowedOrigins.includes(origin)) {
      logger.debug(`CORS allowing request from origin: ${origin}`);
      callback(null, true);
    } else {
      logger.warn(`CORS blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With', 'Cookie', 'X-Portal-Type'],
  exposedHeaders: ['Set-Cookie'],
  credentials: true,
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 200
};

// Create the CORS middleware instance
const corsMiddleware = cors(corsOptions);

// Export a wrapper that logs CORS activity
module.exports = (req, res, next) => {
  // Log preflight requests
  if (req.method === 'OPTIONS') {
    logger.debug(`CORS preflight request from ${req.headers.origin} to ${req.path}`);
  }
  
  // Apply CORS
  corsMiddleware(req, res, (err) => {
    if (err) {
      logger.error('CORS error:', err);
      return res.status(403).json({ error: 'CORS policy violation' });
    }
    next();
  });
};