// src/server.js
const config = require('./config'); // Load config first
const express = require('express');
const path = require('path');
const session = require('express-session');
const cookieParser = require('cookie-parser'); // Import cookie-parser for CSRF
const connectPgSimple = require('connect-pg-simple'); // Import store connector
const helmet = require('helmet'); // Import Helmet for security headers
const httpContext = require('express-http-context'); // For request context
const apiRoutes = require('./routes'); // Import main API router index
const { dbPool, testConnection } = require('./db'); // Import named pool and test function
const { logger, correlationMiddleware } = require('./utils/enhanced-logger'); // Enhanced logger with correlation IDs
const requestIdMiddleware = require('./middleware/request-id.middleware'); // Request ID middleware
const { csrfProtection, handleCsrfError } = require('./middleware/csrf.middleware'); // Import CSRF middleware (ensure this path is correct)
const corsMiddleware = require('./middleware/cors.middleware'); // Import CORS middleware
const { initScheduledJobs } = require('./jobs/scheduler'); // Import scheduled jobs
const Conekta = require('./config/conekta'); // Import Conekta payment gateway configuration

// Initialize connect-pg-simple store connector
const PgSession = connectPgSimple(session);

// Create the session store instance, passing the imported pool
const sessionStore = new PgSession({
  pool: dbPool, // Use the imported dbPool
  tableName: 'user_sessions', // Make sure this matches your DB table name
});

// Session store logging only in development
if (process.env.NODE_ENV === 'development') {
  const originalDestroy = sessionStore.destroy.bind(sessionStore);
  sessionStore.destroy = function(sid, callback) {
    logger.debug(`[SessionStore] Destroying session: ${sid}`);
    return originalDestroy(sid, callback);
  };

  const originalSet = sessionStore.set.bind(sessionStore);
  sessionStore.set = function(sid, sess, callback) {
    logger.debug(`[SessionStore] Setting session: ${sid}, User: ${sess.userId || 'none'}`);
    return originalSet(sid, sess, callback);
  };

  const originalGet = sessionStore.get.bind(sessionStore);
  sessionStore.get = function(sid, callback) {
    logger.debug(`[SessionStore] Getting session: ${sid}`);
    return originalGet(sid, callback);
  };

  const originalTouch = sessionStore.touch.bind(sessionStore);
  sessionStore.touch = function(sid, sess, callback) {
    logger.debug(`[SessionStore] Touching session: ${sid}, User: ${sess.userId || 'none'}`);
    return originalTouch(sid, sess, callback);
  };
}

// --- Initialize Express App ---
const app = express();
const PORT = config.port;

// Trust proxy for production (nginx reverse proxy)
if (config.nodeEnv === 'production') {
  app.set('trust proxy', 1); // Trust first proxy (nginx)
}

// Import metrics middleware
const { metricsMiddleware } = require('./utils/metrics');

// --- Security Middleware ---
// Using Helmet for security headers

// Apply Helmet FIRST for security headers
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ['\'self\''],
      // TODO: Refactor frontend code to remove reliance on inline scripts and eval() to fully enable stricter CSP.
      // Removing 'unsafe-inline' and 'unsafe-eval' would significantly improve XSS protection.
      // Consider using nonces or hashes as a more secure alternative if complete removal is not feasible.
      scriptSrc: ['\'self\''], // Removed 'unsafe-inline' and 'unsafe-eval' for better security
      // TODO: Refactor frontend code to remove reliance on inline styles to fully enable stricter CSP.
      // Removing 'unsafe-inline' would significantly improve XSS protection.
      styleSrc: ['\'self\'', 'https://fonts.googleapis.com'], // Removed 'unsafe-inline' for better security
      styleSrcElem: ['\'self\'', 'https://fonts.googleapis.com'], // Removed 'unsafe-inline' for better security
      styleSrcAttr: ['\'self\''],
      imgSrc: ['\'self\'', 'data:', 'https:'],
      connectSrc: ['\'self\'', 'https:'],
      fontSrc: ['\'self\'', 'https://fonts.gstatic.com', 'https://fonts.googleapis.com', 'data:'],
      objectSrc: ['\'none\''],
      mediaSrc: ['\'self\''],
      frameSrc: ['\'self\'', 'https:'],
    },
  },
  hsts: config.nodeEnv === 'production' ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
  hidePoweredBy: true,
  frameguard: { action: 'deny' },
  noSniff: true,
  xssFilter: true,
  ieNoOpen: true,
  dnsPrefetchControl: { allow: false },
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  referrerPolicy: { policy: 'same-origin' }
}));

// --- Request Tracking, Metrics, and Security Middleware ---
app.use(corsMiddleware); // Apply CORS middleware first
app.use(requestIdMiddleware);
app.use(httpContext.middleware);
app.use((req, _res, next) => { httpContext.set('requestId', req.id); next(); });
app.use(correlationMiddleware); // Set correlation IDs and log requests
app.use(metricsMiddleware); // Add metrics collection

