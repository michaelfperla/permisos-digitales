import React from 'react';

import styles from './Card.module.css';

export interface CardProps {
  children: React.ReactNode;
  title?: string;
  footerContent?: React.ReactNode;
  className?: string;
  hoverable?: boolean;
  variant?: 'default' | 'auth';
  bodyPadding?: string;
}

/**
 * Card component for displaying content in a structured container.
 * Supports optional title header and footer content.
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
      <div
        className={`${styles.cardBody} ${variant === 'auth' ? styles.cardBodyAuth : ''}`}
        style={bodyInlineStyles}
      >
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
