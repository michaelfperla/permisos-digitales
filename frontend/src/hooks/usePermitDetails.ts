import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import { getApplicationById, downloadPermit } from '../services/applicationService';
import { useToast } from '../shared/hooks/useToast';
import { usePermitStatusPolling } from './usePermitStatusPolling';
import { logger } from '../utils/logger';

/**
 * A custom hook to manage all the business logic and state for the PermitDetailsPage.
 * It encapsulates data fetching, state management, and user action handlers.
 */
export const usePermitDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  // State for UI interactions
  const [downloadingTypes, setDownloadingTypes] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [showOxxoModal, setShowOxxoModal] = useState(false);

  // The core data query for the permit details
  const {
    data: applicationData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['application', id],
    queryFn: () => getApplicationById(id!),
    enabled: !!id,
  });

const handleDownloadPermit = async (type: 'permiso' | 'certificado' | 'placas' | 'recomendaciones' = 'permiso') => {
    if (!id) return;
    
    // Check if this type is already downloading
    if (downloadingTypes.has(type)) {
      return;
    }
    
    // Add type to downloading set
    setDownloadingTypes(prev => new Set(prev).add(type));
    
    try {
      const secureUrl = await downloadPermit(id, type);
      
      // Use consistent naming: always use folio if available, otherwise ID
      const folio = (applicationData?.application as any)?.folio;
      const filename = folio ? `${type}_${folio}.pdf` : `${type}_${id}.pdf`;
      
      try {
        // Fetch the file to avoid CORS issues
        const response = await fetch(secureUrl);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        
        // Create a temporary anchor element with blob URL
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up the blob URL
        setTimeout(() => window.URL.revokeObjectURL(blobUrl), 100);
        
        showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} descargado correctamente.`, 'success');
      } catch (fetchError) {
        // Fallback to direct link if fetch fails
        logger.warn('Fetch failed, trying direct download', fetchError);
        const link = document.createElement('a');
        link.href = secureUrl;
        link.download = filename;
        link.target = '_blank';
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast(`Descargando ${type.charAt(0).toUpperCase() + type.slice(1)}...`, 'info');
      }
    } catch (err) {
      logger.error(`Error downloading ${type}:`, err);
      showToast(`No pudimos descargar tu ${type}.`, 'error');
    } finally {
      // Remove type from downloading set
      setDownloadingTypes(prev => {
        const newSet = new Set(prev);
        newSet.delete(type);
        return newSet;
      });
    }
  };

  const handleViewOxxoSlip = () => {
    setShowOxxoModal(true);
  };

  const handleCopyReference = () => {
    const reference = (applicationData as any)?.oxxoReference;
    if (reference) {
      navigator.clipboard.writeText(reference);
      setCopied(true);
      showToast('Referencia OXXO copiada al portapapeles.', 'success');
      setTimeout(() => setCopied(false), 2000);
    } else {
      showToast('Referencia OXXO no disponible.', 'error');
    }
  };

  const handleRenewClick = () => {
    // This logic can be expanded as needed
    navigate(`/permits/renew/${id}`);
  };

  // --- DERIVED STATE & VALUES ---

  const currentStatus = applicationData?.status?.currentStatus;

  // --- INTELLIGENT STATUS POLLING ---
  
  // Integrate automatic status polling for permit updates
  const { isPolling } = usePermitStatusPolling({
    applicationId: id || null,
    currentStatus: currentStatus || null,
    onStatusChange: () => {
      // Refetch data when status changes are detected
      refetch();
    },
    enabled: !!id && !!currentStatus
  });

  // The hook returns a clean interface for the UI component to consume.
  return {
    isLoading,
    isError,
    error,
    applicationData,
    currentStatus,
    state: {
      isDownloading: downloadingTypes.size > 0,
      downloadingTypes,
      copied,
      showOxxoModal,
      isPolling,
    },
    actions: {
      handleDownloadPermit,
      handleViewOxxoSlip,
      handleCopyReference,
      handleRenewClick,
      refetch,
      closeOxxoModal: () => setShowOxxoModal(false),
    },
  };
};