// Response monitoring for debugging (development only)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    // Only monitor specific routes for debugging
    if (req.path === '/user/profile' && req.method === 'PUT') {
      const originalEnd = res.end;

      res.end = function(...args) {
        // Call the original end method
        originalEnd.apply(res, args);

        // Log after response is sent using proper logger
        logger.debug(`[ResponseFinish] ${req.method} ${req.path} completed with status ${res.statusCode}. Session ID: ${req.session?.id}`);

        // Check if session still exists
        if (req.session) {
          logger.debug(`[ResponseFinish] Session still exists after response. User ID: ${req.session.userId}`);
        } else {
          logger.debug('[ResponseFinish] Session was destroyed during or after response!');
        }
      };
    }
    next();
  });
}

// --- Core Body Parsing Middleware ---
// Handle Stripe webhook endpoint BEFORE general JSON parsing if needed
// app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json()); // For parsing application/json
app.use(express.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded

// --- Cookie Parser Middleware ---
// Required for CSRF protection
app.use(cookieParser(config.sessionSecret)); // Use the same secret as session for consistency

// --- Session Middleware ---
// Needs to come after core middleware but before routes that use sessions
app.use(session({
  store: sessionStore,
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  name: 'permisos.sid',
  cookie: {
    secure: config.nodeEnv === 'production',
    httpOnly: true,
    sameSite: config.nodeEnv === 'production' ? 'strict' : 'lax', // Use lax in development for cross-origin
    maxAge: 1000 * 60 * 60, // Example: 1 hour activity timeout
    domain: config.nodeEnv === 'production' ? '.permisosdigitales.com.mx' : undefined // Set domain in production
  }
}));

// --- Session Absolute Timeout Middleware ---
app.use((req, res, next) => {
  // Debug logging for development only
  if (process.env.NODE_ENV === 'development' && req.path === '/user/profile' && req.method === 'PUT') {
    logger.debug(`[SessionTimeout] Checking session timeout for ${req.path}. Session ID: ${req.session?.id}, User ID: ${req.session?.userId}`);
  }

  if (req.session && req.session.createdAt) {
    const now = Date.now();
    const createdAt = new Date(req.session.createdAt).getTime();
    const sessionAge = now - createdAt;
    const absoluteTimeout = 1000 * 60 * 60 * 8; // 8 hours absolute timeout

    if (sessionAge > absoluteTimeout) {
      logger.info(`Session expired due to absolute timeout for user ID: ${req.session.userId}`);

      req.session.destroy(err => {
        if (err) {
          logger.error('Error destroying expired session:', err);
        } else {
          logger.debug(`Successfully destroyed expired session ID: ${req.session?.id}`);
        }

        // Respond consistently for API vs HTML requests
        if (req.accepts('html')) {
          res.redirect('/login?reason=session_expired'); // Redirect browser
        } else {
          res.status(401).json({ message: 'Session expired. Please log in again.' }); // API response
        }
      });
    } else {
      if (process.env.NODE_ENV === 'development' && req.path === '/user/profile' && req.method === 'PUT') {
        logger.debug(`[SessionTimeout] Session is valid (age: ${sessionAge}ms). Continuing to next middleware.`);
      }
      next(); // Session is valid
    }
  } else {
    // Set creation time for new sessions if needed (often handled by store)
    if (process.env.NODE_ENV === 'development' && req.path === '/user/profile' && req.method === 'PUT') {
      logger.debug(`[SessionTimeout] No session createdAt timestamp found. Session ID: ${req.session?.id}`);
    }
    next();
  }
});


// --- CSRF Middleware ---
// Apply the error handler globally or just before API routes
app.use(handleCsrfError);
// Note: Apply csrfProtection selectively within your apiRoutes where needed (on POST, PUT, DELETE)
// Example within ./routes/auth.routes.js:
// router.post('/login', csrfProtection, authController.login);


// ==================================================
// === MOUNT API ROUTES *BEFORE* STATIC/SPA FILES ===
// ==================================================

// Mount health check routes directly (not under /api)
const healthRoutes = require('./routes/health.routes');
app.use('/health', healthRoutes);

// Mount metrics routes
const metricsRoutes = require('./routes/metrics.routes');
app.use('/metrics', metricsRoutes);

// Mount debug routes (production only)
const debugRoutes = require('./routes/debug.routes');
app.use('/debug', debugRoutes);

// Set up Swagger documentation
const { setupSwagger } = require('./utils/swagger');
setupSwagger(app);

// Apply rate limiting
const limiters = require('./middleware/rate-limit.middleware');

// Import ApiResponse helper
const ApiResponse = require('./utils/api-response');

// CSRF token endpoint is defined in auth.routes.js
// Removed duplicate endpoint to avoid conflicts

// Mount main API routes with rate limiting (industry standard: clean subdomain routing)
app.use('/', limiters.api, apiRoutes);

// Apply specific rate limiters to specific routes
app.use('/auth', limiters.auth);
app.use('/admin', limiters.admin);


// =========================================
// === SERVE FRONTEND STATIC ASSETS/VIEWS ===
// =========================================
// Serve files from the frontend directory with proper MIME types
const staticOptions = {
  setHeaders: (res, path) => {
    // Set correct MIME type for JavaScript modules
    if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    }
    if (path.endsWith('.mjs')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    }
    if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
    }
  }
};

