import React, { useState } from 'react';
import {
  FaDownload,
  FaArrowRight,
  FaEdit,
  FaPlus,
  FaFileAlt,
  FaEye,
  FaExternalLinkAlt,
  FaCreditCard
} from 'react-icons/fa';
import styles from './PermitsOverview.module.css';
import { PermitCardProps, CtaProps } from '../../types/permisos';
import Button from '../../components/ui/Button/Button';

/**
 * Props for the PermitsOverview component
 */
interface PermitsOverviewProps {
  permits: PermitCardProps[];
}

/**
 * PermitsOverview Component
 *
 * Displays a list of user permits as 'Zen Cards' with basic filtering.
 */
const PermitsOverview: React.FC<PermitsOverviewProps> = ({ permits }) => {
  // State to track the active filter
  const [activeFilter, setActiveFilter] = useState<'active' | 'expiring_soon'>('active');

  // Filter permits based on the active filter
  const filteredPermits = permits.filter(permit => {
    if (activeFilter === 'active') {
      return permit.statusType === 'active';
    } else if (activeFilter === 'expiring_soon') {
      return permit.statusType === 'expiring_soon';
    }
    return false;
  });

  // Render the CTA button/link
  const renderCta = (cta: CtaProps, isSecondary: boolean = false) => {
    // Determine which icon to use for the CTA
    const ctaIcon = () => {
      // Default to FaEye for primary CTA (Ver Detalles) and FaFileAlt for secondary
      if (!cta.icon) {
        return isSecondary ? <FaFileAlt /> : <FaEye />;
      }

      switch (cta.icon) {
        case 'FaDownload':
          return <FaDownload />;
        case 'FaEdit':
          return <FaEdit />;
        case 'FaArrowRight':
          return <FaArrowRight />;
        case 'FaFileAlt':
          return <FaFileAlt />;
        case 'FaEye':
          return <FaEye />;
        case 'FaExternalLinkAlt':
          return <FaExternalLinkAlt />;
        case 'FaCreditCard':
          return <FaCreditCard />;
        // Add more icon cases as needed
        default:
          // If text contains "Ver" or "Detalles", use FaEye
          if (cta.text.includes('Ver') || cta.text.includes('Detalles')) {
            return <FaEye />;
          }
          return isSecondary ? <FaFileAlt /> : <FaEye />;
      }
    };

    // Return the CTA button with appropriate styling using the enhanced Button component
    return (
      <Button
        to={cta.link}
        variant={isSecondary ? 'secondary' : 'primary'}
        className={`${isSecondary ? styles.secondaryCta : styles.primaryCta} touch-target`}
        icon={ctaIcon()}
      >
        {cta.text}
      </Button>
    );
  };

  // Render a permit card
  const renderPermitCard = (permit: PermitCardProps) => {
    // Determine the card class based on the status type
    const cardClass = (() => {
      switch (permit.statusType) {
        case 'active':
          return styles.activeCard;
        case 'expiring_soon':
          return styles.expiringSoonCard;
        case 'needs_attention':
          return styles.needsAttentionCard;
        case 'archived':
          return styles.archivedCard;
        default:
          return '';
      }
    })();

    // Render document links if available
    const renderDocumentLinks = () => {
      if (permit.rawStatus !== 'PERMIT_READY' && permit.rawStatus !== 'COMPLETED') {
        return null;
      }

      return (
        <div className={styles.documentLinks}>
          <h5 className={styles.documentTitle}>Descargar Documentos</h5>
          <div className={styles.documentGrid}>
            {permit.permitDocumentPath && (
              <a
                href={`/api/applications/${permit.id}/download/permiso`}
                className={styles.documentLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="icon-text-align">
                  <FaDownload className={styles.documentIcon} aria-hidden="true" />
                  <span>Permiso</span>
                </span>
              </a>
            )}
            {permit.receiptDocumentPath && (
              <a
                href={`/api/applications/${permit.id}/download/recibo`}
                className={styles.documentLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="icon-text-align">
                  <FaDownload className={styles.documentIcon} aria-hidden="true" />
                  <span>Recibo</span>
                </span>
              </a>
            )}
            {permit.certificateDocumentPath && (
              <a
                href={`/api/applications/${permit.id}/download/certificado`}
                className={styles.documentLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="icon-text-align">
                  <FaDownload className={styles.documentIcon} aria-hidden="true" />
                  <span>Certificado</span>
                </span>
              </a>
            )}
            {permit.licensePlatesDocumentPath && (
              <a
                href={`/api/applications/${permit.id}/download/placas`}
                className={styles.documentLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="icon-text-align">
                  <FaDownload className={styles.documentIcon} aria-hidden="true" />
                  <span>Placas</span>
                </span>
              </a>
            )}
          </div>
        </div>
      );
    };

    // Render payment reference if AWAITING_OXXO_PAYMENT
    const renderPaymentReference = () => {
      if (permit.rawStatus === 'AWAITING_OXXO_PAYMENT') {
        if (permit.paymentReference) {
          return (
            <div className={styles.paymentReference}>
              <span className={styles.paymentReferenceLabel}>Referencia OXXO para Pago:</span>
              <span className={styles.paymentReferenceValue}>{permit.paymentReference}</span>
            </div>
          );
        } else {
          return (
            <div className={styles.paymentReference}>
              <span className={styles.paymentReferenceLabel}>Referencia OXXO para Pago:</span>
              <span className={styles.paymentReferenceValueLoading}>Cargando referencia...</span>
            </div>
          );
        }
      }
      return null;
    };

    // Render vehicle details
    const renderVehicleDetails = () => {
      return (
        <div className={styles.vehicleDetails}>
          <div className={styles.vehicleDetailRow}>
            <span className={styles.vehicleDetail}>
              <span className={styles.vehicleDetailLabel}>Color:</span>
              <span className={styles.vehicleDetailValue}>{permit.vehicleColor || 'N/A'}</span>
            </span>
            <span className={styles.vehicleDetail}>
              <span className={styles.vehicleDetailLabel}>Año:</span>
              <span className={styles.vehicleDetailValue}>{permit.vehicleYear || 'N/A'}</span>
            </span>
          </div>
          {permit.folioNumber && (
            <div className={styles.folioRow}>
              <span className={styles.folioLabel}>Folio:</span>
              <span className={styles.folioValue}>{permit.folioNumber}</span>
            </div>
          )}
        </div>
      );
    };

    return (
      <div key={permit.id} className={`${styles.permitCard} ${cardClass}`}>
        <div className={styles.permitHeader}>
          {/* Status indicator at the top for better visibility */}
          <div className={styles.permitStatus}>
            <span className={styles.statusText}>{permit.statusText}</span>
            <span className={styles.expirationDate}>{permit.expirationDate}</span>
          </div>

          {/* Action buttons - moved to header for better alignment */}
          <div className={styles.permitActions}>
            {renderCta(permit.primaryCta)}
            {permit.secondaryCta && renderCta(permit.secondaryCta, true)}
          </div>
        </div>

        <div className={styles.permitContent}>
          <div className={styles.permitInfo}>
            {/* Vehicle information */}
            <h4 className={styles.vehicleIdentifier}>{permit.vehicleIdentifier}</h4>
            {renderVehicleDetails()}

            {/* Payment reference if applicable */}
            {renderPaymentReference()}
          </div>

          {/* Document links section */}
          {renderDocumentLinks()}
        </div>
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <h3 className={styles.sectionTitle}>Mis Permisos</h3>

      {/* Filter Tabs */}
      <div className={styles.filterTabs}>
        <Button
          variant="text"
          className={`${styles.filterTab} ${activeFilter === 'active' ? styles.activeTab : ''}`}
          onClick={() => setActiveFilter('active')}
        >
          Activos
        </Button>
        <Button
          variant="text"
          className={`${styles.filterTab} ${activeFilter === 'expiring_soon' ? styles.activeTab : ''}`}
          onClick={() => setActiveFilter('expiring_soon')}
        >
          Por Expirar
        </Button>
      </div>

      {/* Permits Display Area */}
      <div className={styles.permitsContainer}>
        {filteredPermits.length > 0 ? (
          filteredPermits.map(permit => renderPermitCard(permit))
        ) : (
          <div className={styles.emptyState}>
            {activeFilter === 'active'
              ? "No tienes permisos activos en este momento."
              : "No tienes permisos que estén por vencer pronto."}
          </div>
        )}
      </div>

      {/* Apply for New Permit CTA */}
      <div className={styles.newPermitCta}>
        <Button
          to="/permits/new"
          variant="primary"
          className={`${styles.newPermitButton} touch-target`}
          icon={<FaPlus aria-hidden="true" />}
        >
          Solicitar Nuevo Permiso
        </Button>
      </div>
    </div>
  );
};

export default PermitsOverview;
