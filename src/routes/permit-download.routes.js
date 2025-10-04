/**
 * Permit Download Routes
 * Provides clean URLs for downloading permit documents
 */

const express = require('express');
const router = express.Router();
const AWS = require('aws-sdk');
const archiver = require('archiver');
const { logger } = require('../utils/logger');
const crypto = require('crypto');
const { getService, isContainerInitialized } = require('../core/service-container-singleton');

// Initialize S3
const s3 = new AWS.S3({ region: 'us-east-1' });

// Token storage - use Redis if available, otherwise in-memory
let tokenStore;
let redis;

// Default to in-memory storage
const downloadTokens = new Map();
tokenStore = {
  async set(token, data, expiresIn) {
    downloadTokens.set(token, {
      ...data,
      expiresAt: Date.now() + (expiresIn * 1000)
    });
  },
  async get(token) {
    const data = downloadTokens.get(token);
    if (!data) return null;
    if (Date.now() > data.expiresAt) {
      downloadTokens.delete(token);
      return null;
    }
    return data;
  },
  async delete(token) {
    downloadTokens.delete(token);
  }
};

// Try to upgrade to Redis if available
const checkRedisInterval = setInterval(() => {
  try {
    // Check if container is initialized first
    if (!isContainerInitialized()) {
      logger.debug('Waiting for service container to initialize for permit downloads');
      return;
    }
    
    const redisService = getService('redis');
    if (redisService && redisService.client) {
      redis = redisService.client;
      tokenStore = {
        async set(token, data, expiresIn) {
          const key = `permit:download:${token}`;
          await redis.setex(key, expiresIn, JSON.stringify(data));
        },
        async get(token) {
          const key = `permit:download:${token}`;
          const data = await redis.get(key);
          return data ? JSON.parse(data) : null;
        },
        async delete(token) {
          const key = `permit:download:${token}`;
          await redis.del(key);
        }
      };
      logger.info('✅ Successfully upgraded to Redis for permit download token storage');
      clearInterval(checkRedisInterval);
    } else {
      logger.info('Redis service not available, continuing with in-memory storage');
      clearInterval(checkRedisInterval);
    }
  } catch (error) {
    logger.error('Error connecting to Redis for permit download tokens', { error: error.message });
    logger.info('Continuing with in-memory storage for permit download tokens');
    clearInterval(checkRedisInterval);
  }
}, 1000);

/**
 * Generate a short, clean download token
 */
async function generateDownloadToken(applicationId, folioNumber) {
  // Create a short, URL-safe token
  const token = crypto.randomBytes(8).toString('base64url');
  
  // Store token with metadata (expires in 48 hours)
  const tokenData = {
    applicationId,
    folioNumber,
    createdAt: Date.now()
  };
  
  // Store for 48 hours (in seconds)
  await tokenStore.set(token, tokenData, 48 * 60 * 60);
  
  return token;
}

/**
 * Show download page that auto-triggers download
 * This intermediate page handles browser security issues
 */
