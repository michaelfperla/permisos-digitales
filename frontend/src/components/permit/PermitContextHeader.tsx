import React from 'react';
import { FaCopy, FaCreditCard, FaStore, FaDownload, FaSync } from 'react-icons/fa';
import StatusBadge from '../ui/StatusBadge';
import Button from '../ui/Button/Button';
import Icon from '../../shared/components/ui/Icon';
import styles from '../../pages/PermitDetailsPage.module.css';
// FIX: Import the specific type for application status.
import { ApplicationStatus } from '../../services/applicationService';

interface PermitAction {
  label: string;
  // FIX: Explicitly reference React's JSX namespace for the icon type.
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

interface PermitContextHeaderProps {
  permitId?: string;
  // FIX: Use the specific ApplicationStatus type for the status prop.
  status?: ApplicationStatus;
  primaryAction?: PermitAction | null;
  oxxoReference?: string;
  onCopyReference: () => void;
  copied: boolean;
}

const PermitContextHeader: React.FC<PermitContextHeaderProps> = ({
  permitId,
  status,
  primaryAction,
  oxxoReference,
  onCopyReference,
  copied,
}) => {
  return (
    <div className={styles.permitContextHeaderCard}>
      <div className={styles.contextHeaderLeft}>
        <h2 className={styles.contextPermitId}>Permiso #{permitId}</h2>
        {status && (
          <div className={styles.contextStatusPill}>
            {/* This now passes the correctly typed prop. */}
            <StatusBadge status={status} size="large" />
          </div>
        )}
      </div>
      <div className={styles.contextHeaderRight}>
        {primaryAction && (
          <Button
            variant="primary"
            className={styles.contextPrimaryButton}
            onClick={primaryAction.onClick}
            disabled={primaryAction.disabled}
            icon={primaryAction.icon}
          >
            {primaryAction.label}
          </Button>
        )}
        {status === 'AWAITING_OXXO_PAYMENT' && oxxoReference && (
          <div className={styles.contextOxxoBlock}>
            <div className={styles.contextOxxoLabel}>Referencia OXXO:</div>
            <div className={styles.contextOxxoRefValue}>{oxxoReference}</div>
            <Button
              variant="secondary"
              size="small"
              className={styles.contextCopyButton}
              onClick={onCopyReference}
              icon={<Icon IconComponent={FaCopy} />}
              iconAfter
            >
              {copied ? 'Copiado' : 'Copiar'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PermitContextHeader;