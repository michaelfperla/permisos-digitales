import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

import { usePermitDetails } from '../usePermitDetails';

// Mock all dependencies at the top level
const mockApplicationService = {
  getApplicationById: vi.fn(),
  downloadPermit: vi.fn(),
};

const mockShowToast = vi.fn();
const mockNavigate = vi.fn();
const mockUseParams = vi.fn();
const mockUsePermitStatusPolling = vi.fn();

// Mock modules
vi.mock('../../services/applicationService', () => ({
  default: {
    getApplicationById: vi.fn(),
    downloadPermit: vi.fn(),
  },
}));

vi.mock('../../shared/hooks/useToast', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

vi.mock('../usePermitStatusPolling', () => ({
  usePermitStatusPolling: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useParams: vi.fn(),
  useNavigate: () => vi.fn(),
}));

// Mock DOM APIs
Object.defineProperty(window, 'URL', {
  value: {
    createObjectURL: vi.fn(() => 'blob:mock-url'),
    revokeObjectURL: vi.fn(),
  },
  writable: true,
});

Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn(),
  },
  writable: true,
});

Object.defineProperty(document, 'createElement', {
  value: vi.fn(() => ({
    href: '',
    download: '',
    click: vi.fn(),
    style: {},
  })),
  writable: true,
});

Object.defineProperty(document.body, 'appendChild', {
  value: vi.fn(),
  writable: true,
});

Object.defineProperty(document.body, 'removeChild', {
  value: vi.fn(),
  writable: true,
});

