// src/controllers/application.controller.js
const path = require('path');
const fs = require('fs'); // Use synchronous existsSync for check before response
const puppeteerService = require('../services/puppeteer.service');
const applicationService = require('../services/application.service');
const paymentService = require('../services/payment.service');
const pdfService = require('../services/pdf-service');
const storageService = require('../services/storage/storage-service');
const pdfStorageService = require('../services/storage/pdf-storage-service');
const { logger } = require('../utils/enhanced-logger');
const { handleControllerError, createError } = require('../utils/error-helpers');
const { ApplicationStatus, DEFAULT_PERMIT_FEE } = require('../constants');
const { applicationRepository, paymentRepository } = require('../repositories');
const db = require('../db'); // Add database connection
const config = require('../config');

// --- CREATE APPLICATION FUNCTION ---
exports.createApplication = async (req, res, next) => {
  const userId = req.session.userId;
  // Extract form fields with consistent naming aligned with our DB schema
  const {
    nombre_completo,
    curp_rfc,
    domicilio,
    marca,
    linea,        // This matches the DB schema field name
    color,
    numero_serie,
    numero_motor,
    ano_modelo,
    payment_token,  // Field for Conekta payment token (card payment)
    payment_method, // Field to specify payment method ('card' or 'oxxo')
    device_session_id, // Device session ID for fraud prevention
    email           // Customer email (may be needed for OXXO payments)
  } = req.body;
    // Validation handled by middleware

  try {
    logger.info(`Creating new application for user ID: ${userId}`);

    // Enhanced validation with stronger defaults and logging
    // Ensure all values are stringified and never undefined
    const validatedData = {
      nombre_completo: nombre_completo ? String(nombre_completo).trim() : 'No especificado',
      curp_rfc: curp_rfc ? String(curp_rfc).trim() : 'No especificado',
      domicilio: domicilio ? String(domicilio).trim() : 'No especificado',
      marca: marca ? String(marca).trim() : 'No especificado',
      linea: linea ? String(linea).trim() : 'No especificado',
      color: color ? String(color).trim() : 'No especificado',
      numero_serie: numero_serie ? String(numero_serie).trim().toUpperCase() : '',
      numero_motor: numero_motor ? String(numero_motor).trim() : 'No especificado',
      ano_modelo: ano_modelo || new Date().getFullYear(),
      status: ApplicationStatus.AWAITING_PAYMENT // Default status, will be updated if payment is successful
    };

    // Extra validation check for VIN/serial number
    if (!validatedData.numero_serie || validatedData.numero_serie.length < 5 || validatedData.numero_serie.length > 50) {
      logger.warn(`Invalid VIN/serial number detected: ${validatedData.numero_serie}`);
      throw new Error('El número de serie debe tener entre 5 y 50 caracteres');
    }

    // Check if the serial number contains only alphanumeric characters
    if (!/^[A-Z0-9]+$/i.test(validatedData.numero_serie)) {
      logger.warn(`Invalid characters in VIN/serial number: ${validatedData.numero_serie}`);
      throw new Error('El número de serie solo debe contener letras y números');
    }

    // Double check that values are never undefined
    Object.keys(validatedData).forEach(key => {
      if (validatedData[key] === undefined) {
        logger.warn(`Found undefined value for ${key}, replacing with default`);
        validatedData[key] = key === 'ano_modelo' ? new Date().getFullYear() : 'No especificado';
      }
    });

    // Log the validated data for debugging
    logger.debug('Validated application data:', validatedData);

    // Define payment amount and currency
    const amount = DEFAULT_PERMIT_FEE; // Correct permit fee from constants
    const currency = 'MXN'; // Currency code (as a STRING)

    // Determine payment method
    const paymentMethodType = payment_method ? payment_method.toLowerCase() : 'card';
    logger.info(`Payment method for application by user ${userId}: ${paymentMethodType}`);

    // Handle different payment methods
    if (paymentMethodType === 'oxxo') {
      // OXXO payment flow
      try {
        logger.info(`OXXO payment flow initiated for application by user ${userId}`);

        // Get user email for payment processing if not provided in the request
        let userEmail = email;
        let userName = validatedData.nombre_completo;

        if (!userEmail) {
          const { rows: userRows } = await db.query(
            'SELECT email, first_name, last_name FROM users WHERE id = $1',
            [userId]
          );

          if (userRows.length === 0) {
            logger.error(`User ${userId} not found in database`);
            throw new Error('User not found');
          }

          const user = userRows[0];
          userEmail = user.email;
          userName = userName || `${user.first_name} ${user.last_name}`;
        }

        // Create customer in payment provider
        const customer = await paymentService.createCustomer({
          name: userName,
          email: userEmail,
          phone: ''
        });

        // Create application with AWAITING_OXXO_PAYMENT status
        // Ensure we have a valid status constant - use a hardcoded fallback if needed
        const initialStatus = ApplicationStatus.AWAITING_OXXO_PAYMENT || 'AWAITING_OXXO_PAYMENT';

        const applicationData = {
          user_id: Number(userId),
          nombre_completo: String(validatedData.nombre_completo || ''),
          curp_rfc: String(validatedData.curp_rfc || ''),
          domicilio: String(validatedData.domicilio || ''),
          marca: String(validatedData.marca || ''),
          linea: String(validatedData.linea || ''),
          color: String(validatedData.color || ''),
          numero_serie: String(validatedData.numero_serie || ''),
          numero_motor: String(validatedData.numero_motor || ''),
          ano_modelo: Number(validatedData.ano_modelo || 0),
          status: initialStatus, // Use the validated status value
          importe: Number(amount || 0)
        };

        // Log the application data before creating the record to verify status is set
        logger.debug('Creating application with OXXO payment data:', {
          ...applicationData,
          status: applicationData.status // Explicitly log the status field
        });

        // Defensive check - ensure status is never undefined or null before creating the record
        if (!applicationData.status || applicationData.status === 'undefined') {
          logger.warn('Status field is missing or invalid for OXXO payment, setting to AWAITING_OXXO_PAYMENT as fallback');
          applicationData.status = 'AWAITING_OXXO_PAYMENT'; // Hardcoded fallback
        }

        // Final verification of status value immediately before repository call
        logger.debug('Status value immediately before repository create for OXXO payment:', applicationData.status);

        // Create the application
        const newApplication = await applicationRepository.create(applicationData);
        logger.info(`New application created with ID: ${newApplication.id} for user ${userId} with OXXO payment pending`);

        // Prepare payment data
        const paymentData = {
          customerId: customer.id,
          amount: amount,
          currency: 'MXN',
          description: `Permiso de Circulación - ${validatedData.marca} ${validatedData.linea} ${validatedData.ano_modelo}`,
          referenceId: `APP-${newApplication.id}`
        };

        // Add device_session_id if provided (clone to avoid circular references)
        if (device_session_id) {
          // Create a new string to avoid any reference to the original object
          paymentData.device_session_id = String(device_session_id).slice(0);
          logger.debug(`Using device fingerprint for OXXO payment: ${paymentData.device_session_id}`);
        }

        // Create OXXO order
        const paymentResult = await paymentService.processOxxoPayment(paymentData);

        // Update application with payment information and OXXO reference
        await paymentRepository.updatePaymentOrder(
          newApplication.id,
          paymentResult.orderId,
          ApplicationStatus.AWAITING_OXXO_PAYMENT,
          { oxxoReference: paymentResult.oxxoReference }
        );

        // Log payment event
        await paymentRepository.logPaymentEvent({
          applicationId: newApplication.id,
          orderId: paymentResult.orderId,
          eventType: 'oxxo.payment.created',
          eventData: paymentResult
        });

        // Return success response with OXXO payment details
        return res.status(201).json({
          success: true,
          application: {
            id: newApplication.id,
            status: newApplication.status,
            created_at: newApplication.created_at
          },
          payment: {
            success: true,
            method: 'oxxo',
            reference: paymentResult.oxxoReference,
            expiresAt: paymentResult.expiresAt,
            amount: paymentResult.amount,
            currency: paymentResult.currency,
            orderId: paymentResult.orderId
          },
          oxxo: {
            reference: paymentResult.oxxoReference,
            expiresAt: new Date(paymentResult.expiresAt * 1000).toISOString(),
            amount: paymentResult.amount,
            currency: paymentResult.currency,
            barcodeUrl: paymentResult.barcodeUrl || 'https://s3.amazonaws.com/cash_payment_barcodes/sandbox_reference.png'
          }
        });
      } catch (oxxoError) {
        logger.error(`OXXO payment processing error for user ${userId}:`, oxxoError);
        // Return error response without creating application
        return res.status(400).json({
          success: false,
          message: `Error en el procesamiento del pago OXXO: ${oxxoError.message}`,
          paymentError: true
        });
      }
    } else if (payment_token) {
      // Card payment flow
      logger.info(`Card payment token provided for application by user ${userId}`);

      // Get user email for payment processing
      const { rows: userRows } = await db.query(
        'SELECT email, first_name, last_name FROM users WHERE id = $1',
        [userId]
      );

      if (userRows.length === 0) {
        logger.error(`User ${userId} not found in database`);
        throw new Error('User not found');
      }

      const user = userRows[0];
      const userEmail = user.email;
      const userName = `${user.first_name} ${user.last_name}`;

      try {
        // Create application first using repository with initial status
        // Use primitive values to avoid circular references

        // Ensure we have a valid status constant - use a hardcoded fallback if needed
        const initialStatus = ApplicationStatus.PROCESSING_PAYMENT || 'PROCESSING_PAYMENT';

        const applicationData = {
          user_id: Number(userId),
          nombre_completo: String(validatedData.nombre_completo || ''),
          curp_rfc: String(validatedData.curp_rfc || ''),
          domicilio: String(validatedData.domicilio || ''),
          marca: String(validatedData.marca || ''),
          linea: String(validatedData.linea || ''),
          color: String(validatedData.color || ''),
          numero_serie: String(validatedData.numero_serie || ''),
          numero_motor: String(validatedData.numero_motor || ''),
          ano_modelo: Number(validatedData.ano_modelo || 0),
          status: initialStatus, // Use the validated status value
          importe: Number(amount || 0)
        };

        // Log the application data before creating the record to verify status is set
        logger.debug('Creating application with data:', {
          ...applicationData,
          status: applicationData.status // Explicitly log the status field
        });

        // Defensive check - ensure status is never undefined or null before creating the record
        if (!applicationData.status || applicationData.status === 'undefined') {
          logger.warn('Status field is missing or invalid, setting to AWAITING_PAYMENT as fallback');
          applicationData.status = 'AWAITING_PAYMENT'; // Hardcoded fallback
        }

        // Final verification of status value immediately before repository call
        logger.debug('Status value immediately before repository create:', applicationData.status);

        // Create the application first to get the integer ID
        const newApplication = await applicationRepository.create(applicationData);
        logger.info(`New application created with ID: ${newApplication.id} for user ${userId}, proceeding to payment`);

        // Now prepare payment data with the actual application ID
        const paymentData = {
          token: payment_token,
          name: validatedData.nombre_completo || userName,
          email: userEmail || email, // Use email from request if available
          phone: '+525555555555', // Default phone number in Mexico format (required by Conekta)
          amount: amount,
          currency: currency,
          description: `Permiso de Circulación - ${validatedData.marca} ${validatedData.linea} ${validatedData.ano_modelo}`,
          referenceId: `APP-${newApplication.id}`, // Use the actual application ID
          applicationId: newApplication.id // Pass the integer application ID directly
        };

        // Add device_session_id if provided (clone to avoid circular references)
        if (device_session_id) {
          // Create a new string to avoid any reference to the original object
          paymentData.device_session_id = String(device_session_id).slice(0);
          logger.debug(`Using device fingerprint for card payment: ${paymentData.device_session_id}`);
        }

        // Process payment with Conekta
        let paymentResult;
        try {
          // Log the payment data being sent to Conekta (without sensitive info)
          logger.debug('Sending payment data to Conekta:', {
            amount: paymentData.amount,
            currency: paymentData.currency,
            description: paymentData.description,
            referenceId: paymentData.referenceId,
            applicationId: paymentData.applicationId,
            hasToken: !!paymentData.token,
            hasDeviceSessionId: !!paymentData.device_session_id
          });

          paymentResult = await paymentService.createChargeWithToken(paymentData);

          // Log the full Conekta order object for debugging
          if (paymentResult && paymentResult.conektaOrder) {
            logger.info('Full Conekta order object received:', JSON.stringify(paymentResult.conektaOrder, null, 2));
          } else {
            logger.warn('No Conekta order object found in payment result');
          }
        } catch (paymentError) {
          logger.error(`Error processing payment with Conekta: ${paymentError.message}`, {
            error: paymentError,
            errorDetails: paymentError.details || 'No details available',
            errorCode: paymentError.code || 'No error code',
            errorType: paymentError.type || 'Unknown error type',
            errorHttpCode: paymentError.http_code || 'No HTTP code',
            errorStack: paymentError.stack || 'No stack trace',
            paymentToken: paymentData.token ? `${paymentData.token.substring(0, 8)}...` : 'No token',
            deviceSessionId: paymentData.device_session_id ? `${paymentData.device_session_id.substring(0, 8)}...` : 'No device session ID'
          });

          // Update application status to PAYMENT_FAILED
          await applicationRepository.updateStatus(newApplication.id, ApplicationStatus.PAYMENT_FAILED);
          logger.info(`Updated application ${newApplication.id} status to PAYMENT_FAILED due to payment error`);

          // Handle different types of payment errors
          if (paymentError.message && paymentError.message.includes('circular structure')) {
            return res.status(402).json({
              success: false,
              message: 'Error en el pago: Error interno del servidor. Por favor, intente de nuevo.',
              paymentError: true,
              applicationId: newApplication.id
            });
          }

          // Handle card declined errors (402)
          if (paymentError.httpCode === 402 || (paymentError.code && paymentError.code.includes('card_declined'))) {
            // Log detailed information about the card declined error
            logger.warn(`Card declined for user ${userId}:`, {
              message: paymentError.message,
              code: paymentError.code || 'card_declined',
              type: paymentError.type || 'processing_error',
              details: paymentError.details || null,
              httpCode: paymentError.httpCode || 402
            });

            // Return a user-friendly error response
            return res.status(402).json({
              success: false,
              message: `Error en el pago: ${paymentError.message}`,
              paymentError: true,
              errorCode: paymentError.code || 'card_declined',
              details: paymentError.details || null,
              isPending: false, // Explicitly mark as not pending to avoid confusion
              applicationId: newApplication.id
            });
          }

          // Re-throw the error to be caught by the outer catch block
          throw paymentError;
        }

        // If payment was successful or pending, update the application status
        let finalStatus = ApplicationStatus.AWAITING_PAYMENT; // Default status
        if (paymentResult && paymentResult.success) {
          logger.info(`Payment successful or pending for application ${newApplication.id}`);

          // Set the appropriate status based on the payment result
          if (paymentResult.status === 'pending_payment') {
            logger.info(`Payment is in pending state for application ${newApplication.id}`);
            finalStatus = ApplicationStatus.PAYMENT_PROCESSING;
          } else {
            finalStatus = ApplicationStatus.PAYMENT_RECEIVED;
          }
        } else {
          logger.warn(`Payment failed for application ${newApplication.id}: ${paymentResult.failureMessage}`);
          finalStatus = ApplicationStatus.PAYMENT_FAILED;

          // Return error response with application ID
          return res.status(402).json({
            success: false,
            message: `Error en el pago: ${paymentResult.failureMessage || 'La tarjeta fue rechazada. Para pruebas, usa el número 4242 4242 4242 4242.'}`,
            paymentError: true,
            errorCode: paymentResult.errorCode || 'card_declined',
            applicationId: newApplication.id
          });
        }

        // Update the application with the final status and payment information
        await applicationRepository.updateStatus(newApplication.id, finalStatus);
        logger.info(`Updated application ${newApplication.id} status to ${finalStatus}`);

        // Update the payment order with the correct application ID
        await paymentRepository.updatePaymentOrder(
          newApplication.id,
          paymentResult.orderId,
          finalStatus
        );

        // Log payment event
        await paymentRepository.logPaymentEvent({
          applicationId: newApplication.id,
          orderId: paymentResult.orderId,
          eventType: 'payment.created',
          eventData: paymentResult
        });

        // If payment was successful, trigger permit generation
        if (paymentResult.success) {
          // Trigger Puppeteer Asynchronously
          setImmediate(async () => {
            try {
              logger.info(`Triggering Puppeteer job for application ${newApplication.id}...`);
              await puppeteerService.generatePermit(newApplication.id);
              logger.info(`Puppeteer job function called for application ${newApplication.id}. Check service logs.`);
            } catch (puppeteerError) {
              logger.error(`Error trying to trigger Puppeteer job for application ${newApplication.id}:`, puppeteerError);
            }
          });
        }

        // Get the Conekta order object from the payment result
        const conektaOrder = paymentResult.conektaOrder;

        // Log the payment status for debugging
        logger.debug(`Payment status: ${paymentResult.status}`);

        // Determine payment success based directly on payment_status
        const paymentIsSuccessful = conektaOrder &&
                                   conektaOrder.payment_status === 'paid';

        // Set application status based on payment result
        let applicationStatusToSet;
        let paymentMessage;

        if (paymentIsSuccessful) {
          applicationStatusToSet = ApplicationStatus.PAYMENT_RECEIVED;
          paymentMessage = 'Tu pago ha sido procesado exitosamente.';
          logger.info(`Payment successful for application ${newApplication.id}, order ${paymentResult.orderId}`);
        } else if (paymentResult.status === 'pending_payment') {
          applicationStatusToSet = ApplicationStatus.PAYMENT_PROCESSING;
          paymentMessage = 'Tu pago está siendo procesado. El estado se actualizará automáticamente cuando se complete.';
          logger.info(`Payment pending for application ${newApplication.id}, order ${paymentResult.orderId}`);
        } else {
          applicationStatusToSet = ApplicationStatus.PAYMENT_FAILED;
          paymentMessage = paymentResult.failureMessage || 'El pago no pudo ser procesado. Por favor, intenta con otro método de pago.';
          logger.warn(`Payment declined for application ${newApplication.id}, order ${paymentResult.orderId}: ${paymentMessage}`);
        }

        // Update application status if needed
        if (applicationStatusToSet !== newApplication.status) {
          await applicationRepository.updateStatus(newApplication.id, applicationStatusToSet);
          logger.info(`Updated application ${newApplication.id} status to ${applicationStatusToSet}`);
          newApplication.status = applicationStatusToSet;
        }

        // Prepare the simplified response object without 3DS information
        const responseObject = {
          success: true,
          application: {
            id: newApplication.id,
            status: newApplication.status,
            created_at: newApplication.created_at
          },
          payment: {
            success: paymentIsSuccessful,
            method: 'card',
            status: paymentResult.status,
            orderId: paymentResult.orderId,
            isPending: paymentResult.status === 'pending_payment',
            message: paymentMessage
          }
        };

        // Log the response being sent to the frontend
        logger.info(`Sending response for application ${newApplication.id}:`, {
          success: responseObject.payment.success,
          status: paymentResult.status,
          applicationStatus: newApplication.status
        });

        // Return the response
        return res.status(201).json(responseObject);

      } catch (paymentError) {
        logger.error(`Payment processing error for user ${userId}:`, paymentError);
        // Return error response without creating application
        return res.status(400).json({
          success: false,
          message: `Error en el procesamiento del pago: ${paymentError.message}`,
          paymentError: true
        });
      }
    } else {
      // No payment method provided, create application with AWAITING_PAYMENT status
      logger.info(`No payment method provided, creating application with AWAITING_PAYMENT status for user ${userId}`);

      // Create application using repository
      // Ensure we have a valid status constant - use a hardcoded fallback if needed
      const initialStatus = ApplicationStatus.AWAITING_PAYMENT || 'AWAITING_PAYMENT';

      const applicationData = {
        user_id: Number(userId),
        nombre_completo: String(validatedData.nombre_completo || ''),
        curp_rfc: String(validatedData.curp_rfc || ''),
        domicilio: String(validatedData.domicilio || ''),
        marca: String(validatedData.marca || ''),
        linea: String(validatedData.linea || ''),
        color: String(validatedData.color || ''),
        numero_serie: String(validatedData.numero_serie || ''),
        numero_motor: String(validatedData.numero_motor || ''),
        ano_modelo: Number(validatedData.ano_modelo || 0),
        status: initialStatus, // Use the validated status value
        importe: Number(DEFAULT_PERMIT_FEE || 0)
      };

      // Log the application data for debugging
      logger.debug('Creating application with data:', {
        ...applicationData,
        status: applicationData.status // Explicitly log the status field
      });

      // Defensive check - ensure status is never undefined or null before creating the record
      if (!applicationData.status || applicationData.status === 'undefined') {
        logger.warn('Status field is missing or invalid, setting to AWAITING_PAYMENT as fallback');
        applicationData.status = 'AWAITING_PAYMENT'; // Hardcoded fallback
      }

      // Final verification of status value immediately before repository call
      logger.debug('Status value immediately before repository create:', applicationData.status);

      const newApplication = await applicationRepository.create(applicationData);
      logger.info(`New application created with ID: ${newApplication.id} for user ID: ${userId}`);

      // Define payment details
      const reference = `APP-${newApplication.id}`; // Use the actual ID of the created application
      const methods = [ // Define the payment methods array
        {
          type: 'Transferencia Bancaria', // Use consistent keys like 'type' and 'details'
          details: `Transferencia a la cuenta XXXX-XXXX-XXXX-XXXX (CLABE: XXXXXXXXXXXXXXXXXXXX) del banco Nombre del Banco a nombre de Nombre de la Compañía. Referencia: ${reference}` // Example detail string
        },
        {
          type: 'Depósito en Efectivo',
          details: `Depósito en efectivo en la cuenta XXXX-XXXX-XXXX-XXXX del banco Nombre del Banco a nombre de Nombre de la Compañía. Referencia: ${reference}` // Example detail string
        }
      ];
      // Construct the detailed next steps message
      const steps = `Después de realizar tu pago, regresa a la solicitud en tu dashboard y haz clic en "Subir Comprobante" para enviar evidencia de tu pago. Por favor, incluye tu ID de solicitud (${reference}) en la referencia del pago.`;


      // Construct the final JSON response matching API.md structure
      const responseBody = {
        application: { // Nested application object
          id: newApplication.id,
          status: newApplication.status, // Ensure status is correctly set on newApplication
          created_at: newApplication.created_at // Ensure created_at is correctly set
        },
        paymentInstructions: { // Nested paymentInstructions object
          amount: amount,       // Send number
          currency: currency,   // Send string
          reference: reference, // Send generated reference
          paymentMethods: methods, // Send the array of methods
          nextSteps: steps      // Send the detailed steps
        }
      };

      // Send the correctly structured response
      logger.info(`Sending 201 response for application ${newApplication.id} with correct structure.`);
      res.status(201).json(responseBody);
    }

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

// --- GET USER APPLICATIONS ---
exports.getUserApplications = async (req, res, next) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ message: 'Usuario no autenticado.' }); // Should be caught by middleware

  try {
    logger.debug(`Fetching applications for user ID: ${userId}`);

    // Get regular applications using repository
    const applications = await applicationRepository.findByUserId(userId);

    // Get expiring permits using repository
    const expiringPermits = await applicationRepository.findExpiringPermits(userId);

    // Return in the format expected by the frontend
    res.status(200).json({
      success: true,
      applications: applications,
      expiringPermits: expiringPermits
    });
  } catch (error) {
    handleControllerError(error, 'getUserApplications', req, res, next);
  }
};

