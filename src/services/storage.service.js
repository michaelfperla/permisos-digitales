/**
 * File Storage Service
 * Handles file operations with better abstraction and error handling
 */
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { logger } = require('../utils/enhanced-logger');
const { FileSystemError } = require('../utils/errors');

class StorageService {
  /**
   * Initialize the storage service
   * @param {string} baseDir - Base directory for file storage
   */
  constructor(baseDir) {
    this.baseDir = baseDir;
    this.ensureDirectoryExists(baseDir)
      .then(() => logger.info(`Storage service initialized with base directory: ${baseDir}`))
      .catch(error => logger.error(`Failed to initialize storage service: ${error.message}`));
  }

  /**
   * Ensure a directory exists, creating it if necessary
   * @param {string} dirPath - Directory path
   * @returns {Promise<boolean>} - True if directory exists or was created
   * @throws {FileSystemError} - If directory creation fails
   */
  async ensureDirectoryExists(dirPath) {
    try {
      await fs.mkdir(dirPath, { recursive: true });
      return true;
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
   * @param {string} options.originalName - Original filename
   * @param {string} options.subDirectory - Subdirectory within base directory
   * @param {string} options.prefix - Filename prefix
   * @param {Object} options.metadata - Additional metadata
   * @returns {Promise<Object>} - File information
   * @throws {FileSystemError} - If file save fails
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
        url: `/${relativePath}`
      };
    } catch (error) {
      logger.error(`Failed to save file ${originalName}:`, error);
      throw new FileSystemError(`Failed to save file: ${error.message}`, options.subDirectory);
    }
  }

  /**
   * Save a file from a path (e.g., from multer upload)
   * @param {string} sourcePath - Source file path
   * @param {Object} options - Save options
   * @returns {Promise<Object>} - File information
   * @throws {FileSystemError} - If file save fails
   *
   * Note: This function was previously used for handling manual payment proofs,
   * which are now being replaced with a third-party payment provider integration.
   */
  async saveFileFromPath(sourcePath, options = {}) {
    try {
      const fileBuffer = await fs.readFile(sourcePath);
      const originalName = options.originalName || path.basename(sourcePath);

      const result = await this.saveFile(fileBuffer, {
        ...options,
        originalName
      });

      // Optionally remove the source file
      if (options.removeSource) {
        try {
          await fs.unlink(sourcePath);
          logger.debug(`Source file removed: ${sourcePath}`);
        } catch (unlinkError) {
          logger.warn(`Failed to remove source file ${sourcePath}:`, unlinkError);
        }
      }

      return result;
    } catch (error) {
      logger.error(`Failed to save file from path ${sourcePath}:`, error);
      throw new FileSystemError(`Failed to save file from path: ${error.message}`, sourcePath);
    }
  }

  /**
   * Get a file from storage
   * @param {string} relativePath - Relative path to the file
   * @returns {Promise<Object>} - File content and metadata
   * @throws {FileSystemError} - If file retrieval fails
   *
   * Note: This function was previously used for retrieving manual payment proofs,
   * which are now being replaced with a third-party payment provider integration.
   */
  async getFile(relativePath) {
    try {
      const filePath = path.join(this.baseDir, relativePath);
      const stats = await fs.stat(filePath);
      const buffer = await fs.readFile(filePath);

      return {
        buffer,
        size: stats.size,
        lastModified: stats.mtime,
        filePath,
        relativePath
      };
    } catch (error) {
      logger.error(`Failed to get file ${relativePath}:`, error);
      throw new FileSystemError(
        error.code === 'ENOENT' ? 'File not found' : `Failed to get file: ${error.message}`,
        relativePath
      );
    }
  }

  /**
   * Check if a file exists
   * @param {string} relativePath - Relative path to the file
   * @returns {Promise<boolean>} - True if file exists
   */
  async fileExists(relativePath) {
    try {
      const filePath = path.join(this.baseDir, relativePath);
      await fs.access(filePath, fs.constants.F_OK);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Delete a file from storage
   * @param {string} relativePath - Relative path to the file
   * @returns {Promise<boolean>} - True if file was deleted
   * @throws {FileSystemError} - If file deletion fails
   */
  async deleteFile(relativePath) {
    try {
      const filePath = path.join(this.baseDir, relativePath);
      await fs.unlink(filePath);
      logger.debug(`File deleted: ${filePath}`);
      return true;
    } catch (error) {
      // Don't throw if file doesn't exist
      if (error.code === 'ENOENT') {
        logger.warn(`File not found for deletion: ${relativePath}`);
        return false;
      }

      logger.error(`Failed to delete file ${relativePath}:`, error);
      throw new FileSystemError(`Failed to delete file: ${error.message}`, relativePath);
    }
  }

  /**
   * List files in a directory
   * @param {string} subDirectory - Subdirectory to list
   * @param {Object} options - List options
   * @param {string} options.extension - Filter by extension
   * @param {boolean} options.recursive - Include subdirectories
   * @returns {Promise<Array>} - Array of file information
   * @throws {FileSystemError} - If directory listing fails
   */
  async listFiles(subDirectory = '', options = {}) {
    const { extension = null, recursive = false } = options;
    const dirPath = path.join(this.baseDir, subDirectory);

    try {
      // Ensure directory exists
      await this.ensureDirectoryExists(dirPath);

      // Get files in directory
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      let files = [];

      for (const entry of entries) {
        const entryPath = path.join(subDirectory, entry.name);
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory() && recursive) {
          // Recursively get files from subdirectory
          const subFiles = await this.listFiles(entryPath, options);
          files = files.concat(subFiles);
        } else if (entry.isFile()) {
          // Check extension if specified
          if (extension && path.extname(entry.name).toLowerCase() !== extension.toLowerCase()) {
            continue;
          }

          // Get file stats
          const stats = await fs.stat(fullPath);

          files.push({
            name: entry.name,
            relativePath: entryPath.replace(/\\/g, '/'),
            size: stats.size,
            lastModified: stats.mtime
          });
        }
      }

      return files;
    } catch (error) {
      logger.error(`Failed to list files in ${subDirectory}:`, error);
      throw new FileSystemError(`Failed to list files: ${error.message}`, subDirectory);
    }
  }
}

// Create and export a singleton instance
const storageService = new StorageService(path.join(__dirname, '../../storage'));

// Export both the class and the instance
module.exports = storageService;
module.exports.StorageService = StorageService;
