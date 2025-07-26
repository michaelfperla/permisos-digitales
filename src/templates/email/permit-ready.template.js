/**
 * Permit Ready Email Template
 * Generates HTML and text versions of the permit ready notification
 */

const { formatDate } = require('../../utils/formatters');
const { generateHtmlEmail } = require('./base.template');
const { escapeHtml } = require('../../utils/html-escape');
const { logger } = require('../../utils/logger');

/**
 * Generate the email content for permit ready notification
 * @param {Object} data - Template data
 * @returns {Object} Email content with subject, text, and html
 */
function render(data) {
  try {
    // Validate required fields
    if (!data) {
      throw new Error('Template data is required');
    }
    
    if (!data.application_id) {
      throw new Error('Application ID is required');
    }
    
    if (!data.permit_folio) {
      throw new Error('Permit folio is required');
    }
    
    if (!data.permit_url_primary || !data.permit_url_secondary || !data.permit_url_placas) {
      throw new Error('All permit URLs are required');
    }
    
    const urlExpirationTime = data.url_expiration_hours || 48;
    
    // Get user's name or use a default
    const userName = data.first_name || 'Usuario';

    // Construct the dashboard URL with fallback
    const baseUrl = data.frontendUrl || 'https://permisosdigitales.com.mx';
    const dashboardUrl = `${baseUrl}/dashboard`;

    return {
      subject: `¡Tu permiso está listo! - Folio: ${data.permit_folio}`,
      text: generateTextVersion({
        userName,
        permitFolio: data.permit_folio,
        permitUrlPrimary: data.permit_url_primary,
        permitUrlSecondary: data.permit_url_secondary,
        permitUrlPlacas: data.permit_url_placas,
        urlExpirationTime,
        dashboardUrl
      }),
      html: generateHtmlVersion({
        userName,
        permitFolio: data.permit_folio,
        permitUrlPrimary: data.permit_url_primary,
        permitUrlSecondary: data.permit_url_secondary,
        permitUrlPlacas: data.permit_url_placas,
        urlExpirationTime,
        dashboardUrl
      })
    };
  } catch (error) {
    // Log the error and re-throw with more context
    logger.error('Error rendering permit ready template:', {
      error: error.message,
      stack: error.stack,
      applicationId: data?.application_id
    });
    // Don't expose internal error details to the caller
    throw new Error('Failed to render permit ready email template');
  }
}

/**
 * Generate plain text version of the email
 */
function generateTextVersion(data) {
  return `
Hola ${data.userName},

Tu permiso está listo - Folio: ${data.permitFolio}

Descarga tus documentos:
- Permiso: ${data.permitUrlPrimary}
- Certificado: ${data.permitUrlSecondary}
- Placas: ${data.permitUrlPlacas}

IMPORTANTE: Los enlaces expiran en ${data.urlExpirationTime} horas. 
Si expiran, descarga desde tu panel: ${data.dashboardUrl}

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
    permitFolio: escapeHtml(data.permitFolio),
    urlExpirationTime: escapeHtml(data.urlExpirationTime.toString()),
    // URLs in HTML attributes need both URL encoding AND HTML escaping
    permitUrlPrimary: escapeHtml(encodeURI(data.permitUrlPrimary)),
    permitUrlSecondary: escapeHtml(encodeURI(data.permitUrlSecondary)),
    permitUrlPlacas: escapeHtml(encodeURI(data.permitUrlPlacas)),
    dashboardUrl: escapeHtml(encodeURI(data.dashboardUrl))
  };
  
  const content = `
    <h3>Tu permiso está listo - Folio: ${safeData.permitFolio}</h3>
    <p>Hola ${safeData.userName},</p>
    
    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h4 style="margin-top: 0;">Descarga tus documentos:</h4>
        <p style="margin: 10px 0;">
            <a href="${safeData.permitUrlPrimary}" style="color: #007bff;">→ Descargar Permiso</a>
        </p>
        <p style="margin: 10px 0;">
            <a href="${safeData.permitUrlSecondary}" style="color: #007bff;">→ Descargar Certificado</a>
        </p>
        <p style="margin: 10px 0;">
            <a href="${safeData.permitUrlPlacas}" style="color: #007bff;">→ Descargar Placas</a>
        </p>
    </div>
    
    <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0;"><strong>⚠️ Los enlaces expiran en ${safeData.urlExpirationTime} horas.</strong></p>
        <p style="margin: 10px 0 0 0;">Si expiran, descarga desde tu <a href="${safeData.dashboardUrl}">panel de control</a>.</p>
    </div>
  `;

  return generateHtmlEmail({
    title: 'Tu permiso está listo',
    content
  });
}

module.exports = {
  render
};