// Get status information with detailed next steps
exports.getApplicationStatus = async (req, res, next) => {
  const userId = req.session.userId;
  const applicationId = parseInt(req.params.id, 10);

  if (isNaN(applicationId)) {
    return res.status(400).json({ message: 'Invalid application ID format' });
  }

  try {
    logger.debug(`Fetching status for application ID: ${applicationId}, user: ${userId}`);

    // Find application by ID and user ID using repository
    let application;
    try {
      application = await applicationRepository.findById(applicationId);

      // Log the application object for debugging
      logger.debug(`Application ${applicationId} data:`, {
        id: application?.id,
        user_id: application?.user_id,
        status: application?.status,
        fecha_vencimiento: application?.fecha_vencimiento
      });

    } catch (dbError) {
      logger.error(`Database error fetching application ${applicationId}:`, dbError);
      return res.status(500).json({
        message: 'Error retrieving application from database',
        error: dbError.message
      });
    }

    if (!application) {
      logger.warn(`Application ${applicationId} not found`);
      return res.status(404).json({ message: 'Application not found' });
    }

    if (application.user_id !== userId) {
      logger.warn(`User ${userId} attempted to access application ${applicationId} owned by user ${application.user_id}`);
      return res.status(403).json({ message: 'You do not have permission to access this application' });
    }

    // Ensure application.status is valid and never undefined
    if (!application.status || application.status === 'undefined') {
      logger.warn(`Application ${applicationId} has invalid status: ${application.status}`);
      // Update application with a valid status if it's invalid
      await applicationRepository.updateStatus(applicationId, ApplicationStatus.AWAITING_PAYMENT);
      application.status = ApplicationStatus.AWAITING_PAYMENT;
    }

    let statusInfo = {
      currentStatus: application.status,
      lastUpdated: application.updated_at,
      displayMessage: '',
      nextSteps: '',
      allowedActions: []
    };

    switch (application.status) {
    case ApplicationStatus.AWAITING_PAYMENT:
      // Check if this is a pending Conekta payment or just waiting for payment
      if (application.payment_processor_order_id) {
        statusInfo.displayMessage = 'Su pago está siendo procesado';
        statusInfo.nextSteps = 'El pago está siendo procesado por el banco. Esto puede tomar unos minutos. La página se actualizará automáticamente cuando el pago sea confirmado.';
        statusInfo.allowedActions = [];
      } else {
        statusInfo.displayMessage = 'Su solicitud está esperando pago';
        statusInfo.nextSteps = 'Por favor realice el pago y suba el comprobante';
        statusInfo.allowedActions = ['uploadPaymentProof', 'editApplication'];
      }
      break;
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
    // Map obsolete statuses to default case
    // These cases are kept for backward compatibility with existing data
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
    default:
      statusInfo.displayMessage = `Estado de la solicitud: ${application.status}`;
      statusInfo.nextSteps = 'Por favor contacte a soporte para más información.';
      statusInfo.allowedActions = [];
    }

    res.json({
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
          paymentProofUploaded: application.payment_proof_uploaded_at,
          paymentVerified: application.payment_verified_at,
          fecha_expedicion: application.fecha_expedicion || null,
          fecha_vencimiento: application.fecha_vencimiento || null
        },
        paymentReference: application.payment_reference,
        payment_rejection_reason: application.payment_rejection_reason,
        is_sample_permit: application.is_sample_permit === true
      },
      status: statusInfo
    });

  } catch (error) {
    handleControllerError(error, 'getApplicationStatus', req, res, next);
  }
};

