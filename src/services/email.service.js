// src/services/email.service.js
const nodemailer = require('nodemailer');
const mailgunTransport = require('nodemailer-mailgun-transport');
const config = require('../config');
const { logger } = require('../utils/enhanced-logger');

// Create a transporter object
let transporter;

// Initialize the email transporter
function initTransporter() {
  if (transporter) return;

  // Check if Mailgun configuration is available
  if (config.mailgunApiKey && config.mailgunDomain) {
    // Configure Mailgun transport
    const mailgunOptions = {
      auth: {
        api_key: config.mailgunApiKey,
        domain: config.mailgunDomain
      }
    };

    transporter = nodemailer.createTransport(mailgunTransport(mailgunOptions));
    logger.info('Email service initialized with Mailgun transport');
    return;
  }

  // Fall back to SMTP if Mailgun is not configured
  // Check if SMTP configuration is available
  if (!config.emailHost || !config.emailPort || !config.emailUser || !config.emailPass) {
    logger.warn('Email configuration is incomplete. Email functionality will be disabled.');
    return;
  }

  transporter = nodemailer.createTransport({
    host: config.emailHost,
    port: config.emailPort,
    secure: config.emailPort === 465, // true for 465, false for other ports
    auth: {
      user: config.emailUser,
      pass: config.emailPass,
    },
  });

  logger.info('Email service initialized with SMTP transport');
}

/**
 * Send a password reset email
 * @param {string} to - Recipient email address
 * @param {string} resetToken - Password reset token
 * @param {string} resetUrl - URL for password reset page
 * @returns {Promise<boolean>} - True if email was sent successfully
 */
async function sendPasswordResetEmail(to, resetToken, resetUrl) {
  try {
    // Construct the reset URL with token
    // Remove any non-hex characters from the token to ensure compatibility
    const cleanToken = resetToken.replace(/[^a-fA-F0-9]/g, '');
    const fullResetUrl = `${resetUrl}?token=${cleanToken}`;

    // Email content
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

module.exports = {
  sendPasswordResetEmail,
  sendEmailVerificationEmail,
  sendEmail,
  initTransporter,
  _setTransporterForTesting // Only used in tests
};
