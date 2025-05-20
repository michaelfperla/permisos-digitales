/**
 * Local Filesystem Storage Provider
 * 
 * Implementation of the StorageProvider interface for local filesystem storage.
 */
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');
const { logger } = require('../../utils/enhanced-logger');
const StorageProvider = require('./storage-provider.interface');
const { FileSystemError } = require('../../utils/errors');

class LocalStorageProvider extends StorageProvider {
  /**
   * Initialize the local storage provider
   * @param {string} baseDir - Base directory for file storage
   */
  constructor(baseDir) {
    super();
    this.baseDir = baseDir;
    this.ensureDirectoryExists(baseDir)
      .then(() => logger.info(`Local storage provider initialized with base directory: ${baseDir}`))
      .catch(error => logger.error(`Failed to initialize local storage provider: ${error.message}`));
  }

  /**
   * Ensure a directory exists
   * @param {string} dirPath - Directory path
   * @returns {Promise<void>}
   */
  async ensureDirectoryExists(dirPath) {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      logger.error(`Failed to create directory ${dirPath}:`, error);
      throw new FileSystemError(`Failed to create directory: ${error.message}`, dirPath);
    }
  }

  /**
   * Generate a unique filename
   * @param {string} originalName - Original filename
   * @param {string} prefix - Optional prefix for the filename
   * @returns {string} - Generated filename
   */
  generateFileName(originalName, prefix = '') {
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
      metadata = {}
    } = options;

    try {
      // Create full directory path
      const dirPath = path.join(this.baseDir, subDirectory);
      await this.ensureDirectoryExists(dirPath);

      // Generate unique filename
      const fileName = this.generateFileName(originalName, prefix);
      const filePath = path.join(dirPath, fileName);
      const relativePath = path.join(subDirectory, fileName).replace(/\\/g, '/');

      // Write file
      await fs.writeFile(filePath, fileBuffer);
      logger.debug(`File saved: ${filePath}`);

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

      return {
        buffer,
        size: stats.size,
        lastModified: stats.mtime,
        filePath,
        relativePath: fileIdentifier,
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
}

module.exports = LocalStorageProvider;
