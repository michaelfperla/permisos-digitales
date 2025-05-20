/**
 * Storage Services Index
 * 
 * This file exports all storage-related services for easy importing.
 */

const storageService = require('./storage-service');
const pdfStorageService = require('./pdf-storage-service');
const LocalStorageProvider = require('./local-storage-provider');
const S3StorageProvider = require('./s3-storage-provider');
const StorageProvider = require('./storage-provider.interface');

module.exports = {
  storageService,
  pdfStorageService,
  LocalStorageProvider,
  S3StorageProvider,
  StorageProvider
};
