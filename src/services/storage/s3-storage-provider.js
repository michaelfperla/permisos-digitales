/**
 * AWS S3 Storage Provider
 *
 * Implementation of the StorageProvider interface for AWS S3 storage.
 * Provides full S3 integration for file upload, download, delete, and management operations.
 */
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { logger } = require('../../utils/logger');
const { ExternalServiceError, NotFoundError } = require('../../utils/errors');
const StorageProvider = require('./storage-provider.interface');
const path = require('path');
const crypto = require('crypto');

class S3StorageProvider extends StorageProvider {
  /**
   * Initialize the S3 storage provider
   * @param {Object} options - S3 configuration options
   * @param {string} options.bucket - S3 bucket name
   * @param {string} options.region - AWS region
   * @param {string} options.accessKeyId - AWS access key ID
   * @param {string} options.secretAccessKey - AWS secret access key
   * @param {string} options.endpoint - Custom endpoint (optional, for testing or non-AWS S3 compatible services)
   */
  constructor(options) {
    super();

    // Validate required options
    if (!options.bucket) {
      throw new Error('S3 bucket name is required');
    }
    if (!options.region) {
      throw new Error('AWS region is required');
    }

    this.bucket = options.bucket;
    this.region = options.region;

    // Initialize S3 client
    const clientConfig = {
      region: options.region
    };

    // Only set explicit credentials if provided, otherwise use default credential chain (IAM roles, etc.)
    if (options.accessKeyId && options.secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey
      };
      logger.info('S3 storage provider using explicit credentials');
    } else {
      logger.info('S3 storage provider using default AWS credential chain (IAM instance profile, environment, etc.)');
    }

    // Add custom endpoint if provided (useful for testing with LocalStack)
    if (options.endpoint) {
      clientConfig.endpoint = options.endpoint;
      clientConfig.forcePathStyle = true; // Required for custom endpoints
    }

    this.s3Client = new S3Client(clientConfig);