// [Refactor - Remove Manual Payment] Controller function for handling manual payment proof uploads. Obsolete.
/*
// Submit payment proof with optional desired start date
exports.submitPaymentProof = async (req, res, next) => {
  const userId = req.session.userId;
  const applicationId = parseInt(req.params.id, 10);
  // Get payment reference from request body (already validated by middleware)
  const paymentReference = req.body.paymentReference || null;
  const desiredStartDate = req.body.desiredStartDate || null;

  if (isNaN(applicationId)) {
    return res.status(400).json({ message: 'Invalid application ID format' });
  }

  if (!req.file) {
    return res.status(400).json({ message: 'Payment proof file is required' });
  }

  // Validate desiredStartDate if provided
  let validatedStartDate = null;
  if (desiredStartDate) {
    try {
      // Parse the date string
      const dateObj = new Date(desiredStartDate);

      // Check if it's a valid date
      if (isNaN(dateObj.getTime())) {
        return res.status(400).json({ message: 'Invalid date format. Please use YYYY-MM-DD format.' });
      }

      // Check if the date is not in the past
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Set to beginning of day for comparison

      if (dateObj < today) {
        return res.status(400).json({ message: 'Desired start date cannot be in the past.' });
      }

      // Check if the date is within a reasonable future window (e.g., 90 days)
      const maxFutureDate = new Date();
      maxFutureDate.setDate(maxFutureDate.getDate() + 90);

      if (dateObj > maxFutureDate) {
        return res.status(400).json({ message: 'Desired start date cannot be more than 90 days in the future.' });
      }

      // Format as YYYY-MM-DD for database storage
      validatedStartDate = dateObj.toISOString().split('T')[0];
      logger.info(`Valid desired start date provided for application ${applicationId}: ${validatedStartDate}`);
    } catch (error) {
      logger.error(`Error validating desired start date for application ${applicationId}:`, error);
      return res.status(400).json({ message: 'Invalid date format. Please use YYYY-MM-DD format.' });
    }
  }

  try {
    logger.info(`User ${userId} uploading payment proof for application ${applicationId}`);

    // Check if the application exists and belongs to user using repository
    const application = await applicationRepository.findById(applicationId);

    if (!application || application.user_id !== userId) {
      return res.status(404).json({
        message: 'Application not found or does not belong to the current user'
      });
    }

    logger.debug('Found application data:', application || 'No application found');

    // Enhanced status validation with detailed error response
    const currentStatus = application.status;

    if (!currentStatus) {
      logger.error(`Critical data issue: Application ${applicationId} has undefined status`);
      return res.status(500).json({
        message: 'Application data is incomplete. Please contact support.',
        error: 'INVALID_APPLICATION_DATA',
        applicationId
      });
    }

    if (currentStatus !== ApplicationStatus.PENDING_PAYMENT && currentStatus !== ApplicationStatus.PROOF_REJECTED) {
      return res.status(400).json({
        message: `Cannot submit payment proof for application in ${currentStatus} status`,
        currentStatus,
        allowedStatuses: [ApplicationStatus.PENDING_PAYMENT, ApplicationStatus.PROOF_REJECTED]
      });
    }

    // Validate application has all required data
    const requiredFields = ['marca', 'linea', 'ano_modelo', 'nombre_completo'];
    const missingFields = requiredFields.filter(field => !application[field]);

    if (missingFields.length > 0) {
      logger.error(`Application ${applicationId} missing required data: ${missingFields.join(', ')}`);
      return res.status(400).json({
        message: 'Application data is incomplete. Please create a new application.',
        error: 'INCOMPLETE_APPLICATION_DATA',
        missingFields
      });
    }

    // Use storage service to save the file
    const storageService = require('../services/storage.service');

    // Save the file using the storage service
    const fileInfo = await storageService.saveFileFromPath(req.file.path, {
      originalName: req.file.originalname,
      subDirectory: 'payment-proofs',
      prefix: `app-${applicationId}`,
      removeSource: true,
      metadata: {
        applicationId,
        userId,
        uploadedAt: new Date().toISOString()
      }
    });

    // Submit payment proof using repository
    const updatedApplication = await applicationRepository.submitPaymentProof(
      applicationId,
      userId,
      fileInfo.relativePath,
      paymentReference,
      validatedStartDate
    );

    if (!updatedApplication) {
      throw new Error('Failed to update application with payment proof');
    }

    // Prepare response message based on whether scheduling was requested
    let responseMessage;
    if (validatedStartDate) {
      responseMessage = 'Comprobante recibido. Su solicitud se enviará para verificación cerca de la fecha de inicio deseada.';
    } else {
      responseMessage = 'Comprobante subido con éxito. Su pago será verificado pronto.';
    }

    res.status(200).json({
      message: responseMessage,
      applicationId: updatedApplication.id,
      status: updatedApplication.status,
      desiredStartDate: updatedApplication.desired_start_date || null
    });

  } catch (error) {
    logger.error(`Error submitting payment proof for application ${applicationId}:`, error);
    next(error);
  }
};
*/

