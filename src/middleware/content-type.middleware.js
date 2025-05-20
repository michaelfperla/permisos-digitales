// src/middleware/content-type.middleware.js
const path = require('path');
const { logger } = require('../utils/enhanced-logger');

/**
 * Middleware to ensure proper content-type headers for static files
 */
const ensureProperContentType = (req, res, next) => {
  // Only process GET requests for static files
  if (req.method !== 'GET') {
    return next();
  }

  // Get the original send function
  const originalSend = res.send;
  const originalSendFile = res.sendFile;

  // Override the send function
  res.send = function(body) {
    const url = req.url.toLowerCase();

    // Check file extensions
    if (url.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    } else if (url.endsWith('.jpg') || url.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (url.endsWith('.svg')) {
      res.setHeader('Content-Type', 'image/svg+xml');
    } else if (url.endsWith('.pdf')) {
      res.setHeader('Content-Type', 'application/pdf');
    }

    // Call the original send function
    return originalSend.call(this, body);
  };

  // Override the sendFile function
  res.sendFile = function(filePath, options, callback) {
    const ext = path.extname(filePath).toLowerCase();

    // Set content type based on file extension
    if (ext === '.png') {
      res.setHeader('Content-Type', 'image/png');
    } else if (ext === '.jpg' || ext === '.jpeg') {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (ext === '.svg') {
      res.setHeader('Content-Type', 'image/svg+xml');
    } else if (ext === '.pdf') {
      res.setHeader('Content-Type', 'application/pdf');
    }

    // Call the original sendFile function
    return originalSendFile.call(this, filePath, options, callback);
  };

  next();
};

module.exports = ensureProperContentType;
