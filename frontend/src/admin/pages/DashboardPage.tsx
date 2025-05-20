import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  FaClipboardCheck,
  FaExclamationTriangle,
  FaHourglassHalf,
  FaCheckCircle,
  FaTimesCircle,
  FaChartBar,
  FaInfoCircle
} from 'react-icons/fa';
import adminService from '../services/adminService';
import { useToast } from '../contexts/ToastContext';
import styles from './DashboardPage.module.css';

const DashboardPage: React.FC = () => {
  const { showToast } = useToast();

  // Fetch dashboard stats
  const {
    data: stats,
    isLoading,
    isError,
    error,
    refetch
  } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: adminService.getDashboardStats,
    onError: (err: Error) => {
      showToast(`Error al cargar estadísticas: ${err.message}`, 'error');
    }
  });

  // Status mapping object to translate backend status codes to user-friendly Spanish display names
  const statusDisplayMap: Record<string, string> = {
    // New payment flow statuses
    'AWAITING_OXXO_PAYMENT': 'Pagos OXXO Pendientes',
    'PAYMENT_RECEIVED': 'Pagos Recibidos',

    // Permit generation statuses
    'GENERATING_PERMIT': 'Generando Permisos',
    'ERROR_GENERATING_PERMIT': 'Error al Generar Permisos',
    'PERMIT_READY': 'Permisos Listos',

    // Completion statuses
    'COMPLETED': 'Completados',
    'CANCELLED': 'Cancelados',
    'EXPIRED': 'Permisos Vencidos',

    // Renewal statuses
    'RENEWAL_PENDING': 'Renovaciones Pendientes',
    'RENEWAL_APPROVED': 'Renovaciones Aprobadas',
    'RENEWAL_REJECTED': 'Renovaciones Rechazadas',

    // Legacy statuses - kept for backward compatibility
    'PENDING': 'Pendientes de Pago (Legacy)',
    'PROOF_SUBMITTED': 'Comprobantes Enviados (Legacy)',
    'PAYMENT_VERIFIED': 'Pagos Verificados (Legacy)',
    'PAYMENT_REJECTED': 'Comprobantes Rechazados (Legacy)',
    'PERMIT_GENERATED': 'Permisos Generados (Legacy)'
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
        <p>Cargando estadísticas...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={styles.errorContainer}>
        <FaExclamationTriangle className={styles.errorIcon} />
        <h2>Error al cargar estadísticas</h2>
        <p>{error instanceof Error ? error.message : 'Error desconocido'}</p>
        <button type="button" className={styles.retryButton} onClick={() => refetch()}>
          Intentar nuevamente
        </button>
      </div>
    );
  }

  return (
    <div className={styles.dashboardPage}>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Dashboard</h1>
        <p className={styles.pageSubtitle}>Resumen de actividad del sistema</p>
      </header>

      {/* Stats Overview */}
      <section className={styles.statsOverview}>
        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <h2 className={styles.statTitle}>Pagos OXXO Pendientes</h2>
          </div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>{stats?.oxxoPaymentsPending || 0}</div>
            <div className={styles.statIcon}>
              <FaHourglassHalf />
            </div>
          </div>
          <div className={styles.statFooter}>
            <Link to="/applications?status=AWAITING_OXXO_PAYMENT" className={styles.statLink}>
              Ver pagos OXXO pendientes
            </Link>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <h2 className={styles.statTitle}>Permisos Generados Hoy</h2>
          </div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>
              {stats?.todayPermits || 0}
            </div>
            <div className={styles.statIcon}>
              <FaCheckCircle />
            </div>
          </div>
          <div className={styles.statFooter}>
            <Link to="/applications?status=PERMIT_READY" className={styles.statLink}>
              Ver permisos listos
            </Link>
          </div>
        </div>
      </section>

      {/* Status Counts */}
      <section className={styles.statusSection}>
        <h2 className={styles.sectionTitle}>Estado de Solicitudes</h2>

        {stats?.statusCounts && stats.statusCounts.length > 0 ? (
          <div className={styles.statusGrid}>
            {stats.statusCounts.map((statusItem) => (
              <div key={statusItem.status} className={styles.statusCard}>
                <div className={styles.statusIcon}>
                  {getStatusIcon(statusItem.status)}
                </div>
                <div className={styles.statusContent}>
                  <div className={styles.statusCount}>{statusItem.count}</div>
                  <div className={styles.statusName}>
                    {getStatusDisplayName(statusItem.status)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.emptyStatusMessage}>
            <FaInfoCircle className={styles.emptyStatusIcon} />
            <p>No hay datos de estado de solicitudes disponibles.</p>
          </div>
        )}
      </section>

      {/* Quick Links */}
      <section className={styles.quickLinks}>
        <h2 className={styles.sectionTitle}>Acciones Rápidas</h2>

        <div className={styles.linksGrid}>
          <Link to="/applications" className={styles.linkCard}>
            <div className={styles.linkIcon}>
              <FaChartBar />
            </div>
            <div className={styles.linkText}>Ver Todas las Solicitudes</div>
          </Link>

          <Link to="/applications?status=AWAITING_OXXO_PAYMENT" className={styles.linkCard}>
            <div className={styles.linkIcon}>
              <FaHourglassHalf />
            </div>
            <div className={styles.linkText}>Pagos OXXO Pendientes</div>
          </Link>

          <Link to="/applications?status=PERMIT_READY" className={styles.linkCard}>
            <div className={styles.linkIcon}>
              <FaCheckCircle />
            </div>
            <div className={styles.linkText}>Permisos Listos</div>
          </Link>
        </div>
      </section>
    </div>
  );
};

export default DashboardPage;
