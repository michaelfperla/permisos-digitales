// src/middleware/cors.middleware.js
const cors = require('cors');
const { logger } = require('../utils/enhanced-logger');

// Configure CORS options
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) {
      return callback(null, true);
    }

    // Industry Standard: Allow all frontend domains to access canonical API
    const allowedOrigins = process.env.NODE_ENV === 'production'
      ? [
        // Primary frontend domains (.com.mx) - Main production domains
        'https://permisosdigitales.com.mx',
        'https://www.permisosdigitales.com.mx',
        // Secondary frontend domains (.com) - Redirect domains
        'https://permisosdigitales.com',
        'https://www.permisosdigitales.com',
        // CloudFront distribution
        'https://d2gtd1yvnspajh.cloudfront.net',
        // API domain itself (for internal requests)
        'https://api.permisosdigitales.com.mx',
        // Add any staging/preview domains if needed
      ]
      : [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
        'http://127.0.0.1:3002',
      ];

    // Check if the origin is allowed
    if (allowedOrigins.indexOf(origin) !== -1) {
      // Important: Return the actual origin, not a wildcard
      callback(null, origin);
    } else {
      logger.warn(`CORS blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With', 'Cookie'],
  exposedHeaders: ['Set-Cookie'],
  credentials: true, // Allow cookies to be sent with requests
  maxAge: 86400 // Cache preflight request for 24 hours
};

// Create the CORS middleware
const corsMiddleware = cors(corsOptions);

// Create a simple CORS middleware for development
const simpleCorsMiddleware = (req, res, next) => {
  // Get the origin from the request
  const origin = req.headers.origin;

  // List of allowed origins for development
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:3002'
  ];

  // Check if the origin is allowed
  if (origin && allowedOrigins.includes(origin)) {
    // Set the Access-Control-Allow-Origin header to the actual origin
    res.header('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    res.header('Access-Control-Allow-Origin', '*');
  } else {
    // Log blocked origins
    logger.warn(`CORS blocked request from origin: ${origin}`);
  }

  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-CSRF-Token');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Expose-Headers', 'Set-Cookie');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  next();
};

// Export both middleware options
module.exports = process.env.NODE_ENV === 'production' ? corsMiddleware : simpleCorsMiddleware;
