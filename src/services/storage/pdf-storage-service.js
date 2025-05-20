/**
 * PDF Storage Service
 * 
 * Specialized service for handling PDF storage operations.
 * Uses the general storage service with PDF-specific configurations.
 */
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const { logger } = require('../../utils/enhanced-logger');
const storageService = require('./storage-service');

// PDF-specific constants
const PDF_SUBDIRECTORY = 'pdfs';
const USER_PDF_SUBDIRECTORY = 'user_pdf_downloads';

class PdfStorageService {
  /**
   * Save a PDF file
   * @param {Buffer} pdfBuffer - PDF content as buffer
   * @param {Object} options - Save options
   * @returns {Promise<Object>} - File information
   */
  async savePdf(pdfBuffer, options = {}) {
    const pdfOptions = {
      ...options,
      subDirectory: options.subDirectory ? 
        path.join(PDF_SUBDIRECTORY, options.subDirectory) : 
        PDF_SUBDIRECTORY
    };
    
    return storageService.saveFile(pdfBuffer, pdfOptions);
  }

  /**
   * Save a PDF from a path
   * @param {string} sourcePath - Source file path
   * @param {Object} options - Save options
   * @returns {Promise<Object>} - File information
   */
  async savePdfFromPath(sourcePath, options = {}) {
    const pdfOptions = {
      ...options,
      subDirectory: options.subDirectory ? 
        path.join(PDF_SUBDIRECTORY, options.subDirectory) : 
        PDF_SUBDIRECTORY
    };
    
    return storageService.saveFileFromPath(sourcePath, pdfOptions);
  }

  /**
   * Get a PDF file
   * @param {string} fileIdentifier - File identifier (path or key)
   * @returns {Promise<Object>} - PDF content and metadata
   */
  async getPdf(fileIdentifier) {
    // If fileIdentifier is just a filename without path, prepend PDF_SUBDIRECTORY
    const fullIdentifier = path.isAbsolute(fileIdentifier) || fileIdentifier.includes('/') ? 
      fileIdentifier : 
      path.join(PDF_SUBDIRECTORY, fileIdentifier);
    
    return storageService.getFile(fullIdentifier);
  }

  /**
   * Get a URL for a PDF file
   * @param {string} fileIdentifier - File identifier (path or key)
   * @param {Object} options - URL options
   * @returns {Promise<string>} - URL to access the PDF
   */
  async getPdfUrl(fileIdentifier, options = {}) {
    // If fileIdentifier is just a filename without path, prepend PDF_SUBDIRECTORY
    const fullIdentifier = path.isAbsolute(fileIdentifier) || fileIdentifier.includes('/') ? 
      fileIdentifier : 
      path.join(PDF_SUBDIRECTORY, fileIdentifier);
    
    return storageService.getFileUrl(fullIdentifier, options);
  }

  /**
   * Copy a PDF to the user downloads directory with a user-friendly name
   * @param {string} sourceFilename - The source PDF filename
   * @param {number} applicationId - The application ID
   * @param {string} type - The type of document (permiso, recibo, certificado)
   * @param {string} folio - The permit folio number
   * @param {boolean} isSample - Whether this is a sample permit
   * @returns {Promise<{success: boolean, path: string, error: string}>}
   */
  async copyPdfToUserDownloads(sourceFilename, applicationId, type, folio, isSample = false) {
    try {
      // Create a user-friendly filename
      const typeLabels = {
        'permiso': 'Permiso',
        'recibo': 'Recibo',
        'certificado': 'Certificado',
        'placas': 'Placas'
      };

      const typeLabel = typeLabels[type] || 'Documento';
      let userFilename;

      if (isSample) {
        // Add a clear indication that this is a sample permit
        userFilename = `MUESTRA_${typeLabel}_${folio || applicationId}.pdf`;
      } else {
        userFilename = `${typeLabel}_${folio || applicationId}.pdf`;
      }

      // Source identifier is either a full path or just a filename
      const sourceIdentifier = path.isAbsolute(sourceFilename) || sourceFilename.includes('/') ? 
        sourceFilename : 
        path.join(PDF_SUBDIRECTORY, sourceFilename);
      
      // Destination is always in the user_pdf_downloads directory
      const destinationIdentifier = path.join(USER_PDF_SUBDIRECTORY, userFilename);

      // Check if source file exists
      if (!(await storageService.fileExists(sourceIdentifier))) {
        logger.error(`Source PDF file not found: ${sourceIdentifier}`);
        return {
          success: false,
          error: 'Source PDF file not found'
        };
      }

      // Copy the file
      const copyResult = await storageService.copyFile(sourceIdentifier, destinationIdentifier);
      logger.info(`Copied PDF to user downloads: ${destinationIdentifier}`);

      return {
        success: true,
        path: copyResult.relativePath,
        filename: userFilename
      };
    } catch (error) {
      logger.error(`Error copying PDF to user downloads: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Ensure the user PDF download directory exists
   * This is primarily for backward compatibility
   */
  async ensureUserPdfDir() {
    try {
      // For local storage, we need to ensure the directory exists
      // For S3, this is a no-op
      if (storageService.provider.constructor.name === 'LocalStorageProvider') {
        const baseDir = storageService.provider.baseDir;
        const userPdfDir = path.join(baseDir, USER_PDF_SUBDIRECTORY);
        
        if (!fsSync.existsSync(userPdfDir)) {
          await fs.mkdir(userPdfDir, { recursive: true });
          logger.info(`Created user PDF download directory: ${userPdfDir}`);
        }
      }
    } catch (error) {
      logger.error(`Failed to create user PDF download directory: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get the full path to a user-downloaded PDF
   * @param {string} filename - The filename in the user downloads directory
   * @returns {string} The full path or identifier to the file
   */
  getUserPdfPath(filename) {
    return path.join(USER_PDF_SUBDIRECTORY, filename);
  }
}

// Create and export a singleton instance
const pdfStorageService = new PdfStorageService();

module.exports = pdfStorageService;
