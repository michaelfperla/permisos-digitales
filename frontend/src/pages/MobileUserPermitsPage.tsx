import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  FaPlus,
  FaSearch,
  FaFilter,
  FaExclamationCircle,
  FaSpinner,
  FaSync,
  FaFileAlt,
} from 'react-icons/fa';

import styles from './MobileUserPermitsPage.module.css';
import Icon from '../shared/components/ui/Icon';
import { getApplications, deleteApplication } from '../services/applicationService';
import { ApplicationStatus } from '../constants/application.constants';
import { useToast } from '../shared/hooks/useToast';
import MobilePermitCard from '../components/permits/MobilePermitCard';

const MobileUserPermitsPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Pull-to-refresh
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);

  // Fetch applications
  const {
    data: applicationsData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['applications'],
    queryFn: getApplications,
  });

  // Update URL when filter changes
  useEffect(() => {
    if (statusFilter === 'all') {
      searchParams.delete('status');
    } else {
      searchParams.set('status', statusFilter);
    }
    setSearchParams(searchParams);
  }, [statusFilter, searchParams, setSearchParams]);

  // Filter applications
  const filteredApplications = applicationsData?.applications.filter(app => {
    const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
    const matchesSearch = !searchTerm || 
      app.nombre_completo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.folio?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${app.marca} ${app.linea}`.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesStatus && matchesSearch;
  }) || [];

  // Pull to refresh handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = useCallback(async (e: React.TouchEvent) => {
    const touchEndY = e.changedTouches[0].clientY;
    const pullDistance = touchEndY - touchStartY.current;
    
    if (pullDistance > 100 && containerRef.current?.scrollTop === 0) {
      setRefreshing(true);
      await refetch();
      setRefreshing(false);
      showToast('Permisos actualizados', 'success');
    }
  }, [refetch, showToast]);


  // Status filter counts
  const statusCounts = {
    all: filteredApplications.length,
    [ApplicationStatus.AWAITING_OXXO_PAYMENT]: applicationsData?.applications.filter(
      app => app.status === ApplicationStatus.AWAITING_OXXO_PAYMENT
    ).length || 0,
    [ApplicationStatus.PERMIT_READY]: applicationsData?.applications.filter(
      app => app.status === ApplicationStatus.PERMIT_READY || app.status === ApplicationStatus.COMPLETED
    ).length || 0,
    [ApplicationStatus.PAYMENT_FAILED]: applicationsData?.applications.filter(
      app => app.status === ApplicationStatus.PAYMENT_FAILED
    ).length || 0,
  };

  if (isLoading) {
    return (
      <div className={styles.loadingState}>
        <Icon IconComponent={FaSpinner} className={styles.loadingIcon} />
        <p>Cargando tus permisos...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={styles.errorState}>
        <Icon IconComponent={FaExclamationCircle} size="3rem" />
        <h2>Error al cargar</h2>
        <p>No pudimos cargar tus permisos</p>
        <button className={styles.retryButton} onClick={() => refetch()}>
          <Icon IconComponent={FaSync} />
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={styles.mobileContainer}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull to refresh indicator */}
      {refreshing && (
        <div className={styles.refreshIndicator}>
          <Icon IconComponent={FaSync} className={styles.refreshIcon} />
        </div>
      )}

      {/* Header */}
      <div className={styles.mobileHeader}>
        <h1 className={styles.mobileTitle}>Mis Permisos</h1>
        <button
          className={styles.filterButton}
          onClick={() => setShowFilters(!showFilters)}
          aria-label="Filtros"
        >
          <Icon IconComponent={FaFilter} />
          {statusFilter !== 'all' && <span className={styles.filterBadge} />}
        </button>
      </div>

      {/* Search */}
      <div className={styles.searchContainer}>
        <Icon IconComponent={FaSearch} className={styles.searchIcon} />
        <input
          type="search"
          className={styles.searchInput}
          placeholder="Buscar por nombre, folio o vehículo..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          aria-label="Buscar permisos"
        />
      </div>

      {/* Filters */}
      {showFilters && (
        <div className={styles.filterPills}>
          <button
            className={`${styles.filterPill} ${statusFilter === 'all' ? styles.active : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            <span>Todos</span>
            <span className={styles.filterCount}>{statusCounts.all}</span>
          </button>
          <button
            className={`${styles.filterPill} ${statusFilter === ApplicationStatus.AWAITING_OXXO_PAYMENT ? styles.active : ''}`}
            onClick={() => setStatusFilter(ApplicationStatus.AWAITING_OXXO_PAYMENT)}
          >
            <span>Pago OXXO Pendiente</span>
            <span className={styles.filterCount}>
              {statusCounts[ApplicationStatus.AWAITING_OXXO_PAYMENT]}
            </span>
          </button>
          <button
            className={`${styles.filterPill} ${statusFilter === ApplicationStatus.PERMIT_READY ? styles.active : ''}`}
            onClick={() => setStatusFilter(ApplicationStatus.PERMIT_READY)}
          >
            <span>Permisos Listos</span>
            <span className={styles.filterCount}>
              {statusCounts[ApplicationStatus.PERMIT_READY]}
            </span>
          </button>
          <button
            className={`${styles.filterPill} ${statusFilter === ApplicationStatus.PAYMENT_FAILED ? styles.active : ''}`}
            onClick={() => setStatusFilter(ApplicationStatus.PAYMENT_FAILED)}
          >
            <span>Pago Rechazado</span>
            <span className={styles.filterCount}>
              {statusCounts[ApplicationStatus.PAYMENT_FAILED]}
            </span>
          </button>
        </div>
      )}

      {/* Permits List */}
      {filteredApplications.length === 0 ? (
        <div className={styles.emptyState}>
          <Icon IconComponent={FaFileAlt} size="4rem" />
          <h2>No hay permisos</h2>
          <p>
            {searchTerm 
              ? 'No encontramos permisos que coincidan con tu búsqueda'
              : 'Aún no tienes permisos registrados'}
          </p>
          {!searchTerm && (
            <button
              className={styles.newPermitCta}
              onClick={() => navigate('/permits/new')}
            >
              <Icon IconComponent={FaPlus} />
              Nuevo Permiso
            </button>
          )}
        </div>
      ) : (
        <div className={styles.permitsList}>
          {filteredApplications.map((application) => (
            <MobilePermitCard
              key={application.id}
              application={{
                ...application,
                id: String(application.id),
                ano_modelo: String(application.ano_modelo)
              }}
            />
          ))}
        </div>
      )}

      {/* Floating Action Button */}
      <button
        className={styles.fab}
        onClick={() => navigate('/permits/new')}
        aria-label="Nuevo permiso"
      >
        <Icon IconComponent={FaPlus} size="1.5rem" />
      </button>
    </div>
  );
};

export default MobileUserPermitsPage;