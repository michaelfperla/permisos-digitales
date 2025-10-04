const path = require('path');
const puppeteerService = require('../services/permit-generation-orchestrator.service');
const stripePaymentService = require('../services/stripe-payment.service');
const pdfService = require('../services/pdf-service');
const storageService = require('../services/storage/storage-service');
const { logger } = require('../utils/logger');
const { handleControllerError, createError } = require('../utils/error-helpers');
const { validateApplicationId, validateYear } = require('../utils/validation-helpers');
const { ApplicationStatus, DEFAULT_PERMIT_FEE } = require('../constants');
const { applicationRepository, paymentRepository, userRepository } = require('../repositories');
const db = require('../db');
const { withTransaction } = require('../utils/db-transaction');
const metricsCollector = require('../monitoring/metrics-collector');

/**
 * Check if a permit has expired (30 days from generation)
 * @param {Object} application - Application object with fecha_expedicion or fecha_vencimiento
 * @returns {Object} - Expiration check result
 */
function checkPermitExpiration(application) {
  const now = new Date();
  let expirationDate = null;
  let generationDate = null;

  // Use fecha_vencimiento if available, otherwise calculate from fecha_expedicion
  if (application.fecha_vencimiento) {
    expirationDate = new Date(application.fecha_vencimiento);
    // Calculate generation date (30 days before expiration)
    generationDate = new Date(expirationDate);
    generationDate.setDate(generationDate.getDate() - 30);
  } else if (application.fecha_expedicion) {
    generationDate = new Date(application.fecha_expedicion);
    expirationDate = new Date(generationDate);
    expirationDate.setDate(generationDate.getDate() + 30);
  } else {
    // Fallback: assume permit was generated when application was created
    generationDate = new Date(application.created_at);
    expirationDate = new Date(generationDate);
    expirationDate.setDate(generationDate.getDate() + 30);
  }

  const isExpired = now > expirationDate;
  const daysExpired = isExpired ? Math.ceil((now - expirationDate) / (1000 * 60 * 60 * 24)) : 0;

  return {
    isExpired,
    expirationDate: expirationDate.toISOString().split('T')[0],
    expiredDate: isExpired ? expirationDate.toISOString().split('T')[0] : null,
    daysExpired,
    message: isExpired ? `Permit expired ${daysExpired} days ago` : 'Permit is still valid'
  };
}

exports.createApplication = async (req, res, next) => {
  const userId = req.session.userId;
  const {
    nombre_completo,
    curp_rfc,
    domicilio,
    marca,
    linea,
    color,
    numero_serie,
    numero_motor,
    ano_modelo,
    email
  } = req.body;

  try {
    logger.info(`[createApplication] Starting preliminary application for user ID: ${userId}`);

    // Get user's account email as fallback
    const user = await userRepository.findById(userId);
    if (!user) {
      logger.error(`[createApplication] User ${userId} not found`);
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado.',
        error: 'USER_NOT_FOUND'
      });
    }

    const validatedData = {
      nombre_completo: String(nombre_completo || '').trim(),
      curp_rfc: String(curp_rfc || '').trim(),
      domicilio: String(domicilio || '').trim(),
      marca: String(marca || '').trim(),
      linea: String(linea || '').trim(),
      color: String(color || '').trim(),
      numero_serie: String(numero_serie || '').trim().toUpperCase(),
      numero_motor: String(numero_motor || '').trim(),
      ano_modelo: (() => {
        const yearValidation = validateYear(ano_modelo);
        return yearValidation.isValid ? yearValidation.value : new Date().getFullYear();
      })(),
      // Use provided email or fallback to user's account email (no fake emails)
      email: email?.trim() || user.account_email || null
    };

    // Log which email we're using for transparency
    if (email?.trim()) {
      logger.info(`[createApplication] Using provided delivery email: ${validatedData.email}`);
    } else if (user.account_email) {
      logger.info(`[createApplication] Using user's account email: ${validatedData.email}`);
    } else {
      logger.info(`[createApplication] No email provided - will use phone for customer identification`);
    }

    const customer = await stripePaymentService.createCustomer({
      name: validatedData.nombre_completo,
      email: validatedData.email,
      phone: user.whatsapp_phone || user.phone || ''
    });
    logger.info(`[createApplication] Created Stripe Customer ID: ${customer.id} for user ${userId}`);

    const applicationData = {
      user_id: userId,
      nombre_completo: validatedData.nombre_completo,
      curp_rfc: validatedData.curp_rfc,
      domicilio: validatedData.domicilio,
      marca: validatedData.marca,
      linea: validatedData.linea,
      color: validatedData.color,
      numero_serie: validatedData.numero_serie,
      numero_motor: validatedData.numero_motor,
      ano_modelo: validatedData.ano_modelo,
      status: ApplicationStatus.AWAITING_PAYMENT,
      importe: DEFAULT_PERMIT_FEE,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
      // Only set delivery_email if it's not a placeholder
      delivery_email: (email?.trim() || user.account_email) ? validatedData.email : null
    };

    const newApplication = await applicationRepository.create(applicationData);
    logger.info(`[createApplication] Created preliminary application record with ID: ${newApplication.id}`);

    return res.status(201).json({
      success: true,
      message: 'Solicitud preliminar creada exitosamente.',
      application: {
        id: newApplication.id,
        status: newApplication.status,
      },
      customerId: customer.id,
    });

  } catch (error) {
    handleControllerError(error, 'createApplication', req, res, next, {
        errorMappings: {
          '23505': {
            status: 409,
            message: 'Error en la solicitud: Ya existe un vehículo con esta información.'
          }
        }
      });
  }
};