// Temporary replacement function for submitPaymentProof
exports.submitPaymentProof = async (req, res, next) => {
  const userId = req.session.userId;
  const applicationId = parseInt(req.params.id, 10);

  logger.info(`Manual payment proof upload attempted for application ${applicationId} by user ${userId}, but functionality is disabled`);

  res.status(410).json({
    success: false,
    message: 'El sistema de pagos está siendo actualizado para usar un proveedor de pagos externo. Esta funcionalidad ya no está disponible.'
  });
};

// src/controllers/application.controller.js

exports.downloadPermit = async (req, res, next) => {
  const userId = req.session.userId;
  const applicationId = parseInt(req.params.id, 10);
  // --- Read type parameter ---
  const requestedTypeParam = req.params.type; // Get type from URL parameter

  // Initialize requestedType for error handling
  let requestedType = requestedTypeParam ? requestedTypeParam.toLowerCase() : 'unknown';

  // --- Input Validation ---
  if (isNaN(applicationId) || applicationId <= 0) {
    logger.warn(`Download failed: Invalid Application ID format ${req.params.id}`);
    return res.status(400).json({ message: 'Invalid Application ID format.' });
  }
  if (!userId) {
    // Should be caught by middleware, but double-check
    logger.warn(`Download failed: User not authenticated for AppID ${applicationId}`);
    return res.status(401).json({ message: 'Unauthorized.' });
  }
  const allowedTypes = ['permiso', 'recibo', 'certificado', 'placas'];
  if (!requestedTypeParam || !allowedTypes.includes(requestedTypeParam.toLowerCase())) {
    logger.warn(`Download failed: Invalid document type requested '${requestedTypeParam}' for AppID ${applicationId}`);
    return res.status(400).json({ message: `Invalid document type. Allowed types: ${allowedTypes.join(', ')}` });
  }

  // --- Determine DB column and filename prefix based on validated type ---
  // requestedType is already defined above
  let dbColumn;
  let filenamePrefix;

  switch (requestedType) {
  case 'recibo':
    dbColumn = 'recibo_file_path';
    filenamePrefix = 'Recibo';
    break;
  case 'certificado':
    dbColumn = 'certificado_file_path';
    filenamePrefix = 'Certificado';
    break;
  case 'placas':
    dbColumn = 'placas_file_path';
    filenamePrefix = 'Placas';
    break;
  case 'permiso':
    // default case removed as we validated type earlier
    dbColumn = 'permit_file_path';
    filenamePrefix = 'PermisoDigital';
    break;
        // No default needed because we validated allowedTypes
  }

  // --- Log Correct Initial Values ---
  logger.debug(`Download request validated - AppID: ${applicationId}, UserID: ${userId}, Type: ${requestedType}, DB Column: ${dbColumn}, Filename Prefix: ${filenamePrefix}`);

  try {
    // --- Query DB ---
    // Fetch all path columns + status + ownership info
    const query = `SELECT user_id, status, permit_file_path, recibo_file_path, certificado_file_path, placas_file_path
                       FROM permit_applications WHERE id = $1;`;
    const { rows } = await db.query(query, [applicationId]);

    if (rows.length === 0) {
      logger.warn(`Download failed: Application ${applicationId} not found.`);
      return res.status(404).json({ message: 'Application not found.' });
    }
    const app = rows[0];
    logger.debug(`DB Result for App ${applicationId}:`, { status: app.status, permit_path: app.permit_file_path, recibo_path: app.recibo_file_path, cert_path: app.certificado_file_path }); // Log relevant parts

    // --- Check Ownership ---
    if (app.user_id !== userId) {
      logger.warn(`Security Alert: User ${userId} tried to download ${requestedType} for permit ${applicationId} owned by user ${app.user_id}.`);
      return res.status(403).json({ message: 'Forbidden: You do not own this application.' });
    }

    // --- Extract Correct File Path from DB Result ---
    const filePathFromDB = app[dbColumn]; // Use the correctly determined dbColumn
    logger.debug(`Extracted DB File Path (using column '${dbColumn}'): ${filePathFromDB}`);

    // --- Check Status and Path Existence in DB ---
    // Allow download only if permit is ready AND the specific path exists in DB
    if (app.status !== 'PERMIT_READY' || !filePathFromDB) {
      logger.warn(`Download failed for App ${applicationId}, Type ${requestedType}: Status=${app.status}, Path=${filePathFromDB}`);
      const message = app.status !== 'PERMIT_READY'
        ? `Permiso no está listo (Estado: ${app.status}).`
        : `Documento de tipo '${requestedType}' no encontrado para esta solicitud.`;
      return res.status(400).json({ message });
    }

    // --- Use PDF storage service to get the file ---
    // Get the file from storage
    let fileInfo;
    try {
      fileInfo = await pdfService.getPdf(filePathFromDB);
      logger.debug(`File retrieved from storage: ${fileInfo.relativePath || fileInfo.filePath}`);
    } catch (fileError) {
      logger.error(`Error retrieving file from storage for App ${applicationId}, Type ${requestedType}: ${fileError.message}`);
      return res.status(404).json({ message: `Error: Archivo ${filenamePrefix} no encontrado en el servidor.` });
    }

    logger.debug(`File exists in storage: ${filePathFromDB}`);


    // --- Prepare Download ---
    const fileExtension = path.extname(filePathFromDB) || '.pdf';
    let downloadFilename = `${filenamePrefix}_${applicationId}${fileExtension}`;
    logger.debug(`Generated Download Filename: ${downloadFilename}`);

    // --- Copy to User Downloads (Optional - run in background) ---
    const filename = path.basename(filePathFromDB);
    pdfService.copyPermitToUserDownloads(filename, applicationId, requestedType, app.folio, false)
      .then(copyResult => {
        if (copyResult.success) logger.info(`Copied ${requestedType} to user downloads: ${copyResult.filename}`);
        else logger.warn(`Could not copy ${requestedType} to user downloads: ${copyResult.error}`);
      })
      .catch(copyError => logger.warn(`Error during background PDF copy: ${copyError.message}`));


    // --- Send File ---
    logger.info(`Sending file: ${fileInfo.filePath} as ${downloadFilename}`);

    // Set appropriate headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${downloadFilename}"`);
    res.setHeader('Content-Length', fileInfo.size);

    // Send the file buffer
    try {
      res.send(fileInfo.buffer);
      logger.info(`File sent successfully: ${downloadFilename}`);
    } catch (sendError) {
      logger.error(`Error sending file ${downloadFilename}:`, sendError);
      if (!res.headersSent) {
        next(createError(`Error sending file: ${sendError.message}`, 500));
      } else {
        logger.error(`Headers already sent for ${downloadFilename}, could not send error status.`);
      }
    }

  } catch (error) {
    // Catch errors from DB query, ownership check, etc.
    logger.error(`Error during ${requestedType} download processing for App ${applicationId}:`, error);
    next(error); // Pass to global error handler
  }
};