app.use('/assets', express.static(path.join(__dirname, '../frontend/assets'), staticOptions));
app.use('/src', express.static(path.join(__dirname, '../frontend/src'), staticOptions));
app.use('/views', express.static(path.join(__dirname, '../frontend/views'), staticOptions));
app.use('/', express.static(path.join(__dirname, '../frontend'), staticOptions));


// ============================================
// === ADMIN INTERFACE ROUTE HANDLERS ===
// ============================================
// Admin portal - serve admin.html for all admin routes
app.get(['/admin', '/admin/*'], (req, res) => {
  // Set a session flag to indicate admin portal access
  if (req.session) {
    req.session.portalType = 'admin';
  }

  // Log the requested path for debugging
  logger.debug(`Admin route requested: ${req.path}`);

  // Serve admin.html for all admin routes
  res.sendFile(path.join(__dirname, '../frontend/admin.html'), (err) => {
    if (err) {
      logger.error(`Admin portal not found: ${err.message}`);
      res.status(404).send('Admin portal not found');
    } else {
      logger.debug(`Serving admin portal for path: ${req.path}`);
    }
  });
});

// ============================================
// === FRONTEND SPA CATCH-ALL ROUTE HANDLER ===
// ============================================
// This MUST come AFTER API routes and static file routes.
// It serves the main index.html for any GET request that doesn't match the above,
// allowing client-side routing (like react-router or our hash router) to take over.

// Catch-all route handler for HTML requests
// IMPORTANT: This should only serve frontend files when the request is NOT for an API endpoint
app.get('*', (req, res, next) => {
  // Skip serving frontend for API routes - let them 404 properly if not found
  // This is critical for industry standard clean subdomain routing
  const isApiRoute = req.path.startsWith('/auth') ||
                     req.path.startsWith('/applications') ||
                     req.path.startsWith('/user') ||
                     req.path.startsWith('/admin') ||
                     req.path.startsWith('/payments') ||
                     req.path.startsWith('/notifications') ||
                     req.path.startsWith('/status') ||
                     req.path.startsWith('/health') ||
                     req.path.startsWith('/metrics') ||
                     req.path.startsWith('/debug');

  if (isApiRoute) {
    // Let API routes handle themselves (or 404 if not found)
    next();
    return;
  }

  // For non-API requests that accept HTML, serve the SPA shell
  if (req.accepts('html')) {
    res.sendFile(path.join(__dirname, '../frontend/index.html'), (err) => {
      if (err) {
        // Handle potential error sending the file (e.g., file not found)
        logger.error(`Error sending index.html: ${err.message}`);
        next(err); // Pass error to global error handler
      } else {
        logger.debug(`Serving frontend SPA fallback for path: ${req.path}`);
      }
    });
  } else {
    // If it doesn't accept HTML (e.g., browser asking for sourcemap),
    // or for any other unhandled case, let it proceed (likely to 404 or error handler).
    next();
  }
});


// ============================================
// === GLOBAL ERROR HANDLING MIDDLEWARE     ===
// ============================================
// This should be the VERY LAST middleware added.
const errorHandler = require('./middleware/error-handler.middleware');
app.use(errorHandler);


// Migration note: Migrations should be run manually before server startup
// using: npm run migrate:up

// Start server function
async function startServer() {
  try {
    logger.info(`Server starting on port ${PORT} in ${config.nodeEnv} mode`);

    // Check session secret
    if (config.sessionSecret === 'default_fallback_secret_change_me' || !config.sessionSecret) {
      logger.error('FATAL ERROR: SESSION_SECRET is not set or is insecure! Please generate a strong secret in .env file. Exiting.');
      process.exit(1);
    }

    // Test database connection
    const dbOk = await testConnection();
    if (!dbOk) {
      logger.error('FATAL ERROR: Database connection failed on startup. Exiting.');
      process.exit(1);
    }
    logger.info('Database connection successful');
    logger.info('Session store initialized using: PostgreSQL');

    // Note: Database migrations should be run manually before server startup
    // using: npm run migrate:up

    // Start the server
    const server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);

      // Initialize scheduled jobs
      if (config.nodeEnv !== 'test') {
        initScheduledJobs();
      }
    });

    // Handle graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM signal received: closing HTTP server');
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();
