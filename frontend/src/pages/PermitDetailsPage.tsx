import React from 'react';
import { FaDownload, FaStore, FaArrowLeft, FaRedo } from 'react-icons/fa';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ApplicationStatus } from '../constants/application.constants';

import DocumentList from '../components/permit/DocumentList';
import PermitContextHeader from '../components/permit/PermitContextHeader';
import PermitStatusDisplay from '../components/permit/PermitStatusDisplay';
import StatusTimeline from '../components/permit/StatusTimeline';
import RenewalEligibility from '../components/permit/RenewalEligibility';
import OxxoVoucherModal from '../components/payment/OxxoVoucherModal';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ResponsiveContainer from '../components/ui/ResponsiveContainer/ResponsiveContainer';
import Tabs from '../components/ui/Tabs/Tabs';
import { 
  formatDateMexicoWithTZ, 
  calculatePermitExpirationDate, 
  getExpirationStatusMessage 
} from '../utils/permitBusinessDays';
import { usePermitDetails } from '../hooks/usePermitDetails';
import styles from './PermitDetailsPage.module.css';
import { Application, ApplicationDetails } from '../services/applicationService';

/**
 * Helper function to convert ApplicationDetails to Application format
 */
const convertDetailsToApplication = (details: ApplicationDetails): Application => {
  return {
    id: details.id,
    user_id: 0, // Not available in ApplicationDetails
    status: ApplicationStatus.COMPLETED, // Default status
    created_at: details.dates.created,
    updated_at: details.dates.updated,
    nombre_completo: details.ownerInfo.nombre_completo,
    curp_rfc: details.ownerInfo.curp_rfc,
    domicilio: details.ownerInfo.domicilio,
    marca: details.vehicleInfo.marca,
    linea: details.vehicleInfo.linea,
    color: details.vehicleInfo.color,
    numero_serie: details.vehicleInfo.numero_serie,
    numero_motor: details.vehicleInfo.numero_motor,
    ano_modelo: Number(details.vehicleInfo.ano_modelo),
    folio: details.folio,
    importe: details.importe,
    fecha_expedicion: details.dates.fecha_expedicion,
    fecha_vencimiento: details.dates.fecha_vencimiento,
    payment_reference: details.paymentReference,
  };
};

/**
 * PermitDetailsPage serves as the main view for a single permit.
 * It uses the `usePermitDetails` hook to manage all logic and state,
 * and composes smaller, focused components to render the UI.
 */
const PermitDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    isLoading,
    isError,
    error,
    applicationData,
    currentStatus,
    state,
    actions,
  } = usePermitDetails();

  if (isLoading) {
    return (
      <ResponsiveContainer type="fixed" maxWidth="lg" withPadding className={styles.pageWrapper}>
        <div className={styles.loadingContainer}>
          <LoadingSpinner />
          <p>Cargando detalles del permiso...</p>
        </div>
      </ResponsiveContainer>
    );
  }

  if (isError) {
    const errorMessage = axios.isAxiosError(error) && (error.response?.status === 404 || error.response?.status === 403)
      ? 'Permiso no encontrado o sin acceso.'
      : 'Ocurrió un error al cargar el permiso.';
    return (
      <ResponsiveContainer type="fixed" maxWidth="lg" withPadding className={styles.pageWrapper}>
        <div className={styles.errorContainer}>
          <h2>Error</h2>
          <p>{errorMessage}</p>
          <Link to="/dashboard" className={styles.backButton}>
            <FaArrowLeft /> Volver al Panel
          </Link>
        </div>
      </ResponsiveContainer>
    );
  }

  // Ensure applicationData is loaded before accessing nested properties
  if (!applicationData || !applicationData.application) {
    return (
      <ResponsiveContainer type="fixed" maxWidth="lg" withPadding className={styles.pageWrapper}>
        <div className={styles.loadingContainer}>
          <LoadingSpinner />
          <p>Cargando detalles del permiso...</p>
        </div>
      </ResponsiveContainer>
    );
  }

  // Logic to determine the primary action button based on status
  const getPrimaryAction = () => {
    switch (currentStatus) {
      case 'AWAITING_PAYMENT':
      case 'PAYMENT_PROCESSING':
      case 'PAYMENT_FAILED':
        return {
          label: 'Continuar con el Pago',
          icon: <FaArrowLeft style={{ transform: 'rotate(180deg)' }} />,
          onClick: () => {
            // Navigate to payment page with application data
            navigate(`/permits/${applicationData?.application?.id}/payment`);
          },
        };
      case 'AWAITING_OXXO_PAYMENT':
        return {
          label: 'Ver Ficha de Pago OXXO',
          icon: <FaStore />,
          onClick: actions.handleViewOxxoSlip,
        };
      case 'PERMIT_READY':
      case 'COMPLETED':
        return {
          label: 'Renovar este Permiso',
          icon: <FaRedo />,
          onClick: () => {
            const permitId = applicationData?.application?.id;
            if (permitId) {
              navigate(`/permits/${permitId}/renew`);
            }
          },
        };
      default:
        return null;
    }
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'No disponible';
    try {
      return new Date(dateString).toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return 'Fecha inválida';
    }
  };

  const formatDateTime = (dateString?: string | null) => {
    if (!dateString) return 'No disponible';
    try {
      return new Date(dateString).toLocaleString('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Fecha inválida';
    }
  };

  const formatCurrency = (amount?: number | string) => {
    if (!amount && amount !== 0) return 'N/A';
    const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('es-MX', { 
      style: 'currency', 
      currency: 'MXN' 
    }).format(numericAmount);
  };

  const getPaymentMethod = () => {
    if (currentStatus === 'AWAITING_OXXO_PAYMENT' || applicationData?.oxxoReference) {
      return 'OXXO';
    }
    return 'Tarjeta de crédito/débito';
  };

  const vehicleInfo = applicationData?.application?.vehicleInfo;
  const ownerInfo = applicationData?.application?.ownerInfo;
  const dates = applicationData?.application?.dates;

  // Create tabs array - conditionally show certain tabs based on status
  const tabs = [
    {
      id: 'status',
      label: 'Estado',
      content: (
        <div className={styles.statusTabPanel}>
          <PermitStatusDisplay
            status={currentStatus}
            applicationData={applicationData}
          />
          
          <div className={styles.statusTimelineSection}>
            <h3 className={styles.tabSubheading}>Historial del Permiso</h3>
            <StatusTimeline 
              currentStatus={currentStatus || ApplicationStatus.AWAITING_PAYMENT} 
              applicationDates={{
                created_at: dates?.created || '',
                payment_verified_at: dates?.payment_verified_at,
                fecha_expedicion: dates?.fecha_expedicion
              }}
            />
          </div>
        </div>
      ),
    },
    {
      id: 'application-info',
      label: 'Solicitud',
      content: (
        <div className={styles.permitInfoTabPanel}>
          <div className={styles.infoSection}>
            <h3 className={styles.tabSubheading}>Detalles de la Solicitud</h3>
            <div className={styles.infoCard}>
              <div className={styles.infoItem}>
                <span className={styles.infoTabLabel}>ID de Solicitud:</span>
                <span className={styles.infoTabValue}>
                  #{applicationData?.application?.id}
                </span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoTabLabel}>Fecha de Solicitud:</span>
                <span className={styles.infoTabValue}>
                  {formatDateTime(dates?.created)}
                </span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoTabLabel}>Última Actualización:</span>
                <span className={styles.infoTabValue}>
                  {formatDateTime(dates?.updated)}
                </span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoTabLabel}>Estado Actual:</span>
                <span className={styles.infoTabValue}>
                  {applicationData?.status?.displayMessage || 'En proceso'}
                </span>
              </div>
            </div>
          </div>

          <div className={styles.infoSection}>
            <h3 className={styles.tabSubheading}>Información de Pago</h3>
            <div className={styles.infoCard}>
              <div className={styles.infoItem}>
                <span className={styles.infoTabLabel}>Método de Pago:</span>
                <span className={styles.infoTabValue}>
                  {getPaymentMethod()}
                </span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoTabLabel}>Monto:</span>
                <span className={styles.infoTabValue}>
                  {formatCurrency(applicationData?.application?.importe)}
                </span>
              </div>
              {applicationData?.oxxoReference && (
                <div className={styles.infoItem}>
                  <span className={styles.infoTabLabel}>Referencia OXXO:</span>
                  <span className={styles.infoTabValue}>
                    {applicationData.oxxoReference}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Only show permit details section if permit is ready */}
          {(currentStatus === 'PERMIT_READY' || currentStatus === 'COMPLETED') && (
            <div className={styles.infoSection}>
              <h3 className={styles.tabSubheading}>Detalles del Permiso</h3>
              <div className={styles.infoCard}>
                {applicationData?.application?.folio && (
                  <div className={styles.infoItem}>
                    <span className={styles.infoTabLabel}>Número de Folio:</span>
                    <span className={styles.infoTabValue}>
                      {applicationData.application.folio}
                    </span>
                  </div>
                )}
                {dates?.fecha_expedicion && (
                  <div className={styles.infoItem}>
                    <span className={styles.infoTabLabel}>Fecha de Expedición:</span>
                    <span className={styles.infoTabValue}>
                      {formatDateMexicoWithTZ(dates.fecha_expedicion)}
                    </span>
                  </div>
                )}
                {(() => {
                  // Calculate correct expiration based on business rules
                  if (status === 'PERMIT_READY' && (dates?.fecha_expedicion || application?.updated_at)) {
                    const permitReadyDate = dates?.fecha_expedicion || application?.updated_at;
                    const calculatedExpiration = calculatePermitExpirationDate(permitReadyDate);
                    const statusInfo = getExpirationStatusMessage(permitReadyDate, status);
                    
                    return (
                      <div className={styles.infoItem}>
                        <span className={styles.infoTabLabel}>Fecha de Vencimiento:</span>
                        <span className={styles.infoTabValue}>
                          {formatDateMexicoWithTZ(calculatedExpiration)}
                          {statusInfo.urgency !== 'normal' && (
                            <div style={{ 
                              fontSize: '0.9em', 
                              color: statusInfo.urgency === 'expired' ? 'var(--color-danger)' : 
                                     statusInfo.urgency === 'critical' ? 'var(--color-warning)' : 
                                     'var(--color-info)',
                              marginTop: '4px',
                              fontWeight: 'bold'
                            }}>
                              {statusInfo.message}
                            </div>
                          )}
                        </span>
                      </div>
                    );
                  }
                  
                  // For other statuses, show stored date if available
                  if (dates?.fecha_vencimiento) {
                    return (
                      <div className={styles.infoItem}>
                        <span className={styles.infoTabLabel}>Fecha de Vencimiento:</span>
                        <span className={styles.infoTabValue}>
                          {formatDateMexicoWithTZ(dates.fecha_vencimiento)}
                        </span>
                      </div>
                    );
                  }
                  
                  return null;
                })()}
              </div>
            </div>
          )}

          {/* Documents section - always show but it handles empty state internally */}
          <div className={styles.infoSection}>
            <h3 className={styles.tabSubheading}>Documentos</h3>
            <DocumentList
              applicationData={applicationData}
              onDownload={actions.handleDownloadPermit}
              isDownloading={state.isDownloading}
              downloadingTypes={state.downloadingTypes}
            />
          </div>

          {/* Renewal eligibility section for completed permits */}
          {(currentStatus === 'PERMIT_READY' || currentStatus === 'COMPLETED') && applicationData?.application && (
            <div className={styles.infoSection}>
              <RenewalEligibility 
                application={convertDetailsToApplication(applicationData.application)}
                onRefresh={actions.refetch}
              />
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'vehicle',
      label: 'Vehículo',
      content: (
        <div className={styles.vehicleInfoTabPanel}>
          <div className={styles.infoSection}>
            <h3 className={styles.tabSubheading}>Información del Vehículo</h3>
            <div className={styles.infoCard}>
              <div className={styles.infoItem}>
                <span className={styles.infoTabLabel}>Marca:</span>
                <span className={styles.infoTabValue}>
                  {vehicleInfo?.marca || 'No especificado'}
                </span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoTabLabel}>Línea/Modelo:</span>
                <span className={styles.infoTabValue}>
                  {vehicleInfo?.linea || 'No especificado'}
                </span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoTabLabel}>Año:</span>
                <span className={styles.infoTabValue}>
                  {vehicleInfo?.ano_modelo || 'No especificado'}
                </span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoTabLabel}>Color:</span>
                <span className={styles.infoTabValue}>
                  {vehicleInfo?.color || 'No especificado'}
                </span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoTabLabel}>Número de Serie (VIN):</span>
                <span className={styles.infoTabValue}>
                  {vehicleInfo?.numero_serie || 'No especificado'}
                </span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoTabLabel}>Número de Motor:</span>
                <span className={styles.infoTabValue}>
                  {vehicleInfo?.numero_motor || 'No especificado'}
                </span>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'applicant',
      label: 'Solicitante',
      content: (
        <div className={styles.applicantInfoTabPanel}>
          <div className={styles.infoSection}>
            <h3 className={styles.tabSubheading}>Información del Propietario</h3>
            <div className={styles.infoCard}>
              <div className={styles.infoItem}>
                <span className={styles.infoTabLabel}>Nombre Completo:</span>
                <span className={styles.infoTabValue}>
                  {ownerInfo?.nombre_completo || 'No especificado'}
                </span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoTabLabel}>CURP/RFC:</span>
                <span className={styles.infoTabValue}>
                  {ownerInfo?.curp_rfc || 'No especificado'}
                </span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoTabLabel}>Domicilio:</span>
                <span className={styles.infoTabValue}>
                  {ownerInfo?.domicilio || 'No especificado'}
                </span>
              </div>
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <>
      <ResponsiveContainer type="fixed" maxWidth="lg" withPadding className={styles.pageWrapper}>
        <div className={styles.pageHeader}>
          <h1 className={styles.title}>Detalles del Permiso</h1>
          <Link to="/dashboard" className={styles.backButton}>
            <FaArrowLeft /> Volver al Panel
          </Link>
        </div>

        <PermitContextHeader
          permitId={String(applicationData?.application?.id)}
          status={currentStatus}
          primaryAction={getPrimaryAction()}
          oxxoReference={applicationData?.oxxoReference}
          onCopyReference={actions.handleCopyReference}
          copied={state.copied}
        />

        <div className={styles.tabbedInterfaceSection}>
          <Tabs
            tabs={tabs}
            defaultActiveTab="status"
          />
        </div>
      </ResponsiveContainer>

      <OxxoVoucherModal
        isOpen={state.showOxxoModal}
        onClose={actions.closeOxxoModal}
        oxxoReference={applicationData?.oxxoReference}
        hostedVoucherUrl={applicationData?.hostedVoucherUrl}
        amount={applicationData?.application?.importe}
        expiresAt={applicationData?.expiresAt}
      />
    </>
  );
};

export default PermitDetailsPage;