// Test wrapper for React Query
const createWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  });

  return React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe('usePermitDetails', () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    // Get references to mocked modules
    const applicationService = await import('../../services/applicationService');
    const { useToast } = await import('../../shared/hooks/useToast');
    const { usePermitStatusPolling } = await import('../usePermitStatusPolling');
    const { useParams, useNavigate } = await import('react-router-dom');

    // Setup mocks
    vi.mocked(applicationService.default.getApplicationById).mockImplementation(mockApplicationService.getApplicationById);
    vi.mocked(applicationService.default.downloadPermit).mockImplementation(mockApplicationService.downloadPermit);
    
    vi.mocked(useToast).mockReturnValue({
      showToast: mockShowToast,
    });

    vi.mocked(usePermitStatusPolling).mockReturnValue({
      isPolling: false,
      status: null,
      error: null,
      startPolling: vi.fn(),
      stopPolling: vi.fn(),
    });

    vi.mocked(useParams).mockImplementation(mockUseParams);
    vi.mocked(useNavigate).mockReturnValue(mockNavigate);

    // Clear URL and clipboard mocks
    vi.mocked(window.URL.createObjectURL).mockClear();
    vi.mocked(window.URL.revokeObjectURL).mockClear();
    vi.mocked(navigator.clipboard.writeText).mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Data fetching', () => {
    it('should fetch application data when id is provided', async () => {
      const applicationId = 'app-123';
      const mockApplicationData = {
        application: {
          id: applicationId,
          folio: 'FOL-123',
          status: 'completed',
        },
        status: {
          currentStatus: 'PERMIT_READY',
        },
      };

      mockUseParams.mockReturnValue({ id: applicationId });
      mockApplicationService.getApplicationById.mockResolvedValue(mockApplicationData);

      const { result } = renderHook(() => usePermitDetails(), {
        wrapper: createWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.applicationData).toEqual(mockApplicationData);
      expect(result.current.currentStatus).toBe('PERMIT_READY');
      expect(result.current.isError).toBe(false);
    });

    it('should not fetch data when id is not provided', () => {
      mockUseParams.mockReturnValue({ id: undefined });

      const { result } = renderHook(() => usePermitDetails(), {
        wrapper: createWrapper,
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.applicationData).toBeUndefined();
      expect(mockApplicationService.getApplicationById).not.toHaveBeenCalled();
    });

    it('should handle API errors', async () => {
      const applicationId = 'app-123';
      const mockError = new Error('Application not found');

      mockUseParams.mockReturnValue({ id: applicationId });
      mockApplicationService.getApplicationById.mockRejectedValue(mockError);

      const { result } = renderHook(() => usePermitDetails(), {
        wrapper: createWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isError).toBe(true);
      expect(result.current.error).toEqual(mockError);
    });
  });

  describe('Download functionality', () => {
    it('should download permit successfully', async () => {
      const applicationId = 'app-123';
      const mockBlob = new Blob(['mock pdf content'], { type: 'application/pdf' });
      const mockApplicationData = {
        application: {
          folio: 'FOL-123',
        },
      };

      mockUseParams.mockReturnValue({ id: applicationId });
      mockApplicationService.getApplicationById.mockResolvedValue(mockApplicationData);
      mockApplicationService.downloadPermit.mockResolvedValue(mockBlob);

      const { result } = renderHook(() => usePermitDetails(), {
        wrapper: createWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Test download
      await act(async () => {
        await result.current.actions.handleDownloadPermit('permiso');
      });

      expect(mockApplicationService.downloadPermit).toHaveBeenCalledWith(applicationId, 'permiso');
      expect(window.URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
      expect(mockShowToast).toHaveBeenCalledWith('Permiso descargado.', 'success');
    });

    it('should handle download errors', async () => {
      const applicationId = 'app-123';
      const mockError = new Error('Download failed');

      mockUseParams.mockReturnValue({ id: applicationId });
      mockApplicationService.getApplicationById.mockResolvedValue({});
      mockApplicationService.downloadPermit.mockRejectedValue(mockError);

      const { result } = renderHook(() => usePermitDetails(), {
        wrapper: createWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.actions.handleDownloadPermit('certificado');
      });

      expect(mockShowToast).toHaveBeenCalledWith('No pudimos descargar tu certificado.', 'error');
    });

    it('should handle download for different document types', async () => {
      const applicationId = 'app-123';
      const mockBlob = new Blob(['mock pdf content'], { type: 'application/pdf' });
      const mockApplicationData = {
        application: {
          folio: 'FOL-123',
        },
      };

      mockUseParams.mockReturnValue({ id: applicationId });
      mockApplicationService.getApplicationById.mockResolvedValue(mockApplicationData);
      mockApplicationService.downloadPermit.mockResolvedValue(mockBlob);

      const { result } = renderHook(() => usePermitDetails(), {
        wrapper: createWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const documentTypes = ['permiso', 'certificado', 'placas'] as const;

      for (const type of documentTypes) {
        await act(async () => {
          await result.current.actions.handleDownloadPermit(type);
        });

        expect(mockApplicationService.downloadPermit).toHaveBeenCalledWith(applicationId, type);
        expect(mockShowToast).toHaveBeenCalledWith(
          `${type.charAt(0).toUpperCase() + type.slice(1)} descargado.`,
          'success'
        );
      }
    });

    it('should not download when id is missing', async () => {
      mockUseParams.mockReturnValue({ id: undefined });

      const { result } = renderHook(() => usePermitDetails(), {
        wrapper: createWrapper,
      });

      await act(async () => {
        await result.current.actions.handleDownloadPermit('permiso');
      });

      expect(mockApplicationService.downloadPermit).not.toHaveBeenCalled();
    });

    it('should manage downloading state correctly', async () => {
      const applicationId = 'app-123';
      const mockBlob = new Blob(['mock pdf content'], { type: 'application/pdf' });

      mockUseParams.mockReturnValue({ id: applicationId });
      mockApplicationService.getApplicationById.mockResolvedValue({});
      mockApplicationService.downloadPermit.mockResolvedValue(mockBlob);

      const { result } = renderHook(() => usePermitDetails(), {
        wrapper: createWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.state.isDownloading).toBe(false);

      // Start download
      const downloadPromise = act(async () => {
        await result.current.actions.handleDownloadPermit('permiso');
      });

      await downloadPromise;

      // Should finish downloading
      expect(result.current.state.isDownloading).toBe(false);
    });
  });

  describe('OXXO functionality', () => {
    it('should show OXXO modal', () => {
      mockUseParams.mockReturnValue({ id: 'app-123' });

      const { result } = renderHook(() => usePermitDetails(), {
        wrapper: createWrapper,
      });

      expect(result.current.state.showOxxoModal).toBe(false);

      act(() => {
        result.current.actions.handleViewOxxoSlip();
      });

      expect(result.current.state.showOxxoModal).toBe(true);
    });

    it('should close OXXO modal', () => {
      mockUseParams.mockReturnValue({ id: 'app-123' });

      const { result } = renderHook(() => usePermitDetails(), {
        wrapper: createWrapper,
      });

      act(() => {
        result.current.actions.handleViewOxxoSlip();
      });

      expect(result.current.state.showOxxoModal).toBe(true);

      act(() => {
        result.current.actions.closeOxxoModal();
      });

      expect(result.current.state.showOxxoModal).toBe(false);
    });

    it('should copy OXXO reference successfully', async () => {
      const applicationId = 'app-123';
      const mockApplicationData = {
        oxxoReference: '930012345678901',
      };

      mockUseParams.mockReturnValue({ id: applicationId });
      mockApplicationService.getApplicationById.mockResolvedValue(mockApplicationData);

      const { result } = renderHook(() => usePermitDetails(), {
        wrapper: createWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.state.copied).toBe(false);

      await act(async () => {
        result.current.actions.handleCopyReference();
      });

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('930012345678901');
      expect(mockShowToast).toHaveBeenCalledWith('Referencia OXXO copiada al portapapeles.', 'success');
      expect(result.current.state.copied).toBe(true);

      // Should reset copied state after timeout
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 2100));
      });

      expect(result.current.state.copied).toBe(false);
    });

    it('should handle missing OXXO reference', async () => {
      const applicationId = 'app-123';
      const mockApplicationData = {
        // No oxxoReference
      };

      mockUseParams.mockReturnValue({ id: applicationId });
      mockApplicationService.getApplicationById.mockResolvedValue(mockApplicationData);

      const { result } = renderHook(() => usePermitDetails(), {
        wrapper: createWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.actions.handleCopyReference();
      });

      expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
      expect(mockShowToast).toHaveBeenCalledWith('Referencia OXXO no disponible.', 'error');
    });
  });

  describe('Navigation functionality', () => {
    it('should navigate to renewal page', () => {
      const applicationId = 'app-123';
      mockUseParams.mockReturnValue({ id: applicationId });

      const { result } = renderHook(() => usePermitDetails(), {
        wrapper: createWrapper,
      });

      act(() => {
        result.current.actions.handleRenewClick();
      });

      expect(mockNavigate).toHaveBeenCalledWith(`/permits/renew/${applicationId}`);
    });
  });

  describe('Status polling integration', () => {
    it('should enable polling when id and status are available', async () => {
      const applicationId = 'app-123';
      const mockApplicationData = {
        status: {
          currentStatus: 'PROCESSING',
        },
      };

      mockUseParams.mockReturnValue({ id: applicationId });
      mockApplicationService.getApplicationById.mockResolvedValue(mockApplicationData);

      renderHook(() => usePermitDetails(), {
        wrapper: createWrapper,
      });

      await waitFor(() => {
        expect(mockUsePermitStatusPolling).toHaveBeenCalledWith({
          applicationId,
          currentStatus: 'PROCESSING',
          onStatusChange: expect.any(Function),
          enabled: true,
        });
      });
    });

    it('should disable polling when id is missing', () => {
      mockUseParams.mockReturnValue({ id: undefined });

      renderHook(() => usePermitDetails(), {
        wrapper: createWrapper,
      });

      expect(mockUsePermitStatusPolling).toHaveBeenCalledWith({
        applicationId: null,
        currentStatus: null,
        onStatusChange: expect.any(Function),
        enabled: false,
      });
    });

    it('should call refetch when status changes', async () => {
      const applicationId = 'app-123';
      const mockApplicationData = {
        status: {
          currentStatus: 'PROCESSING',
        },
      };

      mockUseParams.mockReturnValue({ id: applicationId });
      mockApplicationService.getApplicationById.mockResolvedValue(mockApplicationData);

      renderHook(() => usePermitDetails(), {
        wrapper: createWrapper,
      });

      await waitFor(() => {
        expect(mockUsePermitStatusPolling).toHaveBeenCalled();
      });

      // Get the onStatusChange callback from the mock call
      const onStatusChangeCallback = mockUsePermitStatusPolling.mock.calls[0][0].onStatusChange;

      // Clear previous calls
      mockApplicationService.getApplicationById.mockClear();

      // Trigger status change
      act(() => {
        onStatusChangeCallback();
      });

      // Should trigger refetch
      await waitFor(() => {
        expect(mockApplicationService.getApplicationById).toHaveBeenCalledWith(applicationId);
      });
    });
  });

  describe('State management', () => {
    it('should provide correct initial state', () => {
      mockUseParams.mockReturnValue({ id: 'app-123' });

      const { result } = renderHook(() => usePermitDetails(), {
        wrapper: createWrapper,
      });

      expect(result.current.state).toEqual({
        isDownloading: false,
        copied: false,
        showOxxoModal: false,
        isPolling: false,
      });
    });

    it('should provide all required actions', () => {
      mockUseParams.mockReturnValue({ id: 'app-123' });

      const { result } = renderHook(() => usePermitDetails(), {
        wrapper: createWrapper,
      });

      expect(result.current.actions).toHaveProperty('handleDownloadPermit');
      expect(result.current.actions).toHaveProperty('handleViewOxxoSlip');
      expect(result.current.actions).toHaveProperty('handleCopyReference');
      expect(result.current.actions).toHaveProperty('handleRenewClick');
      expect(result.current.actions).toHaveProperty('refetch');
      expect(result.current.actions).toHaveProperty('closeOxxoModal');

      expect(typeof result.current.actions.handleDownloadPermit).toBe('function');
      expect(typeof result.current.actions.handleViewOxxoSlip).toBe('function');
      expect(typeof result.current.actions.handleCopyReference).toBe('function');
      expect(typeof result.current.actions.handleRenewClick).toBe('function');
      expect(typeof result.current.actions.refetch).toBe('function');
      expect(typeof result.current.actions.closeOxxoModal).toBe('function');
    });

    it('should handle manual refetch', async () => {
      const applicationId = 'app-123';
      const mockApplicationData = {
        application: { id: applicationId },
      };

      mockUseParams.mockReturnValue({ id: applicationId });
      mockApplicationService.getApplicationById.mockResolvedValue(mockApplicationData);

      const { result } = renderHook(() => usePermitDetails(), {
        wrapper: createWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Clear previous calls
      mockApplicationService.getApplicationById.mockClear();

      // Trigger manual refetch
      await act(async () => {
        await result.current.actions.refetch();
      });

      expect(mockApplicationService.getApplicationById).toHaveBeenCalledWith(applicationId);
    });
  });

  describe('Edge cases', () => {
    it('should handle concurrent downloads', async () => {
      const applicationId = 'app-123';
      const mockBlob = new Blob(['mock pdf content'], { type: 'application/pdf' });

      mockUseParams.mockReturnValue({ id: applicationId });
      mockApplicationService.getApplicationById.mockResolvedValue({});
      mockApplicationService.downloadPermit.mockResolvedValue(mockBlob);

      const { result } = renderHook(() => usePermitDetails(), {
        wrapper: createWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Start multiple downloads concurrently
      const downloads = [
        result.current.actions.handleDownloadPermit('permiso'),
        result.current.actions.handleDownloadPermit('certificado'),
        result.current.actions.handleDownloadPermit('placas'),
      ];

      await act(async () => {
        await Promise.all(downloads);
      });

      expect(mockApplicationService.downloadPermit).toHaveBeenCalledTimes(3);
    });

    it('should handle rapid state changes', () => {
      mockUseParams.mockReturnValue({ id: 'app-123' });

      const { result } = renderHook(() => usePermitDetails(), {
        wrapper: createWrapper,
      });

      // Rapid modal state changes
      act(() => {
        result.current.actions.handleViewOxxoSlip();
        result.current.actions.closeOxxoModal();
        result.current.actions.handleViewOxxoSlip();
      });

      expect(result.current.state.showOxxoModal).toBe(true);
    });
  });
});