    logger.info(`S3 storage provider initialized with bucket: ${this.bucket} in region: ${this.region}`);
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
      // Replace spaces with underscores for URL compatibility
      return sanitized.replace(/\s+/g, '_');
    }
    
    // Otherwise, generate a unique filename
    const extension = path.extname(originalName) || '';
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString('hex');
    return `${prefix}${prefix ? '_' : ''}${timestamp}_${randomString}${extension}`;
  }

  /**
   * Save a file to S3
   * @param {Buffer} fileBuffer - File content as buffer
   * @param {Object} options - Save options
   * @param {string} options.originalName - Original filename
   * @param {string} options.subDirectory - Subdirectory within bucket
   * @param {string} options.prefix - Filename prefix
   * @param {Object} options.metadata - Additional metadata
   * @param {string} options.contentType - Content type (auto-detected if not provided)
   * @returns {Promise<Object>} - File information
   */
  async saveFile(fileBuffer, options = {}) {
    const {
      originalName = 'file',
      subDirectory = '',
      prefix = '',
      metadata = {},
      contentType = null,
      preserveOriginalFilename = false
    } = options;

    try {
      // Generate unique filename and S3 key
      const fileName = this.generateFileName(originalName, prefix, preserveOriginalFilename);
      const key = subDirectory ? `${subDirectory}/${fileName}` : fileName;

      // Determine content type
      const detectedContentType = contentType || this.getContentTypeFromPath(originalName);

      // Prepare S3 upload parameters
      const uploadParams = {
        Bucket: this.bucket,
        Key: key,
        Body: fileBuffer,
        ContentType: detectedContentType,
        Metadata: {
          originalName: originalName,
          uploadedAt: new Date().toISOString(),
          ...metadata
        }
      };

      // Upload file to S3
      const command = new PutObjectCommand(uploadParams);
      const result = await this.s3Client.send(command);

      logger.info(`File uploaded to S3: ${key}`, {
        bucket: this.bucket,
        key,
        size: fileBuffer.length,
        contentType: detectedContentType,
        etag: result.ETag
      });

      return {
        fileName,
        key,
        size: fileBuffer.length,
        contentType: detectedContentType,
        metadata: uploadParams.Metadata,
        etag: result.ETag,
        url: `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`,
        storageType: 's3'
      };
    } catch (error) {
      logger.error(`Failed to upload file to S3: ${error.message}`, {
        bucket: this.bucket,
        originalName,
        error: error.message
      });
      throw new ExternalServiceError(
        `Failed to upload file to S3: ${error.message}`,
        'S3',
        error.code
      );
    }
  }

  /**
   * Get a file from S3
   * @param {string} fileIdentifier - S3 key
   * @returns {Promise<Object>} - File content and metadata
   */
  async getFile(fileIdentifier) {
    try {
      // Get object from S3
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: fileIdentifier
      });

      const result = await this.s3Client.send(command);

      // Convert stream to buffer
      const chunks = [];
      for await (const chunk of result.Body) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      logger.debug(`File retrieved from S3: ${fileIdentifier}`, {
        bucket: this.bucket,
        key: fileIdentifier,
        size: buffer.length,
        contentType: result.ContentType
      });

      return {
        buffer,
        size: buffer.length,
        contentType: result.ContentType,
        lastModified: result.LastModified,
        etag: result.ETag,
        metadata: result.Metadata || {},
        key: fileIdentifier
      };
    } catch (error) {
      if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
        logger.warn(`File not found in S3: ${fileIdentifier}`, {
          bucket: this.bucket,
          key: fileIdentifier
        });
        throw new NotFoundError(`File not found: ${fileIdentifier}`);
      }

      logger.error(`Failed to get file from S3: ${error.message}`, {
        bucket: this.bucket,
        key: fileIdentifier,
        error: error.message
      });
      throw new ExternalServiceError(
        `Failed to get file from S3: ${error.message}`,
        'S3',
        error.code
      );
    }
  }

  /**
   * Delete a file from S3
   * @param {string} fileIdentifier - S3 key
   * @returns {Promise<boolean>} - True if file was deleted
   */
  async deleteFile(fileIdentifier) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: fileIdentifier
      });

      await this.s3Client.send(command);

      logger.info(`File deleted from S3: ${fileIdentifier}`, {
        bucket: this.bucket,
        key: fileIdentifier
      });

      return true;
    } catch (error) {
      // S3 delete doesn't fail if the object doesn't exist, but we'll handle other errors
      logger.error(`Failed to delete file from S3: ${error.message}`, {
        bucket: this.bucket,
        key: fileIdentifier,
        error: error.message
      });
      throw new ExternalServiceError(
        `Failed to delete file from S3: ${error.message}`,
        'S3',
        error.code
      );
    }
  }

  /**
   * List files in an S3 prefix
   * @param {string} directory - S3 prefix
   * @param {Object} options - List options
   * @param {string} options.extension - Filter by extension
   * @param {number} options.maxKeys - Maximum number of keys to return
   * @returns {Promise<Array>} - Array of file information
   */
  async listFiles(directory = '', options = {}) {
    const { extension = null, maxKeys = 1000 } = options;

    try {
      const prefix = directory ? `${directory}/` : '';

      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        MaxKeys: maxKeys
      });

      const result = await this.s3Client.send(command);

      if (!result.Contents) {
        return [];
      }

      let files = result.Contents.map(object => ({
        name: path.basename(object.Key),
        key: object.Key,
        size: object.Size,
        lastModified: object.LastModified,
        etag: object.ETag
      }));

      // Filter by extension if specified
      if (extension) {
        files = files.filter(file =>
          path.extname(file.name).toLowerCase() === extension.toLowerCase()
        );
      }

      logger.debug(`Listed ${files.length} files from S3 prefix: ${prefix}`, {
        bucket: this.bucket,
        prefix,
        totalObjects: result.Contents.length,
        filteredFiles: files.length
      });

      return files;
    } catch (error) {
      logger.error(`Failed to list files from S3: ${error.message}`, {
        bucket: this.bucket,
        directory,
        error: error.message
      });
      throw new ExternalServiceError(
        `Failed to list files from S3: ${error.message}`,
        'S3',
        error.code
      );
    }
  }

  /**
   * Get a pre-signed URL for an S3 object
   * @param {string} fileIdentifier - S3 key
   * @param {Object} options - URL options
   * @param {number} options.expiresIn - URL expiration in seconds (default: 3600)
   * @param {string} options.operation - Operation type ('getObject' or 'putObject', default: 'getObject')
   * @returns {Promise<string>} - Pre-signed URL
   */
  async getFileUrl(fileIdentifier, options = {}) {
    const { expiresIn = 3600, operation = 'getObject', responseContentDisposition } = options;

    try {
      let command;

      if (operation === 'putObject') {
        command = new PutObjectCommand({
          Bucket: this.bucket,
          Key: fileIdentifier
        });
      } else {
        // Extract filename from the key for content-disposition
        const filename = path.basename(fileIdentifier);
        const params = {
          Bucket: this.bucket,
          Key: fileIdentifier,
          ResponseContentType: 'application/pdf'
        };
        
        // Add content-disposition header to force download
        if (responseContentDisposition !== false) {
          // Use 'attachment' to force download instead of 'inline' which displays in browser
          params.ResponseContentDisposition = `attachment; filename="${filename}"`;
        }
        
        command = new GetObjectCommand(params);
      }

      const url = await getSignedUrl(this.s3Client, command, { expiresIn });

      logger.debug(`Generated pre-signed URL for S3 object: ${fileIdentifier}`, {
        bucket: this.bucket,
        key: fileIdentifier,
        operation,
        expiresIn
      });

      return url;
    } catch (error) {
      logger.error(`Failed to generate pre-signed URL: ${error.message}`, {
        bucket: this.bucket,
        key: fileIdentifier,
        operation,
        error: error.message
      });
      throw new ExternalServiceError(
        `Failed to generate pre-signed URL: ${error.message}`,
        'S3',
        error.code
      );
    }
  }

  /**
   * Check if a file exists in S3
   * @param {string} fileIdentifier - S3 key
   * @returns {Promise<boolean>} - True if file exists
   */
  async fileExists(fileIdentifier) {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: fileIdentifier
      });

      await this.s3Client.send(command);

      logger.debug(`File exists in S3: ${fileIdentifier}`, {
        bucket: this.bucket,
        key: fileIdentifier
      });

      return true;
    } catch (error) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        logger.debug(`File does not exist in S3: ${fileIdentifier}`, {
          bucket: this.bucket,
          key: fileIdentifier
        });
        return false;
      }

      logger.error(`Failed to check file existence in S3: ${error.message}`, {
        bucket: this.bucket,
        key: fileIdentifier,
        error: error.message
      });
      throw new ExternalServiceError(
        `Failed to check file existence in S3: ${error.message}`,
        'S3',
        error.code
      );
    }
  }

  /**
   * Copy a file within S3
   * @param {string} sourceIdentifier - Source S3 key
   * @param {string} destinationIdentifier - Destination S3 key
   * @param {Object} options - Copy options
   * @returns {Promise<Object>} - Information about the copied file
   */
  async copyFile(sourceIdentifier, destinationIdentifier, options = {}) {
    try {
      const command = new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${sourceIdentifier}`,
        Key: destinationIdentifier,
        MetadataDirective: 'COPY'
      });

      const result = await this.s3Client.send(command);

      logger.info(`File copied in S3: ${sourceIdentifier} -> ${destinationIdentifier}`, {
        bucket: this.bucket,
        sourceKey: sourceIdentifier,
        destinationKey: destinationIdentifier,
        etag: result.CopyObjectResult?.ETag
      });

      return {
        sourceKey: sourceIdentifier,
        destinationKey: destinationIdentifier,
        etag: result.CopyObjectResult?.ETag,
        lastModified: result.CopyObjectResult?.LastModified,
        storageType: 's3'
      };
    } catch (error) {
      logger.error(`Failed to copy file in S3: ${error.message}`, {
        bucket: this.bucket,
        sourceKey: sourceIdentifier,
        destinationKey: destinationIdentifier,
        error: error.message
      });
      throw new ExternalServiceError(
        `Failed to copy file in S3: ${error.message}`,
        'S3',
        error.code
      );
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
      '.svg': 'image/svg+xml',
      '.txt': 'text/plain',
      '.html': 'text/html',
      '.htm': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.zip': 'application/zip',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };

    return contentTypes[extension] || 'application/octet-stream';
  }
}

module.exports = S3StorageProvider;
