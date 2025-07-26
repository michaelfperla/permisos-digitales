/**
 * Storage Service
 * 
 * This service provides a unified interface for file storage operations,
 * abstracting away the details of the underlying storage provider (local or S3).
 */
const path = require('path');
const { logger } = require('../../utils/logger');
const unifiedConfig = require('../../config/unified-config');
const LocalStorageProvider = require('./local-storage-provider');
const S3StorageProvider = require('./s3-storage-provider');

class StorageService {
  /**
   * Initialize the storage service with the appropriate provider
   */
  constructor() {
    this.provider = null;
    this.initialized = false;
  }

  /**
   * Ensure the storage provider is initialized
   */
  ensureInitialized() {
    if (!this.initialized) {
      this.initializeProvider();
    }
  }

  /**
   * Initialize the storage provider with a provided config (used by service container)
   * @param {Object} config - Configuration object
   */
  initializeWithConfig(config) {
    if (this.initialized) {
      return;
    }

    // Handle different config structures
    const storageType = config.services?.storage?.provider || config.storage?.provider || 's3';
    const s3Bucket = config.services?.storage?.s3Bucket || config.s3Bucket;
    const s3Region = config.services?.storage?.s3Region || config.s3Region || process.env.AWS_REGION || 'us-east-1';
    const s3AccessKeyId = config.s3AccessKeyId || config.storage?.s3AccessKeyId;
    const s3SecretAccessKey = config.s3SecretAccessKey || config.storage?.s3SecretAccessKey;
    const s3Endpoint = config.s3Endpoint || config.storage?.s3Endpoint;

    logger.info('Storage service config debug', {
      storageType,
      s3Bucket,
      s3Region,
      hasAccessKey: !!s3AccessKeyId,
      hasSecretKey: !!s3SecretAccessKey
    });

    if (storageType === 's3') {
      // Initialize S3 storage provider
      this.provider = new S3StorageProvider({
        bucket: s3Bucket,
        region: s3Region,
        accessKeyId: s3AccessKeyId,
        secretAccessKey: s3SecretAccessKey,
        endpoint: s3Endpoint
      });
      logger.info('Storage service initialized with S3 provider (via service container)', {
        bucket: s3Bucket,
        region: s3Region
      });
    } else {
      // Initialize local storage provider with configurable base directory
      const baseDir = this.getLocalStorageBasePathFromConfig(config);
      this.provider = new LocalStorageProvider(baseDir);
      logger.info('Storage service initialized with local filesystem provider (via service container)', {
        baseDir: baseDir,
        isAbsolute: path.isAbsolute(baseDir)
      });
    }

    this.initialized = true;
  }

  /**
   * Initialize the storage provider based on configuration (legacy method)
   */
  initializeProvider() {
    if (this.initialized) {
      return;
    }

    let config;
    try {
      config = unifiedConfig.getSync();
    } catch (error) {
      // If unified config is not ready, fall back to environment variables
      logger.warn('Unified config not ready, falling back to environment variables', {
        error: error.message
      });

      config = {
        s3Bucket: process.env.S3_BUCKET,
        s3Region: process.env.S3_REGION || process.env.AWS_REGION,
        s3AccessKeyId: process.env.AWS_ACCESS_KEY_ID,
        s3SecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        s3Endpoint: process.env.S3_ENDPOINT,
        storage: {
          provider: process.env.STORAGE_PROVIDER || 's3',
          localPath: process.env.STORAGE_LOCAL_PATH || './storage'
        }
      };
    }

    const storageType = config.services?.storage?.provider || config.storage?.provider || 's3';

    if (storageType === 's3') {
      // Initialize S3 storage provider
      this.provider = new S3StorageProvider({
        bucket: config.s3Bucket,
        region: config.s3Region,
        accessKeyId: config.s3AccessKeyId,
        secretAccessKey: config.s3SecretAccessKey,
        endpoint: config.s3Endpoint
      });
      logger.info('Storage service initialized with S3 provider', {
        bucket: config.s3Bucket,
        region: config.s3Region,
        fallbackMode: !unifiedConfig.isInitialized || !unifiedConfig.isInitialized()
      });
    } else {
      // Initialize local storage provider with configurable base directory
      const baseDir = this.getLocalStorageBasePath();
      this.provider = new LocalStorageProvider(baseDir);
      logger.info('Storage service initialized with local filesystem provider', {
        baseDir: baseDir,
        isAbsolute: path.isAbsolute(baseDir)
      });
    }

    this.initialized = true;
  }

