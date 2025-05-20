import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
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
  FaFileAlt,
  FaDownload,
  FaCar
} from 'react-icons/fa';
import applicationService from '../services/applicationService';
import { useToast } from '../contexts/ToastContext';
import styles from './UserDashboardPage.module.css';
import Button from '../components/ui/Button/Button';
import useAuth from '../hooks/useAuth';

const UserDashboardPage: React.FC = () => {
  const { showToast } = useToast();
  const { user } = useAuth();

  // Fetch user applications
  const {
    data: dashboardData,
    isLoading,
    isError,
    error,
    refetch
  } = useQuery({
    queryKey: ['applications'],
    queryFn: applicationService.getApplications,
    onError: (err: Error) => {
      showToast(`Error al cargar permisos: ${err.message}`, 'error');
    }
  });

  // Status mapping object to translate backend status codes to user-friendly Spanish display names
  const statusDisplayMap: Record<string, string> = {
    // New payment flow statuses
    'AWAITING_OXXO_PAYMENT': 'Pendiente de Pago OXXO',
    'PAYMENT_RECEIVED': 'Pago Recibido',
    'PROCESSING_PAYMENT': 'Procesando Pago',

    // Permit generation statuses
    'GENERATING_PERMIT': 'Generando Permiso',
    'ERROR_GENERATING_PERMIT': 'Error al Generar',
    'PERMIT_READY': 'Permiso Listo',

    // Completion statuses
    'COMPLETED': 'Completado',
    'CANCELLED': 'Cancelado',
    'EXPIRED': 'Vencido',

    // Legacy statuses - kept for backward compatibility
    'PENDING': 'Pendiente de Pago',
    'PROOF_SUBMITTED': 'Comprobante Enviado',
    'PAYMENT_VERIFIED': 'Pago Verificado',
    'PAYMENT_REJECTED': 'Comprobante Rechazado',
    'PERMIT_GENERATED': 'Permiso Generado'
  };

  // Helper function to get status display name using the mapping
  const getStatusDisplayName = (status: string): string => {
    return statusDisplayMap[status] || status;
  };

  // Helper function to get status icon
  const getStatusIcon = (status: string): React.ReactNode => {
    switch (status) {
      // New payment flow statuses
      case 'AWAITING_OXXO_PAYMENT':
        return <FaHourglassHalf className={styles.iconPending} />;
      case 'PAYMENT_RECEIVED':
        return <FaCheckCircle className={styles.iconVerified} />;

      // Permit generation statuses
      case 'GENERATING_PERMIT':
        return <FaHourglassHalf className={styles.iconPending} />;
      case 'ERROR_GENERATING_PERMIT':
        return <FaTimesCircle className={styles.iconRejected} />;
      case 'PERMIT_READY':
        return <FaCheckCircle className={styles.iconGenerated} />;

      // Completion statuses
      case 'COMPLETED':
        return <FaCheckCircle className={styles.iconCompleted} />;
      case 'CANCELLED':
        return <FaTimesCircle className={styles.iconCancelled} />;
      case 'EXPIRED':
        return <FaTimesCircle className={styles.iconCancelled} />;

      // Legacy statuses
      case 'PENDING':
        return <FaHourglassHalf className={styles.iconPending} />;
      case 'PROOF_SUBMITTED':
        return <FaClipboardCheck className={styles.iconSubmitted} />;
      case 'PAYMENT_VERIFIED':
        return <FaCheckCircle className={styles.iconVerified} />;
      case 'PAYMENT_REJECTED':
        return <FaTimesCircle className={styles.iconRejected} />;
      case 'PERMIT_GENERATED':
        return <FaCheckCircle className={styles.iconGenerated} />;

      default:
        return <FaChartBar className={styles.iconDefault} />;
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
        <FaExclamationTriangle className={styles.errorIcon} />
        <h2>Error al cargar información</h2>
        <p>{error instanceof Error ? error.message : 'Error desconocido'}</p>
        <button type="button" className={styles.retryButton} onClick={() => refetch()}>
          Intentar nuevamente
        </button>
      </div>
    );
  }

  // Group applications by status
  const statusGroups: Record<string, number> = {};

  if (dashboardData?.applications) {
    dashboardData.applications.forEach((app: any) => {
      if (statusGroups[app.status]) {
        statusGroups[app.status]++;
      } else {
        statusGroups[app.status] = 1;
      }
    });
  }

  // Count active permits (PERMIT_READY, COMPLETED)
  const activePermits = (dashboardData?.applications || []).filter((app: any) =>
    app.status === 'PERMIT_READY' || app.status === 'COMPLETED'
  ).length;

  // Count pending payments
  const pendingPayments = (dashboardData?.applications || []).filter((app: any) =>
    app.status === 'AWAITING_OXXO_PAYMENT' || app.status === 'PENDING'
  ).length;

  return (
    <div className={styles.dashboardPage}>
      <header className={`${styles.pageHeader} page-header-main-content`}>
        <h1 className={`${styles.pageTitle} page-title-h1`}>Dashboard</h1>
        <h2 className={`${styles.pageSubtitle} page-subtitle-h2`}>
          Bienvenido, {user?.first_name}. Aquí está el resumen de tus permisos.
        </h2>
      </header>

      {/* Stats Overview */}
      <section className={styles.statsOverview}>
        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <h2 className={styles.statTitle}>Permisos Activos</h2>
          </div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>{activePermits}</div>
            <div className={styles.statIcon}>
              <FaCheckCircle />
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
            <h2 className={styles.statTitle}>Pagos Pendientes</h2>
          </div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>
              {pendingPayments}
            </div>
            <div className={styles.statIcon}>
              <FaHourglassHalf />
            </div>
          </div>
          <div className={styles.statFooter}>
            <Link to="/permits?status=pending" className={styles.statLink}>
              Ver pagos pendientes
            </Link>
          </div>
        </div>
      </section>

      {/* Status Counts */}
      <section className={styles.statusSection}>
        <h2 className={styles.sectionTitle}>Estado de Mis Permisos</h2>

        {Object.keys(statusGroups).length > 0 ? (
          <div className={styles.statusGrid}>
            {Object.entries(statusGroups).map(([status, count]) => (
              <div key={status} className={styles.statusCard}>
                <div className={styles.statusIcon}>
                  {getStatusIcon(status)}
                </div>
                <div className={styles.statusContent}>
                  <div className={styles.statusCount}>{count}</div>
                  <div className={styles.statusName}>
                    {getStatusDisplayName(status)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.emptyStatusMessage}>
            <FaInfoCircle className={styles.emptyStatusIcon} />
            <p>No tienes permisos registrados. ¡Solicita tu primer permiso ahora!</p>
          </div>
        )}
      </section>

      {/* Quick Links */}
      <section className={styles.quickLinks}>
        <h2 className={styles.sectionTitle}>Acciones Rápidas</h2>

        <div className={styles.linksGrid}>
          <Link to="/permits/new" className={styles.linkCard}>
            <div className={styles.linkIcon}>
              <FaPlus />
            </div>
            <div className={styles.linkText}>Solicitar Nuevo Permiso</div>
          </Link>

          <Link to="/permits" className={styles.linkCard}>
            <div className={styles.linkIcon}>
              <FaClipboardList />
            </div>
            <div className={styles.linkText}>Ver Todos Mis Permisos</div>
          </Link>
        </div>
      </section>
    </div>
  );
};

export default UserDashboardPage;
