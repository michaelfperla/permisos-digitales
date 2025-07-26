const { logger } = require('./logger');

const success = (res, data = null, status = 200, message = null) => {
  if (res.req && res.req.path === '/user/profile' && res.req.method === 'PUT') {
    logger.debug(`[ApiResponse.success] About to send success response for ${res.req.path}. Session ID: ${res.req.session?.id}, User ID: ${res.req.session?.userId}`);
  }

  const response = {
    success: true
  };

  if (data !== null) {
    response.data = data;
  }

  if (message) {
    response.message = message;
  }

  if (res.req && res.req.path === '/user/profile' && res.req.method === 'PUT') {
    logger.debug('[ApiResponse.success] Sending response:', { status, response });
  }

  return res.status(status).json(response);
};

const error = (res, message = 'Error Interno del Servidor', status = 500, errors = null, code = null) => {
  const response = {
    success: false,
    message
  };

  if (errors !== null) {
    response.errors = errors;
  }

  if (code !== null) {
    response.code = code;
  }

  return res.status(status).json(response);
};

const badRequest = (res, message = 'Datos incorrectos', errors = null) => {
  return error(res, message, 400, errors);
};

const unauthorized = (res, message = 'No Autorizado. Por favor, inicia sesión.') => {
  return error(res, message, 401);
};

const forbidden = (res, message = 'Acceso denegado. No tienes permiso para ver este contenido.', code = null) => {
  return error(res, message, 403, null, code);
};

const notFound = (res, message = 'No se encontró lo que buscas') => {
  return error(res, message, 404);
};

const conflict = (res, message = 'Este elemento ya existe') => {
  return error(res, message, 409);
};

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