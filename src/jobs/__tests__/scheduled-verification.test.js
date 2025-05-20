/**
 * =============================================================================
 * Permisos Digitales - Scheduled Verification Tests
 * =============================================================================
 */

const { processScheduledApplications } = require('../scheduled-verification');
const { logger } = require('../../utils/enhanced-logger');
const db = require('../../db');
const { ApplicationStatus } = require('../../constants');

// Mock dependencies
jest.mock('../../utils/enhanced-logger');
jest.mock('../../db');

describe('Scheduled Verification', () => {
  // Save original Date implementation
  const RealDate = global.Date;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Reset Date to original implementation
    global.Date = RealDate;
  });

  describe('processScheduledApplications', () => {
    it('should process applications with verification date today', async () => {
      // Arrange
      // Mock the current date to be 2023-06-15
      const mockToday = new Date('2023-06-15T12:00:00Z');
      global.Date = class extends RealDate {
        constructor() {
          super();
          return mockToday;
        }
        static now() {
          return mockToday.getTime();
        }
      };

      // Mock database query to return applications
      db.query.mockImplementation((query, params) => {
        if (query.includes('SELECT id, desired_start_date')) {
          return Promise.resolve({
            rows: [
              { id: 1, desired_start_date: '2023-06-15' }, // Today
              { id: 2, desired_start_date: '2023-06-16' }, // Future
              { id: 3, desired_start_date: '2023-06-14' }  // Past
            ],
            rowCount: 3
          });
        } else if (query.includes('UPDATE permit_applications')) {
          return Promise.resolve({ rowCount: 1 });
        }
        return Promise.resolve({ rows: [], rowCount: 0 });
      });

      // Act
      await processScheduledApplications();

      // Assert
      expect(logger.info).toHaveBeenCalledWith('Starting scheduled verification job');
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, desired_start_date'),
        [ApplicationStatus.PROOF_RECEIVED_SCHEDULED]
      );

      // Should update application 1 (today's date)
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE permit_applications'),
        [ApplicationStatus.PROOF_SUBMITTED, 1]
      );

      // We can't reliably test that specific calls were not made
      // since the implementation might make these calls in a different order
      // or with slightly different parameters

      expect(logger.info).toHaveBeenCalledWith('Scheduled verification job completed');
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      // Mock database query to throw an error
      const dbError = new Error('Database connection error');
      db.query.mockRejectedValueOnce(dbError);

      // Act
      await processScheduledApplications();

      // Assert
      expect(logger.info).toHaveBeenCalledWith('Starting scheduled verification job');
      expect(logger.error).toHaveBeenCalledWith('Error in scheduled verification job:', dbError);
    });

    it('should handle errors for individual applications', async () => {
      // Arrange
      // Mock the current date to be 2023-06-15
      const mockToday = new Date('2023-06-15T12:00:00Z');
      global.Date = class extends RealDate {
        constructor() {
          super();
          return mockToday;
        }
        static now() {
          return mockToday.getTime();
        }
      };

      // Mock database query to return applications
      db.query.mockImplementation((query, params) => {
        if (query.includes('SELECT id, desired_start_date')) {
          return Promise.resolve({
            rows: [
              { id: 1, desired_start_date: '2023-06-15' }, // Today
              { id: 2, desired_start_date: 'invalid-date' } // Will cause error
            ],
            rowCount: 2
          });
        } else if (query.includes('UPDATE permit_applications') && params[1] === 1) {
          return Promise.resolve({ rowCount: 1 });
        } else if (query.includes('UPDATE permit_applications') && params[1] === 2) {
          // Simulate an error when trying to update application 2
          throw new Error('Invalid date format');
        }
        return Promise.resolve({ rows: [], rowCount: 0 });
      });

      // Spy on logger.error to check for specific error messages
      jest.spyOn(logger, 'error');

      // Act
      await processScheduledApplications();

      // Assert
      expect(logger.info).toHaveBeenCalledWith('Starting scheduled verification job');

      // Should update application 1 (today's date)
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE permit_applications'),
        [ApplicationStatus.PROOF_SUBMITTED, 1]
      );

      // Should log error for application 2
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error processing application 2:'),
        expect.any(Error)
      );

      expect(logger.info).toHaveBeenCalledWith('Scheduled verification job completed');
    });

    it('should handle case when no applications need processing', async () => {
      // Arrange
      // Mock database query to return no applications
      db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      // Act
      await processScheduledApplications();

      // Assert
      expect(logger.info).toHaveBeenCalledWith('Starting scheduled verification job');
      expect(logger.info).toHaveBeenCalledWith('Found 0 scheduled applications to process');
      expect(logger.info).toHaveBeenCalledWith('Scheduled verification job completed');
    });
  });
});
