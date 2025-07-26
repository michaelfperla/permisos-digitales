import React, { useState, useRef, useCallback } from 'react';
import {
  FaChevronDown,
  FaEdit,
  FaTrash,
  FaEye,
  FaDownload,
  FaSync,
  FaInbox,
} from 'react-icons/fa';

import styles from './MobileDataCards.module.css';
import Icon from '../../../shared/components/ui/Icon';

export interface DataField {
  label: string;
  value: string | number | React.ReactNode;
  priority?: 'high' | 'medium' | 'low';
  hideOnCard?: boolean;
}

export interface CardAction {
  label: string;
  icon?: React.ComponentType;
  onClick: (item: any) => void;
  variant?: 'primary' | 'secondary' | 'danger';
}

export interface MobileDataCardsProps {
  data: any[];
  title: (item: any) => string;
  subtitle?: (item: any) => string;
  status?: (item: any) => {
    label: string;
    variant: 'success' | 'warning' | 'error' | 'info';
  };
  fields: (item: any) => DataField[];
  actions?: CardAction[];
  swipeActions?: {
    edit?: (item: any) => void;
    delete?: (item: any) => void;
  };
  expandable?: boolean;
  expandedContent?: (item: any) => React.ReactNode;
  onRefresh?: () => Promise<void>;
  emptyState?: {
    icon?: React.ComponentType;
    title: string;
    description: string;
    action?: {
      label: string;
      onClick: () => void;
    };
  };
  loading?: boolean;
  loadingCards?: number;
}

/**
 * Mobile-optimized data cards component that replaces tables on small screens
 */
