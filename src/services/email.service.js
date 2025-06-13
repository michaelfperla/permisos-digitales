const nodemailer = require('nodemailer');
const config = require('../config');
const { logger } = require('../utils/enhanced-logger');

let transporter;

function initTransporter() {
  if (transporter) return;

  if (!config.emailHost || !config.emailPort || !config.emailUser || !config.emailPass) {
    logger.warn('SMTP email configuration is incomplete. Email functionality will be disabled.');
    return;
  }

  transporter = nodemailer.createTransport({
    host: config.emailHost,
    port: config.emailPort,
    secure: config.emailPort === 465,
    auth: {
      user: config.emailUser,
      pass: config.emailPass,
    },
  });

  logger.info('Email service initialized with SMTP transport');
}

async function sendPasswordResetEmail(to, resetToken, resetUrl) {
  try {
    const cleanToken = resetToken.replace(/[^a-fA-F0-9]/g, '');
    const fullResetUrl = `${resetUrl}?token=${cleanToken}`;

    return await sendEmail({
      to,
      subject: 'Cambia tu contraseña de Permisos Digitales',
      text: `
Hola,

Pediste cambiar tu contraseña en Permisos Digitales.

Para continuar, haz clic en el siguiente link o cópialo y pégalo en tu navegador:

${fullResetUrl}

Este link expirará en 1 hora por seguridad.

Si no pediste cambiar tu contraseña, puedes ignorar este correo.

Saludos,
El equipo de Permisos Digitales
      `,
      html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Restablecimiento de Contraseña</title>
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
            text-align: center;
            margin-bottom: 20px;
        }
        .logo {
            max-width: 200px;
            margin-bottom: 10px;
        }
        .content {
            background-color: #f9f9f9;
            padding: 20px;
            border-radius: 5px;
        }
        .button {
            display: inline-block;
            background-color: #A72B31;
            color: white;
            text-decoration: none;
            padding: 10px 20px;
            border-radius: 5px;
            margin: 20px 0;
        }
        .footer {
            margin-top: 20px;
            font-size: 12px;
            color: #666;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="header">
        <h2>Permisos Digitales</h2>
    </div>
    <div class="content">
        <h3>Cambiar Contraseña</h3>
        <p>Hola,</p>
        <p>Pediste cambiar tu contraseña en Permisos Digitales.</p>
        <p>Para continuar, haz clic en el siguiente botón:</p>
        <div style="text-align: center;">
            <a href="${fullResetUrl}" class="button">Cambiar contraseña</a>
        </div>
        <p>O copia y pega el siguiente link en tu navegador:</p>
        <p><a href="${fullResetUrl}">${fullResetUrl}</a></p>
        <p>Este link expirará en 1 hora por seguridad.</p>
        <p>Si no pediste cambiar tu contraseña, puedes ignorar este correo.</p>
    </div>
    <div class="footer">
        <p>Este es un correo automático, por favor no respondas a este mensaje.</p>
        <p>&copy; ${new Date().getFullYear()} Permisos Digitales. Todos los derechos reservados.</p>
    </div>
</body>
</html>
      `
    });
  } catch (error) {
    logger.error(`Error sending password reset email to ${to}:`, error);
    return false;
  }
}

/**
 * Send a generic email
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text email content
 * @param {string} options.html - HTML email content
 * @param {string} [options.from] - Sender email address (defaults to config.emailFrom)
 * @returns {Promise<boolean>} - True if email was sent successfully
 */
async function sendEmail(options) {
  try {
    // Initialize transporter if not already done
    initTransporter();

    // If transporter is not available, log warning and return
    if (!transporter) {
      logger.warn(`Cannot send email to ${options.to}: Email service not configured`);
      return false;
    }

    // Set default from address if not provided
    const mailOptions = {
      ...options,
      from: options.from || `"Permisos Digitales" <${config.emailFrom}>`
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);
    logger.info(`Email sent to ${options.to}: ${info.messageId}`);
    return true;
  } catch (error) {
    logger.error(`Error sending email to ${options.to}:`, error);
    return false;
  }
}

// For testing purposes only
function _setTransporterForTesting(testTransporter) {
  transporter = testTransporter;
}

/**
 * Send an email verification email
 * @param {string} to - Recipient email address
 * @param {string} verificationToken - Email verification token
 * @param {string} verificationUrl - URL for email verification page
 * @returns {Promise<boolean>} - True if email was sent successfully
 */
async function sendEmailVerificationEmail(to, verificationToken, verificationUrl) {
  try {
    // Construct the verification URL with token
    const fullVerificationUrl = `${verificationUrl}?token=${verificationToken}`;

    // Email content
    return await sendEmail({
      to,
      subject: 'Verifica tu dirección de correo electrónico',
      text: `
Hola,

Gracias por registrarte en Permisos Digitales.

Para verificar tu dirección de correo electrónico, haz clic en el siguiente link o cópialo y pégalo en tu navegador:

${fullVerificationUrl}

Este link expirará en 24 horas por seguridad.

Si no creaste una cuenta en Permisos Digitales, puedes ignorar este correo.

Saludos,
El equipo de Permisos Digitales
      `,
      html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verificación de Correo Electrónico</title>
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
            text-align: center;
            margin-bottom: 20px;
        }
        .logo {
            max-width: 200px;
            margin-bottom: 10px;
        }
        .content {
            background-color: #f9f9f9;
            padding: 20px;
            border-radius: 5px;
        }
        .button {
            display: inline-block;
            background-color: #A72B31;
            color: white;
            text-decoration: none;
            padding: 10px 20px;
            border-radius: 5px;
            margin: 20px 0;
        }
        .footer {
            margin-top: 20px;
            font-size: 12px;
            color: #666;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="header">
        <h2>Permisos Digitales</h2>
    </div>
    <div class="content">
        <h3>Verificación de Correo Electrónico</h3>
        <p>Hola,</p>
        <p>Gracias por registrarte en Permisos Digitales.</p>
        <p>Para verificar tu dirección de correo electrónico, haz clic en el siguiente botón:</p>
        <div style="text-align: center;">
            <a href="${fullVerificationUrl}" class="button">Verificar correo electrónico</a>
        </div>
        <p>O copia y pega el siguiente link en tu navegador:</p>
        <p><a href="${fullVerificationUrl}">${fullVerificationUrl}</a></p>
        <p>Este link expirará en 24 horas por seguridad.</p>
        <p>Si no creaste una cuenta en Permisos Digitales, puedes ignorar este correo.</p>
    </div>
    <div class="footer">
        <p>Este es un correo automático, por favor no respondas a este mensaje.</p>
        <p>&copy; ${new Date().getFullYear()} Permisos Digitales. Todos los derechos reservados.</p>
    </div>
</body>
</html>
      `
    });
  } catch (error) {
    logger.error(`Error sending email verification email to ${to}:`, error);
    return false;
  }
}

