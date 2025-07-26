/**
 * Base Email Template
 * Provides common styles and structure for all email templates
 */

/**
 * Get common email styles
 * @returns {string} CSS styles for emails
 */
function getBaseStyles() {
  return `
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
        }
        .email-container {
            background-color: white;
            border-radius: 5px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
            background-color: #852d2d;
            color: white;
            padding: 20px;
            text-align: center;
        }
        .header h2 {
            margin: 0;
            font-size: 24px;
        }
        .content {
            padding: 30px;
        }
        .content h3 {
            color: #852d2d;
            margin-top: 0;
        }
        .info-box {
            background-color: #f9f9f9;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
            border-left: 4px solid #852d2d;
        }
        .info-box p {
            margin: 5px 0;
        }
        .button {
            display: inline-block;
            background-color: #a72b31;
            color: white !important;
            padding: 12px 25px;
            text-decoration: none;
            border-radius: 4px;
            margin: 15px 0;
            font-weight: bold;
        }
        .button:hover {
            background-color: #852d2d;
        }
        .button-container {
            text-align: center;
            margin: 25px 0;
        }
        .footer {
            background-color: #f4f4f4;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #777;
            border-top: 1px solid #ddd;
        }
        .footer p {
            margin: 5px 0;
        }
        @media only screen and (max-width: 600px) {
            body {
                padding: 10px;
            }
            .content {
                padding: 20px;
            }
        }
    </style>
  `;
}

/**
 * Generate base HTML structure for emails
 * @param {Object} options - Template options
 * @param {string} options.title - Email title
 * @param {string} options.content - Email body content
 * @param {string} [options.styles] - Additional styles
 * @returns {string} Complete HTML email
 */
function generateHtmlEmail(options) {
  const currentYear = new Date().getFullYear();
  
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${options.title}</title>
    ${getBaseStyles()}
    ${options.styles || ''}
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h2>Permisos Digitales</h2>
        </div>
        <div class="content">
            ${options.content}
        </div>
        <div class="footer">
            <p>Este es un correo automático, por favor no respondas a este mensaje.</p>
            <p>&copy; ${currentYear} Permisos Digitales. Todos los derechos reservados.</p>
        </div>
    </div>
</body>
</html>
  `;
}

module.exports = {
  getBaseStyles,
  generateHtmlEmail
};