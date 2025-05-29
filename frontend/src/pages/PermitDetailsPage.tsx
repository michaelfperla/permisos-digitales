import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import React, { useState, useEffect, useRef } from 'react';
import {
  FaDownload,
  FaSync,
  FaCreditCard,
  FaCopy,
  FaCalendarAlt,
  FaInfoCircle,
  FaExclamationTriangle,
  FaTimesCircle,
  FaStore,
  FaMoneyBill,
  FaFilePdf,
  FaFileInvoice,
  FaFileContract,
  FaIdCard,
} from 'react-icons/fa';
import { useParams, useNavigate, useLocation } from 'react-router-dom';

import styles from './PermitDetailsPage.module.css';
import OxxoPaymentSlipModal from '../components/payment/OxxoPaymentSlipModal';
import RenewalEligibility from '../components/permit/RenewalEligibility';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ResponsiveContainer from '../components/ui/ResponsiveContainer/ResponsiveContainer';
import StatusBadge from '../components/ui/StatusBadge';
import applicationService, {
  Application,
  ApplicationStatus,
} from '../services/applicationService';
import paymentService from '../services/paymentService';
import { useToast } from '../shared/hooks/useToast';
import { PermitStatus } from '../types/permisos';

const USE_MOCK_DATA = false;

interface MockApplicationDetails {
  id: string;
  vehicleInfo: {
    marca: string;
    linea: string;
    color: string;
    numero_serie: string;
    numero_motor: string;
    ano_modelo: string | number;
  };
  ownerInfo: {
    nombre_completo: string;
    curp_rfc: string;
    domicilio: string;
  };
  dates: {
    created: string;
    updated: string;
    paymentVerified?: string;  };
  paymentReference?: string;
  payment_rejection_reason?: string;
  folio?: string;
  importe?: number;
  fecha_expedicion?: string;
  fecha_vencimiento?: string;
  permit_file_path?: string;
  recibo_file_path?: string;
  certificado_file_path?: string;
  placas_file_path?: string;
}

interface MockStatusInfo {
  currentStatus: PermitStatus;
  lastUpdated: string;
  displayMessage: string;
  nextSteps: string;
  allowedActions: string[];
}

interface MockApplicationResponse {
  application: MockApplicationDetails;
  status: MockStatusInfo;
}

const mockPermits: Record<string, MockApplicationResponse> = {
  'payment-123': {
    application: {
      id: 'payment-123',
      vehicleInfo: {
        marca: 'Nissan',
        linea: 'Sentra',
        color: 'Blanco',
        numero_serie: '1HGCM82633A123456',
        numero_motor: 'ABC123456789',
        ano_modelo: '2022',
      },
      ownerInfo: {
        nombre_completo: 'Juan Pérez',
        curp_rfc: 'PERJ901231ABC123',
        domicilio: 'Calle Principal 123, Acapulco, Guerrero',
      },
      dates: {
        created: '2023-05-15T10:30:00Z',
        updated: '2023-05-15T10:30:00Z',
      },
      paymentReference: '93847562',
      importe: 197.0,
    },
    status: {
      currentStatus: PermitStatus.AWAITING_OXXO_PAYMENT,
      lastUpdated: '2023-05-15T10:30:00Z',
      displayMessage: 'Pago pendiente en OXXO',
      nextSteps: 'Realiza el pago en cualquier tienda OXXO',
      allowedActions: ['view_payment_instructions'],
    },
  },
  '1': {
    application: {
      id: '1',
      vehicleInfo: {
        marca: 'Toyota',
        linea: 'Camry',
        color: 'Azul',
        numero_serie: '2HGCM82633A654321',
        numero_motor: 'XYZ987654321',
        ano_modelo: '2021',
      },
      ownerInfo: {
        nombre_completo: 'Juan Pérez',
        curp_rfc: 'PERJ901231ABC123',
        domicilio: 'Calle Principal 123, Acapulco, Guerrero',
      },
      dates: {
        created: '2023-01-15T10:30:00Z',
        updated: '2023-01-15T14:45:00Z',
        paymentVerified: '2023-01-15T11:30:00Z',
      },
      folio: 'PD-2023-12345',
      importe: 197.0,
      fecha_expedicion: '2023-01-15',
      fecha_vencimiento: '2025-12-31',
      permit_file_path: '/storage/pdfs/permiso_1_1673789100.pdf',
      recibo_file_path: '/storage/pdfs/recibo_1_1673789100.pdf',
      certificado_file_path: '/storage/pdfs/certificado_1_1673789100.pdf',
      placas_file_path: '/storage/pdfs/placas_1_1673789100.pdf',
    },
    status: {
      currentStatus: PermitStatus.PERMIT_READY,
      lastUpdated: '2023-01-15T14:45:00Z',
      displayMessage: 'Tu permiso está listo',
      nextSteps: 'Descarga tu permiso',
      allowedActions: ['download_permit'],
    },
  },
  '2': {
    application: {
      id: '2',
      vehicleInfo: {
        marca: 'Honda',
        linea: 'CRV',
        color: 'Rojo',
        numero_serie: '3HGCM82633A789012',
        numero_motor: 'DEF123456789',
        ano_modelo: '2020',
      },
      ownerInfo: {
        nombre_completo: 'Juan Pérez',
        curp_rfc: 'PERJ901231ABC123',
        domicilio: 'Calle Principal 123, Acapulco, Guerrero',
      },
      dates: {
        created: '2023-02-15T10:30:00Z',
        updated: '2023-02-15T14:45:00Z',
        paymentVerified: '2023-02-15T11:30:00Z',
      },
      folio: 'PD-2023-67890',
      importe: 197.0,
      fecha_expedicion: '2023-02-15',
      fecha_vencimiento: '2023-06-15',
      permit_file_path: '/storage/pdfs/permiso_2_1676458200.pdf',
      recibo_file_path: '/storage/pdfs/recibo_2_1676458200.pdf',
      certificado_file_path: '/storage/pdfs/certificado_2_1676458200.pdf',
      placas_file_path: '/storage/pdfs/placas_2_1676458200.pdf',
    },
    status: {
      currentStatus: PermitStatus.PERMIT_READY,
      lastUpdated: '2023-02-15T14:45:00Z',
      displayMessage: 'Tu permiso expirará pronto',
      nextSteps: 'Considera renovar tu permiso',
      allowedActions: ['download_permit', 'renew_permit'],
    },
  },
};

/**
 * Detailed permit view with payment status, document downloads, and renewal options
 */
const PermitDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();

  const [isDownloading, setIsDownloading] = useState(false);
  const [_isCheckingPaymentStatus, setIsCheckingPaymentStatus] = useState(false);
  const [_paymentStatusMessage, setPaymentStatusMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('status');
  const [copied, setCopied] = useState(false);
  const [isOxxoModalOpen, setIsOxxoModalOpen] = useState(false);
  const [isFetchingRenewalData, setIsFetchingRenewalData] = useState(false);

  const [mockApplicationData, setMockApplicationData] = useState<MockApplicationResponse | null>(
    null,
  );
  const [mockIsLoading, setMockIsLoading] = useState(true);
  const [mockIsError, setMockIsError] = useState(false);
  const [mockError, setMockError] = useState<Error | null>(null);

  useEffect(() => {
    if (USE_MOCK_DATA && id) {
      setMockIsLoading(true);
      setMockIsError(false);
      setMockError(null);

      // Simulate API delay
      setTimeout(() => {
        console.info(`Using mock data for permit ID: ${id}`);

        // Check if we have mock data for this ID
        // First try direct match
        let mockData = mockPermits[id as keyof typeof mockPermits];

        // If no direct match and id starts with "payment-", try to find a matching payment permit
        if (!mockData && id.startsWith('payment-')) {
          // Look for any payment-related mock data
          mockData = mockPermits['payment-123']; // Use the payment example
        }

        // If no direct match but id is numeric, try to find a matching numeric ID
        if (!mockData && !isNaN(parseInt(id, 10))) {
          const numericId = parseInt(id, 10).toString();
          mockData = mockPermits[numericId as keyof typeof mockPermits];
        }

        if (mockData) {
          setMockApplicationData(mockData);
        } else {
          // If no mock data found for this ID, set error
          setMockIsError(true);
          setMockError(new Error('Permiso no encontrado'));
        }
        setMockIsLoading(false);
      }, 500); // Simulate a 500ms delay
    }
  }, [id]);

  // Mock refetch function
  const mockRefetch = () => {
    if (USE_MOCK_DATA && id) {
      setMockIsLoading(true);

      // Simulate API delay
      setTimeout(() => {
        // First try direct match
        let mockData = mockPermits[id as keyof typeof mockPermits];

        // If no direct match and id starts with "payment-", try to find a matching payment permit
        if (!mockData && id.startsWith('payment-')) {
          // Look for any payment-related mock data
          mockData = mockPermits['payment-123']; // Use the payment example
        }

        // If no direct match but id is numeric, try to find a matching numeric ID
        if (!mockData && !isNaN(parseInt(id, 10))) {
          const numericId = parseInt(id, 10).toString();
          mockData = mockPermits[numericId as keyof typeof mockPermits];
        }

        if (mockData) {
          setMockApplicationData(mockData);
          setMockIsError(false);
          setMockError(null);
        } else {
          setMockIsError(true);
          setMockError(new Error('Permiso no encontrado'));
        }
        setMockIsLoading(false);
      }, 500);
    }
    return Promise.resolve();
  };

  // Fetch application details using React Query (only if not using mock data)
  const {
    data: apiApplicationData,
    isLoading: apiIsLoading,
    isError: apiIsError,
    error: apiError,
    refetch: apiRefetch,
  } = useQuery({
    queryKey: ['application', id],
    queryFn: () => applicationService.getApplicationById(id!),
    enabled: !!id && !USE_MOCK_DATA, // Only run query if id exists and not using mock data
  });

  // Use either mock data or API data based on USE_MOCK_DATA flag
  const applicationData = USE_MOCK_DATA ? mockApplicationData : apiApplicationData;
  const isLoading = USE_MOCK_DATA ? mockIsLoading : apiIsLoading;
  const isError = USE_MOCK_DATA ? mockIsError : apiIsError;
  const error = USE_MOCK_DATA ? mockError : apiError;
  const refetch = USE_MOCK_DATA ? mockRefetch : apiRefetch;

  // Create a flattened application object for backward compatibility
  const application: Application | null = applicationData && applicationData.application && applicationData.status
    ? {
        id: applicationData.application.id,
        user_id: '', // Not available in new format
        status: applicationData.status.currentStatus as unknown as ApplicationStatus, // Type cast to fix compatibility
        created_at: applicationData.application.dates.created,
        updated_at: applicationData.application.dates.updated,

        // Owner info
        nombre_completo: applicationData.application.ownerInfo.nombre_completo,
        curp_rfc: applicationData.application.ownerInfo.curp_rfc,
        domicilio: applicationData.application.ownerInfo.domicilio,

        // Vehicle info
        marca: applicationData.application.vehicleInfo.marca,
        linea: applicationData.application.vehicleInfo.linea,
        color: applicationData.application.vehicleInfo.color,
        numero_serie: applicationData.application.vehicleInfo.numero_serie,
        numero_motor: applicationData.application.vehicleInfo.numero_motor,
        ano_modelo:
          typeof applicationData.application.vehicleInfo.ano_modelo === 'string'
            ? parseInt(applicationData.application.vehicleInfo.ano_modelo, 10)
            : (applicationData.application.vehicleInfo.ano_modelo as number),

        // Payment info
        // Legacy payment properties removed from current system

        // Other fields with default values or from mock data
        // Use type assertion to access properties that might not exist in the ApplicationDetails type
        folio: (applicationData.application as any).folio || '',
        importe: (applicationData.application as any).importe || 197.0, // Default amount
        fecha_expedicion: (applicationData.application as any).fecha_expedicion || '',
        fecha_vencimiento: (applicationData.application as any).fecha_vencimiento || '',
      }
    : null;

  // Get current status from either the new or old format
  const currentStatus = applicationData?.status?.currentStatus || application?.status;

  // Track if we've already checked payment status for this session
  const hasCheckedPaymentStatus = useRef(false);

  // Reset the check status when the ID changes or component unmounts
  useEffect(() => {
    hasCheckedPaymentStatus.current = false;

    return () => {
      hasCheckedPaymentStatus.current = false;
    };
  }, [id]);

  // Track toast messages that have been shown
  const shownToasts = useRef<Record<string, boolean>>({});

  // Check payment status when returning from payment gateway
  useEffect(() => {
    const checkPaymentStatus = async () => {
      if (!id || !applicationData) return;

      // Check if we're returning from a payment gateway (check URL parameters)
      const searchParams = new URLSearchParams(location.search);
      const fromPayment = searchParams.get('from_payment');

      // Only check status if explicitly returning from payment
      if (fromPayment === 'true') {
        try {
          setIsCheckingPaymentStatus(true);
          setPaymentStatusMessage('Verificando estado del pago...');

          const paymentStatus = await paymentService.checkPaymentStatus(id);
          const toastKey = `payment_status_${id}_${paymentStatus.applicationStatus}`;

          // If the payment was successful, show a success message
          if (paymentStatus.applicationStatus === 'PAYMENT_RECEIVED') {
            setPaymentStatusMessage('¡Pago recibido! Actualizando estado del permiso...');

            // Only show toast if not already shown for this status
            if (!shownToasts.current[toastKey]) {
              showToast('Pago recibido correctamente', 'success');
              shownToasts.current[toastKey] = true;
            }

            // Refresh the application data
            refetch();
          } else if (paymentStatus.applicationStatus === 'AWAITING_OXXO_PAYMENT') {
            // If it's an OXXO payment waiting for confirmation
            setPaymentStatusMessage(
              'Esperando confirmación de pago en OXXO. Por favor, realiza el pago con la referencia proporcionada.',
            );

            // Only show toast if not already shown for this status
            if (!shownToasts.current[toastKey]) {
              showToast('Pago OXXO pendiente', 'info');
              shownToasts.current[toastKey] = true;
            }
          } else if (
            paymentStatus.applicationStatus === 'PAYMENT_PROCESSING' ||
            paymentStatus.status === 'pending_payment'
          ) {
            // If the payment is still processing, show a pending message
            setPaymentStatusMessage('Pago en proceso. Puede tomar unos minutos en actualizarse.');

            // Only show toast if not already shown for this status
            if (!shownToasts.current[toastKey]) {
              showToast('Pago en proceso', 'info');
              shownToasts.current[toastKey] = true;
            }
          } else {
            // If the payment failed, show an error message
            setPaymentStatusMessage(null);

            // Only show toast if not already shown for this status
            if (!shownToasts.current[toastKey]) {
              showToast('El pago no ha sido procesado aún', 'warning');
              shownToasts.current[toastKey] = true;
            }
          }
        } catch (err) {
          console.error('Error checking payment status:', err);
          setPaymentStatusMessage(null);

          const errorMessage =
            err instanceof Error ? err.message : 'Error al verificar el estado del pago';
          const toastKey = `payment_error_${id}_${errorMessage}`;

          // Only show toast if not already shown for this error
          if (!shownToasts.current[toastKey]) {
            showToast(errorMessage, 'error');
            shownToasts.current[toastKey] = true;
          }
        } finally {
          setIsCheckingPaymentStatus(false);
          // Remove the from_payment parameter from the URL
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.delete('from_payment');
          window.history.replaceState({}, '', newUrl.toString());
        }
      }
    };

    checkPaymentStatus();
  }, [id, location.search, refetch, showToast]);

  // Separate effect to check payment status for AWAITING_OXXO_PAYMENT or PAYMENT_PROCESSING
  // This prevents infinite loops by using a ref to track if we've already checked
  useEffect(() => {
    const checkPaymentStatus = async () => {
      // Only check once per component mount and only if status is one we need to check
      if (
        !id ||
        !applicationData ||
        hasCheckedPaymentStatus.current ||
        (currentStatus !== 'AWAITING_OXXO_PAYMENT' &&
          currentStatus !== 'PAYMENT_PROCESSING' &&
          currentStatus !== 'AWAITING_PAYMENT')
      ) {
        return;
      }

      try {
        hasCheckedPaymentStatus.current = true;
        setIsCheckingPaymentStatus(true);

        // Set appropriate message based on status
        if (currentStatus === 'AWAITING_OXXO_PAYMENT') {
          setPaymentStatusMessage('Verificando estado del pago OXXO...');
        } else if (currentStatus === 'PAYMENT_PROCESSING') {
          setPaymentStatusMessage('Verificando estado del pago...');
        } else {
          setPaymentStatusMessage('Verificando estado de la solicitud...');
        }

        const paymentStatus = await paymentService.checkPaymentStatus(id);
        const toastKey = `payment_status_${id}_${paymentStatus.applicationStatus}`;

        // If the payment was successful, show a success message
        if (paymentStatus.applicationStatus === 'PAYMENT_RECEIVED') {
          setPaymentStatusMessage('¡Pago recibido! Actualizando estado del permiso...');

          // Only show toast if not already shown for this status
          if (!shownToasts.current[toastKey]) {
            showToast('Pago recibido correctamente', 'success');
            shownToasts.current[toastKey] = true;
          }

          // Refresh the application data
          refetch();
        } else if (paymentStatus.applicationStatus === 'PAYMENT_PROCESSING') {
          // For processing status, show appropriate message
          setPaymentStatusMessage('Pago en proceso. Puede tomar unos minutos en actualizarse.');
        } else if (paymentStatus.applicationStatus === 'AWAITING_OXXO_PAYMENT') {
          // For OXXO payment, show appropriate message
          setPaymentStatusMessage(
            'Esperando confirmación de pago en OXXO. Por favor, realiza el pago con la referencia proporcionada.',
          );
        } else {
          // For any other status, show a generic message
          setPaymentStatusMessage(
            'Esperando confirmación de pago. Por favor, complete el pago para continuar.',
          );
        }
      } catch (err) {
        console.error('Error checking OXXO payment status:', err);
        setPaymentStatusMessage(null);

        const errorMessage =
          err instanceof Error ? err.message : 'Error al verificar el estado del pago OXXO';
        const toastKey = `oxxo_payment_error_${id}_${errorMessage}`;

        // Only show toast if not already shown for this error
        if (!shownToasts.current[toastKey]) {
          showToast(errorMessage, 'error');
          shownToasts.current[toastKey] = true;
        }
      } finally {
        setIsCheckingPaymentStatus(false);
      }
    };

    checkPaymentStatus();
  }, [id, applicationData, currentStatus, refetch, showToast]);

  // Handle renewal click
  const handleRenewClick = async () => {
    if (!id) return;

    try {
      setIsFetchingRenewalData(true);

      // Fetch the original application data for renewal
      const response = await applicationService.getApplicationForRenewal(id);
      console.debug('Application data for renewal:', response);

      if (response.success && response.application) {
        // Navigate to the permit form page with the original application data
        navigate('/permits/complete', {
          state: {
            originalApplicationData: response.application,
            isRenewal: true,
            originalPermitId: id,
          },
          replace: true,
        });
      } else {
        showToast(
          response.message || 'No se pudo obtener la información del permiso original',
          'error',
        );
      }
    } catch (err) {
      console.error('Error fetching application for renewal:', err);

      // More detailed error message based on the error type
      if (axios.isAxiosError(err)) {
        const statusCode = err.response?.status;
        const errorMessage = err.response?.data?.message || err.message;

        if (statusCode === 401) {
          showToast('Sesión expirada. Por favor, inicie sesión nuevamente.', 'error');
        } else if (statusCode === 403) {
          showToast('No tiene permisos para renovar este permiso.', 'error');
        } else if (statusCode === 404) {
          showToast('El permiso solicitado no existe o ha sido eliminado.', 'error');
        } else {
          showToast(`Error al cargar la información del permiso: ${errorMessage}`, 'error');
        }
      } else {
        showToast(
          'Error al cargar la información del permiso. Por favor, inténtelo de nuevo más tarde.',
          'error',
        );
      }
    } finally {
      setIsFetchingRenewalData(false);
    }
  };

  // Handle permit download
  const handleDownloadPermit = async (
    permitId: string = id!,
    type: 'permiso' | 'recibo' | 'certificado' | 'placas' = 'permiso',
  ) => {
    if (!permitId || (!application && !applicationData)) return;

    try {
      setIsDownloading(true);

      // Call the API to download the permit
      const pdfBlob = await applicationService.downloadPermit(permitId, type);

      // Create a download link and trigger the download
      const url = window.URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');

      // Set the filename based on the document type
      const typeLabels: Record<string, string> = {
        permiso: 'Permiso',
        recibo: 'Recibo',
        certificado: 'Certificado',
        placas: 'Placas',
      };

      const folio = (application as any)?.folio || (applicationData?.application as any)?.folio || permitId;
      const filename = `${typeLabels[type] || 'Documento'}_${folio}.pdf`;

      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();

      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Create a unique key for this download success toast
      const toastKey = `download_success_${permitId}_${type}_${Date.now()}`;

      // Show success toast (always show for downloads as they are user-initiated actions)
      showToast(`¡Listo! ${typeLabels[type] || 'Documento'} descargado`, 'success');
      shownToasts.current[toastKey] = true;
    } catch (err) {
      console.error(`Error downloading ${type}:`, err);

      const errorMessage = `No pudimos descargar tu ${type}`;
      const toastKey = `download_error_${permitId}_${type}_${Date.now()}`;

      // Show error toast (always show for downloads as they are user-initiated actions)
      showToast(errorMessage, 'error');
      shownToasts.current[toastKey] = true;
    } finally {
      setIsDownloading(false);
    }
  };

  // Handle viewing OXXO payment slip
  const handleViewOxxoSlip = (_permitId: string = id!) => {
    // Check if we have the OXXO reference
    if (!(applicationData?.application as any)?.paymentReference) {
      showToast('Referencia OXXO no disponible', 'error');
      return;
    }

    // Open the OXXO payment slip modal
    setIsOxxoModalOpen(true);
  };

  // Handle copying OXXO reference
  const handleCopyReference = () => {
    // Always use the Conekta-generated OXXO reference
    const reference = (applicationData?.application as any)?.paymentReference;

    if (reference) {
      navigator.clipboard.writeText(reference);
      setCopied(true);

      // Create a unique key for this copy success toast
      const toastKey = `copy_reference_success_${id}_${Date.now()}`;

      // Show success toast (always show for copy actions as they are user-initiated)
      showToast('Referencia OXXO copiada al portapapeles', 'success');
      shownToasts.current[toastKey] = true;

      // Reset copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } else {
      // Create a unique key for this copy error toast
      const toastKey = `copy_reference_error_${id}_${Date.now()}`;

      // Show error toast (always show for copy actions as they are user-initiated)
      showToast('Referencia OXXO no disponible', 'error');
      shownToasts.current[toastKey] = true;
    }
  };

  // Format currency
  const formatCurrency = (amount?: number) => {
    if (!amount) return 'N/A';

    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';

    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Check if a date is within the renewal eligibility window (7 days before to 15 days after expiration)
  const isEligibleForRenewal = (dateString: string) => {
    // Check if dateString is valid
    if (!dateString) {
      return false;
    }

    // Try to parse the date in different formats
    let expiryDate: Date;

    // First try standard parsing
    expiryDate = new Date(dateString);

    // If that fails, try to parse as YYYY-MM-DD
    if (isNaN(expiryDate.getTime()) && dateString.includes('-')) {
      const [year, month, day] = dateString.split('-').map(Number);
      expiryDate = new Date(year, month - 1, day); // month is 0-indexed in JS Date
    }

    // Check if date parsing worked correctly
    if (isNaN(expiryDate.getTime())) {
      return false;
    }

    const today = new Date();

    // Set both dates to start of day for accurate comparison
    expiryDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const diffTime = expiryDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Eligible if within 7 days before expiration or up to 15 days after expiration
    return diffDays <= 7 && diffDays >= -15;
  };

  // Check if a date is expiring soon (within 30 days)
  const isDateExpiringSoon = (dateString: string) => {
    if (!dateString) {
      return false;
    }

    // Try to parse the date in different formats
    let expiryDate: Date;

    // First try standard parsing
    expiryDate = new Date(dateString);

    // If that fails, try to parse as YYYY-MM-DD
    if (isNaN(expiryDate.getTime()) && dateString.includes('-')) {
      const [year, month, day] = dateString.split('-').map(Number);
      expiryDate = new Date(year, month - 1, day); // month is 0-indexed in JS Date
    }

    // Check if date parsing worked correctly
    if (isNaN(expiryDate.getTime())) {
      return false;
    }

    const today = new Date();

    // Set both dates to start of day for accurate comparison
    expiryDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const diffTime = expiryDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Expiring soon if within 30 days
    return diffDays > 0 && diffDays <= 30;
  };

  // Check if permit is downloadable
  const _isPermitDownloadable = currentStatus === 'PERMIT_READY' || currentStatus === 'COMPLETED';

  // Check if payment is needed (no longer used in this component)
  const _isPaymentNeeded = false;

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <LoadingSpinner />
        <p>Cargando datos...</p>
      </div>
    );
  }

  if (isError) {
    // Check if it's a 404 or 403 error
    const errorMessage =
      axios.isAxiosError(error) &&
      (error.response?.status === 404 || error.response?.status === 403)
        ? 'Permiso no encontrado o sin acceso'
        : error instanceof Error
          ? error.message
          : 'No pudimos cargar los datos del permiso';

    // If it's a 404, show a message about redirecting
    const shouldRedirect = axios.isAxiosError(error) && error.response?.status === 404;

    return (
      <div className={styles.errorContainer}>
        <h2>Error</h2>
        <p>{errorMessage}</p>
        {shouldRedirect && (
          <p className={styles.errorSubtext}>Serás redirigido al dashboard en unos segundos...</p>
        )}
        <button type="button" className={styles.button} onClick={() => navigate('/dashboard')}>
          Volver a mi panel
        </button>
      </div>
    );
  }

  if (!applicationData) {
    return (
      <div className={styles.errorContainer}>
        <h2>Error</h2>
        <p>No pudimos cargar los datos del permiso</p>
        <button type="button" className={styles.button} onClick={() => navigate('/dashboard')}>
          Volver a mi panel
        </button>
      </div>
    );
  }

  // Determine the primary action based on permit status
  const getPrimaryAction = () => {
    if (!currentStatus) return null;

    // Helper function to check if status matches any of the provided values
    const statusMatches = (status: any, ...values: any[]) => {
      return values.some((val) => status === val);
    };

    if (statusMatches(currentStatus, PermitStatus.AWAITING_OXXO_PAYMENT, 'AWAITING_OXXO_PAYMENT')) {
      return {
        label: 'Generar Ficha de Pago OXXO',
        icon: <FaCreditCard />,
        onClick: () => handleViewOxxoSlip(id!),
        disabled: false,
      };
    } else if (
      statusMatches(
        currentStatus,
        PermitStatus.PERMIT_READY,
        'PERMIT_READY',
        PermitStatus.COMPLETED,
        'COMPLETED',
      )
    ) {
      // Check if permit is eligible for renewal
      const isEligible =
        application?.fecha_vencimiento && isEligibleForRenewal(application.fecha_vencimiento);

      // If it's eligible for renewal, show renewal button as primary action
      if (isEligible) {
        return {
          label: 'Renovar Permiso',
          icon: <FaSync />,
          onClick: handleRenewClick,
          disabled: isFetchingRenewalData,
        };
      }

      // Otherwise, show download button as primary action
      return {
        label: 'Descargar Permiso (PDF)',
        icon: <FaDownload />,
        onClick: () => handleDownloadPermit(id!),
        disabled: isDownloading,
      };
    }

    return null;
  };

  // Get the key date to display based on permit status
  const getKeyDate = () => {
    if (!currentStatus) return null;

    // Helper function to check if status matches any of the provided values
    const statusMatches = (status: any, ...values: any[]) => {
      return values.some((val) => status === val);
    };

    if (statusMatches(currentStatus, PermitStatus.AWAITING_OXXO_PAYMENT, 'AWAITING_OXXO_PAYMENT')) {
      // In a real implementation, we would show the OXXO payment expiry date if available
      return null;
    } else if (
      statusMatches(
        currentStatus,
        PermitStatus.PERMIT_READY,
        'PERMIT_READY',
        PermitStatus.COMPLETED,
        'COMPLETED',
      ) ||
      (application?.fecha_vencimiento && isDateExpiringSoon(application.fecha_vencimiento))
    ) {
      return {
        label: 'Vence el:',
        value: application?.fecha_vencimiento
          ? formatDate(application.fecha_vencimiento)
          : 'Pendiente',
        isExpiring: application?.fecha_vencimiento
          ? isDateExpiringSoon(application.fecha_vencimiento)
          : false,
      };
    }

    return null;
  };

  // Create tab content for the tabbed interface
  const _getTabs = () => {
    // Tab 1: Estado del Permiso
    const statusTabContent = (
      <div className={styles.statusTabPanel}>
        {/* Status Instructions Panel */}
        <div className={styles.statusInstructionsPanel}>
          {/* Dynamic content based on permit status */}
          {(() => {
            // Default instructions for any status
            let instructionsTitle = 'Estado de tu Permiso';
            let instructionsIcon = <FaInfoCircle className={styles.statusInstructionsIcon} />;
            let instructionsContent = null;

            // Customize based on status
            switch (currentStatus) {
              case 'AWAITING_OXXO_PAYMENT':
                // Check if this is a pending Conekta payment
                if ((application as any)?.payment_processor_order_id) {
                  instructionsTitle = 'Pago en Proceso';
                  instructionsIcon = (
                    <FaInfoCircle
                      className={styles.statusInstructionsIcon}
                      style={{ color: 'var(--color-warning)' }}
                    />
                  );
                  instructionsContent = (
                    <div className={styles.statusInstructionsContent}>
                      <p>
                        Tu pago está siendo procesado por el banco. Este proceso puede tomar unos
                        minutos. La página se actualizará automáticamente cuando el pago sea
                        confirmado.
                      </p>
                      <p>
                        No es necesario realizar ninguna acción adicional. Una vez que el banco
                        confirme tu pago, tu permiso comenzará a generarse automáticamente.
                      </p>
                      <button
                        type="button"
                        className={styles.refreshButton}
                        onClick={() => refetch()}
                      >
                        <FaSync className={styles.refreshIcon} /> Verificar estado del pago
                      </button>
                    </div>
                  );
                } else {
                  instructionsTitle = 'Pago Pendiente en OXXO';
                  instructionsIcon = <FaStore className={styles.statusInstructionsIcon} />;
                  instructionsContent = (
                    <>
                      <p>
                        Para completar tu solicitud, realiza el pago en cualquier tienda OXXO usando
                        la referencia proporcionada a continuación. Una vez procesado el pago, tu
                        permiso será generado automáticamente.
                      </p>

                      <div className={styles.oxxoInstructions}>
                        <div className={styles.oxxoInstructionsHeader}>
                          <FaMoneyBill className={styles.oxxoInstructionsIcon} />
                          <h3 className={styles.oxxoInstructionsTitle}>
                            Instrucciones para Pago en OXXO
                          </h3>
                        </div>

                        <div className={styles.oxxoReferenceContainer}>
                          <div className={styles.infoItem}>
                            <span className={styles.infoLabel}>Referencia OXXO para Pago:</span>
                            <div className={styles.infoValue}>
                              {(applicationData?.application as any)?.paymentReference ? (
                                <>
                                  <span className={styles.infoValueImportant}>
                                    {(applicationData.application as any).paymentReference}
                                  </span>
                                  <button
                                    type="button"
                                    className={styles.copyButton}
                                    onClick={handleCopyReference}
                                    aria-label="Copiar referencia de pago OXXO"
                                  >
                                    {copied ? 'Copiado' : 'Copiar'}{' '}
                                    <FaCopy className={styles.copyButtonIcon} />
                                  </button>
                                </>
                              ) : (
                                <span className={styles.infoValueWarning}>
                                  Cargando referencia OXXO...
                                </span>
                              )}
                            </div>
                          </div>

                          <div className={styles.infoItem}>
                            <span className={styles.infoLabel}>Monto a Pagar:</span>
                            <span className={styles.infoValueImportant}>
                              {formatCurrency(application?.importe)}
                            </span>
                          </div>
                        </div>

                        <p>
                          Presenta esta referencia en la caja de cualquier tienda OXXO. El cajero
                          escaneará o ingresará la referencia y te indicará el monto a pagar. Conserva
                          tu recibo como comprobante de pago.
                        </p>
                        <p>
                          Una vez que realices el pago, nuestro sistema recibirá la confirmación
                          automáticamente y tu permiso será procesado. Este proceso puede tomar hasta
                          24 horas hábiles.
                        </p>
                      </div>
                    </>
                  );
                }
                break;

              case 'PAYMENT_FAILED':
                instructionsTitle = 'Comprobante de Pago Rechazado';
                instructionsIcon = (
                  <FaTimesCircle
                    className={styles.statusInstructionsIcon}
                    style={{ color: 'var(--color-danger)' }}
                  />
                );
                instructionsContent = (
                  <div className={styles.statusInstructionsContent}>
                    <p>
                      Lamentablemente, tu comprobante de pago ha sido rechazado. A continuación te
                      explicamos el motivo y los pasos a seguir:
                    </p>

                    <div className={styles.rejectionReason}>
                      <div className={styles.rejectionHeader}>
                        <FaExclamationTriangle className={styles.rejectionIcon} />
                        <h3 className={styles.rejectionTitle}>Motivo del Rechazo</h3>
                      </div>
                      <p>
                        {(application as any)?.payment_rejection_reason ||
                          'Tu comprobante de pago no pudo ser verificado. Por favor, sube un nuevo comprobante que muestre claramente los detalles de la transacción.'}
                      </p>
                    </div>

                    <p>
                      <strong>¿Qué hacer ahora?</strong>
                    </p>
                    <p>1. Verifica que el comprobante de pago corresponda a este permiso.</p>
                    <p>
                      2. Asegúrate de que el comprobante muestre claramente la fecha, el monto y la
                      referencia de pago.
                    </p>
                    <p>3. Sube un nuevo comprobante que cumpla con estos requisitos.</p>
                    <p>
                      Si tienes dudas o necesitas asistencia, contacta a nuestro equipo de soporte
                      para recibir ayuda personalizada.
                    </p>
                  </div>
                );
                break;

              case 'PAYMENT_PROCESSING':
                instructionsTitle = 'Pago en Proceso';
                instructionsIcon = (
                  <FaInfoCircle
                    className={styles.statusInstructionsIcon}
                    style={{ color: 'var(--color-warning)' }}
                  />
                );
                instructionsContent = (
                  <div className={styles.statusInstructionsContent}>
                    <p>
                      Tu pago está siendo procesado por el banco. Este proceso puede tomar unos
                      minutos. La página se actualizará automáticamente cuando el pago sea
                      confirmado.
                    </p>
                    <p>
                      No es necesario realizar ninguna acción adicional. Una vez que el banco
                      confirme tu pago, tu permiso comenzará a generarse automáticamente.
                    </p>
                    <button
                      type="button"
                      className={styles.refreshButton}
                      onClick={() => refetch()}
                    >
                      <FaSync className={styles.refreshIcon} /> Verificar estado del pago
                    </button>
                  </div>
                );
                break;

              case 'PAYMENT_RECEIVED':
                instructionsTitle = 'Pago Recibido Correctamente';
                instructionsIcon = (
                  <FaInfoCircle
                    className={styles.statusInstructionsIcon}
                    style={{ color: 'var(--color-success)' }}
                  />
                );
                instructionsContent = (
                  <div className={styles.statusInstructionsContent}>
                    <p>
                      Tu pago ha sido recibido y verificado correctamente. Estamos procesando tu
                      permiso, el cual estará disponible para descargar en breve. Recibirás una
                      notificación cuando esté listo.
                    </p>
                    <p>
                      Este proceso generalmente toma entre 30 minutos y 2 horas hábiles. Si después
                      de este tiempo no ves cambios en el estado de tu permiso, por favor contacta a
                      nuestro equipo de soporte.
                    </p>
                  </div>
                );
                break;

              case 'GENERATING_PERMIT':
                instructionsTitle = 'Generando tu Permiso';
                instructionsIcon = <FaInfoCircle className={styles.statusInstructionsIcon} />;
                instructionsContent = (
                  <div className={styles.statusInstructionsContent}>
                    <p>
                      Estamos generando tu permiso en este momento. Este proceso puede tomar unos
                      minutos. Por favor, espera un momento y actualiza la página para ver el estado
                      más reciente.
                    </p>
                    <p>
                      No es necesario realizar ninguna acción adicional. El sistema está procesando
                      automáticamente tu permiso y estará disponible para descargar muy pronto.
                    </p>
                  </div>
                );
                break;

              case 'PERMIT_READY':
              case 'COMPLETED':
                instructionsTitle = '¡Tu Permiso está Listo!';
                instructionsIcon = (
                  <FaInfoCircle
                    className={styles.statusInstructionsIcon}
                    style={{ color: 'var(--color-success)' }}
                  />
                );
                instructionsContent = (
                  <div className={styles.statusInstructionsContent}>
                    <p>
                      Tu permiso ha sido generado correctamente y está listo para descargar. Utiliza
                      el botón &quot;Descargar Permiso (PDF)&quot; en la parte superior para obtener tu
                      documento.
                    </p>
                    <p>
                      <strong>Importante:</strong> Debes llevar este permiso contigo mientras
                      conduces, ya sea impreso o en formato digital. Las autoridades pueden
                      solicitarlo en cualquier momento para verificar que tu vehículo está
                      autorizado para circular.
                    </p>
                    <p>
                      Recuerda que este permiso tiene una fecha de vencimiento. Te recomendamos
                      configurar un recordatorio para renovarlo antes de que expire.
                    </p>
                  </div>
                );
                break;

              case 'EXPIRED':
                instructionsTitle = 'Permiso Vencido';
                instructionsIcon = (
                  <FaExclamationTriangle
                    className={styles.statusInstructionsIcon}
                    style={{ color: 'var(--color-warning)' }}
                  />
                );
                instructionsContent = (
                  <div className={styles.statusInstructionsContent}>
                    <p>
                      Este permiso ha vencido y ya no es válido para circular. Si necesitas seguir
                      utilizando el vehículo, deberás solicitar un nuevo permiso o completar el
                      trámite de placas permanentes.
                    </p>
                    <p>
                      Circular con un permiso vencido puede resultar en multas y sanciones. Te
                      recomendamos tramitar un nuevo permiso lo antes posible si planeas seguir
                      utilizando el vehículo.
                    </p>
                  </div>
                );
                break;

              default:
                instructionsContent = (
                  <div className={styles.statusInstructionsContent}>
                    <p>
                      Tu solicitud está siendo procesada. Sigue las instrucciones en la línea de
                      tiempo para completar el proceso.
                    </p>
                    <p>
                      El estado actual de tu permiso requiere que estés atento a las
                      actualizaciones. Si tienes alguna duda sobre los siguientes pasos o necesitas
                      asistencia, no dudes en contactar a nuestro equipo de soporte.
                    </p>
                  </div>
                );
            }

            return (
              <>
                <div className={styles.statusInstructionsTitle}>
                  {instructionsIcon}
                  {instructionsTitle}
                </div>
                <div className={styles.statusInstructionsContent}>{instructionsContent}</div>
              </>
            );
          })()}
        </div>

        {/* Show renewal eligibility for permits that are ready or completed */}
        {(currentStatus === 'PERMIT_READY' ||
          currentStatus === 'COMPLETED' ||
          currentStatus === 'EXPIRED') && (
          <div className={styles.renewalSection}>
            <h2 className={styles.sectionTitle}>Renovar permiso</h2>
            <RenewalEligibility
              application={
                application ||
                ({
                  id: applicationData?.application?.id || '',
                  status: applicationData?.status?.currentStatus || '',
                  // Add other required properties for RenewalEligibility
                  created_at: applicationData?.application?.dates?.created || '',
                  updated_at: applicationData?.application?.dates?.updated || '',
                  user_id: '',
                  nombre_completo: applicationData?.application?.ownerInfo?.nombre_completo || '',
                  curp_rfc: applicationData?.application?.ownerInfo?.curp_rfc || '',
                  domicilio: applicationData?.application?.ownerInfo?.domicilio || '',
                  marca: applicationData?.application?.vehicleInfo?.marca || '',
                  linea: applicationData?.application?.vehicleInfo?.linea || '',
                  color: applicationData?.application?.vehicleInfo?.color || '',
                  numero_serie: applicationData?.application?.vehicleInfo?.numero_serie || '',
                  numero_motor: applicationData?.application?.vehicleInfo?.numero_motor || '',
                  ano_modelo:
                    typeof applicationData?.application?.vehicleInfo?.ano_modelo === 'string'
                      ? parseInt(applicationData?.application?.vehicleInfo?.ano_modelo, 10)
                      : (applicationData?.application?.vehicleInfo?.ano_modelo as number) || 0,
                  fecha_expedicion: '',
                  fecha_vencimiento: '',
                } as Application)
              }
            />
          </div>
        )}
      </div>
    );

    // Tab 2: Información del Permiso
    const permitInfoTabContent = (
      <div className={styles.permitInfoTabPanel}>
        <div className={styles.infoSection}>
          <div className={styles.infoCard}>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Folio:</span>
              <span className={styles.infoValue}>{application?.folio || 'Pendiente'}</span>
            </div>

            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Costo:</span>
              <span className={styles.infoValue}>{formatCurrency(application?.importe)}</span>
            </div>

            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Fecha de expedición:</span>
              <span className={styles.infoValue}>
                {application?.fecha_expedicion
                  ? formatDate(application.fecha_expedicion)
                  : 'Pendiente'}
              </span>
            </div>

            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Fecha de vencimiento:</span>
              <span className={styles.infoValue}>
                {application?.fecha_vencimiento
                  ? formatDate(application.fecha_vencimiento)
                  : 'Pendiente'}
              </span>
            </div>

            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Referencia OXXO para Pago:</span>
              <span className={styles.infoValue}>
                {(applicationData?.application as any)?.paymentReference || 'No disponible'}
              </span>
            </div>

            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Estado del pago:</span>
              <span className={styles.infoValue}>
                {currentStatus === 'PAYMENT_RECEIVED'
                  ? 'Pagado'
                  : currentStatus === 'AWAITING_OXXO_PAYMENT'
                    ? 'Pago OXXO pendiente'
                    : 'Pendiente'}
              </span>
            </div>

            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Monto pagado:</span>
              <span className={styles.infoValue}>{formatCurrency(application?.importe)}</span>
            </div>

            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Fecha de procesamiento:</span>
              <span className={styles.infoValue}>
                {currentStatus === 'PAYMENT_RECEIVED' &&
                (applicationData?.application?.dates as any)?.paymentVerified
                  ? formatDate((applicationData?.application?.dates as any).paymentVerified)
                  : 'Pendiente'}
              </span>
            </div>
          </div>
        </div>
      </div>
    );

    // Tab 3: Detalles del Vehículo
    const vehicleInfoTabContent = (
      <div className={styles.vehicleInfoTabPanel}>
        <div className={styles.infoSection}>
          <div className={styles.infoCard}>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Marca:</span>
              <span className={styles.infoValue}>
                {applicationData?.application?.vehicleInfo?.marca || application?.marca || 'N/A'}
              </span>
            </div>

            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Modelo:</span>
              <span className={styles.infoValue}>
                {applicationData?.application?.vehicleInfo?.linea || application?.linea || 'N/A'}
              </span>
            </div>

            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Color:</span>
              <span className={styles.infoValue}>
                {applicationData?.application?.vehicleInfo?.color || application?.color || 'N/A'}
              </span>
            </div>

            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Año:</span>
              <span className={styles.infoValue}>
                {applicationData?.application?.vehicleInfo?.ano_modelo ||
                  application?.ano_modelo ||
                  'N/A'}
              </span>
            </div>

            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Número de serie:</span>
              <span className={styles.infoValue}>
                {applicationData?.application?.vehicleInfo?.numero_serie ||
                  application?.numero_serie ||
                  'N/A'}
              </span>
            </div>

            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Número de motor:</span>
              <span className={styles.infoValue}>
                {applicationData?.application?.vehicleInfo?.numero_motor ||
                  application?.numero_motor ||
                  'N/A'}
              </span>
            </div>
          </div>
        </div>
      </div>
    );

    // Tab 4: Datos del Solicitante
    const applicantInfoTabContent = (
      <div className={styles.applicantInfoTabPanel}>
        <div className={styles.infoSection}>
          <div className={styles.infoCard}>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Nombre:</span>
              <span className={styles.infoValue}>
                {applicationData?.application?.ownerInfo?.nombre_completo ||
                  application?.nombre_completo ||
                  'N/A'}
              </span>
            </div>

            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>CURP/RFC:</span>
              <span className={styles.infoValue}>
                {applicationData?.application?.ownerInfo?.curp_rfc ||
                  application?.curp_rfc ||
                  'N/A'}
              </span>
            </div>

            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Dirección:</span>
              <span className={styles.infoValue}>
                {applicationData?.application?.ownerInfo?.domicilio ||
                  application?.domicilio ||
                  'N/A'}
              </span>
            </div>
          </div>
        </div>
      </div>
    );

    return [
      { id: 'status', label: 'Estado del Permiso', content: statusTabContent },
      { id: 'permit-info', label: 'Información del Permiso', content: permitInfoTabContent },
      { id: 'vehicle-info', label: 'Detalles del Vehículo', content: vehicleInfoTabContent },
      { id: 'applicant-info', label: 'Datos del Solicitante', content: applicantInfoTabContent },
    ];
  };

  const primaryAction = getPrimaryAction();
  const keyDate = getKeyDate();

  return (
    <ResponsiveContainer
      type="fixed"
      maxWidth="xxl"
      withPadding={true}
      className={styles.pageWrapper}
    >
      {/* Page Header with Title */}
      <div className={styles.pageHeader}>
        <h1 className={`${styles.title} u-heading-fluid`}>Detalles del permiso</h1>
      </div>

      {/* Permit Context Header Card */}
      <div className={styles.permitContextHeaderCard}>
        {/* Left Side of Context Header */}
        <div className={styles.contextHeaderLeft}>
          {/* Permit ID */}
          <h2 className={styles.contextPermitId}>
            Permiso #{applicationData?.application?.id || application?.id}
          </h2>

          {/* Status Badge */}
          <div className={styles.contextStatusPill}>
            <StatusBadge status={(currentStatus as any) || ''} size="large" />
          </div>
        </div>

        {/* Right Side of Context Header */}
        <div className={styles.contextHeaderRight}>
          {/* Primary Contextual Action Button */}
          {primaryAction && (
            <button
              type="button"
              className={styles.contextPrimaryButton}
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
            >
              {primaryAction.icon}
              {primaryAction.label}
            </button>
          )}

          {/* OXXO Reference & Copy (if applicable) */}
          {currentStatus === 'AWAITING_OXXO_PAYMENT' &&
            (applicationData?.application as any)?.paymentReference && (
              <div className={styles.contextOxxoBlock}>
                <div className={styles.contextOxxoLabel}>Referencia OXXO para Pago:</div>
                <div className={styles.contextOxxoRefValue}>
                  {(applicationData?.application as any)?.paymentReference}
                </div>
                <button
                  type="button"
                  className={styles.contextCopyButton}
                  onClick={handleCopyReference}
                  aria-label="Copiar referencia de pago OXXO"
                >
                  {copied ? 'Copiado' : 'Copiar'} <FaCopy />
                </button>
              </div>
            )}

          {/* Key Date (if applicable) */}
          {keyDate && (
            <div
              className={`${styles.contextKeyDate} ${keyDate.isExpiring ? styles.contextKeyDateExpiring : ''}`}
            >
              <FaCalendarAlt />
              <span>
                {keyDate.label} {keyDate.value}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Tabbed Interface Section */}
      <div className={styles.tabbedInterfaceSection}>
        {/* Tab Headers */}
        <div className={styles.tabsContainer}>
          <div className={styles.tabHeader}>
            <button
              type="button"
              className={`${styles.tabItem} ${activeTab === 'status' ? styles.tabItemActive : ''}`}
              onClick={() => setActiveTab('status')}
              aria-selected={activeTab === 'status'}
              role="tab"
            >
              Estado del Permiso
            </button>
            <button
              type="button"
              className={`${styles.tabItem} ${activeTab === 'info' ? styles.tabItemActive : ''}`}
              onClick={() => setActiveTab('info')}
              aria-selected={activeTab === 'info'}
              role="tab"
            >
              Información del Permiso
            </button>
            <button
              type="button"
              className={`${styles.tabItem} ${activeTab === 'vehicle' ? styles.tabItemActive : ''}`}
              onClick={() => setActiveTab('vehicle')}
              aria-selected={activeTab === 'vehicle'}
              role="tab"
            >
              Detalles del Vehículo
            </button>
            <button
              type="button"
              className={`${styles.tabItem} ${activeTab === 'applicant' ? styles.tabItemActive : ''}`}
              onClick={() => setActiveTab('applicant')}
              aria-selected={activeTab === 'applicant'}
              role="tab"
            >
              Datos del Solicitante
            </button>
          </div>
        </div>

        {/* Tab Panels */}
        <div
          className={`${styles.tabPanel} ${activeTab === 'status' ? styles.tabPanelActive : ''}`}
        >
          <div className={styles.statusTabPanel}>
            {/* Status Tab Instruction Header */}
            <h2 className={styles.statusTabInstructionHeader}>
              {currentStatus === 'AWAITING_OXXO_PAYMENT' ? (
                <>
                  <FaStore />
                  Pago Pendiente en OXXO
                </>
              ) : currentStatus === 'PERMIT_READY' || currentStatus === 'COMPLETED' ? (
                <>
                  <FaInfoCircle style={{ color: 'var(--color-success)' }} />
                  ¡Tu Permiso está Listo!
                </>
              ) : (
                <>
                  <FaInfoCircle />
                  Estado de tu Permiso
                </>
              )}
            </h2>

            {/* Status Instructions Panel */}
            <div className={styles.statusInstructionsPanel}>
              {/* General Instructions Text */}
              <p className={styles.statusInstructionsText}>
                {currentStatus === 'AWAITING_OXXO_PAYMENT'
                  ? 'Para completar tu solicitud, realiza el pago en cualquier tienda OXXO usando la referencia proporcionada a continuación. Una vez procesado el pago, tu permiso será generado automáticamente.'
                  : currentStatus === 'PERMIT_READY' || currentStatus === 'COMPLETED'
                    ? 'Tu permiso ha sido generado correctamente y está listo para descargar. Utiliza el botón &quot;Descargar Permiso (PDF)&quot; en la parte superior para obtener tu documento.'
                    : 'Tu permiso se encuentra en proceso. Consulta esta página para ver actualizaciones sobre su estado.'}
              </p>

              {/* OXXO Payment Instructions (if applicable) */}
              {currentStatus === 'AWAITING_OXXO_PAYMENT' && (
                <>
                  <h3 className={styles.oxxoInstructionsHeader}>
                    Instrucciones Detalladas de Pago OXXO
                  </h3>

                  <div className={styles.oxxoPaymentDetails}>
                    {applicationData?.application?.paymentReference ? (
                      <div className={styles.oxxoPaymentItem}>
                        <span className={styles.oxxoPaymentLabel}>Referencia OXXO para Pago:</span>
                        <span className={styles.oxxoPaymentValue}>
                          {applicationData.application.paymentReference}
                        </span>
                      </div>
                    ) : (
                      <div className={styles.oxxoPaymentItem}>
                        <span className={styles.oxxoPaymentLabel}>Referencia OXXO para Pago:</span>
                        <span className={styles.oxxoPaymentValueWarning}>
                          Cargando referencia OXXO...
                        </span>
                      </div>
                    )}
                    <div className={styles.oxxoPaymentItem}>
                      <span className={styles.oxxoPaymentLabel}>Monto a Pagar:</span>
                      <span className={styles.oxxoPaymentValue}>
                        {formatCurrency(application?.importe)}
                      </span>
                    </div>
                  </div>

                  <div className={styles.oxxoInstructionsSteps}>
                    <p>
                      Presenta esta referencia en la caja de cualquier tienda OXXO. El cajero
                      escaneará o ingresará la referencia y te indicará el monto a pagar. Conserva
                      tu recibo como comprobante de pago.
                    </p>
                    <p>
                      Una vez que realices el pago, nuestro sistema recibirá la confirmación
                      automáticamente y tu permiso será procesado. Este proceso puede tomar hasta 24
                      horas hábiles.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className={`${styles.tabPanel} ${activeTab === 'info' ? styles.tabPanelActive : ''}`}>
          {/* Información del Permiso Tab Panel */}
          <h3 className={styles.tabSubheading}>Datos del Permiso Original</h3>
          <div className={styles.infoRow}>
            <span className={styles.infoTabLabel}>Folio:</span>
            <span className={styles.infoTabValue}>
              {(applicationData?.application as any)?.folio ||
                (application as any)?.folio ||
                'No disponible'}
            </span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoTabLabel}>Costo:</span>
            <span className={styles.infoTabValue}>{formatCurrency(application?.importe)}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoTabLabel}>Fecha de expedición:</span>
            <span className={styles.infoTabValue}>
              {application?.fecha_expedicion
                ? formatDate(application.fecha_expedicion)
                : 'Pendiente'}
            </span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoTabLabel}>Fecha de vencimiento:</span>
            <span className={styles.infoTabValue}>
              {application?.fecha_vencimiento
                ? formatDate(application.fecha_vencimiento)
                : 'Pendiente'}
            </span>
          </div>

          <h3 className={styles.tabSubheading}>Información de Pago</h3>
          <div className={styles.infoRow}>
            <span className={styles.infoTabLabel}>Referencia OXXO para Pago:</span>
            <span className={styles.infoTabValue}>
              {applicationData?.application?.paymentReference || 'No disponible'}
            </span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoTabLabel}>Estado del pago:</span>
            <span className={styles.infoTabValue}>
              {currentStatus === 'AWAITING_OXXO_PAYMENT'
                ? 'Pendiente de pago en OXXO'
                : currentStatus === 'PAYMENT_RECEIVED'
                  ? 'Pago recibido'
                  : currentStatus === 'PERMIT_READY' || currentStatus === 'COMPLETED'
                    ? 'Pagado'
                    : 'Pendiente'}
            </span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoTabLabel}>Monto pagado:</span>
            <span className={styles.infoTabValue}>
              {currentStatus === 'PERMIT_READY' ||
              currentStatus === 'COMPLETED' ||
              currentStatus === 'PAYMENT_RECEIVED'
                ? formatCurrency(application?.importe)
                : 'Pendiente'}
            </span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoTabLabel}>Fecha de procesamiento:</span>
            <span className={styles.infoTabValue}>
              {applicationData?.application?.dates?.paymentVerified
                ? formatDate(applicationData.application.dates.paymentVerified)
                : 'Pendiente'}
            </span>
          </div>
        </div>

        <div
          className={`${styles.tabPanel} ${activeTab === 'vehicle' ? styles.tabPanelActive : ''}`}
        >
          {/* Detalles del Vehículo Tab Panel */}
          <h3 className={styles.tabSubheading}>Información del Vehículo</h3>
          <div className={styles.infoRow}>
            <span className={styles.infoTabLabel}>Marca:</span>
            <span className={styles.infoTabValue}>
              {applicationData?.application?.vehicleInfo?.marca ||
                application?.marca ||
                'No disponible'}
            </span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoTabLabel}>Modelo:</span>
            <span className={styles.infoTabValue}>
              {applicationData?.application?.vehicleInfo?.linea ||
                application?.linea ||
                'No disponible'}
            </span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoTabLabel}>Color:</span>
            <span className={styles.infoTabValue}>
              {applicationData?.application?.vehicleInfo?.color ||
                application?.color ||
                'No disponible'}
            </span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoTabLabel}>Año:</span>
            <span className={styles.infoTabValue}>
              {applicationData?.application?.vehicleInfo?.ano_modelo ||
                application?.ano_modelo ||
                'No disponible'}
            </span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoTabLabel}>Número de serie:</span>
            <span className={styles.infoTabValue}>
              {applicationData?.application?.vehicleInfo?.numero_serie ||
                application?.numero_serie ||
                'No disponible'}
            </span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoTabLabel}>Número de motor:</span>
            <span className={styles.infoTabValue}>
              {applicationData?.application?.vehicleInfo?.numero_motor ||
                application?.numero_motor ||
                'No disponible'}
            </span>
          </div>
        </div>

        <div
          className={`${styles.tabPanel} ${activeTab === 'applicant' ? styles.tabPanelActive : ''}`}
        >
          {/* Datos del Solicitante Tab Panel */}
          <h3 className={styles.tabSubheading}>Información del Solicitante</h3>
          <div className={styles.infoRow}>
            <span className={styles.infoTabLabel}>Nombre:</span>
            <span className={styles.infoTabValue}>
              {applicationData?.application?.ownerInfo?.nombre_completo ||
                application?.nombre_completo ||
                'No disponible'}
            </span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoTabLabel}>CURP/RFC:</span>
            <span className={styles.infoTabValue}>
              {applicationData?.application?.ownerInfo?.curp_rfc ||
                application?.curp_rfc ||
                'No disponible'}
            </span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoTabLabel}>Dirección:</span>
            <span className={styles.infoTabValue}>
              {applicationData?.application?.ownerInfo?.domicilio ||
                application?.domicilio ||
                'No disponible'}
            </span>
          </div>
        </div>
      </div>

      {/* Documentos del Permiso Section */}
      <div className={styles.documentsSection}>
        <h2 className={styles.sectionTitle}>Documentos del Permiso</h2>
        <div className={styles.documentsList}>
          {/* Only show documents if the permit is ready */}
          {currentStatus === 'PERMIT_READY' || currentStatus === 'COMPLETED' ? (
            <>
              {/* Permiso (Main Permit Document) */}
              {((applicationData?.application as any)?.permit_file_path ||
                application?.permit_file_path) && (
                <div className={styles.documentItem}>
                  <div className={styles.documentInfo}>
                    <FaFilePdf className={styles.documentIcon} />
                    <span className={styles.documentName}>
                      Certificado Principal del Permiso.pdf
                    </span>
                  </div>
                  <button
                    type="button"
                    className={styles.downloadButton}
                    onClick={() => handleDownloadPermit(id!, 'permiso')}
                    disabled={isDownloading}
                  >
                    <FaDownload className={styles.downloadIcon} />
                    <span>{isDownloading ? 'Descargando...' : 'Descargar'}</span>
                  </button>
                </div>
              )}

              {/* Recibo (Receipt) */}
              {((applicationData?.application as any)?.recibo_file_path ||
                application?.recibo_file_path) && (
                <div className={styles.documentItem}>
                  <div className={styles.documentInfo}>
                    <FaFileInvoice className={styles.documentIcon} />
                    <span className={styles.documentName}>Comprobante de Pago.pdf</span>
                  </div>
                  <button
                    type="button"
                    className={styles.downloadButton}
                    onClick={() => handleDownloadPermit(id!, 'recibo')}
                    disabled={isDownloading}
                  >
                    <FaDownload className={styles.downloadIcon} />
                    <span>{isDownloading ? 'Descargando...' : 'Descargar'}</span>
                  </button>
                </div>
              )}

              {/* Certificado (Certificate) */}
              {((applicationData?.application as any)?.certificado_file_path ||
                application?.certificado_file_path) && (
                <div className={styles.documentItem}>
                  <div className={styles.documentInfo}>
                    <FaFileContract className={styles.documentIcon} />
                    <span className={styles.documentName}>Inspección Vehicular.pdf</span>
                  </div>
                  <button
                    type="button"
                    className={styles.downloadButton}
                    onClick={() => handleDownloadPermit(id!, 'certificado')}
                    disabled={isDownloading}
                  >
                    <FaDownload className={styles.downloadIcon} />
                    <span>{isDownloading ? 'Descargando...' : 'Descargar'}</span>
                  </button>
                </div>
              )}

              {/* Placas (Additional Document) */}
              {((applicationData?.application as any)?.placas_file_path ||
                application?.placas_file_path) && (
                <div className={styles.documentItem}>
                  <div className={styles.documentInfo}>
                    <FaIdCard className={styles.documentIcon} />
                    <span className={styles.documentName}>Anexo Adicional.pdf</span>
                  </div>
                  <button
                    type="button"
                    className={styles.downloadButton}
                    onClick={() => handleDownloadPermit(id!, 'placas')}
                    disabled={isDownloading}
                  >
                    <FaDownload className={styles.downloadIcon} />
                    <span>{isDownloading ? 'Descargando...' : 'Descargar'}</span>
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className={styles.noDocumentsMessage}>
              <FaExclamationTriangle className={styles.warningIcon} />
              <p>Los documentos estarán disponibles cuando el permiso esté listo.</p>
            </div>
          )}
        </div>
      </div>

      {/* Support Footer */}
      <div className={styles.supportFooter}>
        <p className={styles.supportFooterText}>
          ¿Tienes dudas? Llámanos al <strong>(123) 456-7890</strong> o escríbenos a{' '}
          <strong>soporte@permisos-digitales.gob.mx</strong>
        </p>
      </div>

      {/* OXXO Payment Slip Modal */}
      <OxxoPaymentSlipModal
        isOpen={isOxxoModalOpen}
        onClose={() => setIsOxxoModalOpen(false)}
        oxxoReference={applicationData?.application?.paymentReference || ''}
        amount={application?.importe || 197.0}
        currency="MXN"
        permitFolio={application?.folio || `Permiso #${id}`}
        // Use a default barcode URL for demonstration purposes
        // In a production environment, this would come from the API
        barcodeUrl="https://s3.amazonaws.com/cash_payment_barcodes/sandbox_reference.png"
        // Set a default expiration date 48 hours from now
        expiresAt={new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()}
      />
    </ResponsiveContainer>
  );
};

export default PermitDetailsPage;
