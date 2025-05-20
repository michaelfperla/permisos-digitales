import React, { useState } from 'react';
import { ApplicationStatus } from '../../services/applicationService';
import {
  FaShieldAlt,
  FaCalendarAlt,
  FaTicketAlt,
  FaArchive,
  FaDownload,
  FaSync,
  FaReceipt,
  FaArrowRight,
  FaCheckCircle,
  FaCopy,
  FaExclamationTriangle,
  FaFileAlt,
  FaCreditCard,
  FaChevronLeft,
  FaChevronRight
} from 'react-icons/fa';
import styles from './HeroPermitCard.module.css';
import Button from '../../components/ui/Button/Button';

/**
 * Interface for the permit object passed to the HeroPermitCard component
 */
export interface PermitCardProps {
  /**
   * The permit object containing all necessary details
   */
  permit: {
    /**
     * Unique identifier for the permit
     */
    id: string;

    /**
     * Folio number of the permit
     */
    folioNumber: string;

    /**
     * Vehicle make (e.g., Toyota, Ford)
     */
    vehicleMake: string;

    /**
     * Vehicle model (e.g., Corolla, F-150)
     */
    vehicleModel: string;

    /**
     * Vehicle year
     */
    vehicleYear: string | number;

    /**
     * Vehicle color
     */
    vehicleColor: string;

    /**
     * Current status of the permit
     */
    status: ApplicationStatus;

    /**
     * Details about the journey/progress of the permit
     */
    statusDetails: {
      /**
       * Whether the application has been submitted
       */
      submitted: boolean;

      /**
       * Whether payment has been received
       */
      paid: boolean;

      /**
       * Whether the permit is active
       */
      active: boolean;

      /**
       * Whether the permit is expiring soon
       */
      expiring: boolean;
    };

    /**
     * Date when the permit was applied for
     */
    applicationDate: string;

    /**
     * Date when the permit expires
     */
    expirationDate?: string;

    /**
     * OXXO payment reference (if applicable)
     */
    oxxoReference?: string;

    /**
     * OXXO payment expiry date (if applicable)
     */
    oxxoExpiry?: string;

    /**
     * Primary action for the permit
     */
    primaryAction: {
      /**
       * Type of action (e.g., 'download', 'renew', 'view_oxxo')
       */
      type: 'download' | 'renew' | 'view_oxxo';

      /**
       * Label for the action button
       */
      label: string;
    };
  };

  /**
   * Callback for when the primary action button is clicked
   */
  onPrimaryAction: (action: string, permitId: string) => void;

  /**
   * Callback for when the "View Details" link is clicked
   */
  onViewDetails: (permitId: string) => void;

  /**
   * Optional navigation props for integrated navigation controls
   */
  navigation?: {
    /**
     * Whether to show navigation controls
     */
    showControls: boolean;

    /**
     * Current permit index
     */
    currentIndex: number;

    /**
     * Total number of permits
     */
    totalPermits: number;

    /**
     * Callback for previous permit button
     */
    onPrevious: () => void;

    /**
     * Callback for next permit button
     */
    onNext: () => void;

    /**
     * Callback for direct navigation to a specific permit
     */
    onNavigate: (index: number) => void;
  };
}

/**
 * HeroPermitCard component displays a single permit in a card format
 * with a "Permiso Journey" concept showing the status and key information.
 * Can optionally include integrated navigation controls.
 */
