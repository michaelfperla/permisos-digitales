/**
 * Metrics Collection Module
 * Collects and exposes application metrics in Prometheus format
 */
const promClient = require('prom-client');
const { logger } = require('./enhanced-logger');

// Create a Registry to register metrics
const register = new promClient.Registry();

// Add default labels to all metrics
register.setDefaultLabels({
  app: 'permisos-digitales'
});

// Enable collection of default metrics
promClient.collectDefaultMetrics({ register });

// Define custom metrics
const httpRequestDurationMicroseconds = new promClient.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000]
});

const httpRequestCounter = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const databaseQueryDurationMicroseconds = new promClient.Histogram({
  name: 'database_query_duration_ms',
  help: 'Duration of database queries in ms',
  labelNames: ['query_type', 'table'],
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000]
});

// Register the custom metrics
register.registerMetric(httpRequestDurationMicroseconds);
register.registerMetric(httpRequestCounter);
register.registerMetric(databaseQueryDurationMicroseconds);

// Middleware to measure HTTP request duration
const metricsMiddleware = (req, res, next) => {
  const start = Date.now();
  
  // Record end time and increment counter on response finish
  res.on('finish', () => {
    const duration = Date.now() - start;
    const route = req.route ? req.route.path : req.path;
    const method = req.method;
    const statusCode = res.statusCode;
    
    httpRequestDurationMicroseconds
      .labels(method, route, statusCode)
      .observe(duration);
    
    httpRequestCounter
      .labels(method, route, statusCode)
      .inc();
  });
  
  next();
};

// Function to measure database query duration
const measureDatabaseQuery = async (queryType, table, queryFn) => {
  const start = Date.now();
  try {
    return await queryFn();
  } finally {
    const duration = Date.now() - start;
    databaseQueryDurationMicroseconds
      .labels(queryType, table)
      .observe(duration);
  }
};

// Metrics endpoint handler
const metricsEndpoint = async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    logger.error('Error generating metrics:', error);
    res.status(500).end();
  }
};

module.exports = {
  register,
  metricsMiddleware,
  measureDatabaseQuery,
  metricsEndpoint
};
