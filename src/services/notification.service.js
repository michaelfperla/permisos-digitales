/**
 * Notification Service
 * Handles sending notifications to users through various channels
 */
const { logger } = require('../utils/enhanced-logger');
const emailService = require('./email.service');
const config = require('../config');
const { formatDate, formatCurrency } = require('../utils/formatters');

/**
 * Send an OXXO payment expiration reminder
 * @param {Object} paymentDetails - Payment details
 * @param {number} paymentDetails.application_id - Application ID
 * @param {string} paymentDetails.user_email - User email
 * @param {string} paymentDetails.first_name - User first name
 * @param {string} paymentDetails.last_name - User last name
 * @param {string} paymentDetails.oxxo_reference - OXXO reference number
 * @param {number} paymentDetails.expires_at - Expiration timestamp (Unix timestamp)
 * @param {string} paymentDetails.expires_at_date - Formatted expiration date
 * @param {number} paymentDetails.amount - Payment amount
 * @param {string} paymentDetails.marca - Vehicle make
 * @param {string} paymentDetails.linea - Vehicle model
 * @param {string} paymentDetails.ano_modelo - Vehicle year
 * @returns {Promise<boolean>} - True if notification was sent successfully
 */
async function sendOxxoExpirationReminder(paymentDetails) {
  try {
    logger.debug(`Sending OXXO expiration reminder for application ${paymentDetails.application_id}`);

    // Format expiration date and time for display
    const expirationDate = new Date(paymentDetails.expires_at * 1000);
    const formattedDate = formatDate(expirationDate);
    const formattedTime = expirationDate.toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit'
    });
    
    // Format amount
    const formattedAmount = formatCurrency(paymentDetails.amount);
    
    // Get user's name or use a default
    const userName = paymentDetails.first_name 
      ? `${paymentDetails.first_name} ${paymentDetails.last_name || ''}`.trim()
      : 'Estimado usuario';
    
    // Vehicle description
    const vehicleDescription = `${paymentDetails.marca} ${paymentDetails.linea} ${paymentDetails.ano_modelo}`;

    // Construct the payment URL
    const paymentUrl = `${config.frontendUrl}/applications/${paymentDetails.application_id}/payment`;

    // Send email notification
    const emailSent = await emailService.sendEmail({
      to: paymentDetails.user_email,
      subject: 'Tu referencia de pago OXXO está por vencer',
      text: `
Hola ${userName},

Tu referencia de pago OXXO para el trámite de Permiso de Circulación está por vencer.

Detalles del pago:
- Referencia OXXO: ${paymentDetails.oxxo_reference}
- Monto: ${formattedAmount}
- Vence: ${formattedDate} a las ${formattedTime}
- Vehículo: ${vehicleDescription}

Para realizar tu pago, visita cualquier tienda OXXO antes de la fecha de vencimiento y proporciona la referencia.

También puedes acceder a los detalles de pago en:
${paymentUrl}

Si ya realizaste el pago, por favor ignora este mensaje.

Gracias,
Equipo de Permisos Digitales
`,
      html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tu referencia de pago OXXO está por vencer</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background-color: #852d2d;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 5px 5px 0 0;
        }
        .content {
            padding: 20px;
            border: 1px solid #ddd;
            border-top: none;
            border-radius: 0 0 5px 5px;
        }
        .payment-details {
            background-color: #f9f9f9;
            padding: 15px;
            border-radius: 5px;
            margin: 15px 0;
        }
        .button {
            display: inline-block;
            background-color: #a72b31;
            color: white;
            padding: 12px 25px;
            text-decoration: none;
            border-radius: 4px;
            margin: 15px 0;
            font-weight: bold;
        }
        .button:hover {
            background-color: #852d2d;
        }
        .footer {
            margin-top: 20px;
            text-align: center;
            font-size: 12px;
            color: #777;
        }
    </style>
</head>
<body>
    <div class="header">
        <h2>Permisos Digitales</h2>
    </div>
    <div class="content">
        <h3>Tu referencia de pago OXXO está por vencer</h3>
        <p>Hola ${userName},</p>
        <p>Tu referencia de pago OXXO para el trámite de Permiso de Circulación está por vencer.</p>
        
        <div class="payment-details">
            <p><strong>Referencia OXXO:</strong> ${paymentDetails.oxxo_reference}</p>
            <p><strong>Monto:</strong> ${formattedAmount}</p>
            <p><strong>Vence:</strong> ${formattedDate} a las ${formattedTime}</p>
            <p><strong>Vehículo:</strong> ${vehicleDescription}</p>
        </div>
        
        <p>Para realizar tu pago, visita cualquier tienda OXXO antes de la fecha de vencimiento y proporciona la referencia.</p>
        
        <p>También puedes acceder a los detalles de pago en nuestra plataforma:</p>
        <div style="text-align: center;">
            <a href="${paymentUrl}" class="button">Ver detalles de pago</a>
        </div>
        
        <p>Si ya realizaste el pago, por favor ignora este mensaje.</p>
    </div>
    <div class="footer">
        <p>Este es un correo automático, por favor no respondas a este mensaje.</p>
        <p>&copy; ${new Date().getFullYear()} Permisos Digitales. Todos los derechos reservados.</p>
    </div>
</body>
</html>
      `
    });

    if (emailSent) {
      logger.info(`OXXO expiration reminder sent to ${paymentDetails.user_email} for application ${paymentDetails.application_id}`);
    } else {
      logger.warn(`Failed to send OXXO expiration reminder to ${paymentDetails.user_email} for application ${paymentDetails.application_id}`);
    }

    return emailSent;
  } catch (error) {
    logger.error(`Error sending OXXO expiration reminder for application ${paymentDetails.application_id}:`, {
      error: error.message,
      applicationId: paymentDetails.application_id,
      userEmail: paymentDetails.user_email
    });
    return false;
  }
}

/**
 * Send a permit expiration reminder
 * @param {Object} permitDetails - Permit details
 * @param {number} permitDetails.application_id - Application ID
 * @param {string} permitDetails.user_email - User email
 * @param {string} permitDetails.first_name - User first name
 * @param {string} permitDetails.last_name - User last name
 * @param {string} permitDetails.folio - Permit folio number
 * @param {string} permitDetails.marca - Vehicle make
 * @param {string} permitDetails.linea - Vehicle model
 * @param {string} permitDetails.ano_modelo - Vehicle year
 * @param {string} permitDetails.fecha_vencimiento - Expiration date
 * @param {number} permitDetails.days_remaining - Days until expiration
 * @returns {Promise<boolean>} - True if notification was sent successfully
 */
async function sendPermitExpirationReminder(permitDetails) {
  try {
    logger.debug(`Sending permit expiration reminder for application ${permitDetails.application_id}`);

    // Format expiration date for display
    const expirationDate = new Date(permitDetails.fecha_vencimiento);
    const formattedDate = formatDate(expirationDate);

    // Get user's name or use a default
    const userName = permitDetails.first_name
      ? `${permitDetails.first_name} ${permitDetails.last_name || ''}`.trim()
      : 'Estimado usuario';

    // Vehicle description
    const vehicleDescription = `${permitDetails.marca} ${permitDetails.linea} ${permitDetails.ano_modelo}`;

    // Construct the renewal URL
    const renewalUrl = `${config.frontendUrl}/applications/${permitDetails.application_id}/renew`;

    // Prepare email details
    const emailDetails = {
      userName,
      folio: permitDetails.folio || `APP-${permitDetails.application_id}`,
      vehicleDescription,
      expirationDate: formattedDate,
      daysRemaining: permitDetails.days_remaining,
      renewalUrl
    };

    // Send email notification
    const emailSent = await emailService.sendPermitExpirationReminder(
      permitDetails.user_email,
      emailDetails
    );

    if (emailSent) {
      logger.info(`Permit expiration reminder sent to ${permitDetails.user_email} for application ${permitDetails.application_id}`);
    } else {
      logger.warn(`Failed to send permit expiration reminder to ${permitDetails.user_email} for application ${permitDetails.application_id}`);
    }

    return emailSent;
  } catch (error) {
    logger.error(`Error sending permit expiration reminder for application ${permitDetails.application_id}:`, {
      error: error.message,
      applicationId: permitDetails.application_id,
      userEmail: permitDetails.user_email
    });
    return false;
  }
}

module.exports = {
  sendOxxoExpirationReminder,
  sendPermitExpirationReminder
};