router.get('/download/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    // Validate token
    const tokenData = await tokenStore.get(token);
    if (!tokenData) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Enlace Expirado</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
            .container { max-width: 500px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            h1 { color: #dc3545; }
            p { color: #666; margin: 20px 0; }
            a { color: #007bff; text-decoration: none; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>❌ Enlace Expirado</h1>
            <p>Este enlace de descarga ha expirado o no es válido.</p>
            <p>Por favor solicita un nuevo enlace a través de WhatsApp o accede al portal web.</p>
            <p><a href="https://permisosdigitales.com.mx/permits">Ir al Portal Web</a></p>
          </div>
        </body>
        </html>
      `);
    }
    
    const { folioNumber } = tokenData;
    const downloadUrl = `/permits/download/${token}/file`;
    
    // Return HTML page that auto-triggers download
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Descargando Permiso ${folioNumber}</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #a72b31 0%, #852023 100%);
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
          }
          .container { 
            background: white;
            padding: 40px;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 500px;
            width: 90%;
          }
          h1 { 
            color: #212529;
            margin-bottom: 10px;
            font-size: 24px;
          }
          .folio {
            color: #a72b31;
            font-weight: bold;
            font-size: 28px;
            margin: 20px 0;
          }
          .spinner {
            border: 3px solid #f8e9ea;
            border-top: 3px solid #a72b31;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 30px auto;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .download-btn {
            display: inline-block;
            padding: 15px 30px;
            background: #a72b31;
            color: white;
            text-decoration: none;
            border-radius: 50px;
            font-weight: bold;
            margin-top: 20px;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(167, 43, 49, 0.3);
          }
          .download-btn:hover {
            background: #852023;
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(167, 43, 49, 0.4);
          }
          .info {
            color: #666;
            margin-top: 20px;
            font-size: 14px;
            line-height: 1.6;
          }
          .success {
            color: #a72b31;
            font-weight: bold;
            display: none;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>📥 Preparando tu descarga</h1>
          <div class="folio">Folio ${folioNumber}</div>
          <div class="spinner" id="spinner"></div>
          <p id="status">Tu descarga comenzará automáticamente...</p>
          <p class="success" id="success">✅ ¡Descarga iniciada!</p>
          
          <a href="${downloadUrl}" class="download-btn" id="downloadBtn" download>
            Descargar Manualmente
          </a>
          
          <p class="info">
            El archivo ZIP contiene:<br>
            • Permiso Digital<br>
            • Certificado<br>
            • Placas en Proceso<br>
            • Recomendaciones
          </p>
          
          <p class="info" style="margin-top: 30px;">
            <strong>¿Problemas con la descarga?</strong><br>
            Haz clic derecho en el botón rojo y selecciona<br>
            "Guardar enlace como..." o "Descargar enlace"
          </p>
        </div>
        
        <script>
          // Auto-trigger download after page loads
          window.onload = function() {
            setTimeout(function() {
              // Create invisible iframe to trigger download
              var iframe = document.createElement('iframe');
              iframe.style.display = 'none';
              iframe.src = '${downloadUrl}';
              document.body.appendChild(iframe);
              
              // Update UI
              setTimeout(function() {
                document.getElementById('spinner').style.display = 'none';
                document.getElementById('status').style.display = 'none';
                document.getElementById('success').style.display = 'block';
              }, 1000);
            }, 1500);
          };
        </script>
      </body>
      </html>
    `);
    
  } catch (error) {
    logger.error('Error in permit download page', { error: error.message });
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Error</title>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          h1 { color: #dc3545; }
        </style>
      </head>
      <body>
        <h1>Error al procesar la descarga</h1>
        <p>Por favor intenta nuevamente o contacta soporte.</p>
      </body>
      </html>
    `);
  }
});

/**
 * Actual file download endpoint
 * This serves the actual ZIP file
 */
router.get('/download/:token/file', async (req, res) => {
  try {
    const { token } = req.params;
    
    // Validate token
    const tokenData = await tokenStore.get(token);
    if (!tokenData) {
      return res.status(404).json({ 
        error: 'Enlace inválido o expirado' 
      });
    }
    
    const { applicationId, folioNumber } = tokenData;
    
    logger.info('Processing permit download request', {
      token,
      applicationId,
      folioNumber
    });
    
    // List all PDFs for this application
    const listParams = {
      Bucket: 'permisos-digitales-files-east',
      Prefix: `permits/${applicationId}/`
    };
    
    const listResult = await s3.listObjectsV2(listParams).promise();
    
    if (!listResult.Contents || listResult.Contents.length === 0) {
      return res.status(404).json({ 
        error: 'No se encontraron documentos' 
      });
    }
    
    // Categorize files
    const files = {
      permit: null,
      certificate: null,
      plates: null,
      recommendations: null
    };
    
    for (const file of listResult.Contents) {
      const key = file.Key;
      const filename = key.split('/').pop();
      
      if (filename.startsWith('Permiso_Digital')) {
        files.permit = { key, filename };  // Keep original filename
      } else if (filename.startsWith('Certificado_Permiso')) {
        files.certificate = { key, filename };  // Keep original filename
      } else if (filename.startsWith('Placas_En_Proceso')) {
        files.plates = { key, filename };  // Keep original filename
      } else if (filename.startsWith('recomendaciones')) {
        files.recommendations = { key, filename };  // Keep original filename
      }
    }
    
    // Set response headers for ZIP download with forced download
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 
      `attachment; filename="Permiso_${folioNumber}_Documentos.zip"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    
    // Create ZIP archive
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });
    
    // Handle archive errors
    archive.on('error', (err) => {
      logger.error('Archive creation error', { error: err.message });
      res.status(500).json({ error: 'Error al crear el archivo' });
    });
    
    // Pipe archive data to response
    archive.pipe(res);
    
    // Add each PDF to the ZIP
    const filesToAdd = Object.values(files).filter(f => f !== null);
    
    for (const file of filesToAdd) {
      try {
        // Get file from S3
        const s3Object = await s3.getObject({
          Bucket: 'permisos-digitales-files-east',
          Key: file.key
        }).promise();
        
        // Add to archive with clean filename
        archive.append(s3Object.Body, { name: file.filename });
        
        logger.info('Added file to ZIP', { 
          originalKey: file.key,
          zipFilename: file.filename 
        });
      } catch (s3Error) {
        logger.error('Error fetching file from S3', { 
          error: s3Error.message,
          key: file.key 
        });
      }
    }
    
    // Finalize the archive
    await archive.finalize();
    
    logger.info('ZIP download completed', {
      token,
      applicationId,
      filesIncluded: filesToAdd.length
    });
    
  } catch (error) {
    logger.error('Error in permit download', { error: error.message });
    
    // If headers haven't been sent, send error response
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Error al descargar los documentos' 
      });
    }
  }
});

/**
 * Generate a download link for WhatsApp
 * This is called internally by the WhatsApp service
 */
router.post('/generate-link', async (req, res) => {
  try {
    const { applicationId, folioNumber } = req.body;
    
    if (!applicationId || !folioNumber) {
      return res.status(400).json({ 
        error: 'Missing required parameters' 
      });
    }
    
    // Generate clean token
    const token = await generateDownloadToken(applicationId, folioNumber);
    
    // Create clean URL
    const baseUrl = process.env.API_URL || 'https://api.permisosdigitales.com.mx';
    const downloadUrl = `${baseUrl}/permits/download/${token}`;
    
    logger.info('Generated download link', {
      applicationId,
      folioNumber,
      token,
      url: downloadUrl
    });
    
    res.json({
      success: true,
      url: downloadUrl,
      token,
      expiresIn: '48 horas'
    });
    
  } catch (error) {
    logger.error('Error generating download link', { error: error.message });
    res.status(500).json({ 
      error: 'Error al generar el enlace' 
    });
  }
});

module.exports = router;