/**
 * Storage Utilities
 * 
 * Utilities for managing storage directories, permissions, and filesystem operations
 * with proper error handling and production-ready configurations.
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { logger } = require('./logger');

/**
 * Storage configuration helper
 */
class StorageUtils {
  /**
   * Get storage paths from configuration with fallbacks
   * @param {Object} config - Configuration object
   * @returns {Object} - Storage paths configuration
   */
  static getStoragePaths(config) {
    const storageConfig = config.services?.storage?.local || {};
    // Use development-friendly default path if no config provided
    const defaultPath = process.env.NODE_ENV === 'production' ? '/app/storage' : 'storage';
    const basePath = StorageUtils.resolveBasePath(storageConfig.basePath || defaultPath);
    const subdirectories = storageConfig.subdirectories || {};
    
    return {
      base: basePath,
      pdfs: path.resolve(basePath, subdirectories.pdfs || 'pdfs'),
      logs: path.resolve(basePath, subdirectories.logs || 'logs'),
      screenshots: path.resolve(basePath, subdirectories.screenshots || 'permit_screenshots'),
      uploads: path.resolve(basePath, subdirectories.uploads || 'uploads'),
      temp: path.resolve(basePath, subdirectories.temp || 'temp')
    };
  }

  /**
   * Resolve base path to absolute path
   * @param {string} basePath - Base path from configuration
   * @returns {string} - Absolute path
   */
  static resolveBasePath(basePath) {
    if (path.isAbsolute(basePath)) {
      return basePath;
    }
    
    // Resolve relative to project root
    const projectRoot = path.resolve(__dirname, '../../');
    return path.resolve(projectRoot, basePath);
  }

  /**
   * Ensure directory exists with proper permissions
   * @param {string} dirPath - Directory path to create
   * @param {Object} options - Creation options
   * @returns {Promise<boolean>} - True if directory exists or was created
   */
  static async ensureDirectory(dirPath, options = {}) {
    const {
      permissions = 0o755,
      createParents = true,
      skipPermissions = false
    } = options;

    try {
      // Check if directory already exists
      const stats = await fs.stat(dirPath);
      if (stats.isDirectory()) {
        logger.debug(`Directory already exists: ${dirPath}`);
        return true;
      } else {
        throw new Error(`Path exists but is not a directory: ${dirPath}`);
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.error(`Error checking directory ${dirPath}:`, error);
        throw new Error(`Failed to check directory: ${error.message}`);
      }
    }

    try {
      // Create directory with parents if needed
      await fs.mkdir(dirPath, { 
        recursive: createParents,
        mode: skipPermissions ? undefined : permissions
      });
      
      logger.info(`Created storage directory: ${dirPath}`, {
        permissions: permissions.toString(8),
        createParents
      });
      
      return true;
    } catch (error) {
      logger.error(`Failed to create directory ${dirPath}:`, error);
      throw new Error(`Directory creation failed: ${error.message}`);
    }
  }

  /**
   * Check filesystem permissions for a directory
   * @param {string} dirPath - Directory path to check
   * @returns {Promise<Object>} - Permission check results
   */
  static async checkPermissions(dirPath) {
    try {
      // Check if directory exists
      const stats = await fs.stat(dirPath);
      
      if (!stats.isDirectory()) {
        return {
          exists: false,
          isDirectory: false,
          readable: false,
          writable: false,
          error: 'Path is not a directory'
        };
      }

      // Test read access
      let readable = false;
      try {
        await fs.access(dirPath, fsSync.constants.R_OK);
        readable = true;
      } catch (error) {
        logger.warn(`No read access to ${dirPath}:`, error.message);
      }

      // Test write access
      let writable = false;
      try {
        await fs.access(dirPath, fsSync.constants.W_OK);
        writable = true;
      } catch (error) {
        logger.warn(`No write access to ${dirPath}:`, error.message);
      }

      return {
        exists: true,
        isDirectory: true,
        readable,
        writable,
        size: stats.size,
        mode: stats.mode,
        permissions: (stats.mode & parseInt('777', 8)).toString(8)
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return {
          exists: false,
          isDirectory: false,
          readable: false,
          writable: false,
          error: 'Directory does not exist'
        };
      }
      
      logger.error(`Error checking permissions for ${dirPath}:`, error);
      return {
        exists: false,
        isDirectory: false,
        readable: false,
        writable: false,
        error: error.message
      };
    }
  }

