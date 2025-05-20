import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  FaExclamationTriangle,
  FaSearch,
  FaEye,
  FaFilter,
  FaCalendarAlt,
  FaSync
} from 'react-icons/fa';
import adminService from '../services/adminService';
import { useToast } from '../contexts/ToastContext';
import Button from '../../components/ui/Button/Button';
import MobileTable from '../../components/ui/MobileTable/MobileTable';
import styles from './ApplicationsPage.module.css';

const ApplicationsPage: React.FC = () => {
  const { showToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  // Fetch applications with pagination
  const {
    data,
    isLoading,
    isError,
    error,
    refetch
  } = useQuery({
    queryKey: ['applications', currentPage, statusFilter],
    queryFn: () => adminService.getAllApplications(currentPage, 10, statusFilter),
    onSuccess: (data) => {
      console.log('[ApplicationsPage] Query success, data:', data);
    },
    onError: (err: Error) => {
      console.error('[ApplicationsPage] Query error:', err);
      showToast(`Error al cargar solicitudes: ${err.message}`, 'error');
    }
  });

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  // Get status display name
  const getStatusDisplayName = (status: string): string => {
    switch (status) {
      // New payment flow statuses
      case 'AWAITING_OXXO_PAYMENT':
        return 'Pago OXXO Pendiente';
      case 'PAYMENT_RECEIVED':
        return 'Pago Recibido';

      // Permit generation statuses
      case 'GENERATING_PERMIT':
        return 'Generando Permiso';
      case 'ERROR_GENERATING_PERMIT':
        return 'Error al Generar Permiso';
      case 'PERMIT_READY':
        return 'Permiso Listo';

      // Completion statuses
      case 'COMPLETED':
        return 'Completado';
      case 'CANCELLED':
        return 'Cancelado';
      case 'EXPIRED':
        return 'Vencido';

      // Legacy statuses - kept for backward compatibility
      case 'PENDING_PAYMENT':
        return 'Pendiente de Pago';
      case 'PROOF_SUBMITTED':
        return 'Comprobante Enviado';
      case 'PROOF_REJECTED':
        return 'Comprobante Rechazado';

      default:
        return status;
    }
  };

  // Get status class for styling
  const getStatusClass = (status: string): string => {
    switch (status) {
      // New payment flow statuses
      case 'AWAITING_OXXO_PAYMENT':
        return styles.statusPending;
      case 'PAYMENT_RECEIVED':
        return styles.statusVerified;

      // Permit generation statuses
      case 'GENERATING_PERMIT':
        return styles.statusGenerating;
      case 'ERROR_GENERATING_PERMIT':
        return styles.statusError;
      case 'PERMIT_READY':
        return styles.statusReady;

      // Completion statuses
      case 'COMPLETED':
        return styles.statusCompleted;
      case 'CANCELLED':
        return styles.statusCancelled;
      case 'EXPIRED':
        return styles.statusExpired;

      // Legacy statuses - kept for backward compatibility
      case 'PENDING_PAYMENT':
        return styles.statusPending;
      case 'PROOF_SUBMITTED':
        return styles.statusSubmitted;
      case 'PROOF_REJECTED':
        return styles.statusRejected;

      default:
        return '';
    }
  };

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Cargando solicitudes...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={styles.errorContainer}>
        <FaExclamationTriangle className={styles.errorIcon} />
        <h2>Error al cargar solicitudes</h2>
        <p>{error instanceof Error ? error.message : 'Error desconocido'}</p>
        <Button
          variant="primary"
          onClick={() => refetch()}
        >
          Intentar nuevamente
        </Button>
      </div>
    );
  }

  // Get applications from data
  const applications = data?.applications || [];

  // Filter applications based on search term
  const filteredApplications = applications.filter(app => {
    if (!app) return false; // Skip null/undefined items
    if (!searchTerm) return true;

    const searchLower = searchTerm.toLowerCase();
    try {
      return (
        (app.id && app.id.toString().includes(searchLower)) ||
        (app.nombre_completo && app.nombre_completo.toLowerCase().includes(searchLower)) ||
        (app.applicant_name && app.applicant_name.toLowerCase().includes(searchLower)) ||
        (app.marca && app.marca.toLowerCase().includes(searchLower)) ||
        (app.linea && app.linea.toLowerCase().includes(searchLower)) ||
        (app.curp_rfc && app.curp_rfc.toLowerCase().includes(searchLower)) ||
        (app.payment_reference && app.payment_reference.toLowerCase().includes(searchLower))
      );
    } catch (error) {
      console.error('Error filtering application:', error, app);
      return false;
    }
  });

  // Debug log
  console.log('[ApplicationsPage] Applications data:', {
    dataExists: !!data,
    dataApplicationsExists: !!data?.applications,
    dataApplicationsLength: data?.applications?.length || 0,
    dataPaginationExists: !!data?.pagination,
    dataPaginationTotal: data?.pagination?.total || 0,
    dataPaginationTotalPages: data?.pagination?.totalPages || 0,
    extractedApplicationsLength: applications.length,
    filteredLength: filteredApplications.length,
    firstItem: filteredApplications[0],
    statusFilter: statusFilter,
    currentPage: currentPage,
    rawData: data
  });

  return (
    <div className={styles.applicationsPage}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Solicitudes de Permisos</h1>
          <p className={styles.pageSubtitle}>
            Total: {data?.pagination?.total || applications.length || 0} solicitudes
          </p>
        </div>

        <div className={styles.searchContainer}>
          <div className={styles.searchInputWrapper}>
            <FaSearch className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Buscar por nombre, ID, vehículo..."
              className={styles.searchInput}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className={styles.filterContainer}>
            <div className={styles.filterWrapper}>
              <FaFilter className={styles.filterIcon} />
              <select
                className={styles.filterSelect}
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1); // Reset to first page when filter changes
                }}
                aria-label="Filtrar por estado"
                title="Filtrar por estado"
              >
                <option value="">Todos los estados</option>

                {/* New payment flow statuses */}
                <option value="AWAITING_OXXO_PAYMENT">Pago OXXO Pendiente</option>
                <option value="PAYMENT_RECEIVED">Pago Recibido</option>

                {/* Permit generation statuses */}
                <option value="GENERATING_PERMIT">Generando Permiso</option>
                <option value="ERROR_GENERATING_PERMIT">Error al Generar Permiso</option>
                <option value="PERMIT_READY">Permiso Listo</option>

                {/* Completion statuses */}
                <option value="COMPLETED">Completado</option>
                <option value="CANCELLED">Cancelado</option>
                <option value="EXPIRED">Vencido</option>

                {/* Legacy statuses - kept for backward compatibility */}
                <option value="PENDING_PAYMENT">Pendiente de Pago (Legacy)</option>
                <option value="PROOF_SUBMITTED">Comprobante Enviado (Legacy)</option>
                <option value="PROOF_REJECTED">Comprobante Rechazado (Legacy)</option>
              </select>
            </div>

            <Button
              variant="secondary"
              size="small"
              icon={<FaSync />}
              onClick={() => refetch()}
            >
              Actualizar
            </Button>
          </div>
        </div>
      </header>

      {applications.length === 0 || filteredApplications.length === 0 ? (
        <div className={styles.emptyState}>
          <h2>No se encontraron solicitudes</h2>
          <p>Intente con otros criterios de búsqueda.</p>
        </div>
      ) : (
        <>
          <MobileTable
            data={filteredApplications}
            columns={[
              {
                id: 'id',
                header: 'ID',
                mobileLabel: 'ID',
                cell: (application) => application.id || 'N/A',
                sortable: true,
                mobilePriority: 1
              },
              {
                id: 'applicant',
                header: 'Solicitante',
                mobileLabel: 'Solicitante',
                cell: (application) => application.applicant_name || application.nombre_completo || 'N/A',
                sortable: true,
                mobilePriority: 2
              },
              {
                id: 'vehicle',
                header: 'Vehículo',
                mobileLabel: 'Vehículo',
                cell: (application) => (
                  <>
                    {application.marca || 'N/A'} {application.linea || ''} {application.ano_modelo ? `(${application.ano_modelo})` : ''}
                  </>
                ),
                sortable: false,
                mobilePriority: 3
              },
              {
                id: 'status',
                header: 'Estado',
                mobileLabel: 'Estado',
                cell: (application) => (
                  application.status ? (
                    <span className={`${styles.statusBadge} ${getStatusClass(application.status)}`}>
                      {getStatusDisplayName(application.status)}
                    </span>
                  ) : (
                    'N/A'
                  )
                ),
                sortable: true,
                mobilePriority: 0 // Show status first in mobile view
              },
              {
                id: 'created_at',
                header: 'Fecha de Creación',
                mobileLabel: 'Fecha',
                cell: (application) => application.created_at ? formatDate(application.created_at) : 'N/A',
                sortable: true,
                mobilePriority: 4
              },
              {
                id: 'actions',
                header: 'Acciones',
                mobileLabel: 'Acciones',
                cell: (application) => (
                  <div className={styles.actionButtons}>
                    {application.id ? (
                      <Link
                        to={`/applications/${application.id}`}
                        className={styles.viewButton}
                        title="Ver detalles"
                        onClick={(e) => e.stopPropagation()} // Prevent row click from triggering
                      >
                        <FaEye />
                      </Link>
                    ) : (
                      <span className={styles.viewButtonDisabled} title="ID no disponible">
                        <FaEye />
                      </span>
                    )}
                  </div>
                ),
                sortable: false,
                mobilePriority: 5
              }
            ]}
            keyExtractor={(application) => application.id || ''}
            onRowClick={(application) => {
              if (application.id) {
                window.location.href = `/applications/${application.id}`;
              }
            }}
            pagination={true}
            itemsPerPage={10}
            initialSortColumn="created_at"
            initialSortDirection="desc"
            emptyMessage="No se encontraron solicitudes"
            className={styles.mobileTable}
          />

          {/* Pagination */}
          {data?.pagination && data.pagination.totalPages > 1 && (
            <div className={styles.pagination}>
              <Button
                variant="secondary"
                size="small"
                disabled={currentPage === 1}
                onClick={() => handlePageChange(currentPage - 1)}
                className={styles.paginationButton}
              >
                Anterior
              </Button>

              <span className={styles.paginationInfo}>
                Página {currentPage} de {data.pagination.totalPages}
              </span>

              <Button
                variant="secondary"
                size="small"
                disabled={currentPage === data.pagination.totalPages}
                onClick={() => handlePageChange(currentPage + 1)}
                className={styles.paginationButton}
              >
                Siguiente
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ApplicationsPage;
