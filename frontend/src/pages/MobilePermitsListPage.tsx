import { useQuery } from '@tanstack/react-query';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaPlus,
  FaCar,
  FaCalendarAlt,
  FaClock,
  FaTag,
  FaEye,
  FaSync,
  FaCreditCard,
  FaExclamationTriangle,
  FaArchive,
  FaSpinner,
  FaFolderOpen,
  FaChevronRight,
  FaFilter,
  FaSearch,
} from 'react-icons/fa';

import styles from './MobilePermitsListPage.module.css';
import Icon from '../shared/components/ui/Icon';
import { getApplications, deleteApplication } from '../services/applicationService';
import { useUserAuth as useAuth } from '../shared/hooks/useAuth';
import { PermitCardProps } from '../types/permisos';
import useResponsive from '../hooks/useResponsive';
import MobilePermitCard from '../components/permits/MobilePermitCard';
import { ApplicationStatus } from '../constants/application.constants';

const MobilePermitsListPage: React.FC = () => {
  const navigate = useNavigate();
  const { isMdDown } = useResponsive();
  const [permitCards, setPermitCards] = useState<PermitCardProps[]>([]);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const touchStartY = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch data
  const {
    data: permitsData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['applications'],
    queryFn: getApplications,
  });

  // Process data
  useEffect(() => {
    if (permitsData?.applications) {
      const transformed = transformToPermitCards(permitsData.applications);
      setPermitCards(transformed);
    }
  }, [permitsData]);

  // Pull to refresh
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback(async (e: React.TouchEvent) => {
    const touchEndY = e.changedTouches[0].clientY;
    const pullDistance = touchEndY - touchStartY.current;
    
    if (pullDistance > 100 && containerRef.current?.scrollTop === 0) {
      setRefreshing(true);
      await refetch();
      setRefreshing(false);
      
      // Haptic feedback if available
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
    }
  }, [refetch]);

  // Transform data (same logic as original)
  const transformToPermitCards = (permits: any[]): PermitCardProps[] => {
    return permits.map((permit) => {
      let statusType: 'active' | 'expiring_soon' | 'needs_attention' | 'archived' = 'active';
      let statusText = 'Activo';
      const actualStatus = permit.status as ApplicationStatus;

      const formatDate = (dateString?: string) => {
        if (!dateString) return 'No disponible';
        const date = new Date(dateString);
        return date.toLocaleDateString('es-MX', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
      };

      const creationDate = formatDate(permit.created_at);
      const expirationDate = formatDate(permit.fecha_vencimiento);

      const primaryCta = {
        text: 'Ver Detalles',
        link: `/permits/${permit.id}`,
        icon: 'FaEye',
      };

      const permitStatus = permit.status;

      // Status logic (simplified for brevity)
      if (permitStatus === 'AWAITING_OXXO_PAYMENT') {
        statusType = 'needs_attention';
        statusText = 'Pago OXXO Pendiente';
        primaryCta.icon = 'FaCreditCard';
      } else if (permitStatus === 'PERMIT_READY' || permitStatus === 'COMPLETED') {
        if (permit.days_remaining <= 30 && permit.days_remaining > 0) {
          statusType = 'expiring_soon';
          statusText = `Vence en ${permit.days_remaining} días`;
        }
      } else if (permitStatus === 'EXPIRED') {
        statusType = 'archived';
        statusText = 'Vencido';
      }

      return {
        id: permit.id,
        vehicleInfo: `${permit.marca} ${permit.linea} ${permit.ano_modelo}`,
        vehicleMake: permit.marca,
        vehicleModel: permit.linea,
        vehicleYear: permit.ano_modelo,
        statusType,
        statusText,
        creationDate,
        expirationDate,
        primaryCta,
        rawStatus: permitStatus,
      };
    });
  };

  // Filter permits
  const filteredPermits = permitCards.filter((permit) => {
    const matchesFilter = activeFilter === 'all' || permit.statusType === activeFilter;
    const matchesSearch = searchQuery === '' || 
      permit.vehicleInfo.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getStatusColor = (statusType: string) => {
    switch (statusType) {
      case 'active': return 'var(--color-success)';
      case 'expiring_soon': return 'var(--color-warning)';
      case 'needs_attention': return 'var(--color-danger)';
      case 'archived': return 'var(--color-neutral-600)';
      default: return 'var(--color-neutral-600)';
    }
  };

  const filterOptions = [
    { id: 'all', label: 'Todos', count: permitCards.length },
    { id: 'active', label: 'Activos', count: permitCards.filter(p => p.statusType === 'active').length },
    { id: 'expiring_soon', label: 'Por Vencer', count: permitCards.filter(p => p.statusType === 'expiring_soon').length },
    { id: 'needs_attention', label: 'Atención', count: permitCards.filter(p => p.statusType === 'needs_attention').length },
    { id: 'archived', label: 'Archivados', count: permitCards.filter(p => p.statusType === 'archived').length },
  ];

  // If not mobile, render the standard page
  if (!isMdDown) {
    return null; // Let the router handle showing the standard page
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
          onClick={() => setIsFilterOpen(!isFilterOpen)}
          aria-label="Filtros"
        >
          <Icon IconComponent={FaFilter} />
          {activeFilter !== 'all' && <span className={styles.filterBadge} />}
        </button>
      </div>

      {/* Search Bar */}
      <div className={styles.searchContainer}>
        <Icon IconComponent={FaSearch} className={styles.searchIcon} />
        <input
          type="search"
          placeholder="Buscar por vehículo..."
          className={styles.searchInput}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Filter Pills */}
      {isFilterOpen && (
        <div className={styles.filterPills}>
          {filterOptions.map((option) => (
            <button
              key={option.id}
              className={`${styles.filterPill} ${activeFilter === option.id ? styles.active : ''}`}
              onClick={() => {
                setActiveFilter(option.id);
                setIsFilterOpen(false);
              }}
            >
              <span>{option.label}</span>
              <span className={styles.filterCount}>{option.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className={styles.loadingState}>
          <Icon IconComponent={FaSpinner} className={styles.loadingIcon} />
          <p>Cargando permisos...</p>
        </div>
      ) : isError ? (
        <div className={styles.errorState}>
          <Icon IconComponent={FaExclamationTriangle} size="3rem" />
          <h2>Error al cargar</h2>
          <p>No pudimos cargar tus permisos</p>
          <button className={styles.retryButton} onClick={() => refetch()}>
            Reintentar
          </button>
        </div>
      ) : filteredPermits.length === 0 ? (
        <div className={styles.emptyState}>
          <Icon IconComponent={FaFolderOpen} size="4rem" />
          <h2>Sin resultados</h2>
          <p>
            {searchQuery
              ? 'No hay permisos que coincidan con tu búsqueda'
              : activeFilter === 'all'
              ? 'No tienes permisos registrados'
              : `No hay permisos en "${filterOptions.find(f => f.id === activeFilter)?.label}"`}
          </p>
          {permitCards.length === 0 && (
            <button
              className={styles.newPermitCta}
              onClick={() => navigate('/permits/new')}
            >
              <Icon IconComponent={FaPlus} />
              Solicitar Permiso
            </button>
          )}
        </div>
      ) : (
        <div className={styles.permitsList}>
          {filteredPermits.map((permit) => (
            <MobilePermitCard
              key={permit.id}
              application={{
                id: String(permit.id),
                marca: permit.vehicleMake,
                linea: permit.vehicleModel,
                ano_modelo: String(permit.vehicleYear),
                nombre_completo: '',
                status: permit.rawStatus,
                created_at: permit.creationDate || new Date().toISOString(),
                expires_at: permit.expirationDate,
                importe: undefined,
                folio: undefined,
                placas: undefined
              }}
            />
          ))}
        </div>
      )}

      {/* Floating Action Button */}
      <button
        className={styles.fab}
        onClick={() => navigate('/permits/new')}
        aria-label="Solicitar nuevo permiso"
      >
        <Icon IconComponent={FaPlus} size="1.5rem" />
      </button>
    </div>
  );
};

export default MobilePermitsListPage;