/**
 * Browser-Sync Configuration
 * This file configures the browser-sync development server
 */

module.exports = {
  port: 3000,
  ui: {
    port: 3002
  },
  files: [
    'frontend/**/*.html',
    'frontend/src/**/*.css',
    'frontend/src/**/*.js'
  ],
  server: {
    baseDir: 'frontend',
    serveStaticOptions: {
      setHeaders: function(res, path) {
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
    }
  },
  middleware: function(req, res, next) {
    // Add CORS headers for API proxying during development
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Authorization');

    // Set proper MIME type for JavaScript files
    if (req.url.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    }
    if (req.url.endsWith('.mjs')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    }
    if (req.url.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
    }

    next();
  },
  ghostMode: false, // Disable syncing of browser actions
  open: false, // Don't automatically open browser
  notify: false, // Disable notifications
  reloadDelay: 500 // Add a small delay to avoid issues with fast file changes
};