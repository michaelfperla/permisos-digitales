// src/templates/email/admin-message.template.js

module.exports = {
  subject: (data) => data.subject || 'Mensaje importante de Permisos Digitales',
  
  html: (data) => {
    const { userName, message, adminName, adminEmail, timestamp } = data;
    const formattedDate = new Date(timestamp).toLocaleString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mensaje del Administrador</title>
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
        .message-box {
            background-color: white;
            padding: 20px;
            margin: 20px 0;
            border-radius: 5px;
            border: 1px solid #e0e0e0;
        }
        .message-content {
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        .sender-info {
            background-color: #ecf0f1;
            padding: 15px;
            border-radius: 5px;
            margin-top: 20px;
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
        .important-notice {
            background-color: #fff3cd;
            border: 1px solid #ffeaa7;
            color: #856404;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
            text-align: center;
        }
        a {
            color: #3498db;
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Mensaje del Administrador</h1>
    </div>
    
    <div class="content">
        <p>Estimado/a <strong>${userName}</strong>,</p>
        
        <p>Ha recibido un mensaje importante del equipo administrativo de Permisos Digitales:</p>
        
        <div class="message-box">
            <div class="message-content">${message}</div>
        </div>
        
        <div class="sender-info">
            <p><strong>Enviado por:</strong> ${adminName}</p>
            <p><strong>Fecha:</strong> ${formattedDate}</p>
            ${adminEmail ? `<p><strong>Contacto:</strong> <a href="mailto:${adminEmail}">${adminEmail}</a></p>` : ''}
        </div>
        
        <div class="important-notice">
            <strong>⚠️ Este es un mensaje oficial del sistema</strong><br>
            Por favor, no responda directamente a este correo electrónico.
        </div>
        
        <p>Si tiene alguna pregunta o necesita asistencia adicional, por favor contacte con nosotros a través de los canales oficiales:</p>
        
        <ul>
            <li>Portal web: <a href="${process.env.FRONTEND_URL || 'https://permisosdigitales.com.mx'}">permisosdigitales.com.mx</a></li>
            <li>Soporte: <a href="mailto:soporte@permisosdigitales.com.mx">soporte@permisosdigitales.com.mx</a></li>
        </ul>
    </div>
    
    <div class="footer">
        <p>© ${new Date().getFullYear()} Permisos Digitales. Todos los derechos reservados.</p>
        <p>Este correo fue enviado a ${userName} como parte de nuestro servicio.</p>
    </div>
</body>
</html>
    `;
  },
  
  text: (data) => {
    const { userName, message, adminName, adminEmail, timestamp } = data;
    const formattedDate = new Date(timestamp).toLocaleString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    return `
Mensaje del Administrador
========================

Estimado/a ${userName},

Ha recibido un mensaje importante del equipo administrativo de Permisos Digitales:

---
${message}
---

Enviado por: ${adminName}
Fecha: ${formattedDate}
${adminEmail ? `Contacto: ${adminEmail}` : ''}

IMPORTANTE: Este es un mensaje oficial del sistema. Por favor, no responda directamente a este correo electrónico.

Si tiene alguna pregunta o necesita asistencia adicional, por favor contacte con nosotros a través de los canales oficiales:

- Portal web: ${process.env.FRONTEND_URL || 'https://permisosdigitales.com.mx'}
- Soporte: soporte@permisosdigitales.com.mx

--
© ${new Date().getFullYear()} Permisos Digitales. Todos los derechos reservados.
Este correo fue enviado a ${userName} como parte de nuestro servicio.
    `;
  }
};