  /**
   * Get the base path for local storage from provided configuration
   * @param {Object} config - Configuration object
   * @returns {string} - Absolute path to the base storage directory
   */
  getLocalStorageBasePathFromConfig(config) {
    const configuredPath = config.services?.storage?.localPath ||
                          config.storage?.localPath ||
                          '/app/storage';

    // If path is already absolute, use it directly
    if (path.isAbsolute(configuredPath)) {
      return configuredPath;
    }

    // Otherwise, make it relative to the project root
    return path.resolve(process.cwd(), configuredPath);
  }

  /**
   * Get the base path for local storage from configuration (legacy method)
   * @returns {string} - Absolute path to the base storage directory
   */
  getLocalStorageBasePath() {
    // Get base path from configuration
    const config = unifiedConfig.getSync();
    const configuredPath = config.services?.storage?.localPath ||
                          config.storage?.localPath ||
                          '/app/storage';

    // If path is already absolute, use it directly
    if (path.isAbsolute(configuredPath)) {
      return configuredPath;
    }
    
    // If relative path, resolve it relative to the project root
    const projectRoot = path.resolve(__dirname, '../../../');
    const resolvedPath = path.resolve(projectRoot, configuredPath);
    
    logger.debug('Resolved storage path', {
      configured: configuredPath,
      projectRoot: projectRoot,
      resolved: resolvedPath
    });
    
    return resolvedPath;
  }

  /**
   * Save a file to storage
   * @param {Buffer} fileBuffer - File content as buffer
   * @param {Object} options - Save options
   * @returns {Promise<Object>} - File information
   */
  async saveFile(fileBuffer, options = {}) {
    this.ensureInitialized();
    return this.provider.saveFile(fileBuffer, options);
  }

  /**
   * Save a file from a path (e.g., from multer upload)
   * @param {string} sourcePath - Source file path
   * @param {Object} options - Save options
   * @returns {Promise<Object>} - File information
   */
  async saveFileFromPath(sourcePath, options = {}) {
    this.ensureInitialized();
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
    this.ensureInitialized();
    return this.provider.getFile(fileIdentifier);
  }

  /**
   * Delete a file from storage
   * @param {string} fileIdentifier - File identifier (path or key)
   * @returns {Promise<boolean>} - True if file was deleted
   */
  async deleteFile(fileIdentifier) {
    this.ensureInitialized();
    return this.provider.deleteFile(fileIdentifier);
  }

  /**
   * List files in a directory/prefix
   * @param {string} directory - Directory/prefix to list
   * @param {Object} options - List options
   * @returns {Promise<Array>} - Array of file information
   */
  async listFiles(directory = '', options = {}) {
    this.ensureInitialized();
    return this.provider.listFiles(directory, options);
  }

  /**
   * Get a URL for a file
   * @param {string} fileIdentifier - File identifier (path or key)
   * @param {Object} options - URL options
   * @returns {Promise<string>} - URL to access the file
   */
  async getFileUrl(fileIdentifier, options = {}) {
    this.ensureInitialized();
    return this.provider.getFileUrl(fileIdentifier, options);
  }

  /**
   * Check if a file exists
   * @param {string} fileIdentifier - File identifier (path or key)
   * @returns {Promise<boolean>} - True if file exists
   */
  async fileExists(fileIdentifier) {
    this.ensureInitialized();
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
    this.ensureInitialized();
    return this.provider.copyFile(sourceIdentifier, destinationIdentifier, options);
  }

  /**
   * Get file information without downloading the file
   * @param {string} fileIdentifier - File identifier (path or key)
   * @returns {Promise<Object>} - File information
   */
  async getFileInfo(fileIdentifier) {
    this.ensureInitialized();
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
