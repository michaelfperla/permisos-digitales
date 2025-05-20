import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router-dom';
import {
  FaExclamationTriangle,
  FaSearch,
  FaFilter,
  FaEye,
  FaDownload,
  FaPlus,
  FaCalendarAlt,
  FaCar,
  FaFileAlt,
  FaCreditCard,
  FaSync,
  FaChevronLeft,
  FaChevronRight
} from 'react-icons/fa';
import applicationService from '../services/applicationService';
import { useToast } from '../contexts/ToastContext';
import styles from './UserPermitsPage.module.css';
import Button from '../components/ui/Button/Button';
import MobileTable from '../components/ui/MobileTable/MobileTable';

const UserPermitsPage: React.FC = () => {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 10;

  // Update URL when filter changes
  useEffect(() => {
    if (statusFilter === 'all') {
      searchParams.delete('status');
    } else {
      searchParams.set('status', statusFilter);
    }
    setSearchParams(searchParams);
  }, [statusFilter, searchParams, setSearchParams]);

  // Fetch applications data
  const {
    data: applicationsData,
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

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Status mapping for display
  const statusDisplayMap: Record<string, string> = {
    'AWAITING_OXXO_PAYMENT': 'Pendiente de Pago OXXO',
    'PAYMENT_RECEIVED': 'Pago Recibido',
    'PROCESSING_PAYMENT': 'Procesando Pago',
    'GENERATING_PERMIT': 'Generando Permiso',
    'ERROR_GENERATING_PERMIT': 'Error al Generar',
    'PERMIT_READY': 'Permiso Listo',
    'COMPLETED': 'Completado',
    'CANCELLED': 'Cancelado',
    'EXPIRED': 'Vencido',
    'PENDING': 'Pendiente de Pago',
    'PROOF_SUBMITTED': 'Comprobante Enviado',
    'PAYMENT_VERIFIED': 'Pago Verificado',
    'PAYMENT_REJECTED': 'Comprobante Rechazado',
    'PERMIT_GENERATED': 'Permiso Generado'
  };

  // Filter applications based on status and search term
  const filteredApplications = React.useMemo(() => {
    if (!applicationsData?.applications) return [];

    return applicationsData.applications.filter((app: any) => {
      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'active' &&
            (app.status !== 'PERMIT_READY' && app.status !== 'COMPLETED')) {
          return false;
        }
        if (statusFilter === 'pending' &&
            (app.status !== 'AWAITING_OXXO_PAYMENT' && app.status !== 'PENDING')) {
          return false;
        }
        if (statusFilter === 'expired' && app.status !== 'EXPIRED') {
          return false;
        }
        if (statusFilter !== 'active' && statusFilter !== 'pending' &&
            statusFilter !== 'expired' && app.status !== statusFilter) {
          return false;
        }
      }

      // Search term filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        return (
          (app.marca && app.marca.toLowerCase().includes(searchLower)) ||
          (app.linea && app.linea.toLowerCase().includes(searchLower)) ||
          (app.ano_modelo && app.ano_modelo.toString().includes(searchLower)) ||
          (app.id && app.id.toString().includes(searchLower))
        );
      }

      return true;
    });
  }, [applicationsData, statusFilter, searchTerm]);

  // Format date for display
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Get status badge class
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'AWAITING_OXXO_PAYMENT':
      case 'PENDING':
        return styles.statusPending;
      case 'PROCESSING_PAYMENT':
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_VERIFIED':
        return styles.statusVerified;
      case 'PERMIT_READY':
      case 'COMPLETED':
      case 'PERMIT_GENERATED':
        return styles.statusCompleted;
      case 'CANCELLED':
      case 'EXPIRED':
        return styles.statusCancelled;
      case 'ERROR_GENERATING_PERMIT':
      case 'PAYMENT_REJECTED':
        return styles.statusRejected;
      default:
        return styles.statusDefault;
    }
  };

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Cargando permisos...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={styles.errorContainer}>
        <FaExclamationTriangle className={styles.errorIcon} />
        <h2>Error al cargar permisos</h2>
        <p>{error instanceof Error ? error.message : 'Error desconocido'}</p>
        <Button
          variant="primary"
          onClick={() => refetch()}
          className={styles.retryButton}
          icon={<FaSearch />}
        >
          Intentar nuevamente
        </Button>
      </div>
    );
  }

  return (
    <div className={styles.permitsPage}>
      <header className={styles.pageHeader}>
        <div className="page-header-main-content">
          <h1 className={`${styles.pageTitle} page-title-h1`}>Mis Permisos</h1>
          <h2 className={`${styles.pageSubtitle} page-subtitle-h2`}>
            Total: {applicationsData?.applications?.length || 0} permisos
          </h2>
        </div>

        <div className={styles.headerActions}>
          <div className={styles.searchContainer}>
            <div className={styles.searchInputWrapper}>
              <FaSearch className={styles.searchIcon} />
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Buscar por marca, modelo, ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <Button
            to="/permits/new"
            variant="primary"
            className={styles.newPermitButton}
            icon={<FaPlus />}
          >
            Nuevo Permiso
          </Button>
        </div>
      </header>

      {/* Filters */}
      <div className={styles.filtersContainer}>
        <div className={styles.statusFilters}>
          {/* Filter tabs using native buttons for better styling control */}
          {[
            { id: 'all', label: 'Todos' },
            { id: 'active', label: 'Activos' },
            { id: 'pending', label: 'Pendientes' },
            { id: 'expired', label: 'Vencidos' }
          ].map(tab => (
            <button
              key={tab.id}
              className={`${styles.pillFilterButton} ${statusFilter === tab.id ? styles.activeFilter : ''}`}
              onClick={() => setStatusFilter(tab.id)}
              aria-pressed={statusFilter === tab.id}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        <Button
          variant="secondary"
          size="small"
          onClick={() => refetch()}
          className={styles.refreshButton}
          icon={<FaSync />}
        >
          Actualizar
        </Button>
      </div>

      {filteredApplications.length === 0 ? (
        <div className={styles.emptyState}>
          <FaFileAlt className={styles.emptyIcon} />
          <h3 className={styles.emptyTitle}>No se encontraron permisos</h3>
          <p className={styles.emptyMessage}>
            {statusFilter !== 'all'
              ? `No tienes permisos con el estado seleccionado.`
              : searchTerm
                ? `No se encontraron permisos que coincidan con "${searchTerm}".`
                : `Aún no tienes permisos registrados. ¡Solicita tu primer permiso ahora!`}
          </p>
          <Button
            to="/permits/new"
            variant="primary"
            className={styles.emptyButton}
            icon={<FaPlus />}
          >
            Solicitar Nuevo Permiso
          </Button>
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
                cell: (permit) => permit.id || 'N/A',
                sortable: true,
                mobilePriority: 1
              },
              {
                id: 'vehicle',
                header: 'Vehículo',
                mobileLabel: 'Vehículo',
                cell: (permit) => (
                  <>
                    {permit.marca || 'N/A'} {permit.linea || ''} {permit.ano_modelo ? `(${permit.ano_modelo})` : ''}
                  </>
                ),
                sortable: false,
                mobilePriority: 2
              },
              {
                id: 'status',
                header: 'Estado',
                mobileLabel: 'Estado',
                cell: (permit) => (
                  permit.status ? (
                    <span className={`${styles.statusBadge} ${getStatusBadgeClass(permit.status)}`}>
                      {statusDisplayMap[permit.status] || permit.status}
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
                header: 'Fecha de Solicitud',
                mobileLabel: 'Fecha',
                cell: (permit) => permit.created_at ? formatDate(permit.created_at) : 'N/A',
                sortable: true,
                mobilePriority: 3
              },
              {
                id: 'expiration',
                header: 'Vencimiento',
                mobileLabel: 'Vencimiento',
                cell: (permit) => permit.fecha_vencimiento ? formatDate(permit.fecha_vencimiento) : 'N/A',
                sortable: true,
                mobilePriority: 4
              },
              {
                id: 'actions',
                header: 'Acciones',
                mobileLabel: 'Acciones',
                cell: (permit) => (
                  <div className={styles.actionButtons}>
                    <Link
                      to={`/permits/${permit.id}`}
                      className={styles.viewButton}
                      title="Ver detalles"
                      onClick={(e) => e.stopPropagation()} // Prevent row click from triggering
                    >
                      <FaEye />
                    </Link>
                    {(permit.status === 'PERMIT_READY' || permit.status === 'COMPLETED') && (
                      <a
                        href={`/api/applications/${permit.id}/download/permiso`}
                        className={styles.downloadButton}
                        title="Descargar permiso"
                        onClick={(e) => e.stopPropagation()} // Prevent row click from triggering
                      >
                        <FaDownload />
                      </a>
                    )}
                  </div>
                ),
                sortable: false,
                mobilePriority: 5,
                headerClassName: styles.actionsHeaderCell
              }
            ]}
            keyExtractor={(permit) => permit.id || ''}
            onRowClick={(permit) => {
              if (permit.id) {
                window.location.href = `/permits/${permit.id}`;
              }
            }}
            pagination={true}
            itemsPerPage={itemsPerPage}
            initialSortColumn="created_at"
            initialSortDirection="desc"
            emptyMessage="No se encontraron permisos"
            className={styles.mobileTable}
          />

          {/* Custom Pagination - Only shown when there's more than one page */}
          {Math.ceil(filteredApplications.length / itemsPerPage) > 1 && (
            <div className={styles.pagination}>
              <Button
                variant="secondary"
                size="small"
                disabled={currentPage === 1}
                onClick={() => handlePageChange(currentPage - 1)}
                className={styles.paginationButton}
                icon={<FaChevronLeft />}
              >
                <span className="hide-on-mobile">Anterior</span>
              </Button>

              <span className={styles.paginationInfo}>
                Página {currentPage} de {Math.ceil(filteredApplications.length / itemsPerPage)}
              </span>

              <Button
                variant="secondary"
                size="small"
                disabled={currentPage === Math.ceil(filteredApplications.length / itemsPerPage)}
                onClick={() => handlePageChange(currentPage + 1)}
                className={styles.paginationButton}
                icon={<FaChevronRight />}
                iconAfter
              >
                <span className="hide-on-mobile">Siguiente</span>
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default UserPermitsPage;
