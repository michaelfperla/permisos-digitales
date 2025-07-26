import { useQuery } from '@tanstack/react-query';
import React, { useState, useEffect } from 'react';
import {
  FaExclamationTriangle,
  FaSearch,
  FaEye,
  FaDownload,
  FaPlus,
  FaFileAlt,
  FaSync,
} from 'react-icons/fa';
import { useSearchParams, Link } from 'react-router-dom';

import styles from './UserPermitsPage.module.css';
import Button from '../components/ui/Button/Button';
import MobileTable from '../components/ui/MobileTable/MobileTable';
import { getApplications, downloadPermit } from '../services/applicationService';
import Icon from '../shared/components/ui/Icon';
import { useToast } from '../shared/hooks/useToast';

const UserPermitsPage: React.FC = () => {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [_currentPage, setCurrentPage] = useState<number>(1);
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
    refetch,
  } = useQuery({
    queryKey: ['applications'],
    queryFn: getApplications,
  });

  // Handle applications data error
  React.useEffect(() => {
    if (isError && error) {
      showToast(`Error al cargar permisos: ${error.message}`, 'error');
    }
  }, [isError, error, showToast]);

  // Handle page change
  const _handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Status mapping for display
  const statusDisplayMap: Record<string, string> = {
    // Payment-related statuses
    AWAITING_PAYMENT: 'Pendiente de Pago',
    AWAITING_OXXO_PAYMENT: 'Pendiente de Pago (OXXO)',
    PAYMENT_PROCESSING: 'Pago en Proceso',
    PAYMENT_FAILED: 'Pago Fallido',
    PAYMENT_RECEIVED: 'Pago Recibido',

    // Permit generation statuses
    GENERATING_PERMIT: 'Generando Permiso',
    ERROR_GENERATING_PERMIT: 'Error al Generar',
    PERMIT_READY: 'Permiso Listo',

    // Final statuses
    COMPLETED: 'Completado',
    CANCELLED: 'Cancelado',
    EXPIRED: 'Expirado',
    VENCIDO: 'Vencido',

    // Renewal statuses
    RENEWAL_PENDING: 'Renovación Pendiente',
    RENEWAL_APPROVED: 'Renovación Aprobada',
    RENEWAL_REJECTED: 'Renovación Rechazada',

    // Legacy statuses (for backward compatibility)
    PENDING: 'Pendiente de Pago',
    PROOF_SUBMITTED: 'Comprobante Enviado',
    PAYMENT_VERIFIED: 'Pago Verificado',
    PAYMENT_REJECTED: 'Comprobante Rechazado',
    PERMIT_GENERATED: 'Permiso Generado',
  };

  // Filter applications based on status and search term
  const filteredApplications = React.useMemo(() => {
    if (!applicationsData?.applications) return [];

    return applicationsData.applications.filter((app: any) => {
      // Status filter
      if (statusFilter !== 'all') {
        if (
          statusFilter === 'active' &&
          app.status !== 'PERMIT_READY' &&
          app.status !== 'COMPLETED'
        ) {
          return false;
        }
        if (
          statusFilter === 'pending' &&
          app.status !== 'AWAITING_PAYMENT' &&
          app.status !== 'AWAITING_OXXO_PAYMENT' &&
          app.status !== 'PAYMENT_PROCESSING' &&
          app.status !== 'PENDING'
        ) {
          return false;
        }
        if (statusFilter === 'expired' && app.status !== 'EXPIRED' && app.status !== 'VENCIDO') {
          return false;
        }
        if (
          statusFilter !== 'active' &&
          statusFilter !== 'pending' &&
          statusFilter !== 'expired' &&
          app.status !== statusFilter
        ) {
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
      day: 'numeric',
    });
  };

  // Get status badge class
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      // Pending statuses
      case 'AWAITING_PAYMENT':
      case 'AWAITING_OXXO_PAYMENT':
      case 'PENDING': // Legacy
        return styles.statusPending;

      // Processing/Verified statuses
      case 'PAYMENT_PROCESSING':
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_VERIFIED': // Legacy
      case 'GENERATING_PERMIT':
        return styles.statusVerified;

      // Completed statuses
      case 'PERMIT_READY':
      case 'COMPLETED':
      case 'PERMIT_GENERATED': // Legacy
        return styles.statusCompleted;

      // Cancelled/Expired statuses
      case 'CANCELLED':
      case 'EXPIRED':
      case 'VENCIDO':
        return styles.statusCancelled;

      // Error/Rejected statuses
      case 'ERROR_GENERATING_PERMIT':
      case 'PAYMENT_FAILED':
      case 'PAYMENT_REJECTED': // Legacy
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
        <Icon
          IconComponent={FaExclamationTriangle}
          className={styles.errorIcon}
          size="xl"
          color="var(--color-danger)"
        />
        <h2>Error al cargar permisos</h2>
        <p>{error instanceof Error ? error.message : 'Error desconocido'}</p>
        <Button
          variant="primary"
          onClick={() => refetch()}
          icon={<Icon IconComponent={FaSearch} size="sm" />}
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
              <Icon IconComponent={FaSearch} className={styles.searchIcon} size="sm" />
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
            icon={<Icon IconComponent={FaPlus} size="sm" />}
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
            { id: 'expired', label: 'Vencidos' },
          ].map((tab) => (
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
          icon={<Icon IconComponent={FaSync} size="sm" />}
        >
          Actualizar
        </Button>
      </div>

      {filteredApplications.length === 0 ? (
        <div className={styles.emptyState}>
          <Icon IconComponent={FaFileAlt} className={styles.emptyIcon} size="xl" />
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
            icon={<Icon IconComponent={FaPlus} size="sm" />}
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
                mobilePriority: 1,
              },
              {
                id: 'vehicle',
                header: 'Vehículo',
                mobileLabel: 'Vehículo',
                cell: (permit) => (
                  <>
                    {permit.marca || 'N/A'} {permit.linea || ''}{' '}
                    {permit.ano_modelo ? `(${permit.ano_modelo})` : ''}
                  </>
                ),
                sortable: false,
                mobilePriority: 2,
              },
              {
                id: 'status',
                header: 'Estado',
                mobileLabel: 'Estado',
                cell: (permit) =>
                  permit.status ? (
                    <span className={`${styles.statusBadge} ${getStatusBadgeClass(permit.status)}`}>
                      {statusDisplayMap[permit.status] || permit.status}
                    </span>
                  ) : (
                    'N/A'
                  ),
                sortable: true,
                mobilePriority: 0, // Show status first in mobile view
              },
              {
                id: 'created_at',
                header: 'Fecha de Solicitud',
                mobileLabel: 'Fecha',
                cell: (permit) => (permit.created_at ? formatDate(permit.created_at) : 'N/A'),
                sortable: true,
                mobilePriority: 3,
              },
              {
                id: 'expiration',
                header: 'Vencimiento',
                mobileLabel: 'Vencimiento',
                cell: (permit) =>
                  permit.fecha_vencimiento ? formatDate(permit.fecha_vencimiento) : 'N/A',
                sortable: true,
                mobilePriority: 4,
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
                      <Icon IconComponent={FaEye} size="sm" />
                    </Link>
                    {(permit.status === 'PERMIT_READY' || permit.status === 'COMPLETED') && (
                      <button
                        className={styles.downloadButton}
                        title="Descargar todos los documentos"
                        onClick={async (e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          
                          try {
                            const types: Array<'permiso' | 'certificado' | 'placas' | 'recomendaciones'> = ['permiso', 'certificado', 'placas', 'recomendaciones'];
                            showToast('Descargando documentos...', 'info');
                            
                            // Get folio for consistent naming
                            const folio = permit.folio;
                            
                            for (const [index, type] of types.entries()) {
                              try {
                                const secureUrl = await downloadPermit(String(permit.id), type);
                                const filename = folio ? `${type}_${folio}.pdf` : `${type}_${permit.id}.pdf`;
                                
                                try {
                                  // Fetch the file to avoid CORS issues
                                  const response = await fetch(secureUrl);
                                  if (!response.ok) {
                                    throw new Error(`HTTP error! status: ${response.status}`);
                                  }
                                  
                                  const blob = await response.blob();
                                  const blobUrl = window.URL.createObjectURL(blob);
                                  
                                  // Create temporary anchor with blob URL
                                  const link = document.createElement('a');
                                  link.href = blobUrl;
                                  link.download = filename;
                                  link.style.display = 'none';
                                  document.body.appendChild(link);
                                  link.click();
                                  document.body.removeChild(link);
                                  
                                  // Clean up the blob URL
                                  setTimeout(() => window.URL.revokeObjectURL(blobUrl), 100);
                                } catch (fetchError) {
                                  // Fallback to direct link if fetch fails
                                  console.warn('Fetch failed, trying direct download', fetchError);
                                  const link = document.createElement('a');
                                  link.href = secureUrl;
                                  link.download = filename;
                                  link.target = '_blank';
                                  link.style.display = 'none';
                                  document.body.appendChild(link);
                                  link.click();
                                  document.body.removeChild(link);
                                }
                                
                                // Small delay between downloads to avoid issues
                                if (index < types.length - 1) {
                                  await new Promise(resolve => setTimeout(resolve, 500));
                                }
                              } catch (error) {
                                console.error(`Error downloading ${type}:`, error);
                                // Continue with other files
                              }
                            }
                            
                            showToast('Documentos descargados', 'success');
                          } catch (error) {
                            showToast('Error al descargar documentos.', 'error');
                          }
                        }}
                      >
                        <Icon IconComponent={FaDownload} size="sm" />
                      </button>
                    )}
                  </div>
                ),
                sortable: false,
              },
            ]}
            keyExtractor={(permit) => String(permit.id) || ''}
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
        </>
      )}
    </div>
  );
};

export default UserPermitsPage;