exports.getUserApplications = async (req, res, next) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ message: 'Usuario no autenticado.' });

  try {
    logger.debug(`Fetching applications for user ID: ${userId}`);

    const applications = await applicationRepository.findByUserId(userId);
    const expiringPermits = await applicationRepository.findExpiringPermits(userId);

    res.status(200).json({
      success: true,
      applications: applications,
      expiringPermits: expiringPermits
    });
  } catch (error) {
    handleControllerError(error, 'getUserApplications', req, res, next);
  }
};

exports.getPendingApplications = async (req, res, next) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ message: 'Usuario no autenticado.' });

  try {
    logger.debug(`Fetching pending applications for user ID: ${userId}`);

    const pendingApplications = await applicationRepository.findPendingPaymentByUserId(userId);

    res.status(200).json({
      success: true,
      applications: pendingApplications
    });
  } catch (error) {
    handleControllerError(error, 'getPendingApplications', req, res, next);
  }
};

exports.getApplicationStatus = async (req, res, next) => {
  const userId = req.session.userId;
  const idValidation = validateApplicationId(req.params.id);

  if (!idValidation.isValid) {
    return res.status(400).json({ 
      message: 'Formato de ID de solicitud inválido',
      error: idValidation.error
    });
  }

  const applicationId = idValidation.value;

  try {
    logger.debug(`Fetching status for application ID: ${applicationId}, user: ${userId}`);

    // Get application with OXXO payment details from payment_events
    const application = await applicationRepository.findApplicationWithOxxoDetails(applicationId);

    if (!application) {
      logger.warn(`Application ${applicationId} not found`);
      return res.status(404).json({ message: 'Application not found' });
    }

    if (application.user_id !== userId) {
      logger.warn(`User ${userId} attempted to access application ${applicationId} owned by user ${application.user_id}`);
      return res.status(403).json({ message: 'You do not have permission to access this application' });
    }

    if (!application.status || application.status === 'undefined') {
      logger.error(`Application ${applicationId} has invalid status: ${application.status}`);
      return res.status(500).json({ 
        message: 'Error: La aplicación tiene un estado inválido. Por favor contacte soporte.',
        error: 'INVALID_APPLICATION_STATUS' 
      });
    }

    let statusInfo = {
      currentStatus: application.status,
      lastUpdated: application.updated_at,
      displayMessage: '',
      nextSteps: '',
      allowedActions: []
    };

    switch (application.status) {
    case ApplicationStatus.PAYMENT_PROCESSING:
      statusInfo.displayMessage = 'Su pago está siendo procesado';
      statusInfo.nextSteps = 'El pago está siendo procesado por el banco. Esto puede tomar unos minutos. La página se actualizará automáticamente cuando el pago sea confirmado.';
      statusInfo.allowedActions = [];
      break;
    case ApplicationStatus.AWAITING_OXXO_PAYMENT:
      statusInfo.displayMessage = 'Su solicitud está esperando pago en OXXO';
      statusInfo.nextSteps = 'Por favor realice el pago en OXXO con la referencia proporcionada. Una vez procesado, su permiso será generado automáticamente.';
      statusInfo.allowedActions = ['viewOxxoDetails'];
      break;
    case 'PROOF_SUBMITTED':
    case 'PROOF_REJECTED':
      statusInfo.displayMessage = 'Su solicitud está siendo procesada';
      statusInfo.nextSteps = 'Por favor contacte a soporte para más información.';
      statusInfo.allowedActions = [];
      break;
    case 'PAYMENT_RECEIVED':
    case 'GENERATING_PERMIT':
      statusInfo.displayMessage = 'Su pago ha sido verificado';
      statusInfo.nextSteps = 'Su permiso está siendo generado. Esto puede tomar unos minutos.';
      statusInfo.allowedActions = [];
      break;
    case 'PERMIT_READY':
      if (application.is_sample_permit) {
        statusInfo.displayMessage = '¡Su permiso de muestra está listo!';
        statusInfo.nextSteps = 'Ahora puede descargar los documentos de muestra. Nota: Estos son documentos DE MUESTRA solo para fines de prueba.';
        statusInfo.allowedActions = ['downloadPermit', 'downloadReceipt', 'downloadCertificate'];
      } else {
        statusInfo.displayMessage = '¡Su permiso está listo!';
        statusInfo.nextSteps = 'Ahora puede descargar sus documentos de permiso.';
        statusInfo.allowedActions = ['downloadPermit', 'downloadReceipt', 'downloadCertificate', 'renewPermit'];
      }
      break;
    case 'VENCIDO':
      statusInfo.displayMessage = 'Su permiso ha vencido';
      statusInfo.nextSteps = 'Su permiso ha excedido el período de validez de 30 días. Puede solicitar una renovación para obtener un nuevo permiso.';
      statusInfo.allowedActions = ['renewPermit'];
      break;
    default:
      statusInfo.displayMessage = `Estado de la solicitud: ${application.status}`;
      statusInfo.nextSteps = 'Por favor contacte a soporte para más información.';
      statusInfo.allowedActions = [];
    }

    const responsePayload = {
      application: {
        id: application.id,
        vehicleInfo: {
          marca: application.marca || 'No especificado',
          linea: application.linea || 'No especificado',
          ano_modelo: application.ano_modelo || 'No especificado',
          color: application.color || 'No especificado',
          numero_serie: application.numero_serie || 'No especificado',
          numero_motor: application.numero_motor || 'No especificado'
        },
        ownerInfo: {
          nombre_completo: application.nombre_completo || 'No especificado',
          curp_rfc: application.curp_rfc || 'No especificado',
          domicilio: application.domicilio || 'No especificado'
        },
        dates: {
          created: application.created_at,
          updated: application.updated_at,
          fecha_expedicion: application.fecha_expedicion || null,
          fecha_vencimiento: application.fecha_vencimiento || null
        },
        paymentReference: application.payment_reference,        is_sample_permit: application.is_sample_permit === true,
        importe: application.importe || 500, // Default to 500 MXN if not set
        folio: application.folio || null,
        permit_file_path: application.permit_file_path || null,
        certificado_file_path: application.certificado_file_path || null,
        placas_file_path: application.placas_file_path || null,
        recomendaciones_file_path: application.recomendaciones_file_path || null,
        // Queue information
        queue_status: application.queue_status || null,
        queue_position: application.queue_position || null,
        queue_entered_at: application.queue_entered_at || null,
        queue_started_at: application.queue_started_at || null,
        queue_completed_at: application.queue_completed_at || null,
        queue_duration_ms: application.queue_duration_ms || null
      },
      status: statusInfo,
      oxxoReference: application.oxxo_reference || null,
      hostedVoucherUrl: application.hosted_voucher_url || null,
      expiresAt: application.oxxo_expires_at || null,
    };

    res.json(responsePayload);

  } catch (error) {
    handleControllerError(error, 'getApplicationStatus', req, res, next);
  }
};

