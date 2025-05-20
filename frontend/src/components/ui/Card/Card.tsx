import React from 'react';
import styles from './Card.module.css';

export interface CardProps {
  /**
   * Card content for the main body
   */
  children: React.ReactNode;
  /**
   * Optional title for the card, will render a styled header
   */
  title?: string;
  /**
   * Optional content for the card footer
   */
  footerContent?: React.ReactNode;
  /**
   * Additional class names to apply to the root card element
   */
  className?: string;
  /**
   * Whether the card should have a hover effect (scales up slightly, deeper shadow)
   */
  hoverable?: boolean;
  /**
   * Card variant - 'auth' adds special styling for authentication forms
   */
  variant?: 'default' | 'auth';
  /**
   * Optional custom padding for the card body.
   * Useful if the card content needs specific spacing different from default.
   */
  bodyPadding?: string; // e.g., "var(--space-2)", "0", "1rem 0.5rem"
}

/**
 * Card component for displaying content in a structured and styled container.
 * Supports optional title (renders a header) and footer.
 */
const Card: React.FC<CardProps> = ({
  children,
  title,
  footerContent,
  className,
  hoverable = false,
  variant = 'default',
  bodyPadding,
}) => {
  const cardBaseClasses = [
    styles.card,
    hoverable ? styles.cardHover : '',
    variant === 'auth' ? styles.cardAuth : '',
    className || '',
  ]
    .filter(Boolean)
    .join(' ');

  const bodyInlineStyles: React.CSSProperties = {};
  if (bodyPadding) {
    bodyInlineStyles.padding = bodyPadding;
  }

  return (
    <div className={cardBaseClasses}>
      {title && (
        <div className={`${styles.cardHeader} ${variant === 'auth' ? styles.cardHeaderAuth : ''}`}>
          {typeof title === 'string' ? <h3 className={styles.cardTitle}>{title}</h3> : title}
        </div>
      )}
      <div className={`${styles.cardBody} ${variant === 'auth' ? styles.cardBodyAuth : ''}`} style={bodyInlineStyles}>
        {children}
      </div>
      {footerContent && (
        <div className={`${styles.cardFooter} ${variant === 'auth' ? styles.cardFooterAuth : ''}`}>
          {footerContent}
        </div>
      )}
    </div>
  );
};

export default Card;