  /**
   * Get disk space information for a path
   * @param {string} dirPath - Directory path to check
   * @returns {Promise<Object>} - Disk space information
   */
  static async getDiskSpace(dirPath) {
    try {
      const stats = await fs.statvfs ? fs.statvfs(dirPath) : null;
      
      if (!stats) {
        // Fallback method for systems without statvfs
        return {
          available: 'unknown',
          total: 'unknown',
          used: 'unknown',
          percentUsed: 'unknown'
        };
      }

      const blockSize = stats.f_bsize;
      const totalBlocks = stats.f_blocks;
      const freeBlocks = stats.f_bavail;
      const usedBlocks = totalBlocks - freeBlocks;

      const total = totalBlocks * blockSize;
      const available = freeBlocks * blockSize;
      const used = usedBlocks * blockSize;
      const percentUsed = totalBlocks > 0 ? Math.round((usedBlocks / totalBlocks) * 100) : 0;

      return {
        available: this.formatBytes(available),
        total: this.formatBytes(total),
        used: this.formatBytes(used),
        percentUsed: `${percentUsed}%`,
        availableBytes: available,
        totalBytes: total,
        usedBytes: used
      };
    } catch (error) {
      logger.error(`Error getting disk space for ${dirPath}:`, error);
      return {
        available: 'error',
        total: 'error',
        used: 'error',
        percentUsed: 'error',
        error: error.message
      };
    }
  }

  /**
   * Format bytes to human readable format
   * @param {number} bytes - Bytes to format
   * @returns {string} - Formatted string
   */
  static formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Initialize all storage directories from configuration
   * @param {Object} config - Configuration object
   * @returns {Promise<Object>} - Initialization results
   */
  static async initializeStorageDirectories(config) {
    const paths = StorageUtils.getStoragePaths(config);
    const results = {};
    const permissions = config.services?.storage?.local?.permissions?.dirs || 0o755;

    logger.info('Initializing storage directories', { paths });

    for (const [name, dirPath] of Object.entries(paths)) {
      try {
        await StorageUtils.ensureDirectory(dirPath, { 
          permissions,
          createParents: true 
        });
        
        const permissionCheck = await StorageUtils.checkPermissions(dirPath);
        
        results[name] = {
          path: dirPath,
          status: 'success',
          permissions: permissionCheck
        };
        
        logger.info(`Storage directory initialized: ${name}`, {
          path: dirPath,
          readable: permissionCheck.readable,
          writable: permissionCheck.writable
        });
      } catch (error) {
        results[name] = {
          path: dirPath,
          status: 'error',
          error: error.message
        };
        
        logger.error(`Failed to initialize storage directory: ${name}`, {
          path: dirPath,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Health check for storage directories
   * @param {Object} config - Configuration object
   * @returns {Promise<Object>} - Health check results
   */
  static async healthCheck(config) {
    const paths = StorageUtils.getStoragePaths(config);
    const results = {
      status: 'healthy',
      directories: {},
      summary: {
        total: Object.keys(paths).length,
        healthy: 0,
        unhealthy: 0
      }
    };

    for (const [name, dirPath] of Object.entries(paths)) {
      try {
        const permissions = await StorageUtils.checkPermissions(dirPath);
        const diskSpace = await StorageUtils.getDiskSpace(dirPath);
        
        const isHealthy = permissions.exists && 
                         permissions.isDirectory && 
                         permissions.readable && 
                         permissions.writable;
        
        results.directories[name] = {
          path: dirPath,
          status: isHealthy ? 'healthy' : 'unhealthy',
          permissions,
          diskSpace,
          issues: []
        };

        if (!permissions.exists) {
          results.directories[name].issues.push('Directory does not exist');
        }
        if (!permissions.readable) {
          results.directories[name].issues.push('No read permission');
        }
        if (!permissions.writable) {
          results.directories[name].issues.push('No write permission');
        }

        if (isHealthy) {
          results.summary.healthy++;
        } else {
          results.summary.unhealthy++;
        }
      } catch (error) {
        results.directories[name] = {
          path: dirPath,
          status: 'error',
          error: error.message,
          issues: ['Health check failed']
        };
        results.summary.unhealthy++;
      }
    }

    if (results.summary.unhealthy > 0) {
      results.status = 'unhealthy';
    }

    return results;
  }
}

module.exports = StorageUtils;