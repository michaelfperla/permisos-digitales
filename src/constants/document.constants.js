/**
 * Document Constants
 * Document types, formats, and validation rules
 */

/**
 * Document types
 */
const DocumentType = Object.freeze({
  PERMIT: 'PERMIT',
  RECEIPT: 'RECEIPT',
  OXXO_VOUCHER: 'OXXO_VOUCHER',
  INVOICE: 'INVOICE',
  ID_FRONT: 'ID_FRONT',
  ID_BACK: 'ID_BACK',
  PROOF_OF_ADDRESS: 'PROOF_OF_ADDRESS',
  VEHICLE_REGISTRATION: 'VEHICLE_REGISTRATION',
});

/**
 * Document status
 */
const DocumentStatus = Object.freeze({
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
});

/**
 * File format constants
 */
const FileFormat = Object.freeze({
  PDF: 'pdf',
  PNG: 'png',
  JPG: 'jpg',
  JPEG: 'jpeg',
  WEBP: 'webp',
});

/**
 * Document validation rules
 */
const DocumentValidation = Object.freeze({
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  MIN_FILE_SIZE: 10 * 1024, // 10KB
  ALLOWED_FORMATS: [FileFormat.PDF, FileFormat.PNG, FileFormat.JPG, FileFormat.JPEG],
  IMAGE_FORMATS: [FileFormat.PNG, FileFormat.JPG, FileFormat.JPEG, FileFormat.WEBP],
  
  // Image dimensions
  MIN_WIDTH: 800,
  MIN_HEIGHT: 600,
  MAX_WIDTH: 4096,
  MAX_HEIGHT: 4096,
  
  // PDF specific
  MAX_PDF_PAGES: 10,
  
  // Expiration rules (in days)
  ID_VALIDITY_DAYS: 365 * 5, // 5 years
  PROOF_OF_ADDRESS_VALIDITY_DAYS: 90, // 3 months
  VEHICLE_REGISTRATION_VALIDITY_DAYS: 365, // 1 year
});

/**
 * Document template constants
 */
const DocumentTemplates = Object.freeze({
  PERMIT_TEMPLATE: 'permit_template_v2',
  RECEIPT_TEMPLATE: 'receipt_template_v1',
  OXXO_VOUCHER_TEMPLATE: 'oxxo_voucher_template_v1',
});

/**
 * Document metadata fields
 */
const DocumentMetadata = Object.freeze({
  REQUIRED_FIELDS: ['type', 'uploadDate', 'userId', 'applicationId'],
  OPTIONAL_FIELDS: ['description', 'tags', 'expirationDate', 'verificationStatus'],
});

/**
 * Helper functions for documents
 */
const DocumentHelpers = {
  isImage: (format) => DocumentValidation.IMAGE_FORMATS.includes(format),
  isPDF: (format) => format === FileFormat.PDF,
  isAllowedFormat: (format) => DocumentValidation.ALLOWED_FORMATS.includes(format),
  
  getFileExtension: (filename) => {
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
  },
  
  validateFileSize: (sizeInBytes) => {
    return sizeInBytes >= DocumentValidation.MIN_FILE_SIZE && 
           sizeInBytes <= DocumentValidation.MAX_FILE_SIZE;
  },
  
  getDocumentExpirationDays: (documentType) => {
    switch (documentType) {
      case DocumentType.ID_FRONT:
      case DocumentType.ID_BACK:
        return DocumentValidation.ID_VALIDITY_DAYS;
      case DocumentType.PROOF_OF_ADDRESS:
        return DocumentValidation.PROOF_OF_ADDRESS_VALIDITY_DAYS;
      case DocumentType.VEHICLE_REGISTRATION:
        return DocumentValidation.VEHICLE_REGISTRATION_VALIDITY_DAYS;
      default:
        return null; // No expiration
    }
  },
  
  getMimeType: (format) => {
    const mimeTypes = {
      [FileFormat.PDF]: 'application/pdf',
      [FileFormat.PNG]: 'image/png',
      [FileFormat.JPG]: 'image/jpeg',
      [FileFormat.JPEG]: 'image/jpeg',
      [FileFormat.WEBP]: 'image/webp',
    };
    return mimeTypes[format] || 'application/octet-stream';
  },
};

module.exports = {
  DocumentType,
  DocumentStatus,
  FileFormat,
  DocumentValidation,
  DocumentTemplates,
  DocumentMetadata,
  DocumentHelpers,
};