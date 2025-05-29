const promClient = require('prom-client');
const { logger } = require('./enhanced-logger');

const register = new promClient.Registry();

register.setDefaultLabels({
  app: 'permisos-digitales'
});

promClient.collectDefaultMetrics({ register });

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

register.registerMetric(httpRequestDurationMicroseconds);
register.registerMetric(httpRequestCounter);
register.registerMetric(databaseQueryDurationMicroseconds);

const metricsMiddleware = (req, res, next) => {
  const start = Date.now();

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
