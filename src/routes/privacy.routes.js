/**
 * Privacy Routes for Data Export and GDPR Compliance
 */

const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const ApiResponse = require('../utils/api-response');
const db = require('../db');

/**
 * GET /api/privacy/export/:token
 * Download exported user data using a secure token
 */
router.get('/export/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    if (!token || typeof token !== 'string' || token.length < 32) {
      return ApiResponse.error(res, 'Invalid or missing token', 400);
    }
    
    // Retrieve data from database
    // Note: export_data is JSONB, so we cast it to text for parsing
    const query = `
      SELECT user_id, export_data::text as export_data, accessed_at, expires_at
      FROM privacy_export_tokens
      WHERE token = $1
      AND expires_at > NOW()
      AND accessed_at IS NULL
    `;
    
    const result = await db.query(query, [token]);
    
    if (!result.rows[0]) {
      return ApiResponse.error(res, 'Export link has expired, already been used, or is invalid', 404);
    }
    
    const exportRecord = result.rows[0];
    
    // Parse the data
    let userData;
    try {
      userData = JSON.parse(exportRecord.export_data);
    } catch (parseError) {
      logger.error('Error parsing export data', { error: parseError.message, token });
      return ApiResponse.error(res, 'Invalid export data', 500);
    }
    
    // Mark as accessed (one-time use) and record IP for audit
    const updateQuery = `
      UPDATE privacy_export_tokens 
      SET accessed_at = NOW(), 
          ip_address = $2
      WHERE token = $1
    `;
    await db.query(updateQuery, [token, req.ip]);
    
    // Log the export access
    logger.info('Privacy data export accessed', {
      userId: userData.userId,
      exportDate: userData.data.exportDate,
      token: token.substring(0, 8) + '...' // Log partial token for security
    });
    
    // Generate human-readable HTML report
    const htmlReport = generateHtmlReport(userData);
    
    // Set headers for HTML display
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Send the HTML report
    res.send(htmlReport);
    
  } catch (error) {
    logger.error('Error in privacy data export', { error: error.message });
    return ApiResponse.error(res, 'Failed to retrieve export data', 500);
  }
});

/**
 * GET /api/privacy/status
 * Check privacy settings and data retention status
 */
router.get('/status/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // This endpoint could be protected with authentication
    // For now, it's a placeholder for future privacy status checks
    
    return ApiResponse.success(res, {
      message: 'Privacy status endpoint - implementation pending',
      userId
    });
    
  } catch (error) {
    logger.error('Error checking privacy status', { error: error.message });
    return ApiResponse.error(res, 'Failed to check privacy status', 500);
  }
});

/**
 * Generate human-readable HTML report
 */
