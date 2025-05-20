/**
 * Storage Provider Interface
 * 
 * This file defines the interface that all storage providers must implement.
 * It serves as a contract for both local filesystem and cloud storage implementations.
 */

/**
 * @interface StorageProvider
 * Abstract interface for storage providers
 */
class StorageProvider {
  /**
   * Save a file to storage
   * @param {Buffer} fileBuffer - File content as buffer
   * @param {Object} options - Save options
   * @param {string} options.originalName - Original filename
   * @param {string} options.subDirectory - Subdirectory within storage
   * @param {string} options.prefix - Filename prefix
   * @param {Object} options.metadata - Additional metadata
   * @returns {Promise<Object>} - File information including path/url
   */
  async saveFile(fileBuffer, options = {}) {
    throw new Error('Method saveFile() must be implemented by storage provider');
  }

  /**
   * Get a file from storage
   * @param {string} fileIdentifier - File identifier (path or key)
   * @returns {Promise<Object>} - File content and metadata
   */
  async getFile(fileIdentifier) {
    throw new Error('Method getFile() must be implemented by storage provider');
  }

  /**
   * Delete a file from storage
   * @param {string} fileIdentifier - File identifier (path or key)
   * @returns {Promise<boolean>} - True if file was deleted
   */
  async deleteFile(fileIdentifier) {
    throw new Error('Method deleteFile() must be implemented by storage provider');
  }

  /**
   * List files in a directory/prefix
   * @param {string} directory - Directory/prefix to list
   * @param {Object} options - List options
   * @returns {Promise<Array>} - Array of file information
   */
  async listFiles(directory = '', options = {}) {
    throw new Error('Method listFiles() must be implemented by storage provider');
  }

  /**
   * Get a URL for a file
   * @param {string} fileIdentifier - File identifier (path or key)
   * @param {Object} options - URL options (e.g. expiration)
   * @returns {Promise<string>} - URL to access the file
   */
  async getFileUrl(fileIdentifier, options = {}) {
    throw new Error('Method getFileUrl() must be implemented by storage provider');
  }

  /**
   * Check if a file exists
   * @param {string} fileIdentifier - File identifier (path or key)
   * @returns {Promise<boolean>} - True if file exists
   */
  async fileExists(fileIdentifier) {
    throw new Error('Method fileExists() must be implemented by storage provider');
  }

  /**
   * Copy a file within the storage
   * @param {string} sourceIdentifier - Source file identifier
   * @param {string} destinationIdentifier - Destination file identifier
   * @param {Object} options - Copy options
   * @returns {Promise<Object>} - Information about the copied file
   */
  async copyFile(sourceIdentifier, destinationIdentifier, options = {}) {
    throw new Error('Method copyFile() must be implemented by storage provider');
  }
}

module.exports = StorageProvider;
