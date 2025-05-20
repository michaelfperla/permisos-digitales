/**
 * API Response Helper Functions
 *
 * Provides consistent formatting for API responses
 */

/**
 * Send a success response
 *
 * @param {Object} res - Express response object
 * @param {*} data - Data to send in response
 * @param {number} status - HTTP status code (default: 200)
 * @param {string} message - Optional success message
 */
const success = (res, data = null, status = 200, message = null) => {
  // Log for debugging session issues
  if (res.req && res.req.path === '/api/user/profile' && res.req.method === 'PUT') {
    console.log(`[ApiResponse.success] About to send success response for ${res.req.path}. Session ID: ${res.req.session?.id}, User ID: ${res.req.session?.userId}`);
  }

  const response = {
    success: true
  };

  // Include provided data if any
  if (data !== null) {
    response.data = data;
  }

  // Include message if provided
  if (message) {
    response.message = message;
  }

  // Log the response being sent
  if (res.req && res.req.path === '/api/user/profile' && res.req.method === 'PUT') {
    console.log('[ApiResponse.success] Sending response:', { status, response });
  }

  return res.status(status).json(response);
};

/**
 * Send an error response
 *
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {number} status - HTTP status code (default: 500)
 * @param {*} errors - Optional detailed errors
 */
const error = (res, message = 'Error Interno del Servidor', status = 500, errors = null) => {
  const response = {
    success: false,
    message
  };

  // Include detailed errors if provided
  if (errors !== null) {
    response.errors = errors;
  }

  return res.status(status).json(response);
};

/**
 * Send a 400 Bad Request response
 *
 * @param {Object} res - Express response object
 * @param {string} message - Error message (default: 'Bad Request')
 * @param {*} errors - Optional detailed errors
 */
const badRequest = (res, message = 'Datos incorrectos', errors = null) => {
  return error(res, message, 400, errors);
};

/**
 * Send a 401 Unauthorized response
 *
 * @param {Object} res - Express response object
 * @param {string} message - Error message (default: 'Unauthorized')
 */
const unauthorized = (res, message = 'No Autorizado. Por favor, inicia sesión.') => {
  return error(res, message, 401);
};

/**
 * Send a 403 Forbidden response
 *
 * @param {Object} res - Express response object
 * @param {string} message - Error message (default: 'Forbidden')
 */
const forbidden = (res, message = 'Acceso denegado. No tienes permiso para ver este contenido.') => {
  return error(res, message, 403);
};

/**
 * Send a 404 Not Found response
 *
 * @param {Object} res - Express response object
 * @param {string} message - Error message (default: 'Resource not found')
 */
const notFound = (res, message = 'No se encontró lo que buscas') => {
  return error(res, message, 404);
};

/**
 * Send a 409 Conflict response
 *
 * @param {Object} res - Express response object
 * @param {string} message - Error message (default: 'Resource already exists')
 */
const conflict = (res, message = 'Este elemento ya existe') => {
  return error(res, message, 409);
};

/**
 * Send a 429 Too Many Requests response
 *
 * @param {Object} res - Express response object
 * @param {string} message - Error message (default: 'Too many requests')
 */
const tooManyRequests = (res, message = 'Demasiadas solicitudes. Por favor, inténtalo de nuevo más tarde.') => {
  return error(res, message, 429);
};

module.exports = {
  success,
  error,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  tooManyRequests
};