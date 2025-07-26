/**
 * Local Filesystem Storage Provider
 * 
 * Implementation of the StorageProvider interface for local filesystem storage.
 */
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');
const { logger } = require('../../utils/logger');
const StorageProvider = require('./storage-provider.interface');
const { FileSystemError } = require('../../utils/errors');
const StorageUtils = require('../../utils/storage-utils');

class LocalStorageProvider extends StorageProvider {
  /**
   * Initialize the local storage provider
   * @param {string} baseDir - Base directory for file storage
   */
  constructor(baseDir) {
    super();
    this.baseDir = baseDir;
    this.initializeStorage();
  }

  /**
   * Initialize storage and perform health checks
   */
  async initializeStorage() {
    try {
      // Ensure base directory exists with proper permissions
      await StorageUtils.ensureDirectory(this.baseDir);
      
      // Perform initial health check
      const permissions = await StorageUtils.checkPermissions(this.baseDir);
      
      if (!permissions.readable || !permissions.writable) {
        throw new Error(`Insufficient permissions for storage directory: ${this.baseDir}`);
      }
      
      logger.info('Local storage provider initialized successfully', {
        baseDir: this.baseDir,
        permissions: permissions.permissions,
        diskSpace: await StorageUtils.getDiskSpace(this.baseDir)
      });
    } catch (error) {
      logger.error('Failed to initialize local storage provider', {
        baseDir: this.baseDir,
        error: error.message
      });
      throw new FileSystemError(`Storage initialization failed: ${error.message}`, this.baseDir);
    }
  }

  /**
   * Ensure a directory exists (delegated to StorageUtils)
   * @param {string} dirPath - Directory path
   * @returns {Promise<void>}
   */
  async ensureDirectoryExists(dirPath) {
    return StorageUtils.ensureDirectory(dirPath);
  }

  /**
   * Generate a unique filename
   * @param {string} originalName - Original filename
   * @param {string} prefix - Optional prefix for the filename
   * @param {boolean} preserveOriginal - Whether to preserve the original filename
   * @returns {string} - Generated filename
   */
  generateFileName(originalName, prefix = '', preserveOriginal = false) {
    // If preserveOriginal is true and we have a valid filename, use it as-is
    if (preserveOriginal && originalName && originalName !== 'file') {
      // Sanitize the filename to remove any path traversal attempts
      const sanitized = path.basename(originalName);
      // Replace spaces with underscores for consistency
      return sanitized.replace(/\s+/g, '_');
    }
    
    // Otherwise, generate a unique filename
    const extension = path.extname(originalName) || '';
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString('hex');
    return `${prefix}${prefix ? '_' : ''}${timestamp}_${randomString}${extension}`;
  }

  /**
   * Save a file to storage
   * @param {Buffer} fileBuffer - File content as buffer
   * @param {Object} options - Save options
   * @returns {Promise<Object>} - File information
   */
  async saveFile(fileBuffer, options = {}) {
    const {
      originalName = 'file',
      subDirectory = '',
      prefix = '',
      metadata = {},
      preserveOriginalFilename = false
    } = options;

    try {
      // Create full directory path
      const dirPath = path.join(this.baseDir, subDirectory);
      await this.ensureDirectoryExists(dirPath);

      // Generate unique filename
      const fileName = this.generateFileName(originalName, prefix, preserveOriginalFilename);
      const filePath = path.join(dirPath, fileName);
      const relativePath = path.join(subDirectory, fileName).replace(/\\/g, '/');

      // Write file
      await fs.writeFile(filePath, fileBuffer);
      logger.debug(`File saved: ${filePath}`);

      // Save metadata to a sidecar JSON file if we have any
      if (Object.keys(metadata).length > 0) {
        const metadataPath = `${filePath}.metadata.json`;
        await fs.writeFile(metadataPath, JSON.stringify({
          originalName,
          ...metadata,
          savedAt: new Date().toISOString()
        }, null, 2));
        logger.debug(`Metadata saved: ${metadataPath}`);
      }

      return {
        fileName,
        filePath,
        relativePath,
        size: fileBuffer.length,
        metadata,
        url: `/${relativePath}`,
        storageType: 'local'
      };
    } catch (error) {
      logger.error(`Failed to save file ${originalName}:`, error);
      throw new FileSystemError(`Failed to save file: ${error.message}`, options.subDirectory);
    }
  }

  /**
   * Get a file from storage
   * @param {string} fileIdentifier - Relative path to the file
   * @returns {Promise<Object>} - File content and metadata
   */
  async getFile(fileIdentifier) {
    try {
      const filePath = path.join(this.baseDir, fileIdentifier);
      const stats = await fs.stat(filePath);
      const buffer = await fs.readFile(filePath);

      // Try to read metadata from sidecar file
      let metadata = {};
      try {
        const metadataPath = `${filePath}.metadata.json`;
        const metadataContent = await fs.readFile(metadataPath, 'utf-8');
        metadata = JSON.parse(metadataContent);
      } catch (metadataError) {
        // Metadata file doesn't exist or is invalid, that's okay
        logger.debug(`No metadata file found for ${fileIdentifier}`);
      }

      return {
        buffer,
        size: stats.size,
        lastModified: stats.mtime,
        filePath,
        relativePath: fileIdentifier,
        metadata,
        storageType: 'local'
      };
    } catch (error) {
      logger.error(`Failed to get file ${fileIdentifier}:`, error);
      throw new FileSystemError(`Failed to get file: ${error.message}`, fileIdentifier);
    }
  }