/**
 * Send a permit expiration reminder email
 * @param {string} to - Recipient email address
 * @param {Object} permitDetails - Permit details
 * @param {string} permitDetails.userName - User's full name
 * @param {string} permitDetails.folio - Permit folio number
 * @param {string} permitDetails.vehicleDescription - Vehicle description (make, model, year)
 * @param {string} permitDetails.expirationDate - Formatted expiration date
 * @param {number} permitDetails.daysRemaining - Days until expiration
 * @param {string} permitDetails.renewalUrl - URL to renew the permit
 * @returns {Promise<boolean>} - True if email was sent successfully
 */
async function sendPermitExpirationReminder(to, permitDetails) {
  try {
    const {
      userName,
      folio,
      vehicleDescription,
      expirationDate,
      daysRemaining,
      renewalUrl
    } = permitDetails;

    // Determine urgency level and messaging
    const isUrgent = daysRemaining <= 3;
    const urgencyText = isUrgent ? '¡URGENTE!' : 'Recordatorio';
    const daysText = daysRemaining === 1 ? 'día' : 'días';

    const subject = `${urgencyText} Tu permiso de circulación vence en ${daysRemaining} ${daysText}`;

    // Email content
    return await sendEmail({
      to,
      subject,
      text: `
Hola ${userName},

${isUrgent ? '¡ATENCIÓN! ' : ''}Tu permiso de circulación está por vencer.

Detalles del permiso:
Folio: ${folio}
Vehículo: ${vehicleDescription}
Fecha de vencimiento: ${expirationDate}
Días restantes: ${daysRemaining} ${daysText}

${isUrgent ?
  'Es importante que renueves tu permiso antes de que expire para evitar multas o problemas legales.' :
  'Te recomendamos renovar tu permiso con anticipación para evitar inconvenientes.'
}

Para renovar tu permiso, visita nuestra plataforma:
${renewalUrl}

El proceso de renovación es rápido y sencillo. Solo necesitas actualizar la información de tu vehículo y realizar el pago correspondiente.

Si ya renovaste tu permiso, puedes ignorar este mensaje.

Saludos,
El equipo de Permisos Digitales
      `,
      html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Recordatorio de Vencimiento de Permiso</title>
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
            background-color: ${isUrgent ? '#d32f2f' : '#852d2d'};
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
        .permit-details {
            background-color: #f9f9f9;
            padding: 15px;
            border-radius: 5px;
            margin: 15px 0;
            border-left: 4px solid ${isUrgent ? '#d32f2f' : '#A72B31'};
        }
        .button {
            display: inline-block;
            background-color: #A72B31;
            color: white;
            text-decoration: none;
            padding: 12px 24px;
            border-radius: 5px;
            margin: 20px 0;
            font-weight: bold;
        }
        .urgent-notice {
            background-color: #ffebee;
            border: 1px solid #d32f2f;
            padding: 15px;
            border-radius: 5px;
            margin: 15px 0;
            color: #d32f2f;
            font-weight: bold;
        }
        .footer {
            margin-top: 20px;
            font-size: 12px;
            color: #666;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="header">
        <h2>Permisos Digitales</h2>
        <h3>${urgencyText} - Vencimiento de Permiso</h3>
    </div>
    <div class="content">
        <p>Hola ${userName},</p>

        ${isUrgent ? `
        <div class="urgent-notice">
            ¡ATENCIÓN! Tu permiso de circulación vence en solo ${daysRemaining} ${daysText}.
            Es importante que lo renueves inmediatamente para evitar multas.
        </div>
        ` : `
        <p>Tu permiso de circulación está próximo a vencer. Te recomendamos renovarlo con anticipación.</p>
        `}

        <div class="permit-details">
            <p><strong>Folio del Permiso:</strong> ${folio}</p>
            <p><strong>Vehículo:</strong> ${vehicleDescription}</p>
            <p><strong>Fecha de Vencimiento:</strong> ${expirationDate}</p>
            <p><strong>Días Restantes:</strong> ${daysRemaining} ${daysText}</p>
        </div>

        <p>El proceso de renovación es rápido y sencillo. Solo necesitas actualizar la información de tu vehículo y realizar el pago correspondiente.</p>

        <div style="text-align: center;">
            <a href="${renewalUrl}" class="button">Renovar Permiso Ahora</a>
        </div>

        <p>Si ya renovaste tu permiso, puedes ignorar este mensaje.</p>
    </div>
    <div class="footer">
        <p>Este es un correo automático, por favor no respondas a este mensaje.</p>
        <p>&copy; ${new Date().getFullYear()} Permisos Digitales. Todos los derechos reservados.</p>
    </div>
</body>
</html>
      `
    });
  } catch (error) {
    logger.error(`Error sending permit expiration reminder to ${to}:`, error);
    return false;
  }
}

module.exports = {
  sendPasswordResetEmail,
  sendEmailVerificationEmail,
  sendPermitExpirationReminder,
  sendEmail,
  initTransporter,
  _setTransporterForTesting // Only used in tests
};
