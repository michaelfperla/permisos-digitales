import { AxiosError } from 'axios';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { RenewalFormData } from '../../types/application.types';

// Define mock functions for axios methods
const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();

// Mock the API module
vi.mock('../api', () => ({
  default: {
    get: mockGet,
    post: mockPost,
    put: mockPut,
    delete: mockDelete,
  },
}));

// Mock axios module
vi.mock('axios', () => {
  return {
    default: {
      create: () => ({
        get: mockGet,
        post: mockPost,
        put: mockPut,
        delete: mockDelete,
      }),
      isAxiosError: (error: any): error is AxiosError => !!error?.isAxiosError,
    },
  };
});

// Mock CSRF utilities
vi.mock('../../utils/csrf', () => ({
  getCsrfToken: vi.fn().mockResolvedValue('mock-csrf-token'),
  handleCsrfError: vi.fn().mockResolvedValue(false),
}));

// Import applicationService after mocking
let applicationService: typeof import('../applicationService');

describe('applicationService', () => {
  beforeEach(async () => {
    // Clear all mocks before each test
    vi.clearAllMocks();

    // Import the module for each test to ensure clean state
    applicationService = await import('../applicationService');
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('getApplications', () => {
    it('should fetch applications successfully', async () => {
      const mockApplications = [
        {
          id: '1',
          user_id: '123',
          status: 'PERMIT_READY',
          nombre_completo: 'Test User',
          marca: 'Ford',
        } as any,
        {
          id: '2',
          user_id: '123',
          status: 'PENDING_PAYMENT',
          nombre_completo: 'Test User',
          marca: 'Toyota',
        } as any,
      ];

      const mockResponse = {
        success: true,
        applications: mockApplications,
        expiringPermits: [],
        message: 'Applications retrieved successfully',
      };

      mockGet.mockResolvedValueOnce({
        data: mockResponse,
      });

      const result = await applicationService.getApplications();

      expect(result).toEqual(mockResponse);
      expect(mockGet).toHaveBeenCalledWith('/applications', { signal: undefined });
    });

    it('should handle API error and return failure response', async () => {
      const networkError = new Error('Network error');
      mockGet.mockRejectedValueOnce(networkError);

      // The actual service doesn't have error handling for getApplications,
      // so it will throw the error
      await expect(applicationService.getApplications()).rejects.toThrow('Network error');
      expect(mockGet).toHaveBeenCalledWith('/applications', { signal: undefined });
    });

    it('should handle response without success field', async () => {
      const mockApplications = [
        {
          id: '1',
          user_id: '123',
          status: 'PERMIT_READY',
          nombre_completo: 'Test User',
          marca: 'Ford',
        } as any,
      ];

      // Response without success field (legacy format)
      const mockResponse = {
        applications: mockApplications,
        expiringPermits: [],
      };

      mockGet.mockResolvedValueOnce({
        data: mockResponse,
      });

      const result = await applicationService.getApplications();

      expect(result).toEqual({
        success: true,
        applications: mockApplications,
        expiringPermits: [],
      });
    });
  });

  describe('getApplicationById', () => {
    it('should fetch application by ID successfully', async () => {
      const mockApplicationDetails = {
        id: '1',
        vehicleInfo: {
          marca: 'Ford',
          linea: 'Mustang',
          color: 'Red',
          numero_serie: 'ABC123',
          numero_motor: 'M123',
          ano_modelo: 2023,
        },
        ownerInfo: {
          nombre_completo: 'Test User',
          curp_rfc: 'TESU123456ABC',
          domicilio: '123 Main St',
        },
        dates: {
          created: '2023-01-01',
          updated: '2023-01-01',
        },
      };

      const mockStatus = {
        currentStatus: 'PERMIT_READY' as const,
        lastUpdated: '2023-01-01',
        displayMessage: 'Permit is ready',
        nextSteps: 'Download your permit',
        allowedActions: ['download'],
      };

      const mockResponse = {
        success: true,
        application: mockApplicationDetails,
        status: mockStatus,
        message: 'Application retrieved successfully',
      };

      mockGet.mockResolvedValueOnce({
        data: mockResponse,
      });

      const result = await applicationService.getApplicationById('1');

      expect(result).toEqual(mockResponse);
      expect(mockGet).toHaveBeenCalledWith('/applications/1/status', { signal: undefined });
    });

    it('should handle API error and return failure response', async () => {
      const networkError = new Error('Network error');
      mockGet.mockRejectedValueOnce(networkError);

      // The actual service doesn't have error handling for getApplicationById,
      // so it will throw the error
      await expect(applicationService.getApplicationById('1')).rejects.toThrow('Network error');
      expect(mockGet).toHaveBeenCalledWith('/applications/1/status', { signal: undefined });
    });
  });

  describe('createApplication', () => {
    it('should create application successfully', async () => {
      const applicationData = {
        nombre_completo: 'Test User',
        curp_rfc: 'TESU123456ABC',
        domicilio: '123 Main St',
        marca: 'Ford',
        linea: 'Mustang',
        color: 'Red',
        numero_serie: 'ABC123',
        numero_motor: 'M123',
        ano_modelo: 2023,
      };

      const mockResponse = {
        success: true,
        application: { id: '1', ...applicationData, status: 'PENDING_PAYMENT' } as any,
        message: 'Application created successfully',
      };

      mockPost.mockResolvedValueOnce({
        data: mockResponse,
      });

      const result = await applicationService.createApplication(applicationData);

      expect(result).toEqual(mockResponse);
      expect(mockPost).toHaveBeenCalledWith('/applications', applicationData);
    });

    it('should handle invalid ano_modelo', async () => {
      const applicationData = {
        nombre_completo: 'Test User',
        curp_rfc: 'TESU123456ABC',
        domicilio: '123 Main St',
        marca: 'Ford',
        linea: 'Mustang',
        color: 'Red',
        numero_serie: 'ABC123',
        numero_motor: 'M123',
        ano_modelo: 'invalid' as any,
      };

      const result = await applicationService.createApplication(applicationData);

      expect(result.success).toBe(false);
      expect(result.application).toEqual({});
      expect(result.message).toBe('El año del modelo no es válido. Por favor ingresa un año válido.');
    });

    it('should handle API error and return failure response', async () => {
      const applicationData = {
        nombre_completo: 'Test User',
        curp_rfc: 'TESU123456ABC',
        domicilio: '123 Main St',
        marca: 'Toyota',
        linea: 'Corolla',
        color: 'Blue',
        numero_serie: 'ABC123',
        numero_motor: 'M123',
        ano_modelo: 2023,
      };

      mockPost.mockRejectedValueOnce(new Error('Network error'));

      const result = await applicationService.createApplication(applicationData);

      expect(result.success).toBe(false);
      expect(result.application).toEqual({});
      expect(result.message).toBe('Error al comunicarse con el servidor. Por favor, inténtalo de nuevo.');
      expect(mockPost).toHaveBeenCalledWith('/applications', applicationData);
    });

    it('should handle response without data', async () => {
      const applicationData = {
        nombre_completo: 'Test User',
        curp_rfc: 'TESU123456ABC',
        domicilio: '123 Main St',
        marca: 'Ford',
        linea: 'Mustang',
        color: 'Red',
        numero_serie: 'ABC123',
        numero_motor: 'M123',
        ano_modelo: 2023,
      };

      // Mock response without data
      mockPost.mockResolvedValueOnce({});

      const result = await applicationService.createApplication(applicationData);

      expect(result.success).toBe(false);
      expect(result.application).toEqual({});
      expect(result.message).toBe('La respuesta del servidor no tiene el formato esperado.');
    });
  });

  describe('updateApplication', () => {
    it('should update application successfully', async () => {
      const applicationId = '1';
      const updateData = {
        color: 'Blue',
        domicilio: '456 New St',
      };

      const mockResponse = {
        success: true,
        application: { id: '1', color: 'Blue', domicilio: '456 New St' } as any,
        message: 'Application updated successfully',
      };

      mockPut.mockResolvedValueOnce({
        data: mockResponse,
      });

      const result = await applicationService.updateApplication(applicationId, updateData);

      expect(result).toEqual(mockResponse);
      expect(mockPut).toHaveBeenCalledWith('/applications/1', updateData, {
        headers: { 'X-CSRF-Token': 'mock-csrf-token' },
      });
    });

    it('should handle API error and return failure response', async () => {
      const applicationId = '1';
      const updateData = {
        color: 'Blue',
      };

      // Mock API error
      const axiosError = new Error('API error') as AxiosError;
      axiosError.isAxiosError = true;
      axiosError.response = {
        data: { message: 'Cannot update application in current status' },
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config: {} as any,
      };
      mockPut.mockRejectedValueOnce(axiosError);

      const result = await applicationService.updateApplication(applicationId, updateData);

      expect(result.success).toBe(false);
      expect(result.application).toEqual({});
      expect(result.message).toBe('Cannot update application in current status');
      expect(mockPut).toHaveBeenCalledWith('/applications/1', updateData, {
        headers: { 'X-CSRF-Token': 'mock-csrf-token' },
      });
    });

    it('should handle network error and return failure response', async () => {
      const applicationId = '1';
      const updateData = {
        color: 'Blue',
      };

      mockPut.mockRejectedValueOnce(new Error('Network error'));

      const result = await applicationService.updateApplication(applicationId, updateData);

      expect(result.success).toBe(false);
      expect(result.application).toEqual({});
      expect(result.message).toBe('Error de red. Por favor, verifica tu conexión.');
      expect(mockPut).toHaveBeenCalledWith('/applications/1', updateData, {
        headers: { 'X-CSRF-Token': 'mock-csrf-token' },
      });
    });
  });

  describe('submitApplication', () => {
    it('should submit application successfully', async () => {
      const applicationId = '1';

      const mockResponse = {
        success: true,
        application: { id: '1', status: 'PROOF_SUBMITTED' } as any,
        message: 'Application submitted successfully',
      };

      mockPost.mockResolvedValueOnce({
        data: mockResponse,
      });

      const result = await applicationService.submitApplication(applicationId);

      expect(result).toEqual(mockResponse);
      expect(mockPost).toHaveBeenCalledWith(
        '/applications/1/submit',
        {},
        { headers: { 'X-CSRF-Token': 'mock-csrf-token' } },
      );
    });

    it('should handle API error and return failure response', async () => {
      const applicationId = '1';

      // Mock API error
      const axiosError = new Error('API error') as AxiosError;
      axiosError.isAxiosError = true;
      axiosError.response = {
        data: { message: 'Cannot submit application in current status' },
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config: {} as any,
      };
      mockPost.mockRejectedValueOnce(axiosError);

      const result = await applicationService.submitApplication(applicationId);

      expect(result.success).toBe(false);
      expect(result.application).toEqual({});
      expect(result.message).toBe('Cannot submit application in current status');
      expect(mockPost).toHaveBeenCalledWith(
        '/applications/1/submit',
        {},
        { headers: { 'X-CSRF-Token': 'mock-csrf-token' } },
      );
    });

    it('should handle network error and return failure response', async () => {
      const applicationId = '1';

      mockPost.mockRejectedValueOnce(new Error('Network error'));

      const result = await applicationService.submitApplication(applicationId);

      expect(result.success).toBe(false);
      expect(result.application).toEqual({});
      expect(result.message).toBe('Network error. Please check your connection.');
      expect(mockPost).toHaveBeenCalledWith(
        '/applications/1/submit',
        {},
        { headers: { 'X-CSRF-Token': 'mock-csrf-token' } },
      );
    });
  });

  describe('uploadPaymentProof', () => {
    it('should return deprecated message', async () => {
      const applicationId = '1';
      const file = new File(['test content'], 'payment.jpg', { type: 'image/jpeg' });
      const paymentReference = 'REF123';

      const result = await applicationService.uploadPaymentProof(
        applicationId,
        file,
        paymentReference,
      );

      expect(result.success).toBe(false);
      expect(result.application).toEqual({});
      expect(result.message).toBe('El sistema de pagos está siendo actualizado. Por favor, intente más tarde.');

      // Should not make any API calls since it's deprecated
      expect(mockPost).not.toHaveBeenCalled();
    });

    it('should return deprecated message for any parameters', async () => {
      const applicationId = '1';
      const file = new File(['test content'], 'payment.jpg', { type: 'image/jpeg' });

      const result = await applicationService.uploadPaymentProof(applicationId, file);

      expect(result.success).toBe(false);
      expect(result.application).toEqual({});
      expect(result.message).toBe('El sistema de pagos está siendo actualizado. Por favor, intente más tarde.');

      // Should not make any API calls since it's deprecated
      expect(mockPost).not.toHaveBeenCalled();
    });
  });

  describe('downloadPermit', () => {
    it('should download permit successfully with default type', async () => {
      const applicationId = '1';
      const mockPdfContent = new Blob(['PDF content'], { type: 'application/pdf' });

      // Mock the permit download request
      mockGet.mockResolvedValueOnce({
        data: mockPdfContent,
      });

      const result = await applicationService.downloadPermit(applicationId);

      expect(result).toEqual(mockPdfContent);
      expect(mockGet).toHaveBeenCalledWith('/applications/1/download/permiso', {
        responseType: 'blob',
        headers: { 'X-CSRF-Token': 'mock-csrf-token' },
        signal: undefined,
      });
    });

    it('should download specific document type', async () => {
      const applicationId = '1';
      const documentType = 'recibo';
      const mockPdfContent = new Blob(['Receipt PDF content'], { type: 'application/pdf' });

      // Mock the permit download request
      mockGet.mockResolvedValueOnce({
        data: mockPdfContent,
      });

      const result = await applicationService.downloadPermit(applicationId, documentType);

      expect(result).toEqual(mockPdfContent);
      expect(mockGet).toHaveBeenCalledWith('/applications/1/download/recibo', {
        responseType: 'blob',
        headers: { 'X-CSRF-Token': 'mock-csrf-token' },
        signal: undefined,
      });
    });

    it('should return mock PDF on error', async () => {
      const applicationId = '1';

      // Mock the permit download request with error
      mockGet.mockRejectedValueOnce(new Error('Network error'));

      const result = await applicationService.downloadPermit(applicationId);

      // Verify it's a Blob with PDF content type
      expect(result instanceof Blob).toBe(true);
      expect(result.type).toBe('application/pdf');

      // For Blob testing, we can't easily check the content directly
      // Instead, we'll create a FileReader to read the Blob as text
      const reader = new FileReader();
      const textPromise = new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsText(result);
      });

      const text = await textPromise;
      expect(text).toBe('Mock PDF content for permiso document - application 1');

      expect(mockGet).toHaveBeenCalledWith('/applications/1/download/permiso', {
        responseType: 'blob',
        headers: { 'X-CSRF-Token': 'mock-csrf-token' },
        signal: undefined,
      });
    });
  });

  describe('checkRenewalEligibility', () => {
    it('should check renewal eligibility successfully', async () => {
      const applicationId = '1';
      const mockResponse = {
        eligible: true,
        message: 'Permit is eligible for renewal',
        daysUntilExpiration: 10,
        expirationDate: '2023-12-31',
      };

      mockGet.mockResolvedValueOnce({
        data: mockResponse,
      });

      const result = await applicationService.checkRenewalEligibility(applicationId);

      expect(result).toEqual(mockResponse);
      expect(mockGet).toHaveBeenCalledWith('/applications/1/renewal-eligibility');
    });

    it('should handle API error and return ineligible response', async () => {
      const applicationId = '1';

      mockGet.mockRejectedValueOnce(new Error('Network error'));

      const result = await applicationService.checkRenewalEligibility(applicationId);

      expect(result.eligible).toBe(false);
      expect(result.message).toBe('Failed to check renewal eligibility. Please try again later.');
      expect(mockGet).toHaveBeenCalledWith('/applications/1/renewal-eligibility');
    });
  });

  describe('createRenewalApplication', () => {
    it('should create renewal application successfully', async () => {
      // Mock CSRF token request
      mockGet.mockResolvedValueOnce({
        data: { csrfToken: 'test-csrf-token' },
      });

      const applicationId = '1';
      const renewalData = {
        renewal_reason: 'Need to extend permit',
        renewal_notes: 'Additional notes',
        domicilio: 'New address',
        color: 'Blue',
      };

      const mockResponse = {
        success: true,
        application: {
          id: 'R1',
          parent_application_id: '1',
          status: 'RENEWAL_PENDING',
          is_renewal: true,
          domicilio: 'New address',
          color: 'Blue',
        } as any,
        message: 'Renewal application created successfully',
        paymentInstructions: {
          amount: 1500,
          currency: 'MXN',
          reference: 'REF-R1',
          paymentMethods: ['Bank transfer'],
          nextSteps: ['Make payment'],
        },
      };

      mockPost.mockResolvedValueOnce({
        data: mockResponse,
      });

      const result = await applicationService.createRenewalApplication(applicationId, renewalData);

      expect(result).toEqual(mockResponse);
      expect(mockGet).toHaveBeenCalledWith('/auth/csrf-token');
      expect(mockPost).toHaveBeenCalledWith('/applications/1/renew', renewalData, {
        headers: { 'X-CSRF-Token': 'test-csrf-token' },
      });
    });

    it('should handle API error and return failure response', async () => {
      // Mock CSRF token request
      mockGet.mockResolvedValueOnce({
        data: { csrfToken: 'test-csrf-token' },
      });

      const applicationId = '1';
      const renewalData = {
        renewal_reason: 'Need to extend permit',
        renewal_notes: 'Additional notes',
        domicilio: 'New address',
        color: 'Blue',
      };

      // Mock API error
      const axiosError = new Error('API error') as AxiosError;
      axiosError.isAxiosError = true;
      axiosError.response = {
        data: { message: 'Permit not eligible for renewal' },
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config: {} as any,
      };
      mockPost.mockRejectedValueOnce(axiosError);

      const result = await applicationService.createRenewalApplication(applicationId, renewalData);

      expect(result.success).toBe(false);
      expect(result.application).toEqual({});
      expect(result.message).toBe('Permit not eligible for renewal');
      expect(mockGet).toHaveBeenCalledWith('/auth/csrf-token');
      expect(mockPost).toHaveBeenCalledWith('/applications/1/renew', renewalData, {
        headers: { 'X-CSRF-Token': 'test-csrf-token' },
      });
    });

    it('should handle network error and return failure response', async () => {
      // Mock CSRF token request
      mockGet.mockResolvedValueOnce({
        data: { csrfToken: 'test-csrf-token' },
      });

      const applicationId = '1';
      const renewalData = {
        renewal_reason: 'Need to extend permit',
        renewal_notes: 'Additional notes',
        domicilio: 'New address',
        color: 'Blue',
      };

      mockPost.mockRejectedValueOnce(new Error('Network error'));

      const result = await applicationService.createRenewalApplication(applicationId, renewalData);

      expect(result.success).toBe(false);
      expect(result.application).toEqual({});
      expect(result.message).toBe('Network error. Please check your connection.');
      expect(mockGet).toHaveBeenCalledWith('/auth/csrf-token');
      expect(mockPost).toHaveBeenCalledWith('/applications/1/renew', renewalData, {
        headers: { 'X-CSRF-Token': 'test-csrf-token' },
      });
    });
  });

  describe('submitRenewalApplication', () => {
    it('should submit renewal application successfully', async () => {
      // Mock CSRF token request
      mockGet.mockResolvedValueOnce({
        data: { csrfToken: 'test-csrf-token' },
      });

      const applicationId = 'R1';

      const mockResponse = {
        success: true,
        application: {
          id: 'R1',
          status: 'RENEWAL_SUBMITTED',
          is_renewal: true,
        } as any,
        message: 'Renewal application submitted successfully',
      };

      mockPost.mockResolvedValueOnce({
        data: mockResponse,
      });

      const result = await applicationService.submitRenewalApplication(applicationId);

      expect(result).toEqual(mockResponse);
      expect(mockGet).toHaveBeenCalledWith('/auth/csrf-token');
      expect(mockPost).toHaveBeenCalledWith(
        '/applications/R1/submit-renewal',
        {},
        { headers: { 'X-CSRF-Token': 'test-csrf-token' } },
      );
    });

    it('should handle API error and return failure response', async () => {
      // Mock CSRF token request
      mockGet.mockResolvedValueOnce({
        data: { csrfToken: 'test-csrf-token' },
      });

      const applicationId = 'R1';

      // Mock API error
      const axiosError = new Error('API error') as AxiosError;
      axiosError.isAxiosError = true;
      axiosError.response = {
        data: { message: 'Cannot submit renewal in current status' },
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config: {} as any,
      };
      mockPost.mockRejectedValueOnce(axiosError);

      const result = await applicationService.submitRenewalApplication(applicationId);

      expect(result.success).toBe(false);
      expect(result.application).toEqual({});
      expect(result.message).toBe('Cannot submit renewal in current status');
      expect(mockGet).toHaveBeenCalledWith('/auth/csrf-token');
      expect(mockPost).toHaveBeenCalledWith(
        '/applications/R1/submit-renewal',
        {},
        { headers: { 'X-CSRF-Token': 'test-csrf-token' } },
      );
    });

    it('should handle network error and return failure response', async () => {
      // Mock CSRF token request
      mockGet.mockResolvedValueOnce({
        data: { csrfToken: 'test-csrf-token' },
      });

      const applicationId = 'R1';

      mockPost.mockRejectedValueOnce(new Error('Network error'));

      const result = await applicationService.submitRenewalApplication(applicationId);

      expect(result.success).toBe(false);
      expect(result.application).toEqual({});
      expect(result.message).toBe('Network error. Please check your connection.');
      expect(mockGet).toHaveBeenCalledWith('/auth/csrf-token');
      expect(mockPost).toHaveBeenCalledWith(
        '/applications/R1/submit-renewal',
        {},
        { headers: { 'X-CSRF-Token': 'test-csrf-token' } },
      );
    });
  });

  describe('deleteApplication', () => {
    it('should delete application successfully', async () => {
      // Mock CSRF token request
      mockGet.mockResolvedValueOnce({
        data: { csrfToken: 'test-csrf-token' },
      });

      const applicationId = '1';

      const mockResponse = {
        success: true,
        message: 'Application deleted successfully',
      };

      mockDelete.mockResolvedValueOnce({
        data: mockResponse,
      });

      const result = await applicationService.deleteApplication(applicationId);

      expect(result).toEqual(mockResponse);
      expect(mockGet).toHaveBeenCalledWith('/auth/csrf-token');
      expect(mockDelete).toHaveBeenCalledWith('/applications/1', {
        headers: { 'X-CSRF-Token': 'test-csrf-token' },
      });
    });

    it('should handle API error and return failure response', async () => {
      // Mock CSRF token request
      mockGet.mockResolvedValueOnce({
        data: { csrfToken: 'test-csrf-token' },
      });

      const applicationId = '1';

      mockDelete.mockRejectedValueOnce(new Error('Network error'));

      const result = await applicationService.deleteApplication(applicationId);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to delete application. Please try again later.');
      expect(mockGet).toHaveBeenCalledWith('/auth/csrf-token');
      expect(mockDelete).toHaveBeenCalledWith('/applications/1', {
        headers: { 'X-CSRF-Token': 'test-csrf-token' },
      });
    });
  });

  describe('renewApplication', () => {
    it('should renew application successfully', async () => {
      // Mock CSRF token request
      mockGet.mockResolvedValueOnce({
        data: { csrfToken: 'test-csrf-token' },
      });

      const applicationId = '1';
      const expectedRenewalData: RenewalFormData = {
        domicilio: '',
        color: '',
        renewal_reason: 'Renovación regular',
        renewal_notes: '',
      };

      const mockResponse = {
        success: true,
        application: {
          id: 'R1',
          parent_application_id: '1',
          status: 'RENEWAL_PENDING',
          is_renewal: true,
        } as any,
        message: 'Application renewed successfully',
      };

      mockPost.mockResolvedValueOnce({
        data: mockResponse,
      });

      const result = await applicationService.renewApplication(applicationId);

      expect(result).toEqual(mockResponse);
      expect(mockGet).toHaveBeenCalledWith('/auth/csrf-token');
      expect(mockPost).toHaveBeenCalledWith('/applications/1/renew', expectedRenewalData, {
        headers: { 'X-CSRF-Token': 'test-csrf-token' },
      });
    });

    it('should handle API error and return failure response', async () => {
      // Mock CSRF token request
      mockGet.mockResolvedValueOnce({
        data: { csrfToken: 'test-csrf-token' },
      });

      const applicationId = '1';
      const expectedRenewalData: RenewalFormData = {
        domicilio: '',
        color: '',
        renewal_reason: 'Renovación regular',
        renewal_notes: '',
      };

      mockPost.mockRejectedValueOnce(new Error('Network error'));

      const result = await applicationService.renewApplication(applicationId);

      expect(result.success).toBe(false);
      expect(result.application).toEqual({});
      expect(result.message).toBe('Failed to renew application. Please try again later.');
      expect(mockGet).toHaveBeenCalledWith('/auth/csrf-token');
      expect(mockPost).toHaveBeenCalledWith('/applications/1/renew', expectedRenewalData, {
        headers: { 'X-CSRF-Token': 'test-csrf-token' },
      });
    });
  });
});