/**
 * Get secure URL for PDF access (pre-signed URL for S3 or direct URL for local)
 */
exports.getPdfUrl = async (req, res, next) => {
  const userId = req.session.userId;
  const applicationId = parseInt(req.params.id, 10);
  const requestedTypeParam = req.params.type;

  // Initialize requestedType for error handling
  let requestedType = requestedTypeParam ? requestedTypeParam.toLowerCase() : 'unknown';

  // Input Validation
  if (isNaN(applicationId) || applicationId <= 0) {
    logger.warn(`PDF URL request failed: Invalid Application ID format ${req.params.id}`);
    return res.status(400).json({ message: 'Invalid Application ID format.' });
  }
  if (!userId) {
    logger.warn(`PDF URL request failed: User not authenticated for AppID ${applicationId}`);
    return res.status(401).json({ message: 'Unauthorized.' });
  }

  try {
    // Map frontend type to database column and user-friendly name
    const typeMapping = {
      'permiso': { dbColumn: 'permit_file_path', displayName: 'Permiso' },
      'recibo': { dbColumn: 'recibo_file_path', displayName: 'Recibo' },
      'certificado': { dbColumn: 'certificado_file_path', displayName: 'Certificado' },
      'placas': { dbColumn: 'placas_file_path', displayName: 'Placas' }
    };

    // requestedType is already defined above
    if (!typeMapping[requestedType]) {
      logger.warn(`PDF URL request failed: Invalid document type '${requestedTypeParam}' for App ${applicationId}`);
      return res.status(400).json({ message: `Invalid document type: ${requestedTypeParam}` });
    }

    const { dbColumn, displayName } = typeMapping[requestedType];

    // Query database for application and check ownership
    const query = `
      SELECT id, user_id, status, ${dbColumn}
      FROM permit_applications
      WHERE id = $1
    `;
    const { rows } = await db.query(query, [applicationId]);

    if (rows.length === 0) {
      logger.warn(`PDF URL request failed: Application ${applicationId} not found`);
      return res.status(404).json({ message: 'Application not found.' });
    }

    const app = rows[0];

    // Check ownership
    if (app.user_id !== userId) {
      logger.warn(`PDF URL request failed: User ${userId} does not own Application ${applicationId}`);
      return res.status(403).json({ message: 'Access denied. This application does not belong to you.' });
    }

    // Extract file path from database
    const filePathFromDB = app[dbColumn];

    // Check status and path existence
    if (app.status !== 'PERMIT_READY' || !filePathFromDB) {
      logger.warn(`PDF URL request failed for App ${applicationId}, Type ${requestedType}: Status=${app.status}, Path=${filePathFromDB}`);
      const message = app.status !== 'PERMIT_READY'
        ? `Permiso no está listo (Estado: ${app.status}).`
        : `Documento de tipo '${requestedType}' no encontrado para esta solicitud.`;
      return res.status(400).json({ message });
    }

    // Get secure URL from storage service
    try {
      const urlOptions = {
        expiresIn: 3600 // 1 hour expiration
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


// NEW: Allow users to update application data before payment
exports.updateApplication = async (req, res, next) => {
  const userId = req.session.userId;
  const applicationId = parseInt(req.params.id, 10);

  if (isNaN(applicationId)) {
    return res.status(400).json({ message: 'Invalid application ID format' });
  }

  try {
    // First, check if application belongs to user and is in an editable state
    const { rows } = await db.query(
      'SELECT status FROM permit_applications WHERE id = $1 AND user_id = $2',
      [applicationId, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: 'Application not found or does not belong to the current user'
      });
    }

    const currentStatus = rows[0].status;
    // Only allow updates if payment is not yet submitted
    if (currentStatus !== ApplicationStatus.AWAITING_PAYMENT) {
      return res.status(400).json({
        message: `Cannot update application in ${currentStatus} status. Only applications awaiting payment can be modified.`,
        currentStatus
      });
    }

    // Get fields to update from request body
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

    // Validate and sanitize update data
    const updateData = {};

    // Only include fields that are provided in the request
    if (nombre_completo) updateData.nombre_completo = nombre_completo;
    if (curp_rfc) updateData.curp_rfc = curp_rfc;
    if (domicilio) updateData.domicilio = domicilio;
    if (marca) updateData.marca = marca;
    if (linea) updateData.linea = linea;
    if (color) updateData.color = color;
    if (numero_serie) updateData.numero_serie = numero_serie;
    if (numero_motor) updateData.numero_motor = numero_motor;
    if (ano_modelo) updateData.ano_modelo = ano_modelo;

    // If no fields to update, return early
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        message: 'No valid fields provided for update'
      });
    }

    // Add updated_at timestamp
    updateData.updated_at = new Date();

    // Prepare the update query
    const fields = Object.keys(updateData);
    const placeholders = fields.map((field, index) => `${field} = $${index + 1}`);
    const values = Object.values(updateData);

    const updateQuery = `
            UPDATE permit_applications
            SET ${placeholders.join(', ')}
            WHERE id = $${values.length + 1} AND user_id = $${values.length + 2}
            RETURNING id, status, marca, linea, color, ano_modelo, nombre_completo, updated_at
        `;

    // Add applicationId and userId to values array
    values.push(applicationId, userId);

    logger.debug('Executing update with params:', {
      applicationId,
      userId,
      updateFields: fields,
      query: updateQuery
    });

    // Execute the update
    const { rows: updatedRows } = await db.query(updateQuery, values);

    if (updatedRows.length === 0) {
      throw new Error('Failed to update application');
    }

    logger.info(`Application ${applicationId} updated successfully by user ${userId}`);

    // Return the updated application data
    res.status(200).json({
      message: 'Application updated successfully',
      application: updatedRows[0]
    });

  } catch (error) {
    logger.error(`Error updating application ${applicationId}:`, error);
    next(error);
  }
};

