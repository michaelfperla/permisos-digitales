import { useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
import {
  FaExclamationTriangle,
  FaCheckCircle,
  FaTimesCircle,
  FaArrowLeft,
  FaEye,
  FaCar,
  FaUser,
  FaFileAlt,
  FaMoneyBillWave,
} from 'react-icons/fa';
import { useParams, useNavigate } from 'react-router-dom';

import styles from './ApplicationDetailsPage.module.css';
import Button from '../../components/ui/Button/Button';
import ResponsiveContainer from '../../components/ui/ResponsiveContainer/ResponsiveContainer';
import Icon from '../../shared/components/ui/Icon';
import { useToast } from '../../shared/hooks/useToast';
import adminService from '../services/adminService';

const ApplicationDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  // Fetch application details
  const {
    data: application,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['applicationDetails', id],
    queryFn: () => adminService.getApplicationDetails(id!),
    enabled: !!id,
  });

  // Handle application details error
  React.useEffect(() => {
    if (isError && error) {
      showToast(`Error al cargar detalles de la solicitud: ${error.message}`, 'error');
    }
  }, [isError, error, showToast]);

  // Fetch payment proof details if application is in PROOF_SUBMITTED status
  const { data: paymentProofDetails, isLoading: isLoadingPaymentProof, isError: isPaymentProofError, error: paymentProofError } = useQuery({
    queryKey: ['paymentProofDetails', id],
    queryFn: () => adminService.getPaymentProofDetails(id!),
    enabled: !!id && application?.status === 'PROOF_SUBMITTED',
  });

  // Handle payment proof error
  React.useEffect(() => {
    if (isPaymentProofError && paymentProofError) {
      showToast(`Error al cargar detalles del comprobante: ${paymentProofError.message}`, 'error');
    }
  }, [isPaymentProofError, paymentProofError, showToast]);

  // Format date for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';

    const date = new Date(dateString);
    return date.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get status display name
  const getStatusDisplayName = (status: string): string => {
    switch (status) {
      case 'PENDING_PAYMENT':
        return 'Pendiente de Pago';
      case 'PROOF_SUBMITTED':
        return 'Comprobante Enviado';
      case 'PAYMENT_RECEIVED':
        return 'Pago Verificado';
      case 'PROOF_REJECTED':
        return 'Comprobante Rechazado';
      case 'PERMIT_READY':
        return 'Permiso Listo';
      case 'COMPLETED':
        return 'Completado';
      case 'CANCELLED':
        return 'Cancelado';
      default:
        return status;
    }
  };

  // Get status class for styling
  const getStatusClass = (status: string): string => {
    switch (status) {
      case 'PENDING_PAYMENT':
        return styles.statusPending;
      case 'PROOF_SUBMITTED':
        return styles.statusSubmitted;
      case 'PAYMENT_RECEIVED':
        return styles.statusVerified;
      case 'PROOF_REJECTED':
        return styles.statusRejected;
      case 'PERMIT_READY':
        return styles.statusReady;
      case 'COMPLETED':
        return styles.statusCompleted;
      case 'CANCELLED':
        return styles.statusCancelled;
      default:
        return '';
    }
  };

  const [verifyNotes, setVerifyNotes] = useState('');
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // Handle verify payment
  const handleVerifyPayment = async () => {
    if (showVerifyModal) {
      try {
        setIsVerifying(true);
        showToast('Verificando pago...', 'info');

        const result = await adminService.verifyPayment(id!, verifyNotes);

        if (result.success) {
          showToast('Pago verificado correctamente', 'success');
          setShowVerifyModal(false);
          setVerifyNotes('');
          refetch();
        } else {
          showToast(`Error al verificar pago: ${result.message || 'Error desconocido'}`, 'error');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
        showToast(`Error al verificar pago: ${errorMessage}`, 'error');
      } finally {
        setIsVerifying(false);
      }
    } else {
      // Show the verification modal
      setShowVerifyModal(true);
    }
  };

  const [isRejecting, setIsRejecting] = useState(false);

  // Handle reject payment
  const handleRejectPayment = async () => {
    if (!rejectReason.trim()) {
      showToast('Debe ingresar un motivo de rechazo', 'error');
      return;
    }

    try {
      setIsRejecting(true);
      showToast('Rechazando pago...', 'info');

      const result = await adminService.rejectPayment(id!, rejectReason);

      if (result.success) {
        showToast('Pago rechazado correctamente', 'success');
        setShowRejectModal(false);
        setRejectReason('');
        refetch();
      } else {
        showToast(`Error al rechazar pago: ${result.message || 'Error desconocido'}`, 'error');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      showToast(`Error al rechazar pago: ${errorMessage}`, 'error');
    } finally {
      setIsRejecting(false);
    }
  };

  // Handle view payment proof
  const handleViewPaymentProof = () => {
    if (id) {
      window.open(`/api/admin/applications/${id}/payment-proof-file`, '_blank');
    }
  };

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Cargando detalles de la solicitud...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={styles.errorContainer}>
        <Icon
          IconComponent={FaExclamationTriangle}
          className={styles.errorIcon}
          size="xl"
          color="var(--color-danger)"
        />
        <h2>Error al cargar detalles de la solicitud</h2>
        <p>{error instanceof Error ? error.message : 'Error desconocido'}</p>
        <div className={styles.errorActions}>
          <Button variant="primary" size="small" onClick={() => refetch()}>
            Intentar nuevamente
          </Button>
          <Button variant="secondary" size="small" onClick={() => navigate(-1)}>
            Volver
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ResponsiveContainer maxWidth="xxl">
      <header className={styles.pageHeader}>
        <Button
          variant="secondary"
          size="small"
          icon={<Icon IconComponent={FaArrowLeft} size="sm" />}
          onClick={() => navigate(-1)}
        >
          Volver
        </Button>

        <div className={styles.headerContent}>
          <h1 className={styles.pageTitle}>Solicitud #{application?.id}</h1>
          <div className={styles.statusContainer}>
            <span className={`${styles.statusBadge} ${getStatusClass(application?.status || '')}`}>
              {getStatusDisplayName(application?.status || '')}
            </span>
          </div>
        </div>

        {application?.status === 'PROOF_SUBMITTED' && (
          <div className={styles.headerActions}>
            <Button
              variant="success"
              size="small"
              icon={<Icon IconComponent={FaCheckCircle} size="sm" color="var(--color-success)" />}
              onClick={handleVerifyPayment}
            >
              Aprobar Pago
            </Button>
            <Button
              variant="danger"
              size="small"
              icon={<Icon IconComponent={FaTimesCircle} size="sm" color="var(--color-danger)" />}
              onClick={() => setShowRejectModal(true)}
            >
              Rechazar Pago
            </Button>
          </div>
        )}
      </header>

      <div className={styles.applicationContent}>
        {/* Application Details */}
        <div className={styles.detailsSection}>
          <h2 className={styles.sectionTitle}>Información del Vehículo</h2>
          <div className={styles.detailsCard}>
            <div className={styles.detailsHeader}>
              <Icon IconComponent={FaCar} className={styles.detailsIcon} size="lg" />
              <h3 className={styles.detailsTitle}>Datos del Vehículo</h3>
            </div>
            <div className={styles.detailsGrid}>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Marca:</span>
                <span className={styles.detailValue}>{application?.marca}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Línea:</span>
                <span className={styles.detailValue}>{application?.linea}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Año Modelo:</span>
                <span className={styles.detailValue}>{application?.ano_modelo}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Color:</span>
                <span className={styles.detailValue}>{application?.color || 'N/A'}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Número de Serie:</span>
                <span className={styles.detailValue}>{application?.numero_serie}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Número de Motor:</span>
                <span className={styles.detailValue}>{application?.numero_motor}</span>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.detailsSection}>
          <h2 className={styles.sectionTitle}>Información del Solicitante</h2>
          <div className={styles.detailsCard}>
            <div className={styles.detailsHeader}>
              <Icon IconComponent={FaUser} className={styles.detailsIcon} size="lg" />
              <h3 className={styles.detailsTitle}>Datos del Solicitante</h3>
            </div>
            <div className={styles.detailsGrid}>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Nombre Completo:</span>
                <span className={styles.detailValue}>{application?.nombre_completo}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>CURP/RFC:</span>
                <span className={styles.detailValue}>{application?.curp_rfc || 'N/A'}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Domicilio:</span>
                <span className={styles.detailValue}>{application?.domicilio}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Correo Electrónico:</span>
                <span className={styles.detailValue}>{application?.applicant_email || 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.detailsSection}>
          <h2 className={styles.sectionTitle}>Información del Permiso</h2>
          <div className={styles.detailsCard}>
            <div className={styles.detailsHeader}>
              <Icon IconComponent={FaFileAlt} className={styles.detailsIcon} size="lg" />
              <h3 className={styles.detailsTitle}>Datos del Permiso</h3>
            </div>
            <div className={styles.detailsGrid}>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Fecha de Creación:</span>
                <span className={styles.detailValue}>{formatDate(application?.created_at)}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Última Actualización:</span>
                <span className={styles.detailValue}>{formatDate(application?.updated_at)}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Folio:</span>
                <span className={styles.detailValue}>{application?.folio || 'No generado'}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Fecha de Expedición:</span>
                <span className={styles.detailValue}>
                  {formatDate(application?.fecha_expedicion)}
                </span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Fecha de Vencimiento:</span>
                <span className={styles.detailValue}>
                  {formatDate(application?.fecha_vencimiento)}
                </span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Importe:</span>
                <span className={styles.detailValue}>
                  {application?.amount ? `$${application.amount.toFixed(2)}` : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Proof Section */}
        {(application?.status === 'PROOF_SUBMITTED' ||
          application?.status === 'PAYMENT_RECEIVED' ||
          application?.status === 'PROOF_REJECTED') && (
          <div className={styles.detailsSection}>
            <h2 className={styles.sectionTitle}>Información de Pago</h2>
            <div className={styles.detailsCard}>
              <div className={styles.detailsHeader}>
                <Icon IconComponent={FaMoneyBillWave} className={styles.detailsIcon} size="lg" />
                <h3 className={styles.detailsTitle}>Comprobante de Pago</h3>
              </div>

              {isLoadingPaymentProof ? (
                <div className={styles.loadingPaymentProof}>
                  <div className={styles.spinner}></div>
                  <p>Cargando información del comprobante...</p>
                </div>
              ) : (
                <>
                  <div className={styles.detailsGrid}>
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Referencia de Pago:</span>
                      <span className={styles.detailValue}>
                        {application?.payment_reference || 'N/A'}
                      </span>
                    </div>
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Fecha de Carga:</span>
                      <span className={styles.detailValue}>
                        {paymentProofDetails?.uploaded_at ? formatDate(paymentProofDetails.uploaded_at) : 'No disponible'}
                      </span>
                    </div>
                    {paymentProofDetails && (
                      <>
                        <div className={styles.detailItem}>
                          <span className={styles.detailLabel}>Nombre del Archivo:</span>
                          <span className={styles.detailValue}>
                            {paymentProofDetails.original_filename}
                          </span>
                        </div>
                        <div className={styles.detailItem}>
                          <span className={styles.detailLabel}>Tipo de Archivo:</span>
                          <span className={styles.detailValue}>
                            {paymentProofDetails.mime_type}
                          </span>
                        </div>
                        <div className={styles.detailItem}>
                          <span className={styles.detailLabel}>Tamaño:</span>
                          <span className={styles.detailValue}>
                            {Math.round(paymentProofDetails.size / 1024)} KB
                          </span>
                        </div>
                      </>
                    )}
                    {/* Legacy payment rejection reason - no longer used in current system */}
                  </div>

                  <div className={styles.paymentProofActions}>
                    <Button
                      variant="info"
                      size="small"
                      icon={<Icon IconComponent={FaEye} size="sm" />}
                      onClick={handleViewPaymentProof}
                    >
                      Ver Comprobante
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Reject Payment Modal */}
      {showRejectModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Rechazar Comprobante de Pago</h2>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setShowRejectModal(false)}
              >
                ×
              </button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.modalText}>
                Ingrese el motivo por el cual está rechazando este comprobante de pago:
              </p>
              <textarea
                className={styles.rejectReasonInput}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Motivo de rechazo"
                rows={4}
              />
            </div>
            <div className={styles.modalFooter}>
              <Button variant="secondary" size="small" onClick={() => setShowRejectModal(false)}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                size="small"
                onClick={handleRejectPayment}
                disabled={!rejectReason.trim() || isRejecting}
              >
                {isRejecting ? 'Procesando...' : 'Confirmar Rechazo'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Verify Payment Modal */}
      {showVerifyModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Verificar Pago</h2>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setShowVerifyModal(false)}
              >
                ×
              </button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.modalText}>
                ¿Está seguro que desea verificar este pago? Esta acción generará el permiso para el
                solicitante.
              </p>
              <div className={styles.verifyDetails}>
                <div className={styles.verifyDetail}>
                  <span className={styles.verifyDetailLabel}>Solicitante:</span>
                  <span className={styles.verifyDetailValue}>{application?.nombre_completo}</span>
                </div>
                <div className={styles.verifyDetail}>
                  <span className={styles.verifyDetailLabel}>Vehículo:</span>
                  <span className={styles.verifyDetailValue}>
                    {application?.marca} {application?.linea} ({application?.ano_modelo})
                  </span>
                </div>
                <div className={styles.verifyDetail}>
                  <span className={styles.verifyDetailLabel}>Referencia de Pago:</span>
                  <span className={styles.verifyDetailValue}>
                    {application?.payment_reference || 'N/A'}
                  </span>
                </div>
              </div>
              <div className={styles.verifyNotesContainer}>
                <label htmlFor="verifyNotes" className={styles.verifyNotesLabel}>
                  Notas adicionales (opcional):
                </label>
                <textarea
                  id="verifyNotes"
                  className={styles.verifyNotesInput}
                  value={verifyNotes}
                  onChange={(e) => setVerifyNotes(e.target.value)}
                  placeholder="Notas adicionales sobre la verificación"
                  rows={3}
                />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <Button variant="secondary" size="small" onClick={() => setShowVerifyModal(false)}>
                Cancelar
              </Button>
              <Button
                variant="success"
                size="small"
                onClick={handleVerifyPayment}
                disabled={isVerifying}
              >
                {isVerifying ? 'Procesando...' : 'Confirmar Verificación'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ResponsiveContainer>
  );
};

export default ApplicationDetailsPage;
