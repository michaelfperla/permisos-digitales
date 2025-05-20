// src/utils/sample-pdfs.js
const path = require('path');
const fs = require('fs');
const { logger } = require('./enhanced-logger');

// Directory containing sample PDFs
const SAMPLE_PDF_DIR = path.join(__dirname, '../../storage/pdfs');
const SAMPLE_PDFS_SOURCE_DIR = path.join(__dirname, '../../storage/sample_pdfs');

// Ensure the sample PDFs directory exists
if (!fs.existsSync(SAMPLE_PDF_DIR)) {
  fs.mkdirSync(SAMPLE_PDF_DIR, { recursive: true });
}

/**
 * Get the most recent sample PDF of a specific type
 * @param {string} type - The type of PDF (permiso, recibo, certificado)
 * @returns {string|null} - The filename of the sample PDF or null if not found
 */
function getSamplePdfFilename(type) {
  try {
    // First, check if we have any existing sample PDFs in the main directory
    if (fs.existsSync(SAMPLE_PDF_DIR)) {
      const files = fs.readdirSync(SAMPLE_PDF_DIR);

      // Filter files by type and sort by timestamp (newest first)
      const matchingFiles = files
        .filter(file => file.startsWith(`${type}_`))
        .sort((a, b) => {
          // Extract timestamps from filenames (assuming format: type_timestamp.pdf)
          const timestampA = parseInt(a.split('_')[1].split('.')[0]);
          const timestampB = parseInt(b.split('_')[1].split('.')[0]);
          return timestampB - timestampA; // Sort descending (newest first)
        });

      // If we found matching files, return the newest one
      if (matchingFiles.length > 0) {
        return matchingFiles[0];
      }
    }

    // If no existing sample PDFs found, copy from source directory and create a new one
    const sourcePdfPath = path.join(SAMPLE_PDFS_SOURCE_DIR, `${type}_sample.pdf`);

    if (fs.existsSync(sourcePdfPath)) {
      // Create a new filename with current timestamp
      const timestamp = Date.now();
      const newFilename = `${type}_${timestamp}.pdf`;
      const destPath = path.join(SAMPLE_PDF_DIR, newFilename);

      // Copy the sample PDF to the destination directory
      fs.copyFileSync(sourcePdfPath, destPath);
      logger.info(`Created new sample PDF: ${newFilename}`);

      return newFilename;
    }

    // If no source PDF found, return null
    logger.warn(`No sample PDF found for type: ${type}`);
    return null;
  } catch (error) {
    logger.error(`Error getting sample PDF filename for type ${type}:`, error);
    return null;
  }
}

/**
 * Assign sample PDFs to an application
 * @param {number} applicationId - The application ID
 * @param {object} db - Database connection
 * @returns {Promise<boolean>} - Whether the operation was successful
 */
async function assignSamplePdfsToApplication(applicationId, db) {
  try {
    logger.info(`Assigning sample PDFs to application ${applicationId}`);

    // Get sample PDF filenames
    const permisoFilename = getSamplePdfFilename('permiso');
    const reciboFilename = getSamplePdfFilename('recibo');
    const certificadoFilename = getSamplePdfFilename('certificado');

    if (!permisoFilename || !reciboFilename || !certificadoFilename) {
      logger.error(`Could not find all required sample PDFs for application ${applicationId}`);
      return false;
    }

    // Update the application with sample PDF paths
    const updateQuery = `
      UPDATE permit_applications
      SET status = 'PERMIT_READY',
          permit_file_path = $1,
          recibo_file_path = $2,
          certificado_file_path = $3,
          is_sample_permit = TRUE,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING id, status;
    `;

    const { rows } = await db.query(updateQuery, [
      permisoFilename,
      reciboFilename,
      certificadoFilename,
      applicationId
    ]);

    if (rows.length === 0) {
      logger.error(`Application ${applicationId} not found during sample PDF assignment`);
      return false;
    }

    logger.info(`Successfully assigned sample PDFs to application ${applicationId}`);
    return true;
  } catch (error) {
    logger.error(`Error assigning sample PDFs to application ${applicationId}:`, error);
    return false;
  }
}

module.exports = {
  getSamplePdfFilename,
  assignSamplePdfsToApplication
};
