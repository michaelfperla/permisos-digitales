import React, { ReactNode } from 'react';

import styles from './ResponsiveGrid.module.css';

interface ResponsiveGridProps {
  /**
   * The content to be rendered inside the grid
   */
  children: ReactNode;

  /**
   * Additional CSS class names to apply to the grid
   */
  className?: string;

  /**
   * Number of columns at different breakpoints
   * @default { xs: 1, sm: 2, md: 3, lg: 4, xl: 4 }
   */
  columns?: {
    xs?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };

  /**
   * Gap between grid items at different breakpoints
   * @default { xs: 'sm', sm: 'sm', md: 'md', lg: 'md', xl: 'md' }
   */
  gap?: {
    xs?: 'xs' | 'sm' | 'md' | 'lg';
    sm?: 'xs' | 'sm' | 'md' | 'lg';
    md?: 'xs' | 'sm' | 'md' | 'lg';
    lg?: 'xs' | 'sm' | 'md' | 'lg';
    xl?: 'xs' | 'sm' | 'md' | 'lg';
  };
}

/**
 * ResponsiveGrid component for creating responsive grid layouts
 *
 * This component provides a standardized grid with responsive behavior
 * based on the design system breakpoints.
 */
const ResponsiveGrid: React.FC<ResponsiveGridProps> = ({
  children,
  className = '',
  columns = { xs: 1, sm: 2, md: 3, lg: 4, xl: 4 },
  gap = { xs: 'sm', sm: 'sm', md: 'md', lg: 'md', xl: 'md' },
}) => {
  // Generate CSS custom properties for columns and gaps
  const style = {
    '--grid-columns-xs': columns.xs || 1,
    '--grid-columns-sm': columns.sm || 2,
    '--grid-columns-md': columns.md || 3,
    '--grid-columns-lg': columns.lg || 4,
    '--grid-columns-xl': columns.xl || 4,
    '--grid-gap-xs': `var(--space-${gap.xs || 'sm'})`,
    '--grid-gap-sm': `var(--space-${gap.sm || 'sm'})`,
    '--grid-gap-md': `var(--space-${gap.md || 'md'})`,
    '--grid-gap-lg': `var(--space-${gap.lg || 'md'})`,
    '--grid-gap-xl': `var(--space-${gap.xl || 'md'})`,
  } as React.CSSProperties;

  return (
    <div className={`${styles.grid} ${className}`} style={style}>
      {children}
    </div>
  );
};

export default ResponsiveGrid;
