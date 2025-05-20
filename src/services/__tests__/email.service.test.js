/**
 * Unit Tests for Email Service
 */

// Import test setup
require('../../tests/setup');

// Mock dependencies using our standardized approach
// Mock config
jest.mock('../../config', () => ({
  emailHost: 'smtp.test.com',
  emailPort: 587,
  emailUser: 'ymmim6btfmeygvha@ethereal.email',
  emailPass: 'password123',
  emailFrom: 'noreply@permisos-digitales.com',
  mailgunApiKey: null, // No Mailgun config for this test
  mailgunDomain: null,
  appUrl: 'https://test.example.com'
}));

// Mock nodemailer
jest.mock('nodemailer', () => {
  const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-message-id' });
  const mockTransporter = { sendMail: mockSendMail };

  return {
    createTransport: jest.fn().mockReturnValue(mockTransporter)
  };
});

// Mock nodemailer-mailgun-transport
jest.mock('nodemailer-mailgun-transport', () => {
  return jest.fn().mockImplementation((options) => {
    return { mailgunOptions: options };
  });
});

// Import dependencies after mocking
const nodemailer = require('nodemailer');
const config = require('../../config');
const { logger } = require('../../utils/enhanced-logger');

// Import the module
const emailService = require('../email.service');

describe('Email Service', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('initTransporter', () => {
    it('should initialize transporter with SMTP when Mailgun is not configured', () => {
      // Act
      emailService.initTransporter();

      // Assert
      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: config.emailHost,
        port: config.emailPort,
        secure: false,
        auth: {
          user: config.emailUser,
          pass: config.emailPass,
        },
      });
      expect(logger.info).toHaveBeenCalledWith('Email service initialized with SMTP transport');
    });

    it('should initialize transporter with Mailgun when configured', () => {
      // Arrange - temporarily modify the config mock to include Mailgun settings
      const originalMailgunApiKey = config.mailgunApiKey;
      const originalMailgunDomain = config.mailgunDomain;
      config.mailgunApiKey = 'test-api-key';
      config.mailgunDomain = 'test-domain.com';

      // Act
      emailService.initTransporter();

      // Assert
      const mailgunTransport = require('nodemailer-mailgun-transport');
      expect(mailgunTransport).toHaveBeenCalledWith({
        auth: {
          api_key: 'test-api-key',
          domain: 'test-domain.com'
        }
      });
      expect(nodemailer.createTransport).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Email service initialized with Mailgun transport');

      // Cleanup - restore original config
      config.mailgunApiKey = originalMailgunApiKey;
      config.mailgunDomain = originalMailgunDomain;
    });
  });

  describe('sendEmail', () => {
    it('should send email successfully', async () => {
      // Arrange
      const emailOptions = {
        to: 'user@example.com',
        subject: 'Test Email',
        text: 'This is a test email',
        html: '<p>This is a test email</p>'
      };

      // Act
      const result = await emailService.sendEmail(emailOptions);

      // Assert
      expect(result).toBe(true);
      expect(nodemailer.createTransport().sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: expect.stringContaining(config.emailFrom),
          to: emailOptions.to,
          subject: emailOptions.subject,
          text: emailOptions.text,
          html: emailOptions.html
        })
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Email sent to ${emailOptions.to}`)
      );
    });

    it('should use custom from address if provided', async () => {
      // Arrange
      const emailOptions = {
        to: 'user@example.com',
        subject: 'Test Email',
        text: 'This is a test email',
        html: '<p>This is a test email</p>',
        from: 'custom@example.com'
      };

      // Act
      await emailService.sendEmail(emailOptions);

      // Assert
      expect(nodemailer.createTransport().sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'custom@example.com'
        })
      );
    });

    it('should handle email sending errors', async () => {
      // Arrange
      const emailOptions = {
        to: 'user@example.com',
        subject: 'Test Email',
        text: 'This is a test email'
      };
      const sendError = new Error('Failed to send email');

      // Mock sendMail to throw an error
      nodemailer.createTransport().sendMail.mockRejectedValueOnce(sendError);

      // Act
      const result = await emailService.sendEmail(emailOptions);

      // Assert
      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(`Error sending email to ${emailOptions.to}`),
        sendError
      );
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send password reset email successfully', async () => {
      // Arrange
      const to = 'user@example.com';
      const resetToken = 'abc123def456';
      const resetUrl = 'https://example.com/reset';

      // Spy on sendEmail function
      jest.spyOn(emailService, 'sendEmail').mockResolvedValue(true);

      // Act
      const result = await emailService.sendPasswordResetEmail(to, resetToken, resetUrl);

      // Assert
      expect(result).toBe(true);
      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to,
          subject: 'Cambia tu contraseña de Permisos Digitales',
          text: expect.stringContaining(`${resetUrl}?token=${resetToken}`),
          html: expect.stringContaining(`${resetUrl}?token=${resetToken}`)
        })
      );
    });

    it('should clean non-hex characters from token', async () => {
      // Arrange
      const to = 'user@example.com';
      const resetToken = 'abc-123!def@456'; // Contains non-hex characters
      const resetUrl = 'https://example.com/reset';

      // Spy on sendEmail function
      jest.spyOn(emailService, 'sendEmail').mockResolvedValue(true);

      // Act
      await emailService.sendPasswordResetEmail(to, resetToken, resetUrl);

      // Assert
      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining(`${resetUrl}?token=abc123def456`), // Non-hex characters removed
          html: expect.stringContaining(`${resetUrl}?token=abc123def456`)
        })
      );
    });

    it('should handle email sending errors', async () => {
      // Arrange
      const to = 'user@example.com';
      const resetToken = 'abc123def456';
      const resetUrl = 'https://example.com/reset';

      // Spy on sendEmail function to simulate an error
      jest.spyOn(emailService, 'sendEmail').mockRejectedValue(new Error('Failed to send email'));

      // Act
      const result = await emailService.sendPasswordResetEmail(to, resetToken, resetUrl);

      // Assert
      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(`Error sending password reset email to ${to}`),
        expect.any(Error)
      );
    });
  });
});