// --- RENEW APPLICATION FUNCTION --- (Keep AS IS)
exports.renewApplication = async (req, res, next) => {
  const userId = req.session.userId;
  const originalApplicationId = parseInt(req.params.id, 10);

  // Basic validation
  if (isNaN(originalApplicationId)) {
    return res.status(400).json({ message: 'Invalid Application ID format.' });
  }

  try {
    logger.info(`Processing renewal for application ID: ${originalApplicationId} by user ${userId}`);

    // 1. Find and verify the original application
    const findOriginalQuery = `
            SELECT * FROM permit_applications
            WHERE id = $1 AND user_id = $2;
        `;
    const { rows } = await db.query(findOriginalQuery, [originalApplicationId, userId]);

    if (rows.length === 0) {
      logger.warn(`Renewal failed: Application ${originalApplicationId} not found or not owned by user ${userId}`);
      return res.status(404).json({ message: 'Application not found or not authorized.' });
    }

    const originalApp = rows[0];

    // 2. Check if permit is eligible for renewal
    if (originalApp.status !== 'PERMIT_READY' && originalApp.status !== 'ACTIVE') { // Assuming ACTIVE might be a future status
      logger.warn(`Renewal failed: Application ${originalApplicationId} has status ${originalApp.status}`);
      return res.status(400).json({
        message: 'Only active or completed permits can be renewed.'
      });
    }

    // 3. Create a new application based on the original
    const insertQuery = `
            INSERT INTO permit_applications (
                user_id, nombre_completo, curp_rfc, domicilio,
                marca, linea, color, numero_serie, numero_motor,
                ano_modelo, renewed_from_id, renewal_count, status
                -- Note: New file path columns will be null by default
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING id, status, created_at;
        `;

    const renewalCount = (originalApp.renewal_count || 0) + 1;
    const insertParams = [
      userId,
      originalApp.nombre_completo,
      originalApp.curp_rfc,
      originalApp.domicilio,
      originalApp.marca,
      originalApp.linea,
      originalApp.color,
      originalApp.numero_serie,
      originalApp.numero_motor,
      originalApp.ano_modelo,
      originalApplicationId,
      renewalCount,
      ApplicationStatus.AWAITING_PAYMENT // New renewals always start awaiting payment
    ];

    const { rows: insertedRows } = await db.query(insertQuery, insertParams);

    if (insertedRows.length === 0) {
      throw new Error('Failed to create renewal application.');
    }

    const newApplication = insertedRows[0];
    logger.info(`Renewal application created with ID: ${newApplication.id} for user ${userId}`);

    // 4. Return success response with payment instructions
    // Enhanced payment instructions
    const paymentInstructions = {
      message: 'Solicitud de renovación creada exitosamente. Por favor realice su pago utilizando uno de los métodos a continuación y envíe el comprobante de pago.',
      application: {
        id: newApplication.id,
        status: newApplication.status,
        created_at: newApplication.created_at,
        renewed_from_id: originalApplicationId
      },
      applicationId: newApplication.id,
      originalApplicationId: originalApplicationId,
      paymentAmount: '197.00 MXN', // Correct permit fee
      paymentMethods: [
        {
          type: 'Transferencia Bancaria',
          instructions: 'Transfiera el monto exacto a la siguiente cuenta:',
          accountDetails: {
            bank: 'Nombre del Banco',
            accountHolder: 'Nombre de la Compañía',
            accountNumber: 'XXXX-XXXX-XXXX-XXXX',
            clabe: 'XXXXXXXXXXXXXXXXXXXXX',
            reference: `APP-${newApplication.id}` // Use application ID as reference
          }
        },
        {
          type: 'Depósito en Efectivo',
          instructions: 'Realice un depósito en efectivo a la siguiente cuenta:',
          accountDetails: {
            bank: 'Nombre del Banco',
            accountHolder: 'Nombre de la Compañía',
            accountNumber: 'XXXX-XXXX-XXXX-XXXX',
            reference: `APP-${newApplication.id}` // Use application ID as reference
          }
        }
      ],
      nextSteps: 'Después de realizar su pago, regrese a la solicitud y haga clic en "Subir Comprobante" para enviar evidencia de su pago. Por favor incluya su ID de solicitud en la referencia del pago.'
    };

    res.status(201).json(paymentInstructions);

  } catch (error) {
    logger.error(`Error creating renewal for application ${originalApplicationId}:`, error);
    next(error);
  }
};