exports.submitPaymentProof = async (req, res, next) => {
  const userId = req.session.userId;
  const applicationId = parseInt(req.params.id, 10);

  logger.info(`Manual payment proof upload attempted for application ${applicationId} by user ${userId}, but functionality is disabled`);

  res.status(410).json({
    success: false,
    message: 'El sistema de pagos está siendo actualizado para usar un proveedor de pagos externo. Esta funcionalidad ya no está disponible.'
  });
};

exports.downloadPermit = async (req, res, next) => {
  const userId = req.session.userId;
  const applicationId = parseInt(req.params.id, 10);
  const requestedType = req.params.type ? req.params.type.toLowerCase() : 'unknown';

  logger.info(`Download request for AppID: ${applicationId}, Type: ${requestedType}`);

  if (isNaN(applicationId) || !userId) {
    return res.status(400).json({ message: 'Solicitud inválida.' });
  }

  const typeMapping = {
    'permiso': 'permit_file_path',
    'certificado': 'certificado_file_path',
    'placas': 'placas_file_path',
    'recomendaciones': 'recomendaciones_file_path'
  };
  const dbColumn = typeMapping[requestedType];

  if (!dbColumn) {
    return res.status(400).json({ message: `Tipo de documento inválido: ${requestedType}` });
  }

  try {
    const app = await applicationRepository.findApplicationForDownload(applicationId);

    if (!app || app.user_id !== userId) {
      return res.status(404).json({ message: 'Solicitud no encontrada o no autorizada.' });
    }

    if (app.status !== 'PERMIT_READY') {
      return res.status(400).json({ message: `Permiso no está listo (Estado: ${app.status}).` });
    }

    // UPDATED: Allow downloads during the entire 30-day validity period
    const permitExpirationCheck = checkPermitExpiration(app);
    if (permitExpirationCheck.isExpired) {
      logger.info(`PDF download allowed for expired permit - App ${applicationId}, Type ${requestedType}: ${permitExpirationCheck.message}`);
      // NOTE: We now allow downloads even after expiration during the 30-day window
    }

    let filePathFromDB = app[dbColumn];

    if (requestedType === 'recomendaciones' && !filePathFromDB) {
      logger.info(`Recommendations PDF missing for App ${applicationId}, generating on-demand.`);
      try {
        const recommendationsPdfService = require('../services/recommendations-pdf.service');
        const userName = app.nombre_completo || 'Usuario';
        const recommendationsPdfBuffer = await recommendationsPdfService.generateRecommendationsPdf({
          userName: userName,
          permitId: app.folio || applicationId.toString()
        });
        const saveOptions = {
          originalName: `recomendaciones_${app.folio || applicationId}_${Date.now()}.pdf`,
          subDirectory: `permits/${applicationId}`,
          prefix: 'recomendaciones',
          contentType: 'application/pdf'
        };
        const result = await storageService.saveFile(recommendationsPdfBuffer, saveOptions);
        filePathFromDB = result.key; 
        await applicationRepository.updateFilePathOnly(applicationId, 'recomendaciones_file_path', filePathFromDB);
        logger.info(`Generated recommendations PDF on-demand: ${filePathFromDB}`);
      } catch (onDemandError) {
        logger.error(`Failed to generate recommendations PDF on-demand for App ${applicationId}:`, onDemandError);
        return res.status(500).json({ message: 'Error generando el documento de recomendaciones.' });
      }
    }

    if (!filePathFromDB) {
      return res.status(404).json({ message: `Documento de tipo '${requestedType}' no encontrado.` });
    }

    const secureUrl = await storageService.getFileUrl(filePathFromDB, { 
      expiresIn: 3600
      // Remove responseContentDisposition: false to use default attachment behavior
    }); 

    logger.info(`Returning secure URL for AppID ${applicationId}, Type: ${requestedType}`);
    
    // Return JSON response with URL instead of redirecting
    res.status(200).json({
      success: true,
      url: secureUrl,
      documentType: requestedType,
      message: 'URL generada exitosamente'
    });

  } catch (error) {
    logger.error(`Error during download processing for App ${applicationId}:`, error);
    next(error);
  }
};

