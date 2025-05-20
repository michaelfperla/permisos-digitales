/**
 * Unit Tests for Payment Repository
 */
const { ApplicationStatus } = require('../../constants');
const { logger } = require('../../utils/enhanced-logger');
const db = require('../../db');
const paymentRepository = require('../payment.repository');

// Mock the database module
jest.mock('../../db', () => ({
  query: jest.fn(),
  dbPool: {
    connect: jest.fn().mockResolvedValue({
      query: jest.fn(),
      release: jest.fn()
    })
  }
}));

// Mock the logger
jest.mock('../../utils/enhanced-logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  }
}));

describe('Payment Repository', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('updatePaymentOrder', () => {
    it('should update payment order information', async () => {
      // Mock the database response
      db.query.mockResolvedValueOnce({
        rows: [{ id: 123, payment_processor_order_id: 'ord_123', status: ApplicationStatus.PAYMENT_RECEIVED }]
      });

      // Call the method
      const result = await paymentRepository.updatePaymentOrder(123, 'ord_123', ApplicationStatus.PAYMENT_RECEIVED);

      // Check that the query was called with the correct parameters
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE permit_applications'),
        ['ord_123', ApplicationStatus.PAYMENT_RECEIVED, 123]
      );

      // Check the result
      expect(result).toEqual({
        id: 123,
        payment_processor_order_id: 'ord_123',
        status: ApplicationStatus.PAYMENT_RECEIVED
      });
    });

    it('should throw an error if application is not found', async () => {
      // Mock the database response for no rows
      db.query.mockResolvedValueOnce({ rows: [] });

      // Call the method and expect it to throw
      await expect(
        paymentRepository.updatePaymentOrder(999, 'ord_123', ApplicationStatus.PAYMENT_RECEIVED)
      ).rejects.toThrow('Application with ID 999 not found');

      // Check that the query was called with the correct parameters
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE permit_applications'),
        ['ord_123', ApplicationStatus.PAYMENT_RECEIVED, 999]
      );
    });
  });

  describe('tryRecordEvent', () => {
    it('should return true for a new event', async () => {
      // Mock db.query to return a row (successful insert)
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const result = await paymentRepository.tryRecordEvent('evt_123', 'order.paid');

      expect(result).toBe(true);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO webhook_events'),
        ['evt_123', 'order.paid']
      );
      expect(logger.debug).toHaveBeenCalled();
    });

    it('should return false for a duplicate event', async () => {
      // Mock db.query to return no rows (duplicate, no insert due to ON CONFLICT)
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await paymentRepository.tryRecordEvent('evt_123', 'order.paid');

      expect(result).toBe(false);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO webhook_events'),
        ['evt_123', 'order.paid']
      );
      expect(logger.info).toHaveBeenCalled();
    });

    it('should return true if event ID is missing', async () => {
      const result = await paymentRepository.tryRecordEvent(null, 'order.paid');

      expect(result).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith('Attempted to record webhook event with no ID');
      expect(db.query).not.toHaveBeenCalled();
    });

    it('should return true on database error to allow processing', async () => {
      // Mock db.query to throw an error
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const result = await paymentRepository.tryRecordEvent('evt_123', 'order.paid');

      expect(result).toBe(true);
      expect(logger.error).toHaveBeenCalledWith(
        'Error recording webhook event:',
        expect.objectContaining({
          error: 'Database error',
          eventId: 'evt_123',
          eventType: 'order.paid'
        })
      );
    });
  });

  // Additional tests for other methods can be added here
});