// --- CHECK RENEWAL ELIGIBILITY FUNCTION ---
exports.checkRenewalEligibility = async (req, res, next) => {
  const userId = req.session.userId;
  const applicationId = parseInt(req.params.id, 10);

  // Basic validation
  if (isNaN(applicationId)) {
    return res.status(400).json({ message: 'Invalid Application ID format.' });
  }

  try {
    logger.info(`Checking renewal eligibility for application ID: ${applicationId} by user ${userId}`);

    // Find and verify the original application
    const findQuery = `
      SELECT id, user_id, status, fecha_expedicion, fecha_vencimiento
      FROM permit_applications
      WHERE id = $1 AND user_id = $2;
    `;
    const { rows } = await db.query(findQuery, [applicationId, userId]);

    if (rows.length === 0) {
      logger.warn(`Renewal eligibility check failed: Application ${applicationId} not found or not owned by user ${userId}`);
      return res.status(404).json({
        eligible: false,
        message: 'Application not found or not authorized.'
      });
    }

    const application = rows[0];

    // Check if permit has the correct status
    if (application.status !== 'PERMIT_READY' && application.status !== 'ACTIVE') {
      logger.warn(`Renewal eligibility check failed: Application ${applicationId} has status ${application.status}`);
      return res.status(200).json({
        eligible: false,
        message: 'Solo los permisos activos o completados pueden ser renovados.'
      });
    }

    // Check if permit has an expiration date
    if (!application.fecha_vencimiento) {
      logger.warn(`Renewal eligibility check failed: Application ${applicationId} has no expiration date`);
      return res.status(200).json({
        eligible: false,
        message: 'Este permiso no tiene fecha de vencimiento.'
      });
    }

    // Calculate days until expiration
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to beginning of day for comparison

    const expirationDate = new Date(application.fecha_vencimiento);
    expirationDate.setHours(0, 0, 0, 0); // Set to beginning of day for comparison

    const diffTime = expirationDate.getTime() - today.getTime();
    const daysUntilExpiration = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    logger.debug(`Application ${applicationId} has ${daysUntilExpiration} days until expiration`);

    // Determine eligibility based on days until expiration
    // Permits can be renewed 7 days before expiration or up to 15 days after expiration
    if (daysUntilExpiration <= 7 && daysUntilExpiration >= -15) {
      // Eligible for renewal
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
      // Not yet eligible - too early
      logger.info(`Application ${applicationId} is not yet eligible for renewal: ${daysUntilExpiration} days until expiration`);

      return res.status(200).json({
        eligible: false,
        message: `Su permiso vence en ${daysUntilExpiration} días. Podrá renovarlo 7 días antes de su vencimiento.`,
        daysUntilExpiration,
        expirationDate: application.fecha_vencimiento
      });
    } else {
      // Too late for renewal
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

// --- TEMPORARY CONTROLLER FOR DEVELOPMENT - REMOVE LATER --- (Keep AS IS)
exports.tempMarkPaid = async (req, res, next) => { // Added next
  const applicationId = parseInt(req.params.id, 10);
  if (isNaN(applicationId)) return res.status(400).json({ message: 'Invalid Application ID.' });

  logger.warn(`--- RUNNING TEMP DEV FUNCTION: Marking Application ${applicationId} as PAID ---`); // Use warn

  try {
    const { rows: currentRows } = await db.query('SELECT status FROM permit_applications WHERE id = $1', [applicationId]);
    if (currentRows.length === 0) return res.status(404).json({ message: 'Application not found.' });

    const currentStatus = currentRows[0].status;
    // Allow proceeding even if not AWAITING_PAYMENT during dev
    if (currentStatus !== ApplicationStatus.AWAITING_PAYMENT) {
      logger.warn(`--- Application ${applicationId} status is ${currentStatus}, proceeding anyway for DEV ---`);
    } else {
      logger.info(`--- Application ${applicationId} status is AWAITING_PAYMENT, proceeding to mark paid. ---`);
    }


    const { rowCount } = await db.query('UPDATE permit_applications SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [ApplicationStatus.PAYMENT_RECEIVED, applicationId]);
    if (rowCount === 0) throw new Error('Application not found during update.');
    logger.info(`--- TEMP DEV: Application ${applicationId} status updated to PAYMENT_RECEIVED ---`); // Use info


    // Trigger Puppeteer Asynchronously
    setImmediate(async () => {
      try {
        logger.info(`--- Triggering Puppeteer job for application ${applicationId}... ---`); // Use info
        await puppeteerService.generatePermit(applicationId);
        logger.info(`--- Puppeteer job function called for application ${applicationId}. Check service logs. ---`); // Use info
      } catch (puppeteerError) {
        logger.error(`--- FATAL error trying to trigger Puppeteer job for application ${applicationId}:`, puppeteerError); // Use error, pass object
        // Optionally update status to indicate trigger failure?
      }
    });

    res.status(200).json({ message: `Application ${applicationId} marked as PAYMENT_RECEIVED (TEMP). Permit generation triggered.` });

  } catch (error) {
    logger.error(`Error in TEMP_mark_paid for ${applicationId}:`, error); // Pass error
    next(error); // Pass to global handler
  }
};