  /**
   * Delete a file from storage
   * @param {string} fileIdentifier - Relative path to the file
   * @returns {Promise<boolean>} - True if file was deleted
   */
  async deleteFile(fileIdentifier) {
    try {
      const filePath = path.join(this.baseDir, fileIdentifier);
      await fs.unlink(filePath);
      logger.debug(`File deleted: ${filePath}`);
      
      // Try to delete metadata file if it exists
      try {
        const metadataPath = `${filePath}.metadata.json`;
        await fs.unlink(metadataPath);
        logger.debug(`Metadata file deleted: ${metadataPath}`);
      } catch (metadataError) {
        // Metadata file doesn't exist, that's okay
      }
      
      return true;
    } catch (error) {
      // Don't throw if file doesn't exist
      if (error.code === 'ENOENT') {
        logger.warn(`File not found for deletion: ${fileIdentifier}`);
        return false;
      }

      logger.error(`Failed to delete file ${fileIdentifier}:`, error);
      throw new FileSystemError(`Failed to delete file: ${error.message}`, fileIdentifier);
    }
  }

  /**
   * List files in a directory
   * @param {string} directory - Subdirectory to list
   * @param {Object} options - List options
   * @returns {Promise<Array>} - Array of file information
   */
  async listFiles(directory = '', options = {}) {
    const { extension = null, recursive = false } = options;
    const dirPath = path.join(this.baseDir, directory);

    try {
      // Ensure directory exists
      await this.ensureDirectoryExists(dirPath);

      // Get files in directory
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      let files = [];

      for (const entry of entries) {
        const entryPath = path.join(directory, entry.name);
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory() && recursive) {
          // Recursively get files in subdirectory
          const subFiles = await this.listFiles(entryPath, options);
          files = files.concat(subFiles);
        } else if (entry.isFile()) {
          // Check extension if specified
          if (extension && !entry.name.endsWith(extension)) {
            continue;
          }

          // Get file stats
          const stats = await fs.stat(fullPath);
          files.push({
            name: entry.name,
            path: entryPath,
            size: stats.size,
            lastModified: stats.mtime,
            storageType: 'local'
          });
        }
      }

      return files;
    } catch (error) {
      logger.error(`Failed to list files in ${directory}:`, error);
      throw new FileSystemError(`Failed to list files: ${error.message}`, directory);
    }
  }

  /**
   * Get a URL for a file
   * @param {string} fileIdentifier - Relative path to the file
   * @returns {Promise<string>} - URL to access the file
   */
  async getFileUrl(fileIdentifier) {
    // For local storage, we just return the relative path
    // In a real application, this would be a full URL
    return `/${fileIdentifier}`;
  }

  /**
   * Check if a file exists
   * @param {string} fileIdentifier - Relative path to the file
   * @returns {Promise<boolean>} - True if file exists
   */
  async fileExists(fileIdentifier) {
    try {
      const filePath = path.join(this.baseDir, fileIdentifier);
      await fs.access(filePath, fsSync.constants.F_OK);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Copy a file within the storage
   * @param {string} sourceIdentifier - Source file identifier
   * @param {string} destinationIdentifier - Destination file identifier
   * @returns {Promise<Object>} - Information about the copied file
   */
  async copyFile(sourceIdentifier, destinationIdentifier) {
    try {
      const sourcePath = path.join(this.baseDir, sourceIdentifier);
      const destPath = path.join(this.baseDir, destinationIdentifier);
      
      // Ensure destination directory exists
      const destDir = path.dirname(destPath);
      await this.ensureDirectoryExists(destDir);
      
      // Copy the file
      await fs.copyFile(sourcePath, destPath);
      
      // Get file stats
      const stats = await fs.stat(destPath);
      
      return {
        relativePath: destinationIdentifier,
        size: stats.size,
        lastModified: stats.mtime,
        storageType: 'local'
      };
    } catch (error) {
      logger.error(`Failed to copy file from ${sourceIdentifier} to ${destinationIdentifier}:`, error);
      throw new FileSystemError(`Failed to copy file: ${error.message}`, sourceIdentifier);
    }
  }

  /**
   * Get storage health status
   * @returns {Promise<Object>} - Health status information
   */
  async getHealthStatus() {
    try {
      const permissions = await StorageUtils.checkPermissions(this.baseDir);
      const diskSpace = await StorageUtils.getDiskSpace(this.baseDir);
      
      return {
        status: permissions.readable && permissions.writable ? 'healthy' : 'unhealthy',
        baseDir: this.baseDir,
        permissions,
        diskSpace,
        storageType: 'local'
      };
    } catch (error) {
      return {
        status: 'error',
        baseDir: this.baseDir,
        error: error.message,
        storageType: 'local'
      };
    }
  }

  /**
   * Get file stats (additional method for compatibility)
   * @param {string} fileIdentifier - File identifier
   * @returns {Promise<Object>} - File stats
   */
  async getFileStats(fileIdentifier) {
    try {
      const filePath = path.join(this.baseDir, fileIdentifier);
      const stats = await fs.stat(filePath);
      
      return {
        size: stats.size,
        lastModified: stats.mtime,
        created: stats.birthtime || stats.ctime,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory()
      };
    } catch (error) {
      logger.error(`Failed to get file stats ${fileIdentifier}:`, error);
      throw new FileSystemError(`Failed to get file stats: ${error.message}`, fileIdentifier);
    }
  }
}

module.exports = LocalStorageProvider;