const MobileDataCards: React.FC<MobileDataCardsProps> = ({
  data,
  title,
  subtitle,
  status,
  fields,
  actions = [],
  swipeActions,
  expandable = false,
  expandedContent,
  onRefresh,
  emptyState,
  loading = false,
  loadingCards = 3,
}) => {
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const [swipingCard, setSwipingCard] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number>(0);
  const isPulling = useRef<boolean>(false);

  // Toggle card expansion
  const toggleExpand = (index: number) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  // Handle swipe gestures
  const handleTouchStart = useCallback((e: React.TouchEvent, index: number) => {
    const touch = e.touches[0];
    touchStartY.current = touch.clientY;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent, index: number) => {
    const touch = e.touches[0];
    const deltaX = touch.clientX - e.currentTarget.getBoundingClientRect().left;
    
    if (Math.abs(deltaX) > 50) {
      setSwipingCard(index);
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent, index: number) => {
    setSwipingCard(null);
  }, []);

  // Pull to refresh functionality
  const handlePullStart = useCallback((e: React.TouchEvent) => {
    if (containerRef.current?.scrollTop === 0) {
      touchStartY.current = e.touches[0].clientY;
      isPulling.current = true;
    }
  }, []);

  const handlePullMove = useCallback((e: React.TouchEvent) => {
    if (isPulling.current && containerRef.current?.scrollTop === 0) {
      const deltaY = e.touches[0].clientY - touchStartY.current;
      if (deltaY > 0) {
        setPullDistance(Math.min(deltaY * 0.5, 100));
      }
    }
  }, []);

  const handlePullEnd = useCallback(async () => {
    if (pullDistance > 60 && onRefresh) {
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    }
    setPullDistance(0);
    isPulling.current = false;
  }, [pullDistance, onRefresh]);

  // Render loading skeleton
  if (loading) {
    return (
      <div className={styles.cardList}>
        {Array.from({ length: loadingCards }).map((_, index) => (
          <div key={index} className={styles.skeletonCard}>
            <div className={styles.skeletonLine} />
            <div className={`${styles.skeletonLine} ${styles.short}`} />
            <div className={`${styles.skeletonLine} ${styles.medium}`} />
          </div>
        ))}
      </div>
    );
  }

  // Render empty state
  if (data.length === 0 && emptyState) {
    return (
      <div className={styles.emptyState}>
        {emptyState.icon && (
          <div className={styles.emptyIcon}>
            <Icon IconComponent={emptyState.icon} size="3rem" />
          </div>
        )}
        <h3 className={styles.emptyTitle}>{emptyState.title}</h3>
        <p className={styles.emptyDescription}>{emptyState.description}</p>
        {emptyState.action && (
          <button
            className={`${styles.actionButton} ${styles.primary}`}
            onClick={emptyState.action.onClick}
          >
            {emptyState.action.label}
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={styles.cardList}
      onTouchStart={handlePullStart}
      onTouchMove={handlePullMove}
      onTouchEnd={handlePullEnd}
    >
      {/* Pull to refresh indicator */}
      {onRefresh && (
        <div
          className={`${styles.pullToRefresh} ${
            pullDistance > 0 ? styles.visible : ''
          } ${refreshing ? styles.refreshing : ''}`}
          style={{ transform: `translateX(-50%) translateY(${pullDistance}px)` }}
        >
          <Icon IconComponent={FaSync} />
        </div>
      )}

      {/* Data cards */}
      {data.map((item, index) => {
        const isExpanded = expandedCards.has(index);
        const isSwiping = swipingCard === index;
        const itemStatus = status?.(item);
        const itemFields = fields(item);

        return (
          <div
            key={index}
            className={`${styles.dataCard} ${isExpanded ? styles.expanded : ''} ${
              isSwiping ? styles.swiping : ''
            }`}
            onTouchStart={(e) => handleTouchStart(e, index)}
            onTouchMove={(e) => handleTouchMove(e, index)}
            onTouchEnd={(e) => handleTouchEnd(e, index)}
          >
            {/* Card Header */}
            <div className={styles.cardHeader}>
              <div>
                <h3 className={styles.cardTitle}>{title(item)}</h3>
                {subtitle && <p className={styles.cardSubtitle}>{subtitle(item)}</p>}
              </div>
              {itemStatus && (
                <span className={`${styles.statusBadge} ${styles[itemStatus.variant]}`}>
                  {itemStatus.label}
                </span>
              )}
            </div>

            {/* Card Body */}
            <div className={styles.cardBody}>
              {itemFields
                .filter(field => !field.hideOnCard && field.priority !== 'low')
                .map((field, fieldIndex) => (
                  <div key={fieldIndex} className={styles.dataRow}>
                    <span className={styles.dataLabel}>{field.label}</span>
                    <span className={styles.dataValue}>{field.value}</span>
                  </div>
                ))}
            </div>

            {/* Expandable content */}
            {expandable && expandedContent && (
              <>
                <div className={styles.expandableSection}>
                  <div className={styles.expandableContent}>
                    {expandedContent(item)}
                  </div>
                </div>
                <button
                  className={styles.expandToggle}
                  onClick={() => toggleExpand(index)}
                  aria-expanded={isExpanded}
                  aria-label={isExpanded ? 'Ocultar detalles' : 'Ver más detalles'}
                >
                  <Icon IconComponent={FaChevronDown} size="sm" />
                  {isExpanded ? 'Ver menos' : 'Ver más'}
                </button>
              </>
            )}

            {/* Card Footer with actions */}
            {actions.length > 0 && (
              <div className={styles.cardFooter}>
                {actions.map((action, actionIndex) => (
                  <button
                    key={actionIndex}
                    className={`${styles.actionButton} ${
                      action.variant ? styles[action.variant] : ''
                    }`}
                    onClick={() => action.onClick(item)}
                  >
                    {action.icon && <Icon IconComponent={action.icon} size="sm" />}
                    {action.label}
                  </button>
                ))}
              </div>
            )}

            {/* Swipe actions */}
            {swipeActions && (
              <div className={styles.swipeActions}>
                {swipeActions.edit && (
                  <div
                    className={`${styles.swipeAction} ${styles.edit}`}
                    onClick={() => swipeActions.edit!(item)}
                  >
                    <Icon IconComponent={FaEdit} />
                  </div>
                )}
                {swipeActions.delete && (
                  <div
                    className={`${styles.swipeAction} ${styles.delete}`}
                    onClick={() => swipeActions.delete!(item)}
                  >
                    <Icon IconComponent={FaTrash} />
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default MobileDataCards;