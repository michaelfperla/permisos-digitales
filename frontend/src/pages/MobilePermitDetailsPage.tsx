import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaDownload, FaStore } from 'react-icons/fa';
import axios from 'axios';
import { ApplicationStatus } from '../constants/application.constants';

import styles from './MobilePermitDetailsPage.module.css';
import Icon from '../shared/components/ui/Icon';
import { usePermitDetails } from '../hooks/usePermitDetails';
import OxxoVoucherModal from '../components/payment/OxxoVoucherModal';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import StatusTimeline from '../components/permit/StatusTimeline';
import StatusBadge from '../components/ui/StatusBadge/StatusBadge';

const MobilePermitDetailsPage: React.FC = () => {
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

  // Format helpers
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

  // Get primary action based on status
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
          label: 'Descargar Todos los Documentos',
          icon: <FaDownload />,
          onClick: () => {
            // Download all four PDFs
            const types: Array<'permiso' | 'certificado' | 'placas' | 'recomendaciones'> = ['permiso', 'certificado', 'placas', 'recomendaciones'];
            types.forEach((type) => {
              actions.handleDownloadPermit(type);
            });
          },
          disabled: state.isDownloading,
        };
      default:
        return null;
    }
  };

  const primaryAction = getPrimaryAction();

  const getPaymentMethod = () => {
    if (currentStatus === 'AWAITING_OXXO_PAYMENT' || applicationData?.oxxoReference) {
      return 'OXXO';
    }
    return 'Tarjeta de crédito/débito';
  };


  if (isLoading) {
    return (
      <div className={styles.mobileContainer}>
        <div className={styles.loadingState}>
          <LoadingSpinner />
          <p>Cargando detalles del permiso...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    const errorMessage = axios.isAxiosError(error) && (error.response?.status === 404 || error.response?.status === 403)
      ? 'Permiso no encontrado o sin acceso.'
      : 'Ocurrió un error al cargar el permiso.';
    return (
      <div className={styles.mobileContainer}>
        <div className={styles.errorState}>
          <h2>Error</h2>
          <p>{errorMessage}</p>
          <Link to="/dashboard" className={styles.backButton}>
            <Icon IconComponent={FaArrowLeft} /> Volver al Panel
          </Link>
        </div>
      </div>
    );
  }

  if (!applicationData || !applicationData.application) {
    return (
      <div className={styles.mobileContainer}>
        <div className={styles.loadingState}>
          <LoadingSpinner />
          <p>Cargando detalles del permiso...</p>
        </div>
      </div>
    );
  }

  const vehicleInfo = applicationData?.application?.vehicleInfo;
  const ownerInfo = applicationData?.application?.ownerInfo;
  const dates = applicationData?.application?.dates;

  return (
    <>
      <div className={styles.mobileContainer}>
        {/* Header */}
        <div className={styles.mobileHeader}>
          <Link to="/dashboard" className={styles.backButtonLink}>
            <Icon IconComponent={FaArrowLeft} />
          </Link>
          <h1 className={styles.headerTitle}>Detalles del Permiso</h1>
        </div>

        {/* Permit Context Card */}
        <div className={styles.permitContextCard}>
          <div className={styles.contextHeader}>
            <div className={styles.permitId}>Permiso #{applicationData.application.id}</div>
            {currentStatus && (
              <StatusBadge status={currentStatus} size="large" />
            )}
          </div>
          
          {applicationData?.oxxoReference && (
            <div className={styles.oxxoReferenceSection}>
              <span className={styles.oxxoLabel}>Referencia OXXO:</span>
              <span className={styles.oxxoReference}>{applicationData.oxxoReference}</span>
              <button 
                className={styles.copyButton}
                onClick={actions.handleCopyReference}
              >
                {state.copied ? '✓ Copiado' : 'Copiar'}
              </button>
            </div>
          )}

          {primaryAction && (
            <button
              className={styles.primaryActionButton}
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
            >
              {primaryAction.icon}
              {primaryAction.label}
            </button>
          )}
        </div>

        {/* Status Section */}
        <div className={styles.mobileCard}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Estado del Permiso</h2>
          </div>
          <div className={styles.cardContent}>
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

        {/* Application Info Card */}
        <div className={styles.mobileCard}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Información de la Solicitud</h2>
          </div>
          <div className={styles.cardContent}>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Fecha de Solicitud</span>
              <span className={styles.infoValue}>{formatDateTime(dates?.created)}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Última Actualización</span>
              <span className={styles.infoValue}>{formatDateTime(dates?.updated)}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Estado Actual</span>
              <span className={styles.infoValue}>
                {currentStatus && <StatusBadge status={currentStatus} />}
              </span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Método de Pago</span>
              <span className={styles.infoValue}>{getPaymentMethod()}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Monto</span>
              <span className={styles.infoValue}>{formatCurrency(applicationData?.application?.importe)}</span>
            </div>
          </div>
        </div>

        {/* Permit Details (only if ready) */}
        {(currentStatus === 'PERMIT_READY' || currentStatus === 'COMPLETED') && (
          <div className={styles.mobileCard}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Detalles del Permiso</h2>
            </div>
            <div className={styles.cardContent}>
              {applicationData?.application?.folio && (
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Número de Folio</span>
                  <span className={styles.infoValue}>{applicationData.application.folio}</span>
                </div>
              )}
              {dates?.fecha_expedicion && (
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Fecha de Expedición</span>
                  <span className={styles.infoValue}>{formatDate(dates.fecha_expedicion)}</span>
                </div>
              )}
              {dates?.fecha_vencimiento && (
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Fecha de Vencimiento</span>
                  <span className={styles.infoValue}>{formatDate(dates.fecha_vencimiento)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Vehicle Info Card */}
        <div className={styles.mobileCard}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Datos del Vehículo</h2>
          </div>
          <div className={styles.cardContent}>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Marca</span>
              <span className={styles.infoValue}>{vehicleInfo?.marca || 'No especificado'}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Línea/Versión/Submarca</span>
              <span className={styles.infoValue}>{vehicleInfo?.linea || 'No especificado'}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Modelo/Año</span>
              <span className={styles.infoValue}>{vehicleInfo?.ano_modelo || 'No especificado'}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Color</span>
              <span className={styles.infoValue}>{vehicleInfo?.color || 'No especificado'}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Número de Serie (VIN/NIV)</span>
              <span className={styles.infoValue}>{vehicleInfo?.numero_serie || 'No especificado'}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Número de Motor</span>
              <span className={styles.infoValue}>{vehicleInfo?.numero_motor || 'No especificado'}</span>
            </div>
          </div>
        </div>

        {/* Owner Info Card */}
        <div className={styles.mobileCard}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Datos del Solicitante</h2>
          </div>
          <div className={styles.cardContent}>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Nombre</span>
              <span className={styles.infoValue}>{ownerInfo?.nombre_completo || 'No especificado'}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>CURP/RFC</span>
              <span className={styles.infoValue}>{ownerInfo?.curp_rfc || 'No especificado'}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Domicilio</span>
              <span className={styles.infoValue}>{ownerInfo?.domicilio || 'No especificado'}</span>
            </div>
          </div>
        </div>

        {/* Documents Card */}
        {(currentStatus === 'PERMIT_READY' || currentStatus === 'COMPLETED') && (
          <div className={styles.mobileCard}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Documentos</h2>
            </div>
            <div className={styles.cardContent}>
              <button
                className={styles.documentButton}
                onClick={() => {
                  // Download all four PDFs
                  const types: Array<'permiso' | 'certificado' | 'placas' | 'recomendaciones'> = ['permiso', 'certificado', 'placas', 'recomendaciones'];
                  types.forEach((type) => {
                    actions.handleDownloadPermit(type);
                  });
                }}
                disabled={state.isDownloading}
              >
                <Icon IconComponent={FaDownload} />
                {state.isDownloading ? 'Descargando...' : 'Descargar Todos los Documentos (4 PDFs)'}
              </button>
            </div>
          </div>
        )}
      </div>

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

export default MobilePermitDetailsPage;