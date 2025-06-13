/**
 * Unit Tests for Permit Expiration Email Functionality
 */

// Import test setup
require('../../tests/setup');

// Mock dependencies
jest.mock('../../config', () => ({
  emailHost: 'smtp.test.com',
  emailPort: 587,
  emailUser: 'test@example.com',
  emailPass: 'password123',
  emailFrom: 'contacto@permisosdigitales.com.mx',
  frontendUrl: 'https://test.permisosdigitales.com.mx'
}));

// Mock nodemailer
const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-message-id' });
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({ sendMail: mockSendMail })
}));

// Mock logger
jest.mock('../../utils/enhanced-logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn()
  }
}));

const emailService = require('../email.service');
const notificationService = require('../notification.service');
const { logger } = require('../../utils/enhanced-logger');

describe('Permit Expiration Email Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendPermitExpirationReminder', () => {
    const mockPermitDetails = {
      userName: 'Juan Pérez',
      folio: 'PD-2024-001',
      vehicleDescription: 'Toyota Corolla 2020',
      expirationDate: '15 de febrero de 2024',
      daysRemaining: 5,
      renewalUrl: 'https://test.permisosdigitales.com.mx/applications/123/renew'
    };

    it('should send permit expiration reminder email successfully', async () => {
      const result = await emailService.sendPermitExpirationReminder(
        'test@example.com',
        mockPermitDetails
      );

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Email sent to test@example.com')
      );
    });

    it('should include correct subject for regular warning', async () => {
      await emailService.sendPermitExpirationReminder(
        'test@example.com',
        mockPermitDetails
      );

      const emailCall = mockSendMail.mock.calls[0][0];
      expect(emailCall.subject).toBe('Recordatorio Tu permiso de circulación vence en 5 días');
    });

    it('should include urgent subject for 1-day warning', async () => {
      const urgentDetails = { ...mockPermitDetails, daysRemaining: 1 };
      
      await emailService.sendPermitExpirationReminder(
        'test@example.com',
        urgentDetails
      );

      const emailCall = mockSendMail.mock.calls[0][0];
      expect(emailCall.subject).toBe('¡URGENTE! Tu permiso de circulación vence en 1 día');
    });

    it('should include all permit details in email content', async () => {
      await emailService.sendPermitExpirationReminder(
        'test@example.com',
        mockPermitDetails
      );

      const emailCall = mockSendMail.mock.calls[0][0];
      expect(emailCall.text).toContain('Juan Pérez');
      expect(emailCall.text).toContain('PD-2024-001');
      expect(emailCall.text).toContain('Toyota Corolla 2020');
      expect(emailCall.text).toContain('15 de febrero de 2024');
      expect(emailCall.text).toContain('5 días');
      expect(emailCall.html).toContain('Juan Pérez');
      expect(emailCall.html).toContain('PD-2024-001');
    });

    it('should handle email sending errors gracefully', async () => {
      mockSendMail.mockRejectedValueOnce(new Error('SMTP Error'));

      const result = await emailService.sendPermitExpirationReminder(
        'test@example.com',
        mockPermitDetails
      );

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error sending email to test@example.com'),
        expect.any(Error)
      );
    });
  });
});

describe('Permit Expiration Notification Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendPermitExpirationReminder', () => {
    const mockPermitData = {
      application_id: 123,
      user_email: 'test@example.com',
      first_name: 'Juan',
      last_name: 'Pérez',
      folio: 'PD-2024-001',
      marca: 'Toyota',
      linea: 'Corolla',
      ano_modelo: '2020',
      fecha_vencimiento: '2024-02-15',
      days_remaining: 5
    };

    it('should send notification successfully', async () => {
      // Mock the email service to return success
      jest.spyOn(emailService, 'sendPermitExpirationReminder').mockResolvedValue(true);

      const result = await notificationService.sendPermitExpirationReminder(mockPermitData);

      expect(result).toBe(true);
      expect(emailService.sendPermitExpirationReminder).toHaveBeenCalledWith(
        'test@example.com',
        expect.objectContaining({
          userName: 'Juan Pérez',
          folio: 'PD-2024-001',
          vehicleDescription: 'Toyota Corolla 2020',
          daysRemaining: 5
        })
      );
    });

    it('should handle missing user name gracefully', async () => {
      const dataWithoutName = {
        ...mockPermitData,
        first_name: null,
        last_name: null
      };

      jest.spyOn(emailService, 'sendPermitExpirationReminder').mockResolvedValue(true);

      await notificationService.sendPermitExpirationReminder(dataWithoutName);

      expect(emailService.sendPermitExpirationReminder).toHaveBeenCalledWith(
        'test@example.com',
        expect.objectContaining({
          userName: 'Estimado usuario'
        })
      );
    });

    it('should handle errors gracefully', async () => {
      jest.spyOn(emailService, 'sendPermitExpirationReminder').mockRejectedValue(
        new Error('Email service error')
      );

      const result = await notificationService.sendPermitExpirationReminder(mockPermitData);

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error sending permit expiration reminder'),
        expect.any(Object)
      );
    });
  });
});
