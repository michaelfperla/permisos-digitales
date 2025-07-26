// Mock config first to prevent database connection errors
jest.mock('../../config', () => ({
  database: {
    url: 'mock://database'
  },
  stripe: {
    privateKey: 'mock_stripe_key',
    publicKey: 'mock_public_key'
  },
  redis: {
    url: 'mock://redis'
  },
  nodeEnv: 'test',
  email: {
    provider: 'console'
  }
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('../email.service', () => ({
  sendEmail: jest.fn().mockResolvedValue({ messageId: 'mock_message_id' })
}));

// Mock fetch for webhook alerts
global.fetch = jest.fn();

const AlertService = require('../alert.service');
const { logger } = require('../../utils/logger');
const emailService = require('../email.service');

describe('AlertService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch.mockClear();
    
    // Reset environment variables
    delete process.env.ALERT_WEBHOOK_URL;
    delete process.env.ALERT_EMAIL_RECIPIENTS;
    delete process.env.ALERT_SMS_ENABLED;
  });

  describe('sendAlert', () => {
    it('should send alert successfully and return alert object', async () => {
      const alertData = {
        title: 'Test Alert',
        message: 'This is a test alert',
        severity: 'HIGH'
      };

      const result = await AlertService.sendAlert(alertData);

      expect(result).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          timestamp: expect.any(String),
          environment: 'test',
          title: 'Test Alert',
          message: 'This is a test alert',
          severity: 'HIGH'
        })
      );

      expect(logger.error).toHaveBeenCalledWith('SYSTEM ALERT:', expect.objectContaining({
        title: 'Test Alert',
        message: 'This is a test alert',
        severity: 'HIGH'
      }));
    });

    it('should handle alerts with all properties', async () => {
      const alertData = {
        title: 'Payment Alert',
        message: 'Payment processing failed',
        severity: 'CRITICAL',
        category: 'payment',
        metrics: { 
          failureRate: 0.15,
          totalAttempts: 100 
        },
        errorDetails: {
          code: 'CARD_DECLINED',
          message: 'Insufficient funds'
        }
      };

      const result = await AlertService.sendAlert(alertData);

      expect(result).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          timestamp: expect.any(String),
          environment: 'test',
          title: 'Payment Alert',
          message: 'Payment processing failed',
          severity: 'CRITICAL',
          category: 'payment',
          metrics: { 
            failureRate: 0.15,
            totalAttempts: 100 
          },
          errorDetails: {
            code: 'CARD_DECLINED',
            message: 'Insufficient funds'
          }
        })
      );
    });

    it('should add alert to history', async () => {
      const alertData = {
        title: 'Test Alert',
        message: 'Test message',
        severity: 'MEDIUM'
      };

      await AlertService.sendAlert(alertData);

      const history = AlertService.getAlertHistory(1);
      expect(history).toHaveLength(1);
      expect(history[0]).toEqual(
        expect.objectContaining({
          title: 'Test Alert',
          message: 'Test message',
          severity: 'MEDIUM'
        })
      );
    });

    it('should limit alert history size', async () => {
      // Send more alerts than max history size (100)
      for (let i = 0; i < 105; i++) {
        await AlertService.sendAlert({
          title: `Alert ${i}`,
          message: `Message ${i}`,
          severity: 'LOW'
        });
      }

      const history = AlertService.getAlertHistory(110);
      expect(history).toHaveLength(100);
      
      // Should keep the most recent alerts
      expect(history[0].title).toBe('Alert 104');
      expect(history[99].title).toBe('Alert 5');
    });
  });

  describe('sendAlert with email channel', () => {
    beforeEach(() => {
      // Mock the alert service to have email channel configured
      AlertService.alertChannels = [
        {
          name: 'email',
          send: jest.fn().mockResolvedValue(true)
        }
      ];
      
      process.env.ALERT_EMAIL_RECIPIENTS = 'admin@test.com,security@test.com';
    });

    afterEach(() => {
      delete process.env.ALERT_EMAIL_RECIPIENTS;
      AlertService.alertChannels = [];
    });

    it('should send email alerts when email channel is configured', async () => {
      const alertData = {
        title: 'Email Test Alert',
        message: 'This should trigger an email',
        severity: 'HIGH'
      };

      await AlertService.sendAlert(alertData);

      expect(AlertService.alertChannels[0].send).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Email Test Alert',
          message: 'This should trigger an email',
          severity: 'HIGH'
        })
      );
    });

    it('should handle email service failures gracefully', async () => {
      AlertService.alertChannels[0].send.mockRejectedValue(new Error('Email service down'));

      const alertData = {
        title: 'Test Alert',
        message: 'Test message',
        severity: 'MEDIUM'
      };

      const result = await AlertService.sendAlert(alertData);

      expect(result).toEqual(
        expect.objectContaining({
          title: 'Test Alert',
          message: 'Test message'
        })
      );

      expect(logger.error).toHaveBeenCalledWith(
        'Error sending alert via email:',
        expect.any(Error)
      );
    });
  });

  describe('sendAlert with webhook channel', () => {
    beforeEach(() => {
      // Mock the alert service to have webhook channel configured
      AlertService.alertChannels = [
        {
          name: 'webhook',
          send: jest.fn().mockResolvedValue(true)
        }
      ];
      
      process.env.ALERT_WEBHOOK_URL = 'https://hooks.slack.com/test-webhook';
    });

    afterEach(() => {
      delete process.env.ALERT_WEBHOOK_URL;
      AlertService.alertChannels = [];
    });

    it('should send webhook alerts when webhook channel is configured', async () => {
      const alertData = {
        title: 'Webhook Test Alert',
        message: 'This should trigger a webhook',
        severity: 'CRITICAL',
        metrics: { errorCount: 5 }
      };

      await AlertService.sendAlert(alertData);

      expect(AlertService.alertChannels[0].send).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Webhook Test Alert',
          message: 'This should trigger a webhook',
          severity: 'CRITICAL',
          metrics: { errorCount: 5 }
        })
      );
    });

    it('should handle webhook failures gracefully', async () => {
      AlertService.alertChannels[0].send.mockRejectedValue(new Error('Webhook service down'));

      const alertData = {
        title: 'Test Alert',
        message: 'Test message',
        severity: 'HIGH'
      };

      const result = await AlertService.sendAlert(alertData);

      expect(result).toEqual(
        expect.objectContaining({
          title: 'Test Alert',
          message: 'Test message'
        })
      );

      expect(logger.error).toHaveBeenCalledWith(
        'Error sending alert via webhook:',
        expect.any(Error)
      );
    });

    it('should handle webhook HTTP errors', async () => {
      AlertService.alertChannels[0].send.mockRejectedValue(new Error('HTTP 500 error'));

      const alertData = {
        title: 'Test Alert',
        message: 'Test message',
        severity: 'HIGH'
      };

      await AlertService.sendAlert(alertData);

      expect(logger.error).toHaveBeenCalledWith(
        'Error sending alert via webhook:',
        expect.any(Error)
      );
    });
  });

  describe('specialized alert methods', () => {
    it('should send payment alerts with correct formatting', async () => {
      const result = await AlertService.sendPaymentAlert(
        'Transaction Failed',
        'Credit card transaction was declined',
        { attemptCount: 3, amount: 250.00 },
        'HIGH'
      );

      expect(result).toEqual(
        expect.objectContaining({
          title: 'Payment System: Transaction Failed',
          message: 'Credit card transaction was declined',
          severity: 'HIGH',
          category: 'payment',
          metrics: { attemptCount: 3, amount: 250.00 }
        })
      );
    });

    it('should send database alerts with correct formatting', async () => {
      const errorDetails = {
        query: 'SELECT * FROM payments WHERE id = ?',
        error: 'Connection timeout',
        duration: 30000
      };

      const result = await AlertService.sendDatabaseAlert(
        'Query Timeout',
        'Database query exceeded timeout limit',
        errorDetails,
        'MEDIUM'
      );

      expect(result).toEqual(
        expect.objectContaining({
          title: 'Database: Query Timeout',
          message: 'Database query exceeded timeout limit',
          severity: 'MEDIUM',
          category: 'database',
          errorDetails
        })
      );
    });

    it('should send security alerts with critical severity by default', async () => {
      const details = {
        ip: '192.168.1.100',
        userAgent: 'Suspicious Bot',
        attemptedAction: 'admin_access'
      };

      const result = await AlertService.sendSecurityAlert(
        'Unauthorized Access Attempt',
        'Multiple failed login attempts detected',
        details
      );

      expect(result).toEqual(
        expect.objectContaining({
          title: 'Security: Unauthorized Access Attempt',
          message: 'Multiple failed login attempts detected',
          severity: 'CRITICAL',
          category: 'security',
          details
        })
      );
    });

    it('should allow custom severity for security alerts', async () => {
      const result = await AlertService.sendSecurityAlert(
        'Rate Limit Exceeded',
        'User exceeded API rate limit',
        { userId: 'user123' },
        'MEDIUM'
      );

      expect(result.severity).toBe('MEDIUM');
    });
  });

  describe('getAlertHistory', () => {
    beforeEach(async () => {
      // Clear history and add test alerts
      AlertService.alertHistory = [];
      
      for (let i = 0; i < 5; i++) {
        await AlertService.sendAlert({
          title: `Alert ${i}`,
          message: `Message ${i}`,
          severity: 'LOW'
        });
      }
    });

    it('should return recent alerts limited by parameter', () => {
      const history = AlertService.getAlertHistory(3);
      
      expect(history).toHaveLength(3);
      expect(history[0].title).toBe('Alert 4'); // Most recent first
      expect(history[2].title).toBe('Alert 2');
    });

    it('should return all history when limit exceeds available alerts', () => {
      const history = AlertService.getAlertHistory(10);
      
      expect(history).toHaveLength(5);
    });

    it('should return default 10 alerts when no limit specified', () => {
      // Add more alerts
      for (let i = 5; i < 15; i++) {
        AlertService.alertHistory.unshift({
          id: i.toString(),
          title: `Alert ${i}`,
          message: `Message ${i}`,
          timestamp: new Date().toISOString()
        });
      }

      const history = AlertService.getAlertHistory();
      
      expect(history).toHaveLength(10);
    });
  });

  describe('alert color methods', () => {
    it('should return correct Slack colors for severities', () => {
      expect(AlertService.getAlertColor('LOW')).toBe('good');
      expect(AlertService.getAlertColor('MEDIUM')).toBe('warning');
      expect(AlertService.getAlertColor('HIGH')).toBe('danger');
      expect(AlertService.getAlertColor('CRITICAL')).toBe('danger');
      expect(AlertService.getAlertColor('UNKNOWN')).toBe('danger'); // Default
    });

    it('should return correct hex colors for severities', () => {
      expect(AlertService.getAlertColorHex('LOW')).toBe('#36a64f');
      expect(AlertService.getAlertColorHex('MEDIUM')).toBe('#ff9800');
      expect(AlertService.getAlertColorHex('HIGH')).toBe('#f44336');
      expect(AlertService.getAlertColorHex('CRITICAL')).toBe('#b71c1c');
      expect(AlertService.getAlertColorHex('UNKNOWN')).toBe('#f44336'); // Default
    });
  });

  describe('integration tests', () => {
    it('should work end-to-end with multiple channels', async () => {
      // Set up both email and webhook channels
      AlertService.alertChannels = [
        {
          name: 'email',
          send: jest.fn().mockResolvedValue(true)
        },
        {
          name: 'webhook',
          send: jest.fn().mockResolvedValue(true)
        }
      ];

      const alertData = {
        title: 'Critical System Error',
        message: 'Database connection pool exhausted',
        severity: 'CRITICAL',
        category: 'system',
        metrics: {
          activeConnections: 100,
          maxConnections: 100,
          queuedRequests: 50
        }
      };

      const result = await AlertService.sendAlert(alertData);

      expect(result).toEqual(
        expect.objectContaining({
          title: 'Critical System Error',
          severity: 'CRITICAL'
        })
      );

      // Should attempt both channels
      expect(AlertService.alertChannels[0].send).toHaveBeenCalled();
      expect(AlertService.alertChannels[1].send).toHaveBeenCalled();
      
      // Cleanup
      AlertService.alertChannels = [];
    });

    it('should handle partial channel failures gracefully', async () => {
      AlertService.alertChannels = [
        {
          name: 'webhook',
          send: jest.fn().mockRejectedValue(new Error('Network error'))
        },
        {
          name: 'email',
          send: jest.fn().mockResolvedValue(true)
        }
      ];

      const result = await AlertService.sendAlert({
        title: 'Test Alert',
        message: 'Test message',
        severity: 'HIGH'
      });

      // Should still succeed overall
      expect(result.title).toBe('Test Alert');
      
      // Should log channel failures but continue
      expect(logger.error).toHaveBeenCalledWith(
        'Error sending alert via webhook:',
        expect.any(Error)
      );

      AlertService.alertChannels = [];
    });
  });
});