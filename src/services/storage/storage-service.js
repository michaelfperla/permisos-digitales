/**
 * Storage Service
 * 
 * This service provides a unified interface for file storage operations,
 * abstracting away the details of the underlying storage provider (local or S3).
 */
const path = require('path');
const { logger } = require('../../utils/enhanced-logger');
const config = require('../../config');
const LocalStorageProvider = require('./local-storage-provider');
const S3StorageProvider = require('./s3-storage-provider');

class StorageService {
  /**
   * Initialize the storage service with the appropriate provider
   */
  constructor() {
    this.initializeProvider();
  }

  /**
   * Initialize the storage provider based on configuration
   */
  initializeProvider() {
    const storageType = config.storageType || 'local';
    
    if (storageType === 's3') {
      // Initialize S3 storage provider
      this.provider = new S3StorageProvider({
        bucket: config.s3Bucket,
        region: config.s3Region,
        accessKeyId: config.s3AccessKeyId,
        secretAccessKey: config.s3SecretAccessKey,
        endpoint: config.s3Endpoint
      });
      logger.info('Storage service initialized with S3 provider');
    } else {
      // Initialize local storage provider
      const baseDir = path.join(__dirname, '../../../storage');
      this.provider = new LocalStorageProvider(baseDir);
      logger.info('Storage service initialized with local filesystem provider');
    }
  }

  /**
   * Save a file to storage
   * @param {Buffer} fileBuffer - File content as buffer
   * @param {Object} options - Save options
   * @returns {Promise<Object>} - File information
   */
  async saveFile(fileBuffer, options = {}) {
    return this.provider.saveFile(fileBuffer, options);
  }

  /**
   * Save a file from a path (e.g., from multer upload)
   * @param {string} sourcePath - Source file path
   * @param {Object} options - Save options
   * @returns {Promise<Object>} - File information
   */
  async saveFileFromPath(sourcePath, options = {}) {
    const fs = require('fs').promises;
    try {
      const fileBuffer = await fs.readFile(sourcePath);
      const originalName = options.originalName || path.basename(sourcePath);

      const result = await this.saveFile(fileBuffer, {
        ...options,
        originalName
      });

      // Remove source file if requested
      if (options.removeSource) {
        try {
          await fs.unlink(sourcePath);
          logger.debug(`Removed source file: ${sourcePath}`);
        } catch (unlinkError) {
          logger.warn(`Failed to remove source file ${sourcePath}:`, unlinkError);
        }
      }

      return result;
    } catch (error) {
      logger.error(`Failed to save file from path ${sourcePath}:`, error);
      throw error;
    }
  }

  /**
   * Get a file from storage
   * @param {string} fileIdentifier - File identifier (path or key)
   * @returns {Promise<Object>} - File content and metadata
   */
  async getFile(fileIdentifier) {
    return this.provider.getFile(fileIdentifier);
  }

  /**
   * Delete a file from storage
   * @param {string} fileIdentifier - File identifier (path or key)
   * @returns {Promise<boolean>} - True if file was deleted
   */
  async deleteFile(fileIdentifier) {
    return this.provider.deleteFile(fileIdentifier);
  }

  /**
   * List files in a directory/prefix
   * @param {string} directory - Directory/prefix to list
   * @param {Object} options - List options
   * @returns {Promise<Array>} - Array of file information
   */
  async listFiles(directory = '', options = {}) {
    return this.provider.listFiles(directory, options);
  }

  /**
   * Get a URL for a file
   * @param {string} fileIdentifier - File identifier (path or key)
   * @param {Object} options - URL options
   * @returns {Promise<string>} - URL to access the file
   */
  async getFileUrl(fileIdentifier, options = {}) {
    return this.provider.getFileUrl(fileIdentifier, options);
  }

  /**
   * Check if a file exists
   * @param {string} fileIdentifier - File identifier (path or key)
   * @returns {Promise<boolean>} - True if file exists
   */
  async fileExists(fileIdentifier) {
    return this.provider.fileExists(fileIdentifier);
  }

  /**
   * Copy a file within the storage
   * @param {string} sourceIdentifier - Source file identifier
   * @param {string} destinationIdentifier - Destination file identifier
   * @param {Object} options - Copy options
   * @returns {Promise<Object>} - Information about the copied file
   */
  async copyFile(sourceIdentifier, destinationIdentifier, options = {}) {
    return this.provider.copyFile(sourceIdentifier, destinationIdentifier, options);
  }

  /**
   * Get file information without downloading the file
   * @param {string} fileIdentifier - File identifier (path or key)
   * @returns {Promise<Object>} - File information
   */
  async getFileInfo(fileIdentifier) {
    try {
      if (await this.fileExists(fileIdentifier)) {
        const stats = await this.provider.getFileStats ? 
          await this.provider.getFileStats(fileIdentifier) : 
          { size: 0 };
        
        return {
          exists: true,
          size: stats.size || 0,
          contentType: this.getContentTypeFromPath(fileIdentifier)
        };
      }
      
      return { exists: false };
    } catch (error) {
      logger.error(`Failed to get file info for ${fileIdentifier}:`, error);
      return { exists: false, error: error.message };
    }
  }

  /**
   * Get content type based on file extension
   * @param {string} filePath - File path or key
   * @returns {string} - Content type
   */
  getContentTypeFromPath(filePath) {
    const extension = path.extname(filePath).toLowerCase();
    
    const contentTypes = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.txt': 'text/plain',
      '.html': 'text/html',
      '.json': 'application/json'
    };
    
    return contentTypes[extension] || 'application/octet-stream';
  }
}

// Create and export a singleton instance
const storageService = new StorageService();

// Export both the class and the instance
module.exports = storageService;
module.exports.StorageService = StorageService;
