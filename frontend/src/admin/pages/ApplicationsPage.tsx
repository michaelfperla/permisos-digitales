import { useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
import {
  FaExclamationTriangle,
  FaSearch,
  FaEye,
  FaFilter,
  FaSync,
} from 'react-icons/fa';
import { Link, useNavigate } from 'react-router-dom';

import styles from './ApplicationsPage.module.css';
import Button from '../../components/ui/Button/Button';
import MobileTable from '../../components/ui/MobileTable/MobileTable';
import ResponsiveContainer from '../../components/ui/ResponsiveContainer/ResponsiveContainer';
import useResponsive from '../../hooks/useResponsive';
import Icon from '../../shared/components/ui/Icon';
import { useToast } from '../../shared/hooks/useToast';
import adminService from '../services/adminService';

const ApplicationsPage: React.FC = () => {
  const { showToast } = useToast(); // Removed unused _showToast
  const navigate = useNavigate();
  const { isMdDown } = useResponsive();
  const [searchTerm, setSearchTerm] = useState(''); // Removed unused _searchTerm
  const [currentPage, setCurrentPage] = useState(1); // Removed unused _currentPage
  const [statusFilter, setStatusFilter] = useState(''); // Removed unused _statusFilter

  // Fetch applications with pagination
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['applications', currentPage, statusFilter],
    queryFn: () => adminService.getAllApplications(currentPage, 10, statusFilter),
    onSuccess: (data) => {
      console.debug('[ApplicationsPage] Query success, data:', data); // Changed to debug
    },
    onError: (err: Error) => {
      console.error('[ApplicationsPage] Query error:', err);
      showToast(`Error al cargar solicitudes: ${err.message}`, 'error');
    },
  });

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Get status display name
  const getStatusDisplayName = (status: string): string => {
    switch (status) {
      case 'AWAITING_OXXO_PAYMENT': return 'Pago OXXO Pendiente';
      case 'PAYMENT_RECEIVED': return 'Pago Recibido';
      case 'GENERATING_PERMIT': return 'Generando Permiso';
      case 'ERROR_GENERATING_PERMIT': return 'Error al Generar Permiso';
      case 'PERMIT_READY': return 'Permiso Listo';
      case 'COMPLETED': return 'Completado';
      case 'CANCELLED': return 'Cancelado';
      case 'EXPIRED': return 'Vencido';
      case 'PENDING_PAYMENT': return 'Pendiente de Pago';
      case 'PROOF_SUBMITTED': return 'Comprobante Enviado';
      case 'PROOF_REJECTED': return 'Comprobante Rechazado';
      default: return status;
    }
  };

  // Get status class for styling
  const getStatusClass = (status: string): string => {
    switch (status) {
      case 'AWAITING_OXXO_PAYMENT': return styles.statusPending;
      case 'PAYMENT_RECEIVED': return styles.statusVerified;
      case 'GENERATING_PERMIT': return styles.statusGenerating;
      case 'ERROR_GENERATING_PERMIT': return styles.statusError;
      case 'PERMIT_READY': return styles.statusReady;
      case 'COMPLETED': return styles.statusCompleted;
      case 'CANCELLED': return styles.statusCancelled;
      case 'EXPIRED': return styles.statusExpired;
      case 'PENDING_PAYMENT': return styles.statusPending;
      case 'PROOF_SUBMITTED': return styles.statusSubmitted;
      case 'PROOF_REJECTED': return styles.statusRejected;
      default: return '';
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
        <Icon
          IconComponent={FaExclamationTriangle}
          className={styles.errorIcon}
          size="xl"
          color="var(--color-danger)"
        />
        <h2>Error al cargar solicitudes</h2>
        <p>{error instanceof Error ? error.message : 'Error desconocido'}</p>
        <Button variant="primary" onClick={() => refetch()}>
          Intentar nuevamente
        </Button>
      </div>
    );
  }

  const applications = data?.applications || [];

  const filteredApplications = applications.filter((app) => {
    if (!app) return false;
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    try {
      return (
        (app.id && app.id.toString().includes(searchLower)) ||
        (app.nombre_completo && app.nombre_completo.toLowerCase().includes(searchLower)) ||
        ((app as any).applicant_name && (app as any).applicant_name.toLowerCase().includes(searchLower)) || // Added type assertion for temp prop
        (app.marca && app.marca.toLowerCase().includes(searchLower)) ||
        (app.linea && app.linea.toLowerCase().includes(searchLower)) ||
        (app.curp_rfc && app.curp_rfc.toLowerCase().includes(searchLower)) ||
        (app.payment_reference && app.payment_reference.toLowerCase().includes(searchLower))
      );
    } catch (filterError) { // Changed variable name
      console.error('Error filtering application:', filterError, app);
      return false;
    }
  });

  console.debug('[ApplicationsPage] Applications data:', { // Changed to debug
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
    rawData: data,
  });

  return (
    <ResponsiveContainer maxWidth="xxl">
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Solicitudes de Permisos</h1>
          <p className={styles.pageSubtitle}>
            Total: {data?.pagination?.total || applications.length || 0} solicitudes
          </p>
        </div>

        <div className={styles.searchContainer}>
          <div className={styles.searchInputWrapper}>
            <Icon IconComponent={FaSearch} className={styles.searchIcon} size="sm" />
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
              <Icon IconComponent={FaFilter} className={styles.filterIcon} size="sm" />
              <select
                className={styles.filterSelect}
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                aria-label="Filtrar por estado"
                title="Filtrar por estado"
              >
                <option value="">Todos los estados</option>
                <option value="AWAITING_OXXO_PAYMENT">Pago OXXO Pendiente</option>
                <option value="PAYMENT_RECEIVED">Pago Recibido</option>
                <option value="GENERATING_PERMIT">Generando Permiso</option>
                <option value="ERROR_GENERATING_PERMIT">Error al Generar Permiso</option>
                <option value="PERMIT_READY">Permiso Listo</option>
                <option value="COMPLETED">Completado</option>
                <option value="CANCELLED">Cancelado</option>
                <option value="EXPIRED">Vencido</option>
                <option value="PENDING_PAYMENT">Pendiente de Pago (Legacy)</option>
                <option value="PROOF_SUBMITTED">Comprobante Enviado (Legacy)</option>
                <option value="PROOF_REJECTED">Comprobante Rechazado (Legacy)</option>
              </select>
            </div>

            <Button
              variant="secondary"
              size="small"
              icon={<Icon IconComponent={FaSync} size="sm" />}
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
          {/* Mobile Card Layout */}
          {isMdDown ? (
            <div className={styles.mobileCards}>
              {filteredApplications.map((application: any) => (
                <div
                  key={application.id || Math.random()}
                  className={styles.mobileCard}
                  onClick={() => {
                    if (application.id) {
                      navigate(`/applications/${application.id}`);
                    }
                  }}
                >
                  <div className={styles.mobileCardHeader}>
                    <div className={styles.mobileCardTitle}>
                      {(application as any).applicant_name || application.nombre_completo || 'Sin nombre'}
                    </div>
                    <div className={styles.mobileCardId}>ID: {application.id || 'N/A'}</div>
                  </div>

                  <div className={styles.mobileCardContent}>
                    <div className={styles.mobileCardItem}>
                      <span className={styles.mobileCardLabel}>Vehículo:</span>
                      <span className={styles.mobileCardValue}>
                        {application.marca || 'N/A'} {application.linea || ''}{' '}
                        {application.ano_modelo ? `(${application.ano_modelo})` : ''}
                      </span>
                    </div>

                    <div className={styles.mobileCardItem}>
                      <span className={styles.mobileCardLabel}>Estado:</span>
                      {application.status ? (
                        <span className={`${styles.statusBadge} ${getStatusClass(application.status)}`}>
                          {getStatusDisplayName(application.status)}
                        </span>
                      ) : (
                        <span className={styles.mobileCardValue}>N/A</span>
                      )}
                    </div>

                    <div className={styles.mobileCardItem}>
                      <span className={styles.mobileCardLabel}>Fecha:</span>
                      <span className={styles.mobileCardValue}>
                        {application.created_at ? formatDate(application.created_at) : 'N/A'}
                      </span>
                    </div>

                    <div className={styles.mobileCardActions}>
                      {application.id ? (
                        <Button
                          variant="primary"
                          size="small"
                          to={`/applications/${application.id}`}
                          icon={<Icon IconComponent={FaEye} size="sm" />}
                          onClick={(e) => e.stopPropagation()}
                        >
                          Ver detalles
                        </Button>
                      ) : (
                        <Button
                          variant="primary"
                          size="small"
                          disabled
                          icon={<Icon IconComponent={FaEye} size="sm" />}
                        >
                          Ver detalles
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Desktop Table Layout */
            <MobileTable
            data={filteredApplications}
            columns={[
              {
                id: 'id',
                header: 'ID',
                mobileLabel: 'ID',
                cell: (application) => application.id || 'N/A',
                sortable: true,
                mobilePriority: 1,
              },
              {
                id: 'applicant',
                header: 'Solicitante',
                mobileLabel: 'Solicitante',
                cell: (application) =>
                  (application as any).applicant_name || application.nombre_completo || 'N/A', // Added type assertion
                sortable: true,
                mobilePriority: 2,
              },
              {
                id: 'vehicle',
                header: 'Vehículo',
                mobileLabel: 'Vehículo',
                cell: (application) => (
                  <>
                    {application.marca || 'N/A'} {application.linea || ''}{' '}
                    {application.ano_modelo ? `(${application.ano_modelo})` : ''}
                  </>
                ),
                sortable: false,
                mobilePriority: 3,
              },
              {
                id: 'status',
                header: 'Estado',
                mobileLabel: 'Estado',
                cell: (application) =>
                  application.status ? (
                    <span className={`${styles.statusBadge} ${getStatusClass(application.status)}`}>
                      {getStatusDisplayName(application.status)}
                    </span>
                  ) : (
                    'N/A'
                  ),
                sortable: true,
                mobilePriority: 0,
              },
              {
                id: 'created_at',
                header: 'Fecha de Creación',
                mobileLabel: 'Fecha',
                cell: (application) =>
                  application.created_at ? formatDate(application.created_at) : 'N/A',
                sortable: true,
                mobilePriority: 4,
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
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Icon IconComponent={FaEye} size="sm" />
                      </Link>
                    ) : (
                      <span className={styles.viewButtonDisabled} title="ID no disponible">
                        <Icon IconComponent={FaEye} size="sm" />
                      </span>
                    )}
                  </div>
                ),
                sortable: false,
                mobilePriority: 5,
              },
            ]}
            keyExtractor={(application) => application.id || ''}
            onRowClick={(application) => {
              if (application.id) {
                // Using window.location.href for navigation here might be intentional or an oversight
                // Consider using `navigate` from `useNavigate` for SPA navigation if appropriate
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
          )}
        </>
      )}
    </ResponsiveContainer>
  );
};

export default ApplicationsPage;