exports.getPdfUrl = async (req, res, next) => {
  const userId = req.session.userId;
  const applicationId = parseInt(req.params.id, 10);
  const requestedTypeParam = req.params.type;

  let requestedType = requestedTypeParam ? requestedTypeParam.toLowerCase() : 'unknown';

  if (isNaN(applicationId) || applicationId <= 0) {
    logger.warn(`PDF URL request failed: Invalid Application ID format ${req.params.id}`);
    return res.status(400).json({ message: 'Formato de ID de solicitud inválido.' });
  }
  if (!userId) {
    logger.warn(`PDF URL request failed: User not authenticated for AppID ${applicationId}`);
    return res.status(401).json({ message: 'No autorizado.' });
  }

  try {
    const typeMapping = {
      'permiso': { dbColumn: 'permit_file_path', displayName: 'Permiso' },
      'certificado': { dbColumn: 'certificado_file_path', displayName: 'Certificado' },
      'placas': { dbColumn: 'placas_file_path', displayName: 'Placas' },
      'recomendaciones': { dbColumn: 'recomendaciones_file_path', displayName: 'Recomendaciones' }
    };

    if (!typeMapping[requestedType]) {
      logger.warn(`PDF URL request failed: Invalid document type '${requestedTypeParam}' for App ${applicationId}`);
      return res.status(400).json({ message: `Tipo de documento inválido: ${requestedTypeParam}` });
    }

    const { dbColumn, displayName } = typeMapping[requestedType];

    const app = await applicationRepository.findApplicationWithFields(applicationId, ['id', 'user_id', 'status', dbColumn, 'fecha_expedicion', 'fecha_vencimiento', 'created_at']);

    if (!app) {
      logger.warn(`PDF URL request failed: Application ${applicationId} not found`);
      return res.status(404).json({ message: 'Solicitud no encontrada.' });
    }

    if (app.user_id !== userId) {
      logger.warn(`PDF URL request failed: User ${userId} does not own Application ${applicationId}`);
      return res.status(403).json({ message: 'Acceso denegado. Esta solicitud no te pertenece.' });
    }

    let filePathFromDB = app[dbColumn];

    // Check permit status first
    if (app.status !== 'PERMIT_READY') {
      logger.warn(`PDF URL request failed for App ${applicationId}, Type ${requestedType}: Status=${app.status}`);
      return res.status(400).json({ 
        message: `Permiso no está listo (Estado: ${app.status}).`
      });
    }

    // --- START: ON-DEMAND GENERATION FIX ---
    // Handle recommendations PDF on-demand generation BEFORE checking file path
    if (requestedType === 'recomendaciones' && !filePathFromDB) {
      logger.info(`Recommendations PDF missing for App ${applicationId}, generating on-demand for URL request.`);
      try {
        const recommendationsPdfService = require('../services/recommendations-pdf.service');
        const userName = app.nombre_completo || 'Usuario';
        const recommendationsPdfBuffer = await recommendationsPdfService.generateRecommendationsPdf({
          userName: userName,
          permitId: app.folio || applicationId.toString()
        });
        const saveOptions = {
          originalName: `recomendaciones_${app.folio || applicationId}_${Date.now()}.pdf`,
          subDirectory: `permits/${applicationId}`,
          prefix: 'recomendaciones',
          contentType: 'application/pdf'
        };
        const result = await storageService.saveFile(recommendationsPdfBuffer, saveOptions);
        filePathFromDB = result.key; // Use the new key for the next step
        await applicationRepository.updateFilePathOnly(applicationId, 'recomendaciones_file_path', filePathFromDB);
        logger.info(`Generated recommendations PDF on-demand for URL request: ${filePathFromDB}`);
      } catch (onDemandError) {
        logger.error(`Failed to generate recommendations PDF on-demand for App ${applicationId}:`, onDemandError);
        return res.status(500).json({ message: 'Error generando el documento de recomendaciones.' });
      }
    }
    // --- END: ON-DEMAND GENERATION FIX ---

    // Check if we have a file path after potential on-demand generation
    if (!filePathFromDB) {
      logger.warn(`PDF URL request failed for App ${applicationId}, Type ${requestedType}: No file path found`);
      return res.status(404).json({ 
        message: `Documento de tipo '${requestedType}' no encontrado para esta solicitud.`
      });
    }

    // Check if permit has expired (30 days from generation)
    // UPDATED: Allow downloads during the entire 30-day validity period
    const permitExpirationCheck = checkPermitExpiration(app);
    if (permitExpirationCheck.isExpired) {
      logger.info(`PDF download allowed for expired permit - App ${applicationId}, Type ${requestedType}: ${permitExpirationCheck.message}`);
      // NOTE: We now allow downloads even after expiration during the 30-day window
      // This was changed per business requirements to allow access throughout the permit validity period
    }

    try {
      const urlOptions = {
        expiresIn: 3600
      };

      const secureUrl = await storageService.getFileUrl(filePathFromDB, urlOptions);

      logger.info(`Generated secure URL for ${requestedType} PDF: ${filePathFromDB}`, {
        applicationId,
        userId,
        documentType: requestedType,
        storageType: storageService.provider.constructor.name
      });

      res.status(200).json({
        success: true,
        url: secureUrl,
        documentType: requestedType,
        displayName: displayName,
        expiresIn: urlOptions.expiresIn,
        message: `URL segura generada para ${displayName}`
      });

    } catch (urlError) {
      logger.error(`Error generating secure URL for ${requestedType} PDF: ${urlError.message}`, {
        applicationId,
        filePathFromDB,
        error: urlError.message
      });
      return res.status(500).json({
        message: `Error generando URL segura para ${displayName}. Por favor intente de nuevo más tarde.`
      });
    }

  } catch (error) {
    logger.error(`Error during ${requestedType} PDF URL processing for App ${applicationId}:`, error);
    next(error);
  }
};

