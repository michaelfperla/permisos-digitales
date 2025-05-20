/**
 * API Documentation Configuration
 * Sets up Swagger/OpenAPI documentation
 */
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const path = require('path');
const config = require('../../config');
const { logger } = require('../enhanced-logger');

// Swagger definition
const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Permisos Digitales API',
      version: '1.0.0',
      description: 'API documentation for Permisos Digitales',
      contact: {
        name: 'API Support',
        email: 'support@permisos-digitales.mx'
      }
    },
    servers: [
      {
        url: '/api',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        sessionAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'permisos.sid'
        },
        csrfToken: {
          type: 'apiKey',
          in: 'header',
          name: 'X-CSRF-Token'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            message: {
              type: 'string',
              example: 'Error message'
            },
            requestId: {
              type: 'string',
              example: '1234567890abcdef'
            }
          }
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1
            },
            email: {
              type: 'string',
              example: 'user@example.com'
            },
            firstName: {
              type: 'string',
              example: 'John'
            },
            lastName: {
              type: 'string',
              example: 'Doe'
            },
            accountType: {
              type: 'string',
              example: 'client'
            }
          }
        },
        Application: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1
            },
            userId: {
              type: 'integer',
              example: 1
            },
            status: {
              type: 'string',
              example: 'PENDING_PAYMENT'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        }
      }
    }
  },
  apis: [
    path.join(__dirname, '../../routes/*.js'),
    path.join(__dirname, '../../controllers/*.js'),
    path.join(__dirname, './definitions/*.yaml')
  ]
};

// Initialize swagger-jsdoc
const specs = swaggerJsdoc(options);

/**
 * Set up Swagger UI
 * @param {Object} app - Express app
 */
function setupSwagger(app) {
  // Serve Swagger UI only in development and staging environments
  if (config.nodeEnv !== 'production') {
    logger.info('Setting up Swagger UI at /api-docs');
    
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
      explorer: true,
      customCss: '.swagger-ui .topbar { display: none }',
      swaggerOptions: {
        persistAuthorization: true
      }
    }));
  }
}

module.exports = {
  specs,
  setupSwagger
};
