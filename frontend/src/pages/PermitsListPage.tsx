import { useQuery } from '@tanstack/react-query';
import React, { useState, useEffect } from 'react';
import {
  FaPlus,
  FaCar,
  FaCalendarAlt,
  FaClock,
  FaTag,
  FaEye,
  FaEdit,
  FaCreditCard,
  FaExclamationTriangle,
  FaArchive,
  FaSpinner,
  FaFolderOpen,
  FaSync,
} from 'react-icons/fa';

import styles from './PermitsListPage.module.css';
import Button from '../components/ui/Button/Button';
import ResponsiveContainer from '../components/ui/ResponsiveContainer/ResponsiveContainer';
import applicationService from '../services/applicationService';
import { useUserAuth as useAuth } from '../shared/hooks/useAuth';
import { PermitCardProps } from '../types/permisos';

/**
 * PermitsListPage - Dedicated page for listing all user permits
 *
 * Displays a comprehensive list of all user permits with filtering options.
 * Separate from the dashboard to provide more detailed permit management.
 */
const PermitsListPage: React.FC = () => {
  // State for permits data
  const [permitCards, setPermitCards] = useState<PermitCardProps[]>([]);
  const [activeFilter, setActiveFilter] = useState<
    'all' | 'active' | 'expiring_soon' | 'needs_attention' | 'archived'
  >('all');

  // Get current user from auth context
  const { user: _currentUserProfile } = useAuth(); // Not directly used in this version, but good for context

  // Fetch applications data using React Query
  const {
    data: permitsData,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['applications'],
    queryFn: applicationService.getApplications,
  });

  // Process data when it's available
  useEffect(() => {
    if (permitsData && !isLoading) {
      if (permitsData.applications && permitsData.applications.length > 0) {
        const transformedPermitCards = transformToPermitCards(permitsData.applications);
        setPermitCards(transformedPermitCards);
      } else {
        setPermitCards([]);
      }
    }

    if (isError && error) {
      console.error('Error fetching applications:', error);
    }
  }, [permitsData, isLoading, isError, error]);

  // Transform API data to permit cards
  const transformToPermitCards = (permits: any[]): PermitCardProps[] => {
    return permits.map((permit) => {
      let statusType: 'active' | 'expiring_soon' | 'needs_attention' | 'archived' = 'active';
      let statusText = 'Activo';

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
      let secondaryCta = null;

      const permitStatus = permit.status;

      if (permitStatus === 'DRAFT') {
        statusType = 'needs_attention';
        statusText = 'Borrador';
      } else if (permitStatus === 'SUBMITTED') {
        statusType = 'needs_attention';
        statusText = 'Enviado';
      } else if (permitStatus === 'AWAITING_PAYMENT') {
        statusType = 'needs_attention';
        statusText = 'Pago Pendiente';
      } else if (permitStatus === 'AWAITING_OXXO_PAYMENT') {
        statusType = 'needs_attention';
        statusText = 'Pago OXXO Pendiente';
      } else if (permitStatus === 'PAYMENT_VERIFICATION') {
        statusType = 'needs_attention';
        statusText = 'Verificando Pago';
      } else if (permitStatus === 'PROCESSING') {
        statusType = 'needs_attention';
        statusText = 'En Procesamiento';
      } else if (permitStatus === 'PERMIT_READY' || permitStatus === 'COMPLETED') {
        if (
          permit.days_remaining !== undefined &&
          permit.days_remaining <= 30 &&
          permit.days_remaining > 0
        ) {
          statusType = 'expiring_soon';
          statusText = `Vence en ${permit.days_remaining} días`;
        } else {
          statusType = 'active';
          statusText = 'Activo';
        }
      } else if (permitStatus === 'EXPIRED') {
        statusType = 'archived';
        statusText = 'Vencido';
      } else if (permitStatus === 'REJECTED') {
        statusType = 'archived';
        statusText = 'Rechazado';
      } else if (permitStatus === 'CANCELLED') {
        statusType = 'archived';
        statusText = 'Cancelado';
      }

      if (permitStatus === 'AWAITING_OXXO_PAYMENT') {
        primaryCta.text = 'Ver Instrucciones';
        primaryCta.link = `/permits/${permit.id}`;
        primaryCta.icon = 'FaCreditCard';
      } else if (permitStatus === 'PERMIT_READY' || permitStatus === 'COMPLETED') {
        // Check if permit is eligible for renewal based on fecha_vencimiento
        const isEligibleForRenewal =
          permit.fecha_vencimiento &&
          (() => {
            const expiryDate = new Date(permit.fecha_vencimiento);
            const today = new Date();

            // Set both dates to start of day for accurate comparison
            expiryDate.setHours(0, 0, 0, 0);
            today.setHours(0, 0, 0, 0);

            const diffTime = expiryDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            // Eligible if within 7 days before expiration or up to 15 days after expiration
            return diffDays <= 7 && diffDays >= -15;
          })();

        if (isEligibleForRenewal) {
          primaryCta.text = 'Renovar Permiso';
          primaryCta.link = `/permits/${permit.id}/renew`;
          primaryCta.icon = 'FaSync';
          secondaryCta = {
            text: 'Ver Detalles',
            link: `/permits/${permit.id}`,
            icon: 'FaEye',
          };
        }
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
        secondaryCta,
        permitDocumentPath: permit.permit_file_path,
        receiptDocumentPath: permit.recibo_file_path,
        certificateDocumentPath: permit.certificado_file_path,
        licensePlatesDocumentPath: permit.placas_file_path,
        rawStatus: permitStatus,
      };
    });
  };

  const filteredPermits = permitCards.filter((permit) => {
    if (activeFilter === 'all') return true;
    return permit.statusType === activeFilter;
  });

  const getStatusBadgeIcon = (statusType: PermitCardProps['statusType']) => {
    switch (statusType) {
      case 'active':
        return <FaTag aria-hidden="true" />;
      case 'expiring_soon':
        return <FaClock aria-hidden="true" />;
      case 'needs_attention':
        return <FaExclamationTriangle aria-hidden="true" />;
      case 'archived':
        return <FaArchive aria-hidden="true" />;
      default:
        return <FaTag aria-hidden="true" />;
    }
  };

  const getCtaIcon = (iconName: string) => {
    switch (iconName) {
      case 'FaEye':
        return <FaEye className={styles.ctaIcon} aria-hidden="true" />;
      case 'FaEdit':
        return <FaEdit className={styles.ctaIcon} aria-hidden="true" />;
      case 'FaSync':
        return <FaSync className={styles.ctaIcon} aria-hidden="true" />;
      case 'FaCreditCard':
        return <FaCreditCard className={styles.ctaIcon} aria-hidden="true" />;
      default:
        return <FaEye className={styles.ctaIcon} aria-hidden="true" />;
    }
  };

  const renderCta = (cta: any, isSecondary = false) => {
    if (!cta) return null;
    return (
      <Button
        to={cta.link}
        variant={isSecondary ? 'secondary' : 'primary'}
        className={`${styles.ctaButton} ${isSecondary ? styles.secondaryCta : styles.primaryCta} touch-target`}
        icon={cta.icon ? getCtaIcon(cta.icon) : undefined}
        size="small"
      >
        {cta.text}
      </Button>
    );
  };

  const renderPermitCard = (permit: PermitCardProps) => {
    const statusBadgeClass = `${styles.statusBadge} ${styles[`status${permit.statusType.charAt(0).toUpperCase() + permit.statusType.slice(1)}`]}`;

    return (
      <div className={styles.permitCard}>
        <div className={styles.cardHeader}>
          <div className={styles.vehicleInfo}>
            <FaCar className={styles.vehicleIcon} aria-hidden="true" />
            <div className={styles.vehicleDetails}>
              <span className={styles.vehicleMakeModel}>
                {permit.vehicleMake} {permit.vehicleModel}
              </span>
              <span className={styles.vehicleYear}>{permit.vehicleYear}</span>
            </div>
          </div>
          <div className={statusBadgeClass}>
            {getStatusBadgeIcon(permit.statusType)}
            <span>{permit.statusText}</span>
          </div>
        </div>

        <div className={styles.cardBody}>
          <div className={styles.detailItem}>
            <FaCalendarAlt className={styles.detailIcon} aria-hidden="true" />
            <span className={styles.detailLabel}>Creado:</span>
            <span className={styles.detailValue}>{permit.creationDate}</span>
          </div>
          {permit.expirationDate && permit.expirationDate !== 'No disponible' && (
            <div className={styles.detailItem}>
              <FaClock className={styles.detailIcon} aria-hidden="true" />
              <span className={styles.detailLabel}>Vence:</span>
              <span className={styles.detailValue}>{permit.expirationDate}</span>
            </div>
          )}
        </div>

        <div className={styles.cardFooter}>
          {renderCta(permit.primaryCta)}
          {permit.secondaryCta && renderCta(permit.secondaryCta, true)}
        </div>
      </div>
    );
  };

  const filterOptions = [
    { id: 'all', label: 'Todos' },
    { id: 'active', label: 'Activos', icon: <FaTag /> },
    { id: 'expiring_soon', label: 'Por Vencer', icon: <FaClock /> },
    { id: 'needs_attention', label: 'Requieren Atención', icon: <FaExclamationTriangle /> },
    { id: 'archived', label: 'Archivados', icon: <FaArchive /> },
  ] as const;

  return (
    <ResponsiveContainer
      type="fixed"
      maxWidth="xxl"
      withPadding={true}
      className={styles.permitsListContainer}
    >
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Mis Solicitudes de Permiso</h1>
        <Button
          to="/permits/new"
          variant="primary"
          className={`${styles.newPermitButton} touch-target`}
          icon={<FaPlus aria-hidden="true" />}
        >
          Solicitar Nuevo Permiso
        </Button>
      </div>

      <div className={styles.filterContainer}>
        <div className={styles.filterButtonsWrapper}>
          {filterOptions.map((option) => (
            <button
              key={option.id}
              className={`${styles.filterButton} ${activeFilter === option.id ? styles.active : ''} touch-target`}
              onClick={() => setActiveFilter(option.id as typeof activeFilter)}
              aria-pressed={activeFilter === option.id}
            >
              {option.icon && (
                <span className={styles.filterButtonIcon} aria-hidden="true">
                  {option.icon}
                </span>
              )}
              <span className={styles.filterButtonText}>{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className={styles.stateContainer}>
          <FaSpinner className={`${styles.stateIcon} ${styles.loadingIcon}`} aria-hidden="true" />
          <p className={styles.stateText}>Cargando tus permisos...</p>
          <p className={styles.stateSubText}>Por favor, espera un momento.</p>
        </div>
      ) : isError ? (
        <div className={styles.stateContainer}>
          <FaExclamationTriangle
            className={`${styles.stateIcon} ${styles.errorIcon}`}
            aria-hidden="true"
          />
          <p className={styles.stateText}>Error al cargar permisos</p>
          <p className={styles.stateSubText}>
            Lo sentimos, ha ocurrido un error. Intenta recargar la página o contacta a soporte.
          </p>
        </div>
      ) : (
        <div className={styles.permitsGrid}>
          {filteredPermits.length > 0 ? (
            filteredPermits.map((permit) => renderPermitCard(permit))
          ) : (
            <div className={`${styles.stateContainer} ${styles.emptyState}`}>
              <FaFolderOpen
                className={`${styles.stateIcon} ${styles.emptyIcon}`}
                aria-hidden="true"
              />
              <p className={styles.stateText}>
                {activeFilter === 'all'
                  ? 'No tienes permisos registrados.'
                  : `No hay permisos en "${filterOptions.find((f) => f.id === activeFilter)?.label || activeFilter}".`}
              </p>
              <p className={styles.stateSubText}>
                {activeFilter === 'all'
                  ? 'Cuando solicites un permiso, aparecerá aquí.'
                  : 'Prueba con otro filtro o solicita un nuevo permiso.'}
              </p>
            </div>
          )}
        </div>
      )}
    </ResponsiveContainer>
  );
};

export default PermitsListPage;
