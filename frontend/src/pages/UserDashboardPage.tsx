import { useQuery } from '@tanstack/react-query';
import React from 'react';
import {
  FaClipboardCheck,
  FaClipboardList,
  FaExclamationTriangle,
  FaHourglassHalf,
  FaCheckCircle,
  FaTimesCircle,
  FaChartBar,
  FaInfoCircle,
  FaPlus,
} from 'react-icons/fa';
import { Link } from 'react-router-dom';

import styles from './UserDashboardPage.module.css';
import applicationService from '../services/applicationService';
import Icon from '../shared/components/ui/Icon';
import { useUserAuth as useAuth } from '../shared/hooks/useAuth';
import { useToast } from '../shared/hooks/useToast';

/**
 * User dashboard showing permit statistics and quick actions
 */
const UserDashboardPage: React.FC = () => {
  const { showToast } = useToast();
  const { user } = useAuth();

  const {
    data: dashboardData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['applications'],
    queryFn: applicationService.getApplications,
  });

  React.useEffect(() => {
    if (isError && error) {
      showToast(`Error al cargar permisos: ${error.message}`, 'error');
    }
  }, [isError, error, showToast]);

  const statusDisplayMap: Record<string, string> = {
    AWAITING_PAYMENT: 'Pendiente de Pago',
    AWAITING_OXXO_PAYMENT: 'Pendiente de Pago (OXXO)',
    PAYMENT_PROCESSING: 'Pago en Proceso',
    PAYMENT_FAILED: 'Pago Fallido',
    PAYMENT_RECEIVED: 'Pago Recibido',
    GENERATING_PERMIT: 'Generando Permiso',
    ERROR_GENERATING_PERMIT: 'Error al Generar',
    PERMIT_READY: 'Permiso Listo',
    COMPLETED: 'Completado',
    CANCELLED: 'Cancelado',
    EXPIRED: 'Expirado',
    RENEWAL_PENDING: 'Renovación Pendiente',
    RENEWAL_APPROVED: 'Renovación Aprobada',
    RENEWAL_REJECTED: 'Renovación Rechazada',
    PENDING: 'Pendiente de Pago',
    PROOF_SUBMITTED: 'Comprobante Enviado',
    PAYMENT_VERIFIED: 'Pago Verificado',
    PAYMENT_REJECTED: 'Comprobante Rechazado',
    PERMIT_GENERATED: 'Permiso Generado',
  };

  const getStatusDisplayName = (status: string): string => {
    return statusDisplayMap[status] || status;
  };

  const getStatusIcon = (status: string): React.ReactNode => {
    switch (status) {
      case 'AWAITING_PAYMENT':
      case 'PENDING':
      case 'AWAITING_OXXO_PAYMENT':
      case 'PAYMENT_PROCESSING':
      case 'GENERATING_PERMIT':
      case 'RENEWAL_PENDING':
        return <Icon IconComponent={FaHourglassHalf} className={styles.iconPending} />;
      case 'PAYMENT_FAILED':
      case 'ERROR_GENERATING_PERMIT':
      case 'RENEWAL_REJECTED':
      case 'PAYMENT_REJECTED':
        return <Icon IconComponent={FaTimesCircle} className={styles.iconRejected} />;
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_VERIFIED':
        return <Icon IconComponent={FaCheckCircle} className={styles.iconVerified} />;
      case 'PERMIT_READY':
      case 'PERMIT_GENERATED':
        return <Icon IconComponent={FaCheckCircle} className={styles.iconGenerated} />;
      case 'COMPLETED':
      case 'RENEWAL_APPROVED':
        return <Icon IconComponent={FaCheckCircle} className={styles.iconCompleted} />;
      case 'CANCELLED':
      case 'EXPIRED':
        return <Icon IconComponent={FaTimesCircle} className={styles.iconCancelled} />;
      case 'PROOF_SUBMITTED':
        return <Icon IconComponent={FaClipboardCheck} className={styles.iconSubmitted} />;
      default:
        return <Icon IconComponent={FaChartBar} className={styles.iconDefault} />;
    }
  };

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Cargando información...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={styles.errorContainer}>
        <Icon IconComponent={FaExclamationTriangle} className={styles.errorIcon} />
        <h2>Error al cargar información</h2>
        <p>{error instanceof Error ? error.message : 'Error desconocido'}</p>
        <button type="button" className={styles.retryButton} onClick={() => refetch()}>
          Intentar nuevamente
        </button>
      </div>
    );
  }

  const statusGroups: Record<string, number> = {};
  if (dashboardData?.applications) {
    dashboardData.applications.forEach((app: any) => {
      statusGroups[app.status] = (statusGroups[app.status] || 0) + 1;
    });
  }

  const activePermits = (dashboardData?.applications || []).filter(
    (app: any) => app.status === 'PERMIT_READY' || app.status === 'COMPLETED',
  ).length;

  const pendingPayments = (dashboardData?.applications || []).filter(
    (app: any) =>
      app.status === 'AWAITING_PAYMENT' ||
      app.status === 'AWAITING_OXXO_PAYMENT' ||
      app.status === 'PAYMENT_PROCESSING' ||
      app.status === 'PENDING',
  ).length;

  return (
    <div className={styles.dashboardPage}>
      <div className={styles.dashboardContentWrapper}>
        <header className={`${styles.pageHeader} page-header-main-content ${styles.centeredText}`}>
          <h1 className={`${styles.pageTitle} page-title-h1`}>Dashboard</h1>
          <h2 className={`${styles.pageSubtitle} page-subtitle-h2`}>
            Bienvenido, {user?.first_name || 'Usuario'}. Aquí está el resumen de tus permisos.
          </h2>
        </header>

        <section className={styles.statsOverview}>
          <div className={styles.statCard}>
            <div className={styles.statHeader}>
              <h3 className={styles.statTitle}>Permisos Activos</h3>
            </div>
            <div className={styles.statContent}>
              <div className={styles.statValue}>{activePermits}</div>
              <div className={styles.statIcon}>
                <Icon IconComponent={FaCheckCircle} />
              </div>
            </div>
            <div className={styles.statFooter}>
              <Link to="/permits?status=active" className={styles.statLink}>
                Ver permisos activos
              </Link>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statHeader}>
              <h3 className={styles.statTitle}>Pagos Pendientes</h3>
            </div>
            <div className={styles.statContent}>
              <div className={styles.statValue}>{pendingPayments}</div>
              <div className={styles.statIcon}>
                <Icon IconComponent={FaHourglassHalf} />
              </div>
            </div>
            <div className={styles.statFooter}>
              <Link to="/permits?status=pending" className={styles.statLink}>
                Ver pagos pendientes
              </Link>
            </div>
          </div>
        </section>

        <section className={styles.statusSection}>
          <h3 className={styles.sectionTitle}>Estado de Mis Permisos</h3>
          {Object.keys(statusGroups).length > 0 ? (
            <div className={styles.statusGrid}>
              {Object.entries(statusGroups).map(([status, count]) => (
                <div key={status} className={styles.statusCard}>
                  <div className={styles.statusIconWrapper}>
                    {getStatusIcon(status)}
                  </div>
                  <div className={styles.statusContent}>
                    <div className={styles.statusCount}>{count}</div>
                    <div className={styles.statusName}>{getStatusDisplayName(status)}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.emptyStatusMessage}>
              <Icon IconComponent={FaInfoCircle} className={styles.emptyStatusIcon} />
              <p>No tienes permisos registrados. ¡Solicita tu primer permiso ahora!</p>
            </div>
          )}
        </section>

        <section className={styles.quickLinks}>
          <h3 className={styles.sectionTitle}>Acciones Rápidas</h3>
          <div className={styles.linksGrid}>
            <Link to="/permits/new" className={styles.linkCard}>
              <div className={styles.linkIconWrapper}>
                <Icon IconComponent={FaPlus} />
              </div>
              <div className={styles.linkText}>Solicitar Nuevo Permiso</div>
            </Link>
            <Link to="/permits" className={styles.linkCard}>
              <div className={styles.linkIconWrapper}>
                <Icon IconComponent={FaClipboardList} />
              </div>
              <div className={styles.linkText}>Ver Todos Mis Permisos</div>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default UserDashboardPage;
