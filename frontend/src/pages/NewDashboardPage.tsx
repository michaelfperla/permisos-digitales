import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TodaysFocus,
  PermitsOverview,
  GuidanceCenter
} from '../components/dashboard';
import { FaRegLightbulb } from 'react-icons/fa';
import styles from './NewDashboardPage.module.css';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ResponsiveContainer from '../components/ui/ResponsiveContainer/ResponsiveContainer';
import {
  UserProfile,
  FocusItemProps,
  PermitCardProps,
  CtaProps
} from '../types/permisos';
import applicationService from '../services/applicationService';
import useAuth from '../hooks/useAuth';
// Import mobile components
import { MobileNavigation } from '../components/mobile';

/**
 * NewDashboardPage - Main layout shell for the Permit Harmony Engine dashboard
 *
 * Implements a responsive two-column layout that adapts to a single column on mobile.
 * Uses realistic data structures based on the API analysis.
 */
const NewDashboardPage: React.FC = () => {
  // State for mobile guidance panel visibility
  const [isGuidancePanelOpen, setIsGuidancePanelOpen] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);

  // State for dashboard data
  const [focusItemForDisplay, setFocusItemForDisplay] = useState<FocusItemProps | null>(null);
  const [permitCardsForDisplay, setPermitCardsForDisplay] = useState<PermitCardProps[]>([]);

  // Get current user from auth context
  const { user: currentUserProfile } = useAuth();

  // Effect to handle window resize and detect mobile view
  useEffect(() => {
    const checkMobileView = () => {
      setIsMobileView(window.innerWidth <= 768);
    };

    // Initial check
    checkMobileView();

    // Add event listener for window resize
    window.addEventListener('resize', checkMobileView);

    // Cleanup
    return () => {
      window.removeEventListener('resize', checkMobileView);
    };
  }, []);

  // Handle opening the guidance panel on mobile
  const handleOpenGuidancePanel = () => {
    setIsGuidancePanelOpen(true);
  };

  // Handle closing the guidance panel on mobile
  const handleCloseGuidancePanel = () => {
    setIsGuidancePanelOpen(false);
  };

  // Fetch applications data using React Query
  const {
    data: dashboardData,
    isLoading,
    isError,
    error
  } = useQuery({
    queryKey: ['applications'],
    queryFn: applicationService.getApplications
  });

  // Process data when it's available
  useEffect(() => {
    if (dashboardData && !isLoading) {
      console.log('Applications data fetched successfully:', dashboardData);

      // Transform permits to permit cards when data is available
      if (dashboardData.applications && dashboardData.applications.length > 0) {
        const permitCards = transformToPermitCards(dashboardData.applications);
        setPermitCardsForDisplay(permitCards);
      } else {
        // Empty array if no applications
        setPermitCardsForDisplay([]);
      }

      // Determine focus item based on current data
      if (currentUserProfile) {
        const focusItem = determineFocusItem(
          dashboardData.applications || [],
          dashboardData.expiringPermits || [],
          {
            id: typeof currentUserProfile.id === 'string' ? parseInt(currentUserProfile.id, 10) : currentUserProfile.id,
            email: currentUserProfile.email,
            first_name: currentUserProfile.first_name,
            last_name: currentUserProfile.last_name,
            account_type: 'client', // Default to client for user context
            created_at: currentUserProfile.created_at || new Date().toISOString(),
            updated_at: currentUserProfile.updated_at || new Date().toISOString()
          }
        );
        setFocusItemForDisplay(focusItem);
      }
    }

    if (isError && error) {
      console.error('Error fetching applications:', error);
    }
  }, [dashboardData, isLoading, isError, error, currentUserProfile]);

  // Function to determine the focus item based on the current data
  const determineFocusItem = (
    permits: any[] | null,
    expiring: any[] | null,
    profile: UserProfile | null
  ): FocusItemProps => {
    // If no permits, show welcome message with info action type
    if (!permits || permits.length === 0) {
      return {
        type: 'info_action',
        iconName: 'FaPlusCircle',
        title: `¡Bienvenido ${profile?.first_name || ''}!`,
        message: 'Aún no tienes permisos registrados. Solicita tu primer permiso digital para comenzar a disfrutar de nuestros servicios.',
        cta: { text: 'Solicitar Nuevo Permiso', link: '/permits/complete', icon: 'FaPlus' }
      };
    }

    // Check for OXXO payment pending (highest priority) - critical action
    const oxxoPaymentPending = permits.find(permit => permit.status === 'AWAITING_OXXO_PAYMENT');
    if (oxxoPaymentPending) {
      return {
        type: 'critical_action',
        iconName: 'FaCreditCard',
        title: 'Acción Necesaria: Pago Pendiente en OXXO',
        message: `Tu permiso para ${oxxoPaymentPending.marca} ${oxxoPaymentPending.linea} está esperando tu pago en OXXO. Realiza el pago para activar tu permiso lo antes posible.`,
        cta: {
          text: 'Ver Instrucciones de Pago',
          link: `/permits/${oxxoPaymentPending.id}`,
          icon: 'FaCreditCard'
        }
      };
    }

    // Check for expiring permits (second priority)
    if (expiring && expiring.length > 0) {
      // Sort by days remaining (ascending)
      const sortedExpiring = [...expiring].sort((a, b) => a.days_remaining - b.days_remaining);
      const mostUrgent = sortedExpiring[0];

      // Critical if less than 5 days remaining
      if (mostUrgent.days_remaining <= 5) {
        return {
          type: 'critical_action',
          iconName: 'FaExclamationCircle',
          title: 'Atención Urgente: Renovación Necesaria',
          message: `Tu permiso para ${mostUrgent.marca} ${mostUrgent.linea} vence en solo ${mostUrgent.days_remaining} ${mostUrgent.days_remaining === 1 ? 'día' : 'días'}. Renuévalo ahora para evitar problemas.`,
          cta: {
            text: 'Renovar Permiso Ahora',
            link: `/permits/${mostUrgent.id}/renew`,
            icon: 'FaEdit'
          }
        };
      } else {
        // Warning for permits expiring soon but not critically
        return {
          type: 'warning_action',
          iconName: 'FaExclamationCircle',
          title: 'Atención: Renovación Próxima',
          message: `Tu permiso para ${mostUrgent.marca} ${mostUrgent.linea} vence en ${mostUrgent.days_remaining} días. Te recomendamos renovarlo pronto para evitar contratiempos.`,
          cta: {
            text: 'Renovar Permiso',
            link: `/permits/${mostUrgent.id}/renew`,
            icon: 'FaEdit'
          }
        };
      }
    }

    // All clear - no urgent actions needed
    // Define an array of welcome messages with more conversational Mexican Spanish
    const welcomeMessages = [
      `¡Bienvenido de nuevo, ${profile?.first_name || ''}!`,
      `¡Hola ${profile?.first_name || ''}! Todo está en orden.`,
      `¡Qué gusto verte, ${profile?.first_name || ''}!`,
      `¡Qué tal, ${profile?.first_name || ''}! Todo va bien.`
    ];

    // Pick a random welcome message
    const randomIndex = Math.floor(Math.random() * welcomeMessages.length);
    const randomWelcomeMessage = welcomeMessages[randomIndex];

    return {
      type: 'all_clear',
      iconName: 'FaCheckCircle',
      title: randomWelcomeMessage,
      message: 'Todos tus permisos están al día. No necesitas realizar ninguna acción por el momento.',
      cta: { text: 'Ver Mis Permisos', link: '/permits', icon: 'FaArrowRight' }
    };
  };

  // Function to transform Application to PermitCardProps
  const transformToPermitCards = (permits: any[]): PermitCardProps[] => {
    return permits.map(permit => {
      // Format date for display
      const formatDate = (dateString?: string) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('es-MX', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        });
      };

      // Calculate days remaining
      const getDaysRemaining = (expiryDate?: string): number => {
        if (!expiryDate) return 0;
        const now = new Date();
        const expiry = new Date(expiryDate);
        const diffTime = expiry.getTime() - now.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      };

      const daysRemaining = getDaysRemaining(permit.fecha_vencimiento);

      // Determine status type and text
      let statusType: 'active' | 'expiring_soon' | 'needs_attention' | 'archived';
      let statusText: string;
      let expirationDate: string;
      let paymentStatus: string = '';

      // Map API status to our PermitStatus enum for consistency
      const permitStatus = permit.status as string;

      // Handle different permit statuses
      if (permitStatus === 'AWAITING_OXXO_PAYMENT') {
        statusType = 'needs_attention';
        statusText = 'Pago Pendiente OXXO';
        expirationDate = 'Pendiente de Activación';
        paymentStatus = 'Pendiente de Pago OXXO';
      } else if (permitStatus === 'PENDING_PAYMENT') {
        statusType = 'needs_attention';
        statusText = 'Pago Pendiente';
        expirationDate = 'Pendiente de Activación';
        paymentStatus = 'Pendiente de Pago';
      } else if (permitStatus === 'PAYMENT_RECEIVED') {
        statusType = 'needs_attention';
        statusText = 'Pago Recibido';
        expirationDate = 'En Procesamiento';
        paymentStatus = 'Pago Recibido';
      } else if (permitStatus === 'GENERATING_PERMIT') {
        statusType = 'needs_attention';
        statusText = 'Generando Permiso';
        expirationDate = 'En Procesamiento';
        paymentStatus = 'Pago Verificado';
      } else if (permitStatus === 'EXPIRED') {
        statusType = 'archived';
        statusText = 'Expirado';
        expirationDate = `Expiró: ${formatDate(permit.fecha_vencimiento)}`;
      } else if (permitStatus === 'PERMIT_READY' || permitStatus === 'COMPLETED') {
        if (daysRemaining <= 0) {
          statusType = 'archived';
          statusText = 'Expirado';
          expirationDate = `Expiró: ${formatDate(permit.fecha_vencimiento)}`;
        } else if (daysRemaining <= 30) {
          statusType = 'expiring_soon';
          statusText = `Expira en ${daysRemaining} días`;
          expirationDate = `Expira: ${formatDate(permit.fecha_vencimiento)}`;
        } else {
          statusType = 'active';
          statusText = 'Activo';
          expirationDate = `Expira: ${formatDate(permit.fecha_vencimiento)}`;
        }
        paymentStatus = 'Pagado';
      } else {
        statusType = 'needs_attention';
        statusText = 'Requiere Atención';
        expirationDate = permit.fecha_vencimiento ? `Expira: ${formatDate(permit.fecha_vencimiento)}` : 'Pendiente';
      }

      // Determine primary and secondary CTAs
      const primaryCta: CtaProps = { text: '', link: '', icon: '' };
      let secondaryCta: CtaProps | undefined;

      // Set CTAs based on permit status
      if (permitStatus === 'AWAITING_OXXO_PAYMENT') {
        primaryCta.text = 'Ver Instrucciones de Pago';
        primaryCta.link = `/permits/${permit.id}`;
        primaryCta.icon = 'FaCreditCard';
      } else if (permitStatus === 'PERMIT_READY' || permitStatus === 'COMPLETED') {
        if (statusType === 'expiring_soon') {
          primaryCta.text = 'Renovar Permiso';
          primaryCta.link = `/permits/${permit.id}/renew`;
          primaryCta.icon = 'FaEdit';

          secondaryCta = {
            text: 'Ver Detalles',
            link: `/permits/${permit.id}`,
            icon: 'FaEye'
          };
        } else {
          primaryCta.text = 'Ver Detalles';
          primaryCta.link = `/permits/${permit.id}`;
          primaryCta.icon = 'FaEye';

          // We're removing the redundant "Descargar Permiso" secondary CTA
          // since users can already download specific documents through the document links section
          secondaryCta = undefined;
        }
      } else {
        primaryCta.text = 'Ver Detalles';
        primaryCta.link = `/permits/${permit.id}`;
        primaryCta.icon = 'FaEye';
      }

      // We're no longer displaying a permit type label
      const permitType = '';

      return {
        id: permit.id,
        vehicleIdentifier: `${permit.marca} ${permit.linea} - ${permit.numero_serie.slice(-6)}`,
        permitType,
        statusText,
        statusType,
        expirationDate,
        primaryCta,
        secondaryCta,

        // Additional vehicle details
        vehicleMake: permit.marca,
        vehicleModel: permit.linea,
        vehicleColor: permit.color || '',
        vehicleYear: permit.ano_modelo || '',
        vehicleSerialNumber: permit.numero_serie,

        // Permit details
        folioNumber: permit.folio,
        issueDate: permit.fecha_expedicion,
        expiryDate: permit.fecha_vencimiento,
        amount: permit.importe,

        // Payment details
        paymentReference: permit.payment_reference,
        paymentStatus,

        // Document paths
        permitDocumentPath: permit.permit_file_path,
        receiptDocumentPath: permit.recibo_file_path,
        certificateDocumentPath: permit.certificado_file_path,
        licensePlatesDocumentPath: permit.placas_file_path,

        // Raw status for specific handling
        rawStatus: permitStatus
      };
    });
  };



  return (
    <ResponsiveContainer
      type="fixed"
      maxWidth="xxl"
      withPadding={true}
      className={styles.dashboardContainer}
    >
      {/* Mobile Toggle Button for Guidance Panel */}
      {isMobileView && !isGuidancePanelOpen && (
        <button
          type="button"
          className={`${styles.guidancePanelToggle} touch-target`}
          onClick={handleOpenGuidancePanel}
          aria-label="Abrir panel de asistencia"
        >
          <FaRegLightbulb className={styles.toggleIcon} />
          <span>Guía y Recursos</span>
        </button>
      )}

      {isLoading ? (
        <div className={styles.loadingContainer}>
          <LoadingSpinner />
          <p className="u-text-fluid">Cargando tu información...</p>
        </div>
      ) : isError ? (
        <div className={styles.errorContainer}>
          <p className="u-text-fluid">Lo sentimos, ha ocurrido un error al cargar tus permisos.</p>
          <p className="u-text-fluid">Por favor, intenta recargar la página o contacta a soporte si el problema persiste.</p>
        </div>
      ) : (
        <div className={`${styles.dashboardContent} u-stack-on-mobile`}>
          {/* Left Column - Main Content Area */}
          <div className={styles.leftColumn}>
            {/* Today's Focus Area */}
            <div className={styles.contentSection}>
              <TodaysFocus focusItem={focusItemForDisplay} />
            </div>

            {/* My Permits Overview Area */}
            <div className={styles.contentSection}>
              <PermitsOverview permits={permitCardsForDisplay} />
            </div>
          </div>

          {/* Right Column - Guidance & Resource Center */}
          <div
            className={`
              ${styles.rightColumn}
              ${isMobileView && isGuidancePanelOpen ? styles.rightColumnMobileOpen : ''}
            `}
          >
            <div className={styles.contentSection}>
              <GuidanceCenter onClose={handleCloseGuidancePanel} />
            </div>
          </div>

          {/* Backdrop overlay for mobile panel */}
          {isMobileView && (
            <div
              className={`${styles.backdrop} ${isGuidancePanelOpen ? styles.backdropVisible : ''}`}
              onClick={handleCloseGuidancePanel}
              aria-hidden="true"
            />
          )}
        </div>
      )}

      {/* Mobile Navigation - Only shown on mobile devices */}
      {isMobileView && (
        <div className={styles.mobileNavContainer}>
          <MobileNavigation type="bottom" isAuthenticated={true} />
        </div>
      )}
    </ResponsiveContainer>
  );
};

export default NewDashboardPage;
