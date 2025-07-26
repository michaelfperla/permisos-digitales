// src/templates/email/bulk-operation-complete.template.js

module.exports = {
  subject: 'Operación masiva completada - Permisos Digitales',
  
  html: (data) => {
    const { operationType, totalProcessed, succeeded, failed, operationId } = data;
    
    const successRate = totalProcessed > 0 
      ? ((succeeded / totalProcessed) * 100).toFixed(2) 
      : 0;
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Operación Masiva Completada</title>
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
            background-color: #2c3e50;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 5px 5px 0 0;
        }
        .content {
            background-color: #f9f9f9;
            padding: 30px;
            border-radius: 0 0 5px 5px;
            border: 1px solid #ddd;
            border-top: none;
        }
        .stats-container {
            background-color: white;
            padding: 20px;
            margin: 20px 0;
            border-radius: 5px;
            border: 1px solid #e0e0e0;
        }
        .stat-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #f0f0f0;
        }
        .stat-row:last-child {
            border-bottom: none;
        }
        .stat-label {
            font-weight: bold;
            color: #555;
        }
        .stat-value {
            color: #333;
        }
        .success-value {
            color: #27ae60;
            font-weight: bold;
        }
        .failed-value {
            color: #e74c3c;
            font-weight: bold;
        }
        .warning-box {
            background-color: #fff3cd;
            border: 1px solid #ffeaa7;
            color: #856404;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
        }
        .operation-id {
            background-color: #e8e8e8;
            padding: 5px 10px;
            border-radius: 3px;
            font-family: monospace;
            font-size: 14px;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            color: #666;
            font-size: 14px;
        }
        .button {
            display: inline-block;
            padding: 10px 20px;
            background-color: #3498db;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin-top: 20px;
        }
        .button:hover {
            background-color: #2980b9;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Operación Masiva Completada</h1>
    </div>
    
    <div class="content">
        <h2>Resumen de la Operación</h2>
        
        <p>La operación masiva de <strong>${operationType}</strong> ha sido completada.</p>
        
        <div class="stats-container">
            <div class="stat-row">
                <span class="stat-label">ID de Operación:</span>
                <span class="operation-id">${operationId}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Total Procesados:</span>
                <span class="stat-value">${totalProcessed}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Exitosos:</span>
                <span class="success-value">${succeeded}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Fallidos:</span>
                <span class="failed-value">${failed}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Tasa de Éxito:</span>
                <span class="stat-value">${successRate}%</span>
            </div>
        </div>
        
        ${failed > 0 ? `
        <div class="warning-box">
            <strong>⚠️ Atención:</strong> ${failed} elemento(s) no pudieron ser procesados. 
            Por favor, revise los logs del sistema para más detalles sobre los errores.
        </div>
        ` : ''}
        
        <p>Para ver más detalles sobre esta operación, puede consultar el estado usando el ID de operación proporcionado.</p>
        
        <center>
            <a href="${process.env.ADMIN_PORTAL_URL || 'https://admin.permisosdigitales.com.mx'}" class="button">
                Ir al Panel de Administración
            </a>
        </center>
    </div>
    
    <div class="footer">
        <p>Este es un correo automático del sistema de Permisos Digitales.</p>
        <p>Por favor, no responda a este mensaje.</p>
    </div>
</body>
</html>
    `;
  },
  
  text: (data) => {
    const { operationType, totalProcessed, succeeded, failed, operationId } = data;
    
    const successRate = totalProcessed > 0 
      ? ((succeeded / totalProcessed) * 100).toFixed(2) 
      : 0;
    
    return `
Operación Masiva Completada
===========================

La operación masiva de ${operationType} ha sido completada.

Resumen de la Operación:
-----------------------
ID de Operación: ${operationId}
Total Procesados: ${totalProcessed}
Exitosos: ${succeeded}
Fallidos: ${failed}
Tasa de Éxito: ${successRate}%

${failed > 0 ? `
ATENCIÓN: ${failed} elemento(s) no pudieron ser procesados.
Por favor, revise los logs del sistema para más detalles sobre los errores.
` : ''}

Para ver más detalles sobre esta operación, puede consultar el estado usando el ID de operación proporcionado.

--
Este es un correo automático del sistema de Permisos Digitales.
Por favor, no responda a este mensaje.
    `;
  }
};