exports.updateApplication = async (req, res, next) => {
  const userId = req.session.userId;
  const applicationId = parseInt(req.params.id, 10);

  if (isNaN(applicationId)) {
    return res.status(400).json({ message: 'Formato de ID de solicitud inválido' });
  }

  try {
    const app = await applicationRepository.findApplicationWithFields(applicationId, ['status', 'user_id']);

    if (!app || app.user_id !== userId) {
      return res.status(404).json({
        message: 'Solicitud no encontrada o no pertenece al usuario actual'
      });
    }

    const currentStatus = app.status;
    if (currentStatus !== ApplicationStatus.PAYMENT_PROCESSING) {
      return res.status(400).json({
        message: `No se puede actualizar la solicitud en estado ${currentStatus}. Solo las solicitudes en espera de pago pueden ser modificadas.`,
        currentStatus
      });
    }

    const {
      nombre_completo,
      curp_rfc,
      domicilio,
      marca,
      linea,
      color,
      numero_serie,
      numero_motor,
      ano_modelo
    } = req.body;

    const updateData = {};

    if (nombre_completo) updateData.nombre_completo = nombre_completo;
    if (curp_rfc) updateData.curp_rfc = curp_rfc;
    if (domicilio) updateData.domicilio = domicilio;
    if (marca) updateData.marca = marca;
    if (linea) updateData.linea = linea;
    if (color) updateData.color = color;
    if (numero_serie) updateData.numero_serie = numero_serie;
    if (numero_motor) updateData.numero_motor = numero_motor;
    if (ano_modelo) updateData.ano_modelo = ano_modelo;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        message: 'No se proporcionaron campos válidos para actualizar'
      });
    }

    await applicationRepository.updateApplication(applicationId, updateData);

    // Get the updated application to return it
    const updatedApp = await applicationRepository.findApplicationWithFields(applicationId, [
      'id', 'status', 'marca', 'linea', 'color', 'ano_modelo', 'nombre_completo', 'updated_at'
    ]);

    if (!updatedApp) {
      throw new Error('Error al actualizar la solicitud');
    }

    logger.info(`Application ${applicationId} updated successfully by user ${userId}`);

    res.status(200).json({
      message: 'Solicitud actualizada exitosamente',
      application: updatedApp
    });

  } catch (error) {
    logger.error(`Error updating application ${applicationId}:`, error);
    next(error);
  }
};

