/**
 * =============================================================================
 * Permisos Digitales - Scheduler Tests
 * =============================================================================
 */

// Mock dependencies before requiring modules
const mockSchedule = jest.fn().mockImplementation((cronExpression, callback) => {
  return { cronExpression, callback };
});

// Mock node-cron
jest.mock('node-cron', () => ({
  schedule: mockSchedule
}));

// Mock logger with all required methods
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn()
  }
}));

// Mock scheduled-verification
jest.mock('../scheduled-verification', () => ({
  processScheduledApplications: jest.fn()
}));

// Import modules after mocking
const { logger } = require('../../utils/logger');
const { processScheduledApplications } = require('../scheduled-verification');
const { initScheduledJobs } = require('../scheduler');

describe('Scheduler', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('initScheduledJobs', () => {
    it('should initialize scheduled jobs with correct cron expression', () => {
      // Act
      initScheduledJobs();

      // Assert
      expect(logger.info).toHaveBeenCalledWith('Initializing scheduled jobs');
      expect(mockSchedule).toHaveBeenCalledWith('0 1 * * *', expect.any(Function));
      expect(logger.info).toHaveBeenCalledWith('Scheduled jobs initialized');
    });

    it('should call processScheduledApplications when the cron job runs', async () => {
      // Initialize the jobs
      initScheduledJobs();

      // Get the callback function that was passed to mockSchedule
      const scheduledCallback = mockSchedule.mock.calls[0][1];

      // Act - simulate the cron job running
      await scheduledCallback();

      // Assert
      expect(logger.info).toHaveBeenCalledWith('Running scheduled verification job');
      expect(processScheduledApplications).toHaveBeenCalled();
    });

    it('should handle errors when processScheduledApplications fails', async () => {
      // Mock processScheduledApplications to throw an error
      const testError = new Error('Test error');
      processScheduledApplications.mockImplementationOnce(() => Promise.reject(testError));

      // Initialize the jobs
      initScheduledJobs();

      // Get the callback function that was passed to mockSchedule
      const scheduledCallback = mockSchedule.mock.calls[0][1];

      // Act - simulate the cron job running with an error
      await scheduledCallback();

      // Assert
      expect(logger.info).toHaveBeenCalledWith('Running scheduled verification job');
      expect(processScheduledApplications).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith('Error running scheduled verification job:', testError);
    });
  });
});
