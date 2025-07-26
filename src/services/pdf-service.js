// src/services/pdf-service.js
/**
 * PDF Service
 *
 * This service provides a backward-compatible interface for PDF operations,
 * delegating to the new PDF storage service for actual implementation.
 */
const path = require('path');
const pdfStorageService = require('./storage/pdf-storage-service');

// Constants for backward compatibility
const PDF_STORAGE_DIR = path.join(__dirname, '../../storage/pdfs');
const USER_PDF_DIR = path.join(__dirname, '../../storage/user_pdf_downloads');

/**
 * Ensures the user PDF download directory exists
 * @deprecated Use pdfStorageService directly
 */
function ensureUserPdfDir() {
  return pdfStorageService.ensureUserPdfDir();
}

/**
 * Copy a permit PDF to the user download directory with a user-friendly name
 * @param {string} sourceFilename - The source PDF filename in storage/pdfs
 * @param {number} applicationId - The application ID
 * @param {string} type - The type of document (permiso, certificado, placas)
 * @param {string} folio - The permit folio number
 * @param {boolean} isSample - Whether this is a sample permit
 * @returns {Promise<{success: boolean, path: string, error: string}>}
 */
async function copyPermitToUserDownloads(sourceFilename, applicationId, type, folio, isSample = false) {
  return pdfStorageService.copyPdfToUserDownloads(sourceFilename, applicationId, type, folio, isSample);
}

/**
 * Get the full path to a user-downloaded PDF
 * @param {string} filename - The filename in the user downloads directory
 * @returns {string} The full path to the file
 */
function getUserPdfPath(filename) {
  return pdfStorageService.getUserPdfPath(filename);
}

/**
 * Get a PDF file
 * @param {string} fileIdentifier - File identifier (path or key)
 * @param {number} applicationId - Optional application ID for permits stored in subdirectories
 * @returns {Promise<Object>} - PDF content and metadata
 */
async function getPdf(fileIdentifier, applicationId = null) {
  return pdfStorageService.getPdf(fileIdentifier, applicationId);
}

/**
 * Get a URL for a PDF file
 * @param {string} fileIdentifier - File identifier (path or key)
 * @param {Object} options - URL options
 * @returns {Promise<string>} - URL to access the PDF
 */
async function getPdfUrl(fileIdentifier, options = {}) {
  return pdfStorageService.getPdfUrl(fileIdentifier, options);
}

module.exports = {
  copyPermitToUserDownloads,
  getUserPdfPath,
  ensureUserPdfDir,
  getPdf,
  getPdfUrl,
  // Export constants for backward compatibility
  PDF_STORAGE_DIR,
  USER_PDF_DIR
};