exports.renewApplication = async (req, res, next) => {
  const userId = req.session.userId;
  const originalApplicationId = parseInt(req.params.id, 10);
  const { createRenewalError, withRetry, getUserFriendlyMessage } = require('../utils/renewal-errors');
  const { PaymentFees } = require('../constants/payment.constants');

  if (isNaN(originalApplicationId)) {
    return res.status(400).json({ 
      success: false,
      message: 'Formato de ID de solicitud inválido.',
      code: 'INVALID_APPLICATION_ID'
    });
  }

  try {
    logger.info(`Processing renewal for application ID: ${originalApplicationId} by user ${userId}`);

    // Wrap the entire renewal process with retry logic for transient failures
    const renewalResult = await withRetry(async () => {
      try {
        const originalApp = await applicationRepository.findById(originalApplicationId);

        if (!originalApp || originalApp.user_id !== userId) {
          throw createRenewalError('eligibility_check', new Error('Application not found or unauthorized'));
        }

        if (originalApp.status !== 'PERMIT_READY' && originalApp.status !== 'ACTIVE') {
          throw createRenewalError('eligibility_check', new Error('invalid_status'));
        }

        const renewalCount = (originalApp.renewal_count || 0) + 1;
        
        const renewalData = {
          user_id: userId,
          nombre_completo: originalApp.nombre_completo,
          curp_rfc: originalApp.curp_rfc,
          domicilio: originalApp.domicilio,
          marca: originalApp.marca,
          linea: originalApp.linea,
          color: originalApp.color,
          numero_serie: originalApp.numero_serie,
          numero_motor: originalApp.numero_motor,
          ano_modelo: originalApp.ano_modelo,
          renewed_from_id: originalApplicationId,
          renewal_count: renewalCount,
          status: ApplicationStatus.AWAITING_PAYMENT
        };

        // Get user data first (outside transaction)
        const user = await userRepository.findById(userId);
        if (!user) {
          throw createRenewalError('database_connection', new Error('User not found'));
        }

        // Execute renewal creation and payment setup in transaction
        const stripePaymentLinkService = require('../services/whatsapp/stripe-payment-link.service');
        
        return await withTransaction(async (client) => {
          try {
            // Create renewal application within transaction
            const newApplication = await applicationRepository.createRenewalApplication(renewalData, client);
            
            if (!newApplication) {
              throw new Error('Failed to create renewal application');
            }
            
            logger.info(`Renewal application created with ID: ${newApplication.id} for user ${userId}`);

            // Create Stripe checkout session
            const checkoutSession = await stripePaymentLinkService.createCheckoutSession({
              applicationId: newApplication.id,
              amount: PaymentFees.RENEWAL_FEE,
              currency: 'MXN',
              customerEmail: user.email,
              metadata: {
                renewal: true,
                original_application_id: originalApplicationId,
                source: 'renewal_api'
              },
              successUrl: `${process.env.FRONTEND_URL || 'https://permisosdigitales.com.mx'}/payment-success?session_id={CHECKOUT_SESSION_ID}&renewal=true`,
              cancelUrl: `${process.env.FRONTEND_URL || 'https://permisosdigitales.com.mx'}/payment-cancelled?renewal=true`
            });

            // Update application with payment session ID within same transaction
            await applicationRepository.updateApplication(
              newApplication.id, 
              { payment_processor_order_id: checkoutSession.id },
              client
            );

            return {
              application: newApplication,
              checkoutSession: checkoutSession,
              renewalCount: renewalCount
            };
          } catch (error) {
            if (error.message && error.message.includes('stripe')) {
              throw createRenewalError('payment_session', error);
            }
            throw createRenewalError('database_transaction', error);
          }
        });
      } catch (error) {
        // If it's already a renewal error, re-throw it
        if (error.name && error.name.includes('Renewal')) {
          throw error;
        }
        
        // Categorize other errors
        if (error.message && error.message.includes('connection')) {
          throw createRenewalError('database_connection', error);
        }
        
        throw createRenewalError('unexpected', error);
      }
    });

    const renewalResponse = {
      success: true,
      message: 'Solicitud de renovación creada exitosamente.',
      data: {
        id: renewalResult.application.id,
        status: renewalResult.application.status,
        created_at: renewalResult.application.created_at,
        renewed_from_id: originalApplicationId,
        renewal_count: renewalResult.renewalCount
      },
      payment: {
        amount: PaymentFees.RENEWAL_FEE,
        currency: 'MXN',
        sessionId: renewalResult.checkoutSession.id,
        paymentUrl: renewalResult.checkoutSession.url
      },
      // Include paymentLink for backward compatibility with WhatsApp service
      paymentLink: renewalResult.checkoutSession.url
    };

    res.status(201).json(renewalResponse);

  } catch (error) {
    logger.error(`Error creating renewal for application ${originalApplicationId}:`, {
      userId,
      originalApplicationId,
      error: error.message,
      stack: error.stack,
      errorType: error.name,
      errorCode: error.code
    });

    // Get user-friendly error message
    const userMessage = getUserFriendlyMessage(error);
    
    // Determine appropriate HTTP status code
    let statusCode = 500;
    let errorCode = 'RENEWAL_ERROR';
    
    if (error.name === 'RenewalEligibilityError') {
      statusCode = 400;
      errorCode = 'RENEWAL_NOT_ELIGIBLE';
    } else if (error.name === 'RenewalRateLimitError') {
      statusCode = 429;
      errorCode = 'RATE_LIMIT_EXCEEDED';
    } else if (error.name === 'RenewalValidationError') {
      statusCode = 400;
      errorCode = 'VALIDATION_ERROR';
    } else if (error.name === 'RenewalPaymentError') {
      statusCode = 402;
      errorCode = 'PAYMENT_ERROR';
    }

    res.status(statusCode).json({
      success: false,
      message: userMessage,
      code: errorCode,
      ...(process.env.NODE_ENV === 'development' && { debug: error.message })
    });
  }
};

