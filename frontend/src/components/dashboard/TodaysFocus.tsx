import React from 'react';
import {
  FaExclamationCircle,
  FaCheckCircle,
  FaArrowRight,
  FaEdit,
  FaPlusCircle,
  FaCreditCard,
  FaInfoCircle,
  FaPlus,
  FaSync,
  FaFileAlt,
  FaDownload,
  FaEye
} from 'react-icons/fa';
import styles from './TodaysFocus.module.css';
import { FocusItemProps } from '../../types/permisos';
import Button from '../../components/ui/Button/Button';

/**
 * Props for the TodaysFocus component
 */
interface TodaysFocusProps {
  focusItem: FocusItemProps | null;
}

/**
 * TodaysFocus Component
 *
 * Displays either a critical action required by the user or an 'all clear' message,
 * based on the props it receives.
 */
const TodaysFocus: React.FC<TodaysFocusProps> = ({ focusItem }) => {
  // If no focus item is provided, render nothing
  if (!focusItem) {
    return null;
  }

  // Determine which icon to use based on the type and iconName
  const renderIcon = () => {
    if (!focusItem.iconName) {
      // Default icons if iconName is not provided
      switch (focusItem.type) {
        case 'critical_action':
          return <FaExclamationCircle className={styles.icon} />;
        case 'warning_action':
          return <FaExclamationCircle className={styles.icon} />;
        case 'info_action':
          return <FaInfoCircle className={styles.icon} />;
        case 'all_clear':
        default:
          return <FaCheckCircle className={styles.icon} />;
      }
    }

    // Use the specified icon if provided
    switch (focusItem.iconName) {
      case 'FaExclamationCircle':
        return <FaExclamationCircle className={styles.icon} />;
      case 'FaCheckCircle':
        return <FaCheckCircle className={styles.icon} />;
      case 'FaPlusCircle':
        return <FaPlusCircle className={styles.icon} />;
      case 'FaCreditCard':
        return <FaCreditCard className={styles.icon} />;
      // Add more icon cases as needed
      default:
        // Fallback based on type
        switch (focusItem.type) {
          case 'critical_action':
            return <FaExclamationCircle className={styles.icon} />;
          case 'warning_action':
            return <FaExclamationCircle className={styles.icon} />;
          case 'info_action':
            return <FaInfoCircle className={styles.icon} />;
          case 'all_clear':
          default:
            return <FaCheckCircle className={styles.icon} />;
        }
    }
  };

  // Render the CTA button/link if provided
  const renderCta = () => {
    if (!focusItem.cta) {
      return null;
    }

    // Determine which icon to use for the CTA
    const ctaIcon = () => {
      if (!focusItem.cta?.icon) {
        return <FaArrowRight className={styles.ctaIcon} />;
      }

      switch (focusItem.cta.icon) {
        case 'FaEdit':
          return <FaEdit className={styles.ctaIcon} />;
        case 'FaArrowRight':
          return <FaArrowRight className={styles.ctaIcon} />;
        case 'FaPlus':
          return <FaPlus className={styles.ctaIcon} />;
        case 'FaSync':
          return <FaSync className={styles.ctaIcon} />;
        case 'FaFileAlt':
          return <FaFileAlt className={styles.ctaIcon} />;
        case 'FaDownload':
          return <FaDownload className={styles.ctaIcon} />;
        case 'FaCreditCard':
          return <FaCreditCard className={styles.ctaIcon} />;
        case 'FaPlusCircle':
          return <FaPlusCircle className={styles.ctaIcon} />;
        case 'FaInfoCircle':
          return <FaInfoCircle className={styles.ctaIcon} />;
        case 'FaCheckCircle':
          return <FaCheckCircle className={styles.ctaIcon} />;
        case 'FaExclamationCircle':
          return <FaExclamationCircle className={styles.ctaIcon} />;
        case 'FaEye':
          return <FaEye className={styles.ctaIcon} />;
        default:
          return <FaArrowRight className={styles.ctaIcon} />;
      }
    };

    // Return the CTA button with appropriate styling based on the focus item type
    let ctaClass;
    switch (focusItem.type) {
      case 'critical_action':
        ctaClass = styles.ctaCritical;
        break;
      case 'warning_action':
        ctaClass = styles.ctaWarning;
        break;
      case 'info_action':
        ctaClass = styles.ctaInfo; // Fixed to use the correct class
        break;
      case 'all_clear':
      default:
        ctaClass = styles.ctaSecondary;
        break;
    }

    // Always use primary variant for the monochromatic theme
    const variant = 'primary';

    // Validate the link path - ensure it's not empty and starts with a slash if it's a relative path
    const linkPath = focusItem.cta.link || '/permits';
    const isExternalLink = linkPath.startsWith('http://') || linkPath.startsWith('https://');

    // For internal links, ensure they start with a slash
    const validatedLink = !isExternalLink && !linkPath.startsWith('/') && !linkPath.startsWith('#')
      ? `/${linkPath}`
      : linkPath;

    return (
      <Button
        to={validatedLink}
        variant={variant}
        className={`${ctaClass} touch-target`}
        icon={ctaIcon()}
        aria-label={`${focusItem.cta.text} - ${focusItem.title}`}
      >
        {focusItem.cta.text}
      </Button>
    );
  };

  // Determine the container class based on the focus item type
  let containerClass;
  switch (focusItem.type) {
    case 'critical_action':
      containerClass = styles.criticalAction;
      break;
    case 'warning_action':
      containerClass = styles.warningAction;
      break;
    case 'info_action':
      containerClass = styles.infoAction;
      break;
    case 'all_clear':
    default:
      containerClass = styles.allClear;
      break;
  }

  return (
    <div className={`${styles.container} ${containerClass}`}>
      <div className={styles.iconContainer}>
        {renderIcon()}
      </div>
      <div className={styles.content}>
        <h2 className={styles.title}>{focusItem.title}</h2>
        <p className={styles.message}>{focusItem.message}</p>
        <div className={styles.ctaContainer}>
          {renderCta()}
        </div>
      </div>
    </div>
  );
};

export default TodaysFocus;