const HeroPermitCard: React.FC<PermitCardProps> = ({
  permit,
  onPrimaryAction,
  onViewDetails,
  navigation
}) => {
  // Helper function to get days remaining until expiry
  const getDaysRemaining = (expiryDate?: string): number => {
    if (!expiryDate) return 0;

    const now = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Format date for display
  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'N/A';

    return new Date(dateString).toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  // State for copy button feedback
  const [copied, setCopied] = useState(false);

  // Handle copying OXXO reference
  const handleCopyOxxoReference = () => {
    if (permit.oxxoReference) {
      navigator.clipboard.writeText(permit.oxxoReference);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Render key information based on permit status
  const renderKeyInfo = () => {
    // Get days remaining for expiration-related logic
    const daysRemaining = getDaysRemaining(permit.expirationDate);

    // Check if permit is expiring soon but still active
    const isExpiringSoon = daysRemaining > 0 && daysRemaining <= 14;
    const isActive = permit.status === 'COMPLETED' || permit.status === 'PERMIT_READY';

    // Special case for active permits that are expiring soon
    if (isActive && isExpiringSoon) {
      return (
        <>
          <div className={styles.keyInfoItem}>
            <span className={styles.keyInfoLabel}>Fecha de solicitud:</span>
            <span className={styles.keyInfoValue}>{formatDate(permit.applicationDate)}</span>
          </div>
          <div className={styles.keyInfoItem}>
            <span className={styles.keyInfoLabel}>Vence el:</span>
            <span className={styles.keyInfoValueWarning}>
              {formatDate(permit.expirationDate)}
            </span>
          </div>
          <div className={styles.keyInfoItem}>
            <span className={styles.keyInfoLabel}>Días restantes:</span>
            <span className={styles.keyInfoValueWarning}>
              {daysRemaining} {daysRemaining === 1 ? 'día' : 'días'}
            </span>
          </div>
          <div className={styles.keyInfoAlert}>
            <FaExclamationTriangle className={styles.keyInfoAlertIcon} />
            <span>¡Tu permiso vence pronto! Renueva ahora para continuar circulando sin interrupciones.</span>
          </div>
        </>
      );
    }

    switch (permit.status) {
      case 'COMPLETED':
      case 'PERMIT_READY':
        return (
          <>
            <div className={styles.keyInfoItem}>
              <span className={styles.keyInfoLabel}>Fecha de solicitud:</span>
              <span className={styles.keyInfoValue}>{formatDate(permit.applicationDate)}</span>
            </div>
            <div className={styles.keyInfoItem}>
              <span className={styles.keyInfoLabel}>Válido hasta:</span>
              <span className={styles.keyInfoValue}>
                {formatDate(permit.expirationDate)}
              </span>
            </div>
            <div className={styles.keyInfoItem}>
              <span className={styles.keyInfoLabel}>Días restantes:</span>
              <span className={styles.keyInfoValue}>
                {daysRemaining} {daysRemaining === 1 ? 'día' : 'días'}
              </span>
            </div>
          </>
        );

      case 'AWAITING_OXXO_PAYMENT':
        return (
          <>
            <div className={styles.keyInfoItem}>
              <span className={styles.keyInfoLabel}>Fecha de solicitud:</span>
              <span className={styles.keyInfoValue}>{formatDate(permit.applicationDate)}</span>
            </div>
            <div className={styles.keyInfoItem}>
              <span className={styles.keyInfoLabel}>Referencia OXXO:</span>
              <div className={styles.oxxoReferenceContainer}>
                <div className={styles.oxxoReferenceWrapper}>
                  <span className={styles.oxxoReferenceLabel}>Tu Referencia:</span>
                  <span className={styles.oxxoReferenceValue} id="oxxoReference">{permit.oxxoReference}</span>
                </div>
                <Button
                  variant="secondary"
                  onClick={handleCopyOxxoReference}
                  className={styles.copyButton}
                  icon={<FaCopy />}
                  iconAfter={true}
                  aria-label="Copiar referencia OXXO"
                  title="Copiar referencia"
                  size="small"
                >
                  {copied ? 'Copiado' : 'Copiar'}
                </Button>
              </div>
            </div>
            <div className={styles.keyInfoAlert}>
              <FaTicketAlt className={styles.keyInfoAlertIcon} />
              <span>Realiza tu pago en cualquier tienda OXXO para activar tu permiso. Usa la referencia mostrada arriba.</span>
            </div>
          </>
        );

      case 'EXPIRED':
        return (
          <>
            <div className={styles.keyInfoItem}>
              <span className={styles.keyInfoLabel}>Venció el:</span>
              <span className={styles.keyInfoValue}>{formatDate(permit.expirationDate)}</span>
            </div>
            <div className={styles.keyInfoItem}>
              <span className={styles.keyInfoLabel}>Fecha de expedición:</span>
              <span className={styles.keyInfoValue}>{formatDate(permit.applicationDate)}</span>
            </div>
            <div className={styles.keyInfoItem}>
              <span className={styles.keyInfoLabel}>Estado:</span>
              <span className={styles.keyInfoValueExpired}>Este permiso ya no es válido</span>
            </div>
            <div className={styles.keyInfoAlert}>
              <FaArchive className={styles.keyInfoAlertIcon} />
              <span>Este permiso ha vencido. Solicita un nuevo permiso para circular legalmente.</span>
            </div>
          </>
        );

      default:
        return (
          <>
            <div className={styles.keyInfoItem}>
              <span className={styles.keyInfoLabel}>Fecha de solicitud:</span>
              <span className={styles.keyInfoValue}>{formatDate(permit.applicationDate)}</span>
            </div>
            <div className={styles.keyInfoItem}>
              <span className={styles.keyInfoLabel}>Estado actual:</span>
              <span className={styles.keyInfoValue}>{permit.status}</span>
            </div>
            <div className={styles.keyInfoItem}>
              <span className={styles.keyInfoLabel}>Vehículo:</span>
              <span className={styles.keyInfoValue}>
                {permit.vehicleYear} {permit.vehicleMake} {permit.vehicleModel} ({permit.vehicleColor})
              </span>
            </div>
          </>
        );
    }
  };

  return (
    <div className={styles.cardContainer}>
      {/* Left "Status Anchor" Section - Enhanced for "Permiso Journey" */}
      <div className={styles.statusAnchor}>
        {/* Large Thematic Status Icon with conditional rendering */}
        <div className={`${styles.statusIcon}
          ${permit.status === 'COMPLETED' || permit.status === 'PERMIT_READY' ? styles.statusIconActive :
            permit.status === 'AWAITING_OXXO_PAYMENT' ? styles.statusIconPending :
            permit.status === 'EXPIRED' ? styles.statusIconExpired :
            getDaysRemaining(permit.expirationDate) <= 14 && getDaysRemaining(permit.expirationDate) > 0 ? styles.statusIconExpiring :
            styles.statusIconDefault}`}>

          {/* Render different thematic icons based on permit status */}
          {permit.status === 'COMPLETED' || permit.status === 'PERMIT_READY' ? (
            <FaShieldAlt className={`${styles.icon} ${styles.iconActive}`} />
          ) : permit.status === 'AWAITING_OXXO_PAYMENT' ? (
            <FaTicketAlt className={`${styles.icon} ${styles.iconPending}`} />
          ) : permit.status === 'EXPIRED' ? (
            <FaArchive className={`${styles.icon} ${styles.iconExpired}`} />
          ) : getDaysRemaining(permit.expirationDate) <= 14 && getDaysRemaining(permit.expirationDate) > 0 ? (
            <FaCalendarAlt className={`${styles.icon} ${styles.iconExpiring}`} />
          ) : (
            <FaShieldAlt className={`${styles.icon} ${styles.iconDefault}`} />
          )}
        </div>

        {/* Human-friendly status text */}
        <p className={styles.statusText}>
          {permit.status === 'COMPLETED' || permit.status === 'PERMIT_READY' ?
            'ACTIVO' :
           permit.status === 'AWAITING_OXXO_PAYMENT' ?
            'PAGO PENDIENTE OXXO' :
           permit.status === 'EXPIRED' ?
            'VENCIDO' :
           getDaysRemaining(permit.expirationDate) <= 14 && getDaysRemaining(permit.expirationDate) > 0 ?
            'VENCE PRONTO' :
            permit.status
          }
        </p>

        {/* Vehicle information */}
        <div className={styles.vehicleInfo}>
          <p className={styles.vehicleText}>
            {permit.vehicleYear} {permit.vehicleMake} {permit.vehicleModel}
          </p>
          <p className={styles.folioText}>
            Permiso Nº: {permit.folioNumber}
          </p>
        </div>

        {/* Navigation Controls in Status Anchor */}
        {navigation && navigation.showControls && (
          <div className={styles.statusAnchorNavControls}>
            <Button
              variant="secondary"
              size="icon"
              onClick={navigation.onPrevious}
              className={styles.navButton}
              icon={<FaChevronLeft />}
              aria-label="Permiso anterior"
            />

            {/* Numerical indicator showing current position */}
            <div className={styles.numericalIndicator}>
              {navigation.currentIndex + 1}/{navigation.totalPermits}
            </div>

            <Button
              variant="secondary"
              size="icon"
              onClick={navigation.onNext}
              className={styles.navButton}
              icon={<FaChevronRight />}
              aria-label="Permiso siguiente"
            />
          </div>
        )}
      </div>

      {/* Right "Journey & Action Details" Section */}
      <div className={styles.journeyDetails}>
        <div className={styles.journeyBar}>
          {/* Mini Progress/Journey Bar - Enhanced for "Permiso Journey" */}
          {/* Step 1: Solicitado (Always completed) */}
          <div className={styles.journeyStepContainer}>
            <div className={`${styles.journeyStep} ${styles.journeyStepCompleted}`}>
              <div className={styles.journeyStepCircle}>
                <FaCheckCircle className={styles.journeyStepIcon} />
              </div>
              <span className={styles.journeyStepLabel}>Solicitado</span>
            </div>
          </div>

          <div className={`${styles.journeyConnector} ${permit.statusDetails.paid ? styles.journeyConnectorCompleted : ''}`}></div>

          {/* Step 2: Pagado (Current if AWAITING_OXXO_PAYMENT, Completed if paid) */}
          <div className={styles.journeyStepContainer}>
            <div className={`${styles.journeyStep} ${permit.statusDetails.paid ? styles.journeyStepCompleted :
              permit.status === 'AWAITING_OXXO_PAYMENT' ? styles.journeyStepCurrent : styles.journeyStepFuture}`}>
              <div className={styles.journeyStepCircle}>
                {permit.statusDetails.paid ? (
                  <FaCheckCircle className={styles.journeyStepIcon} />
                ) : permit.status === 'AWAITING_OXXO_PAYMENT' ? (
                  <FaTicketAlt className={styles.journeyStepIcon} />
                ) : (
                  <span className={styles.journeyStepNumber}>2</span>
                )}
              </div>
              <span className={styles.journeyStepLabel}>
                {permit.status === 'AWAITING_OXXO_PAYMENT' ? 'Pendiente de Pago' : 'Pagado'}
              </span>
            </div>
          </div>

          <div className={`${styles.journeyConnector} ${permit.statusDetails.active ? styles.journeyConnectorCompleted : ''}`}></div>

          {/* Step 3: Activo (Current if paid but not active, Completed if active) */}
          <div className={styles.journeyStepContainer}>
            <div className={`${styles.journeyStep} ${permit.statusDetails.active ? styles.journeyStepCompleted :
              permit.statusDetails.paid && !permit.statusDetails.active ? styles.journeyStepCurrent : styles.journeyStepFuture}`}>
              <div className={styles.journeyStepCircle}>
                {permit.statusDetails.active ? (
                  <FaCheckCircle className={styles.journeyStepIcon} />
                ) : permit.statusDetails.paid && !permit.statusDetails.active ? (
                  <FaSync className={styles.journeyStepIcon} />
                ) : (
                  <span className={styles.journeyStepNumber}>3</span>
                )}
              </div>
              <span className={styles.journeyStepLabel}>Activo</span>
            </div>
          </div>

          <div className={`${styles.journeyConnector} ${permit.statusDetails.expiring ? styles.journeyConnectorWarning : ''}`}></div>

          {/* Step 4: Por Vencer/Vencido (Warning if expiring, Completed if expired) */}
          <div className={styles.journeyStepContainer}>
            <div className={`${styles.journeyStep} ${permit.statusDetails.expiring ? styles.journeyStepWarning :
              permit.status === 'EXPIRED' ? styles.journeyStepCompleted : styles.journeyStepFuture}`}>
              <div className={styles.journeyStepCircle}>
                {permit.status === 'EXPIRED' ? (
                  <FaArchive className={styles.journeyStepIcon} />
                ) : permit.statusDetails.expiring ? (
                  <FaCalendarAlt className={styles.journeyStepIcon} />
                ) : (
                  <span className={styles.journeyStepNumber}>4</span>
                )}
              </div>
              <span className={styles.journeyStepLabel}>
                {permit.status === 'EXPIRED' ? 'Vencido' : 'Por Vencer'}
              </span>
            </div>
          </div>
        </div>

        <div className={styles.keyInfo}>
          {renderKeyInfo()}
        </div>

        <div className={styles.actionArea}>
          {/* Primary action button with dynamic styling based on action type */}
          <Button
            variant="primary"
            onClick={() => onPrimaryAction(permit.primaryAction.type, permit.id)}
            className={`${styles.primaryActionButton} ${
              permit.primaryAction.type === 'download' ? styles.primaryActionDownload :
              permit.primaryAction.type === 'renew' ? styles.primaryActionRenew :
              permit.primaryAction.type === 'view_oxxo' ? styles.primaryActionOxxo :
              ''
            }`}
            icon={permit.primaryAction.type === 'download' ? <FaFileAlt /> :
                  permit.primaryAction.type === 'renew' ? <FaSync /> :
                  permit.primaryAction.type === 'view_oxxo' ? <FaCreditCard /> :
                  <FaDownload />}
            aria-label={permit.primaryAction.label}
          >
            {permit.primaryAction.label}
          </Button>

          {/* View details button */}
          <Button
            variant="secondary"
            onClick={() => onViewDetails(permit.id)}
            className={styles.viewDetailsLink}
            icon={<FaArrowRight />}
            iconAfter={true}
            aria-label="Ver detalles completos del permiso"
          >
            Detalles Completos
          </Button>
        </div>


      </div>
    </div>
  );
};

export default HeroPermitCard;
