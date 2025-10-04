/**
 * Tests for Simple WhatsApp Service
 * Focus on core functionality that matters
 */

const SimpleWhatsAppService = require('../simple-whatsapp.service');

describe('SimpleWhatsAppService', () => {
  let service;
  let mockStateManager;
  let mockDb;
  let mockFetch;

  beforeEach(() => {
    // Mock environment
    process.env.WHATSAPP_PHONE_NUMBER_ID = '123456789';
    process.env.WHATSAPP_ACCESS_TOKEN = 'test_token';
    process.env.PRIVACY_POLICY_VERSION = '1.0';

    // Create service instance
    service = new SimpleWhatsAppService();

    // Mock dependencies
    mockStateManager = {
      getState: jest.fn(),
      setState: jest.fn(),
      clearState: jest.fn()
    };
    service.stateManager = mockStateManager;

    // Mock fetch for API calls
    global.fetch = jest.fn();
    mockFetch = global.fetch;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Core Functionality', () => {
    test('should initialize with correct configuration', async () => {
      await service.initialize();
      
      expect(service.config.phoneNumberId).toBe('123456789');
      expect(service.config.accessToken).toBe('test_token');
      expect(service.config.apiUrl).toContain('123456789/messages');
    });

    test('should handle privacy consent correctly', async () => {
      const from = '521234567890';
      const state = {
        status: 'awaiting_privacy_consent',
        userId: 1
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ messages: [{ id: 'msg123' }] })
      });

      await service.handlePrivacyConsent(from, 'si', state);

      expect(mockStateManager.setState).toHaveBeenCalledWith(
        from,
        expect.objectContaining({
          status: 'collecting',
          currentField: 0,
          data: {}
        })
      );
    });

    test('should validate fields correctly', () => {
      // CURP validation
      const curpValid = service.validateField('curp_rfc', 'ABCD123456HEFGHI01');
      expect(curpValid.valid).toBe(true);
      expect(curpValid.value).toBe('ABCD123456HEFGHI01');

      const curpInvalid = service.validateField('curp_rfc', 'invalid');
      expect(curpInvalid.valid).toBe(false);

      // Email validation
      const emailValid = service.validateField('email', 'user@example.com');
      expect(emailValid.valid).toBe(true);
      expect(emailValid.value).toBe('user@example.com');

      const emailInvalid = service.validateField('email', 'not-an-email');
      expect(emailInvalid.valid).toBe(false);

      // Year validation
      const yearValid = service.validateField('ano_modelo', '2020');
      expect(yearValid.valid).toBe(true);
      expect(yearValid.value).toBe('2020');

      const yearInvalid = service.validateField('ano_modelo', '1800');
      expect(yearInvalid.valid).toBe(false);
    });

    test('should enforce rate limiting', () => {
      const from = '521234567890';

      // First 20 messages should pass
      for (let i = 0; i < 20; i++) {
        expect(service.checkRateLimit(from)).toBe(true);
      }

      // 21st message should be rate limited
      expect(service.checkRateLimit(from)).toBe(false);
    });

    test('should sanitize input correctly', () => {
      // Remove control characters
      const dirty = 'Hello\x00World\x1F';
      expect(service.sanitizeInput(dirty)).toBe('HelloWorld');

      // Trim whitespace
      expect(service.sanitizeInput('  hello  ')).toBe('hello');

      // Limit length
      const longText = 'a'.repeat(1000);
      expect(service.sanitizeInput(longText).length).toBe(500);

      // Handle null/undefined
      expect(service.sanitizeInput(null)).toBe('');
      expect(service.sanitizeInput(undefined)).toBe('');
    });

    test('should handle commands correctly', async () => {
      const from = '521234567890';
      const state = {};

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ messages: [{ id: 'msg123' }] })
      });

      // Test help command
      await service.handleCommand(from, '/ayuda', state);
      expect(mockFetch).toHaveBeenCalled();
      const helpCall = mockFetch.mock.calls[0];
      expect(helpCall[1].body).toContain('COMANDOS DISPONIBLES');

      // Test cancel command
      await service.handleCommand(from, '/cancelar', state);
      expect(mockStateManager.clearState).toHaveBeenCalledWith(from);
    });
  });

  describe('Privacy Features', () => {
    test('should require privacy consent before collecting data', async () => {
      const from = '521234567890';
      
      mockStateManager.getState.mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ messages: [{ id: 'msg123' }] })
      });

      await service.processMessage(from, '/permiso');

      // Should send privacy notice
      expect(mockFetch).toHaveBeenCalled();
      const call = mockFetch.mock.calls[0];
      expect(call[1].body).toContain('AVISO DE PRIVACIDAD');

      // Should set state to await consent
      expect(mockStateManager.setState).toHaveBeenCalledWith(
        from,
        expect.objectContaining({
          status: 'awaiting_privacy_consent'
        })
      );
    });

    test('should handle privacy commands', async () => {
      const from = '521234567890';
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ messages: [{ id: 'msg123' }] })
      });

      // Test privacy options
      await service.handleCommand(from, '/privacidad', {});
      expect(mockFetch).toHaveBeenCalled();
      const call = mockFetch.mock.calls[0];
      expect(call[1].body).toContain('OPCIONES DE PRIVACIDAD');
    });
  });

  describe('Data Collection Flow', () => {
    test('should collect fields in correct order', async () => {
      const from = '521234567890';
      const state = {
        status: 'collecting',
        currentField: 0,
        data: {}
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ messages: [{ id: 'msg123' }] })
      });

      // First field (nombre_completo)
      await service.handleDataCollection(from, 'Juan Pérez', state);
      
      expect(mockStateManager.setState).toHaveBeenCalledWith(
        from,
        expect.objectContaining({
          currentField: 1,
          data: { nombre_completo: 'Juan Pérez' }
        })
      );

      // Should prompt for next field
      const call = mockFetch.mock.calls[0];
      expect(call[1].body).toContain('Paso 2 de 10');
    });

    test('should show confirmation after all fields', async () => {
      const from = '521234567890';
      const state = {
        status: 'collecting',
        currentField: 9, // Last field
        data: {
          nombre_completo: 'Juan Pérez',
          curp_rfc: 'ABCD123456HEFGHI01',
          domicilio: 'Calle 123',
          email: 'juan@example.com',
          marca: 'Toyota',
          linea: 'Corolla',
          color: 'Rojo',
          numero_serie: 'VIN123',
          numero_motor: 'MOT123'
        }
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ messages: [{ id: 'msg123' }] })
      });

      // Submit last field
      await service.handleDataCollection(from, '2020', state);
      
      // Should change to confirming status
      expect(mockStateManager.setState).toHaveBeenCalledWith(
        from,
        expect.objectContaining({
          status: 'confirming'
        })
      );

      // Should show confirmation
      const call = mockFetch.mock.calls[1]; // Second call is confirmation
      expect(call[1].body).toContain('CONFIRMACIÓN DE DATOS');
    });
  });

  describe('Error Handling', () => {
    test('should handle API errors gracefully', async () => {
      const from = '521234567890';
      
      mockFetch.mockRejectedValue(new Error('Network error'));

      await service.sendMessage(from, 'Test message');
      
      // Should not throw, error is logged internally
      expect(mockFetch).toHaveBeenCalled();
    });

    test('should handle missing configuration', async () => {
      delete process.env.WHATSAPP_PHONE_NUMBER_ID;
      const newService = new SimpleWhatsAppService();
      
      await expect(newService.initialize()).rejects.toThrow('WhatsApp configuration missing');
    });
  });
});