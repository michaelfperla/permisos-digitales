const config = require('./config');
const express = require('express');
const path = require('path');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const connectPgSimple = require('connect-pg-simple');
const helmet = require('helmet');
const httpContext = require('express-http-context');
const apiRoutes = require('./routes');
const { dbPool, testConnection } = require('./db');
const { logger, correlationMiddleware } = require('./utils/enhanced-logger');
const requestIdMiddleware = require('./middleware/request-id.middleware');
const { handleCsrfError } = require('./middleware/csrf.middleware');
const corsMiddleware = require('./middleware/cors.middleware');
const { initScheduledJobs } = require('./jobs/scheduler');
// Conekta configuration available but not used in server setup

const PgSession = connectPgSimple(session);

const sessionStore = new PgSession({
  pool: dbPool,
  tableName: 'user_sessions',
});

// Development-only session store debugging
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

const app = express();
const PORT = config.port;

if (config.nodeEnv === 'production') {
  app.set('trust proxy', 1);
}

const { metricsMiddleware } = require('./utils/metrics');

// Security headers configuration
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ['\'self\''],
      // TODO: Remove inline script dependencies for stricter CSP
      scriptSrc: ['\'self\''],
      // TODO: Remove inline style dependencies for stricter CSP
      styleSrc: ['\'self\'', 'https://fonts.googleapis.com'],
      styleSrcElem: ['\'self\'', 'https://fonts.googleapis.com'],
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

// Request tracking and monitoring middleware
app.use(corsMiddleware);
app.use(requestIdMiddleware);
app.use(httpContext.middleware);
app.use((req, _res, next) => { httpContext.set('requestId', req.id); next(); });
app.use(correlationMiddleware);
app.use(metricsMiddleware);

// Development-only response monitoring for specific routes
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    if (req.path === '/user/profile' && req.method === 'PUT') {
      const originalEnd = res.end;

      res.end = function(...args) {
        originalEnd.apply(res, args);

        logger.debug(`[ResponseFinish] ${req.method} ${req.path} completed with status ${res.statusCode}. Session ID: ${req.session?.id}`);

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

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cookie parser for CSRF protection
app.use(cookieParser(config.sessionSecret));

// Session configuration
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
    sameSite: config.nodeEnv === 'production' ? 'strict' : 'lax',
    maxAge: 1000 * 60 * 60, // 1 hour activity timeout
    domain: config.nodeEnv === 'production' ? '.permisosdigitales.com.mx' : undefined
  }
}));

// Session timeout enforcement
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'development' && req.path === '/user/profile' && req.method === 'PUT') {
    logger.debug(`[SessionTimeout] Checking session timeout for ${req.path}. Session ID: ${req.session?.id}, User ID: ${req.session?.userId}`);
  }

  if (req.session && req.session.createdAt) {
    const now = Date.now();
    const createdAt = new Date(req.session.createdAt).getTime();
    const sessionAge = now - createdAt;
    const absoluteTimeout = 1000 * 60 * 60 * 8; // 8 hours

    if (sessionAge > absoluteTimeout) {
      logger.info(`Session expired due to absolute timeout for user ID: ${req.session.userId}`);

      req.session.destroy(err => {
        if (err) {
          logger.error('Error destroying expired session:', err);
        } else {
          logger.debug(`Successfully destroyed expired session ID: ${req.session?.id}`);
        }

        if (req.accepts('html')) {
          res.redirect('/login?reason=session_expired');
        } else {
          res.status(401).json({ message: 'Session expired. Please log in again.' });
        }
      });
    } else {
      if (process.env.NODE_ENV === 'development' && req.path === '/user/profile' && req.method === 'PUT') {
        logger.debug(`[SessionTimeout] Session is valid (age: ${sessionAge}ms). Continuing to next middleware.`);
      }
      next();
    }
  } else {
    if (process.env.NODE_ENV === 'development' && req.path === '/user/profile' && req.method === 'PUT') {
      logger.debug(`[SessionTimeout] No session createdAt timestamp found. Session ID: ${req.session?.id}`);
    }
    next();
  }
});

// CSRF error handling
app.use(handleCsrfError);


// API Routes Configuration
const healthRoutes = require('./routes/health.routes');
app.use('/health', healthRoutes);

const metricsRoutes = require('./routes/metrics.routes');
app.use('/metrics', metricsRoutes);

const debugRoutes = require('./routes/debug.routes');
app.use('/debug', debugRoutes);

const { setupSwagger } = require('./utils/swagger');
setupSwagger(app);

const limiters = require('./middleware/rate-limit.middleware');
// ApiResponse utility available but not used in server setup

app.use('/', limiters.api, apiRoutes);
app.use('/auth', limiters.auth);
app.use('/admin', limiters.admin);

// Static file serving with proper MIME types
const staticOptions = {
  setHeaders: (res, path) => {
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

// ============================================
// === ADMIN INTERFACE ROUTE HANDLERS ===
// ============================================
// Admin portal - serve admin.html for all admin routes (BEFORE static files)
app.get(['/admin', '/admin/*'], (req, res) => {
  if (req.session) {
    req.session.portalType = 'admin';
  }

  logger.debug(`Admin route requested: ${req.path}`);

  // Serve admin.html for all admin routes from dist-admin directory
  res.sendFile(path.join(__dirname, '../frontend/dist-admin/admin.html'), (err) => {
    if (err) {
      logger.error(`Admin portal not found: ${err.message}`);
      res.status(404).send('Admin portal not found');
    } else {
      logger.debug(`Serving admin portal for path: ${req.path}`);
    }
  });
});

// =========================================
// === SERVE FRONTEND STATIC ASSETS/VIEWS ===
// =========================================
// Serve built frontend assets from dist directory (AFTER admin routes)
app.use('/assets', express.static(path.join(__dirname, '../frontend/dist/assets'), staticOptions));
// Serve admin assets from dist-admin directory
app.use('/admin/assets', express.static(path.join(__dirname, '../frontend/dist-admin/assets'), staticOptions));
// Serve client static files but exclude admin routes
app.use((req, res, next) => {
  if (req.path.startsWith('/admin')) {
    next(); // Skip static file serving for admin routes
  } else {
    express.static(path.join(__dirname, '../frontend/dist'), staticOptions)(req, res, next);
  }
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
    next();
    return;
  }

  // For non-API requests that accept HTML, serve the SPA shell from dist directory
  if (req.accepts('html')) {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'), (err) => {
      if (err) {
        logger.error(`Error sending index.html: ${err.message}`);
        next(err);
      } else {
        logger.debug(`Serving frontend SPA fallback for path: ${req.path}`);
      }
    });
  } else {
    next();
  }
});

// Global error handling
const errorHandler = require('./middleware/error-handler.middleware');
app.use(errorHandler);

async function startServer() {
  try {
    logger.info(`Server starting on port ${PORT} in ${config.nodeEnv} mode`);

    if (config.sessionSecret === 'default_fallback_secret_change_me' || !config.sessionSecret) {
      logger.error('FATAL ERROR: SESSION_SECRET is not set or is insecure! Please generate a strong secret in .env file. Exiting.');
      process.exit(1);
    }

    const dbOk = await testConnection();
    if (!dbOk) {
      logger.error('FATAL ERROR: Database connection failed on startup. Exiting.');
      process.exit(1);
    }
    logger.info('Database connection successful');
    logger.info('Session store initialized using: PostgreSQL');

    const server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);

      if (config.nodeEnv !== 'test') {
        initScheduledJobs();
      }
    });

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

startServer();
