# PDF Storage Migration Guide

This document provides information about the storage abstraction layer implemented to support both local filesystem and AWS S3 cloud storage for PDF documents.

## Overview

The storage abstraction layer provides a unified interface for file storage operations, abstracting away the details of the underlying storage provider. This allows for a seamless transition from local filesystem to AWS S3 cloud storage when needed.

## Architecture

The storage abstraction layer consists of the following components:

1. **StorageProvider Interface**: Defines the contract that all storage providers must implement.
2. **LocalStorageProvider**: Implementation of the StorageProvider interface for local filesystem storage.
3. **S3StorageProvider**: Implementation of the StorageProvider interface for AWS S3 cloud storage.
4. **StorageService**: Main service that uses the appropriate provider based on configuration.
5. **PdfStorageService**: Specialized service for handling PDF storage operations.

## File Structure

```
src/
  services/
    storage/
      storage-provider.interface.js  # Interface for storage providers
      local-storage-provider.js      # Local filesystem implementation
      s3-storage-provider.js         # AWS S3 implementation (placeholder)
      storage-service.js             # Main storage service
      pdf-storage-service.js         # PDF-specific storage service
      index.js                       # Exports all storage services
    pdf-service.js                   # Backward-compatible PDF service
```

## Configuration

The storage type is configured in the environment variables:

```
# Storage Configuration
# Options: 'local' or 's3'
STORAGE_TYPE=local

# AWS S3 Configuration (only needed if STORAGE_TYPE=s3)
S3_BUCKET=your-bucket-name
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=your-access-key-id
S3_SECRET_ACCESS_KEY=your-secret-access-key
S3_ENDPOINT=https://custom-endpoint.example.com # Optional, for non-AWS S3 compatible services
S3_URL_EXPIRATION=3600 # URL expiration in seconds, default 1 hour
```

## Usage

### Backend Usage

```javascript
// Using the PDF service (backward-compatible)
const pdfService = require('./services/pdf-service');

// Get a PDF file
const pdfFile = await pdfService.getPdf('pdfs/example.pdf');

// Get a URL for a PDF file
const pdfUrl = await pdfService.getPdfUrl('pdfs/example.pdf');

// Copy a PDF to the user downloads directory
const copyResult = await pdfService.copyPermitToUserDownloads(
  'example.pdf',
  123,
  'permiso',
  'ABC123',
  false
);
```

### Frontend Usage

```typescript
// Using the application service to download PDFs
import applicationService from '../services/applicationService';

// Download a permit PDF
const permitPdf = await applicationService.downloadPermit('123', 'permiso');

// Download a receipt PDF
const receiptPdf = await applicationService.downloadPermit('123', 'recibo');

// Download a certificate PDF
const certificatePdf = await applicationService.downloadPermit('123', 'certificado');

// Download a license plates PDF
const platesPdf = await applicationService.downloadPermit('123', 'placas');
```

## Migrating to S3

To migrate from local filesystem to AWS S3 cloud storage:

1. Set up an AWS S3 bucket and create an IAM user with appropriate permissions.
2. Update the environment variables to use S3:
   ```
   STORAGE_TYPE=s3
   S3_BUCKET=your-bucket-name
   S3_REGION=us-east-1
   S3_ACCESS_KEY_ID=your-access-key-id
   S3_SECRET_ACCESS_KEY=your-secret-access-key
   ```
3. Implement the S3StorageProvider methods (currently placeholders).
4. Migrate existing files from local storage to S3 (optional).

## Implementation Details

### StorageProvider Interface

The StorageProvider interface defines the following methods:

- `saveFile(fileBuffer, options)`: Save a file to storage.
- `getFile(fileIdentifier)`: Get a file from storage.
- `deleteFile(fileIdentifier)`: Delete a file from storage.
- `listFiles(directory, options)`: List files in a directory/prefix.
- `getFileUrl(fileIdentifier, options)`: Get a URL for a file.
- `fileExists(fileIdentifier)`: Check if a file exists.
- `copyFile(sourceIdentifier, destinationIdentifier, options)`: Copy a file within the storage.

### LocalStorageProvider

The LocalStorageProvider implements the StorageProvider interface for local filesystem storage. It uses the Node.js `fs` module to perform file operations.

### S3StorageProvider

The S3StorageProvider implements the StorageProvider interface for AWS S3 cloud storage. It uses the AWS SDK for JavaScript to interact with S3.

### StorageService

The StorageService provides a unified interface for file storage operations. It uses the appropriate provider based on the `STORAGE_TYPE` configuration.

### PdfStorageService

The PdfStorageService provides PDF-specific storage operations. It uses the StorageService internally and adds PDF-specific functionality.

## Backward Compatibility

The storage abstraction layer maintains backward compatibility with existing code through the `pdf-service.js` module, which now delegates to the new PdfStorageService.

## Future Improvements

- Implement file lifecycle management (automatic cleanup of old files).
- Add support for other cloud storage providers (Azure Blob Storage, Google Cloud Storage).
- Implement file compression/decompression.
- Add support for file encryption/decryption.
- Implement file streaming for large files.

## Completing the S3 Implementation

To complete the S3 implementation, you'll need to:

1. Install the AWS SDK for JavaScript:
   ```
   npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
   ```

2. Implement the methods in the S3StorageProvider class:
   - Uncomment and complete the constructor code to initialize the S3 client.
   - Implement the `saveFile` method to upload files to S3.
   - Implement the `getFile` method to download files from S3.
   - Implement the `deleteFile` method to delete files from S3.
   - Implement the `listFiles` method to list files in an S3 prefix.
   - Implement the `getFileUrl` method to generate pre-signed URLs for S3 objects.
   - Implement the `fileExists` method to check if a file exists in S3.
   - Implement the `copyFile` method to copy files within S3.

3. Test the S3 implementation with a real S3 bucket.

4. Update the documentation with any additional S3-specific configuration options.

## Testing

The storage abstraction layer includes tests for both the local filesystem and S3 implementations. To run the tests:

```
npm test
```

## Troubleshooting

If you encounter issues with the storage abstraction layer, check the following:

- Make sure the environment variables are set correctly.
- Check the logs for error messages.
- Verify that the storage directories exist and have the correct permissions.
- If using S3, verify that the IAM user has the correct permissions.
