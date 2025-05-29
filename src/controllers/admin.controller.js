// src/controllers/admin.controller.js
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { logger } = require('../utils/enhanced-logger');
const puppeteerService = require('../services/puppeteer.service');
const { ApplicationStatus } = require('../constants');
const ApiResponse = require('../utils/api-response');
const applicationRepository = require('../repositories/application.repository');

// Temporary replacement function for getPaymentProof
exports.getPaymentProof = async (req, res, next) => {
  const applicationId = parseInt(req.params.id, 10);
  const adminId = req.session.userId;

  logger.info(`Admin ${adminId} requested payment proof for application ${applicationId}, but functionality is disabled`);

  return ApiResponse.error(res, 'El sistema de pagos está siendo actualizado para usar un proveedor de pagos externo. Esta funcionalidad ya no está disponible.', 410);
};

// Temporary replacement function for rejectPayment
exports.rejectPayment = async (req, res, next) => {
  const adminId = req.session.userId;
  const applicationId = parseInt(req.params.id, 10);

  logger.info(`Admin ${adminId} attempted to reject payment for application ${applicationId}, but functionality is disabled`);

  return ApiResponse.error(res, 'El sistema de pagos está siendo actualizado para usar un proveedor de pagos externo. Esta funcionalidad ya no está disponible.', 410);
};

// Temporary replacement function for servePaymentProofFile
exports.servePaymentProofFile = async (req, res, next) => {
  const applicationId = parseInt(req.params.id, 10);
  const adminId = req.session.userId;

  logger.info(`Admin ${adminId} requested payment proof file for application ${applicationId}, but functionality is disabled`);

  return ApiResponse.error(res, 'El sistema de pagos está siendo actualizado para usar un proveedor de pagos externo. Esta funcionalidad ya no está disponible.', 410);
};



// Temporary replacement function for getPaymentProofDetails
exports.getPaymentProofDetails = async (req, res) => {
  const applicationId = parseInt(req.params.id, 10);
  const adminId = req.session.userId;

  logger.info(`Admin ${adminId} requested payment proof details for application ${applicationId}, but functionality is disabled`);

  return ApiResponse.error(res, 'El sistema de pagos está siendo actualizado para usar un proveedor de pagos externo. Esta funcionalidad ya no está disponible.', 410);
};



/**
 * Get dashboard statistics
 */
exports.getDashboardStats = async (req, res) => {
  try {
    const adminId = req.session.userId;
    logger.info(`Admin ${adminId} requested dashboard stats`);

    const stats = await applicationRepository.getDashboardStats();

    return ApiResponse.success(res, stats);
  } catch (error) {
    logger.error('Error getting dashboard stats:', error);
    return ApiResponse.error(res, 'Error al obtener estadísticas del dashboard', 500);
  }
};

/**
 * Get all applications with filtering and pagination
 */
exports.getAllApplications = async (req, res) => {
  try {
    const adminId = req.session.userId;
    const { page = 1, limit = 10, status, startDate, endDate, search } = req.query;

    logger.info(`Admin ${adminId} requested applications list`, { page, limit, status, startDate, endDate, search });

    const filters = {};
    if (status) filters.status = status;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    if (search) filters.searchTerm = search;

    const pagination = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10)
    };

    const result = await applicationRepository.findApplicationsWithPagination(filters, pagination);

    return ApiResponse.success(res, result);
  } catch (error) {
    logger.error('Error getting applications:', error);
    return ApiResponse.error(res, 'Error al obtener solicitudes', 500);
  }
};

/**
 * Get application details by ID
 */
exports.getApplicationDetails = async (req, res) => {
  try {
    const adminId = req.session.userId;
    const applicationId = parseInt(req.params.id, 10);

    if (isNaN(applicationId)) {
      return ApiResponse.badRequest(res, 'ID de solicitud inválido');
    }

    logger.info(`Admin ${adminId} requested application details for ID: ${applicationId}`);

    const application = await applicationRepository.findById(applicationId);

    if (!application) {
      return ApiResponse.notFound(res, 'Solicitud no encontrada');
    }

    return ApiResponse.success(res, application);
  } catch (error) {
    logger.error(`Error getting application details for ID ${req.params.id}:`, error);
    return ApiResponse.error(res, 'Error al obtener detalles de la solicitud', 500);
  }
};
