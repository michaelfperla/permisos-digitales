/**
 * OXXO Payment Reminder Email Template
 * Generates HTML and text versions of the OXXO payment expiration reminder
 */

const { formatDate, formatCurrency } = require('../../utils/formatters');
const { generateHtmlEmail } = require('./base.template');
const { escapeHtml } = require('../../utils/html-escape');
const { logger } = require('../../utils/logger');

/**
 * Generate the email content for OXXO payment reminder
 * @param {Object} data - Template data
 * @returns {Object} Email content with subject, text, and html
 */
function render(data) {
  try {
    // Validate required fields
    if (!data) {
      throw new Error('Template data is required');
    }
    
    if (!data.expires_at) {
      throw new Error('Expiration timestamp (expires_at) is required');
    }
    
    if (!data.application_id) {
      throw new Error('Application ID is required');
    }
    
    // Format data for display with safe defaults
    const expirationDate = new Date(data.expires_at * 1000);
    if (isNaN(expirationDate.getTime())) {
      throw new Error('Invalid expiration timestamp');
    }
    
    const formattedDate = formatDate(expirationDate);
    const formattedTime = expirationDate.toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit'
    });
    const formattedAmount = formatCurrency(data.amount || 0);
    
    // Get user's name or use a default
    const userName = data.first_name 
      ? `${data.first_name} ${data.last_name || ''}`.trim()
      : 'Estimado usuario';
    
    // Vehicle description with safe defaults
    const vehicleDescription = [
      data.marca || 'Marca no especificada',
      data.linea || 'Línea no especificada',
      data.ano_modelo || 'Año no especificado'
    ].join(' ');

    // Construct the payment URL with fallback
    const baseUrl = data.frontendUrl || 'https://permisos-digitales.mx';
    const paymentUrl = `${baseUrl}/applications/${data.application_id}/payment`;

    return {
      subject: 'Tu referencia de pago OXXO está por vencer',
      text: generateTextVersion({
        userName,
        oxxoReference: data.oxxo_reference || 'REF-NO-DISPONIBLE',
        formattedAmount,
        formattedDate,
        formattedTime,
        vehicleDescription,
        paymentUrl
      }),
      html: generateHtmlVersion({
        userName,
        oxxoReference: data.oxxo_reference || 'REF-NO-DISPONIBLE',
        formattedAmount,
        formattedDate,
        formattedTime,
        vehicleDescription,
        paymentUrl
      })
    };
  } catch (error) {
    // Log the error and re-throw with more context
    logger.error('Error rendering OXXO reminder template:', {
      error: error.message,
      stack: error.stack,
      applicationId: data?.application_id
    });
    // Don't expose internal error details to the caller
    throw new Error('Failed to render OXXO reminder email template');
  }
}

/**
 * Generate plain text version of the email
 */
function generateTextVersion(data) {
  return `
Hola ${data.userName},

Tu referencia de pago OXXO para el trámite de Permiso de Circulación está por vencer.

Detalles del pago:
- Referencia OXXO: ${data.oxxoReference}
- Monto: ${data.formattedAmount}
- Vence: ${data.formattedDate} a las ${data.formattedTime}
- Vehículo: ${data.vehicleDescription}

Para realizar tu pago, visita cualquier tienda OXXO antes de la fecha de vencimiento y proporciona la referencia.

También puedes acceder a los detalles de pago en:
${data.paymentUrl}

Si ya realizaste el pago, por favor ignora este mensaje.

Gracias,
Equipo de Permisos Digitales
`;
}

/**
 * Generate HTML version of the email
 */
function generateHtmlVersion(data) {
  // Escape all user-provided data to prevent XSS
  const safeData = {
    userName: escapeHtml(data.userName),
    oxxoReference: escapeHtml(data.oxxoReference),
    formattedAmount: escapeHtml(data.formattedAmount),
    formattedDate: escapeHtml(data.formattedDate),
    formattedTime: escapeHtml(data.formattedTime),
    vehicleDescription: escapeHtml(data.vehicleDescription),
    // URLs in HTML attributes need both URL encoding AND HTML escaping
    paymentUrl: escapeHtml(encodeURI(data.paymentUrl))
  };
  
  const content = `
    <h3>Tu referencia de pago OXXO está por vencer</h3>
    <p>Hola ${safeData.userName},</p>
    <p>Tu referencia de pago OXXO para el trámite de Permiso de Circulación está por vencer.</p>
    
    <div class="info-box">
        <p><strong>Referencia OXXO:</strong> ${safeData.oxxoReference}</p>
        <p><strong>Monto:</strong> ${safeData.formattedAmount}</p>
        <p><strong>Vence:</strong> ${safeData.formattedDate} a las ${safeData.formattedTime}</p>
        <p><strong>Vehículo:</strong> ${safeData.vehicleDescription}</p>
    </div>
    
    <p>Para realizar tu pago, visita cualquier tienda OXXO antes de la fecha de vencimiento y proporciona la referencia.</p>
    
    <p>También puedes acceder a los detalles de pago en nuestra plataforma:</p>
    <div class="button-container">
        <a href="${safeData.paymentUrl}" class="button">Ver detalles de pago</a>
    </div>
    
    <p>Si ya realizaste el pago, por favor ignora este mensaje.</p>
  `;

  return generateHtmlEmail({
    title: 'Tu referencia de pago OXXO está por vencer',
    content
  });
}

module.exports = {
  render
};