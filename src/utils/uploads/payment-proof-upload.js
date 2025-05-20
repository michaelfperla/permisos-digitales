// src/utils/uploads/payment-proof-upload.js
// [Refactor - Remove Manual Payment] Multer configuration specifically for handling manual payment proof uploads. Obsolete.

/*
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { logger } = require('../enhanced-logger');

// Base storage directory for payment proofs
const PAYMENT_PROOFS_DIR = path.join(__dirname, '../../../storage/payment_proofs');

// Ensure storage directory exists
try {
  fs.mkdirSync(PAYMENT_PROOFS_DIR, { recursive: true });
  logger.info(`Payment proofs directory ensured at: ${PAYMENT_PROOFS_DIR}`);
} catch (error) {
  logger.error(`Error creating payment proofs directory: ${error.message}`);
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, PAYMENT_PROOFS_DIR);
  },
  filename: function (req, file, cb) {
    // Get application ID from route params
    const applicationId = req.params.id;
    // Create a unique filename with timestamp and random suffix
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname) || '.unknown';
    cb(null, `payment_proof_${applicationId}_${uniqueSuffix}${extension}`);
  }
});

// File filter to only allow certain file types
const fileFilter = (req, file, cb) => {
  // Allow only image files and PDFs
  const allowedTypes = /jpeg|jpg|png|pdf/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, and PDF files are allowed'));
  }
};

// Create and configure the multer upload middleware
const paymentProofUpload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: fileFilter
});

// Error handler for multer errors
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    logger.error(`Multer error: ${err.message}`);
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        message: 'File is too large. Maximum size is 5MB.'
      });
    }
    return res.status(400).json({ message: `Upload error: ${err.message}` });
  } else if (err) {
    logger.error(`Error in file upload: ${err.message}`);
    return res.status(400).json({ message: err.message });
  }
  next();
};
*/

// Provide empty exports to prevent import errors in existing code
module.exports = {
  paymentProofUpload: {
    single: () => (req, res, next) => {
      next(new Error('Payment proof upload functionality has been disabled'));
    }
  },
  handleMulterError: (err, req, res, next) => {
    res.status(410).json({
      message: 'El sistema de pagos está siendo actualizado para usar un proveedor de pagos externo. Esta funcionalidad ya no está disponible.'
    });
  }
};