exports.checkRenewalEligibility = async (req, res, next) => {
  const userId = req.session.userId;
  const applicationId = parseInt(req.params.id, 10);

  if (isNaN(applicationId)) {
    return res.status(400).json({ message: 'Formato de ID de solicitud inválido.' });
  }

  try {
    logger.info(`Checking renewal eligibility for application ID: ${applicationId} by user ${userId}`);

    const application = await applicationRepository.findApplicationWithFields(applicationId, [
      'id', 'user_id', 'status', 'fecha_expedicion', 'fecha_vencimiento'
    ]);

    if (!application || application.user_id !== userId) {
      logger.warn(`Renewal eligibility check failed: Application ${applicationId} not found or not owned by user ${userId}`);
      return res.status(404).json({
        eligible: false,
        message: 'Solicitud no encontrada o no autorizada.'
      });
    }

    if (application.status !== 'PERMIT_READY' && application.status !== 'ACTIVE') {
      logger.warn(`Renewal eligibility check failed: Application ${applicationId} has status ${application.status}`);
      return res.status(200).json({
        eligible: false,
        message: 'Solo los permisos activos o completados pueden ser renovados.'
      });
    }

    if (!application.fecha_vencimiento) {
      logger.warn(`Renewal eligibility check failed: Application ${applicationId} has no expiration date`);
      return res.status(200).json({
        eligible: false,
        message: 'Este permiso no tiene fecha de vencimiento.'
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expirationDate = new Date(application.fecha_vencimiento);
    expirationDate.setHours(0, 0, 0, 0);

    const diffTime = expirationDate.getTime() - today.getTime();
    const daysUntilExpiration = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    logger.debug(`Application ${applicationId} has ${daysUntilExpiration} days until expiration`);

    if (daysUntilExpiration <= 7 && daysUntilExpiration >= -15) {
      let message = '';
      if (daysUntilExpiration > 0) {
        message = `Su permiso vence en ${daysUntilExpiration} días. Puede renovarlo ahora.`;
      } else if (daysUntilExpiration === 0) {
        message = 'Su permiso vence hoy. Puede renovarlo ahora.';
      } else {
        message = `Su permiso venció hace ${Math.abs(daysUntilExpiration)} días. Aún puede renovarlo.`;
      }

      logger.info(`Application ${applicationId} is eligible for renewal: ${daysUntilExpiration} days until expiration`);

      return res.status(200).json({
        eligible: true,
        message,
        daysUntilExpiration,
        expirationDate: application.fecha_vencimiento
      });
    } else if (daysUntilExpiration > 7) {
      logger.info(`Application ${applicationId} is not yet eligible for renewal: ${daysUntilExpiration} days until expiration`);

      return res.status(200).json({
        eligible: false,
        message: `Su permiso vence en ${daysUntilExpiration} días. Podrá renovarlo 7 días antes de su vencimiento.`,
        daysUntilExpiration,
        expirationDate: application.fecha_vencimiento
      });
    } else {
      logger.info(`Application ${applicationId} is too late for renewal: ${daysUntilExpiration} days until expiration`);

      return res.status(200).json({
        eligible: false,
        message: 'Su permiso venció hace más de 15 días. Debe solicitar un nuevo permiso.',
        daysUntilExpiration,
        expirationDate: application.fecha_vencimiento
      });
    }
  } catch (error) {
    logger.error(`Error checking renewal eligibility for application ${applicationId}:`, error);
    next(error);
  }
};

exports.tempMarkPaid = async (req, res, next) => {
  const applicationId = parseInt(req.params.id, 10);
  if (isNaN(applicationId)) return res.status(400).json({ message: 'ID de solicitud inválido.' });

  logger.warn(`--- RUNNING TEMP DEV FUNCTION: Marking Application ${applicationId} as PAID ---`);

  try {
    const currentApp = await applicationRepository.findById(applicationId);
    if (!currentApp) return res.status(404).json({ message: 'Solicitud no encontrada.' });

    const currentStatus = currentApp.status;
    if (currentStatus !== ApplicationStatus.PAYMENT_PROCESSING) {
      logger.warn(`--- Application ${applicationId} status is ${currentStatus}, proceeding anyway for DEV ---`);
    } else {
      logger.info(`--- Application ${applicationId} status is PAYMENT_PROCESSING, proceeding to mark paid. ---`);
    }


    const updated = await applicationRepository.updateApplicationStatus(applicationId, ApplicationStatus.PAYMENT_RECEIVED);
    if (!updated) throw new Error('Solicitud no encontrada durante la actualización.');
    logger.info(`--- TEMP DEV: Application ${applicationId} status updated to PAYMENT_RECEIVED ---`);


    setImmediate(async () => {
      try {
        logger.info(`--- Triggering Puppeteer job for application ${applicationId}... ---`);
        await puppeteerService.generatePermit(applicationId);
        logger.info(`--- Puppeteer job function called for application ${applicationId}. Check service logs. ---`);
      } catch (puppeteerError) {
        logger.error(`--- FATAL error trying to trigger Puppeteer job for application ${applicationId}:`, puppeteerError);
      }
    });

    res.status(200).json({ message: `Solicitud ${applicationId} marcada como PAYMENT_RECEIVED (TEMP). Generación de permiso activada.` });

  } catch (error) {
    logger.error(`Error in TEMP_mark_paid for ${applicationId}:`, error);
    next(error);
  }
};