function generateHtmlReport(userData) {
  const user = userData.data.user || {};
  const applications = userData.data.applications || [];
  const payments = userData.data.payments || [];
  const exportDate = new Date(userData.data.exportDate).toLocaleString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mis Datos - Permisos Digitales</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
            padding: 20px;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: #2563eb;
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            font-size: 28px;
            margin-bottom: 10px;
        }
        .header p {
            opacity: 0.9;
            font-size: 14px;
        }
        .content {
            padding: 30px;
        }
        .section {
            margin-bottom: 40px;
        }
        .section h2 {
            color: #1f2937;
            font-size: 20px;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #e5e7eb;
        }
        .info-grid {
            display: grid;
            gap: 15px;
        }
        .info-item {
            display: flex;
            padding: 12px;
            background: #f9fafb;
            border-radius: 6px;
        }
        .info-label {
            font-weight: 600;
            color: #6b7280;
            min-width: 150px;
        }
        .info-value {
            color: #1f2937;
        }
        .empty-state {
            text-align: center;
            padding: 40px;
            color: #9ca3af;
            background: #f9fafb;
            border-radius: 6px;
        }
        .permit-card {
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 15px;
            background: #f9fafb;
        }
        .permit-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 15px;
        }
        .permit-title {
            font-weight: 600;
            color: #1f2937;
        }
        .permit-status {
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
        }
        .status-active {
            background: #d1fae5;
            color: #065f46;
        }
        .status-expired {
            background: #fee2e2;
            color: #991b1b;
        }
        .status-pending {
            background: #fef3c7;
            color: #92400e;
        }
        .vehicle-info {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
            margin-top: 10px;
        }
        .vehicle-detail {
            font-size: 14px;
            color: #6b7280;
        }
        .footer {
            background: #f9fafb;
            padding: 20px;
            text-align: center;
            color: #6b7280;
            font-size: 14px;
        }
        .download-btn {
            display: inline-block;
            margin-top: 20px;
            padding: 12px 24px;
            background: #2563eb;
            color: white;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
        }
        .download-btn:hover {
            background: #1d4ed8;
        }
        @media (max-width: 600px) {
            .vehicle-info {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🛡️ Tus Datos Personales</h1>
            <p>Reporte generado el ${exportDate}</p>
        </div>
        
        <div class="content">
            <!-- Personal Information -->
            <div class="section">
                <h2>👤 Información Personal</h2>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">Nombre:</span>
                        <span class="info-value">${user.first_name || ''} ${user.last_name || ''}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Email:</span>
                        <span class="info-value">${user.email || 'No registrado'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">WhatsApp:</span>
                        <span class="info-value">${user.whatsapp_phone || 'No registrado'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Fecha de registro:</span>
                        <span class="info-value">${user.created_at ? new Date(user.created_at).toLocaleDateString('es-MX') : 'No disponible'}</span>
                    </div>
                </div>
            </div>

            <!-- Permit Applications -->
            <div class="section">
                <h2>🚗 Historial de Permisos</h2>
                ${applications.length > 0 ? applications.map(app => `
                    <div class="permit-card">
                        <div class="permit-header">
                            <span class="permit-title">${app.marca} ${app.linea} ${app.ano_modelo}</span>
                            <span class="permit-status ${
                                app.status === 'COMPLETED' && app.fecha_vencimiento && new Date(app.fecha_vencimiento) > new Date() ? 'status-active' :
                                app.status === 'COMPLETED' ? 'status-expired' : 'status-pending'
                            }">
                                ${app.status === 'COMPLETED' ? 'Completado' : 'Pendiente'}
                            </span>
                        </div>
                        <div class="vehicle-info">
                            <div class="vehicle-detail">
                                <strong>Color:</strong> ${app.color}
                            </div>
                            <div class="vehicle-detail">
                                <strong>Placas:</strong> ${app.numero_serie}
                            </div>
                            ${app.fecha_expedicion ? `
                            <div class="vehicle-detail">
                                <strong>Expedición:</strong> ${new Date(app.fecha_expedicion).toLocaleDateString('es-MX')}
                            </div>
                            ` : ''}
                            ${app.fecha_vencimiento ? `
                            <div class="vehicle-detail">
                                <strong>Vencimiento:</strong> ${new Date(app.fecha_vencimiento).toLocaleDateString('es-MX')}
                            </div>
                            ` : ''}
                        </div>
                    </div>
                `).join('') : `
                    <div class="empty-state">
                        <p>No tienes permisos registrados</p>
                    </div>
                `}
            </div>

            <!-- Payment History -->
            <div class="section">
                <h2>💳 Historial de Pagos</h2>
                ${payments.length > 0 ? `
                    <div class="info-grid">
                        ${payments.map(payment => `
                            <div class="info-item">
                                <span class="info-label">${new Date(payment.created_at).toLocaleDateString('es-MX')}:</span>
                                <span class="info-value">$${payment.amount || '99.00'} MXN - ${payment.event_type}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <div class="empty-state">
                        <p>No tienes pagos registrados</p>
                    </div>
                `}
            </div>

            <!-- Download Options -->
            <div class="section" style="text-align: center;">
                <h2>📥 Opciones de Descarga</h2>
                <p style="margin-bottom: 20px; color: #6b7280;">
                    Puedes guardar este reporte para tus registros
                </p>
                <a href="#" onclick="window.print(); return false;" class="download-btn">
                    🖨️ Imprimir o Guardar como PDF
                </a>
            </div>
        </div>
        
        <div class="footer">
            <p>Este reporte contiene toda la información que Permisos Digitales tiene sobre ti.</p>
            <p style="margin-top: 10px;">
                Si tienes preguntas, contáctanos en: 
                <a href="mailto:soporte@permisosdigitales.com.mx" style="color: #2563eb;">soporte@permisosdigitales.com.mx</a>
            </p>
        </div>
    </div>
</body>
</html>
  `;
}

module.exports = router;