import { useMemo } from 'react';

import useMediaQuery from './useMediaQuery';

/**
 * Breakpoint sizes based on the design system
 */
export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * Custom hook that provides responsive design utilities based on the design system breakpoints
 *
 * @returns Object with responsive utility functions and boolean flags
 *
 * @example
 * const { isXs, isSm, isMd, isLg, isXl, isSmDown, isMdDown, isLgDown, isXlDown, isSmUp, isMdUp, isLgUp, isXlUp } = useResponsive();
 *
 * // Conditionally render based on screen size
 * return (
 *   <div>
 *     {isMdDown ? <MobileComponent /> : <DesktopComponent />}
 *   </div>
 * );
 */
const useResponsive = () => {
  // Get CSS variables for breakpoints
  const getCSSBreakpoint = (name: string): string => {
    if (typeof document === 'undefined') return '0px';
    return getComputedStyle(document.documentElement)
      .getPropertyValue(`--breakpoint-${name}`)
      .trim();
  };

  // Create media queries for each breakpoint
  const isXs = useMediaQuery(`(max-width: ${getCSSBreakpoint('xs')})`);
  const isSm = useMediaQuery(
    `(min-width: ${getCSSBreakpoint('xs')}) and (max-width: ${getCSSBreakpoint('sm')})`,
  );
  const isMd = useMediaQuery(
    `(min-width: ${getCSSBreakpoint('sm')}) and (max-width: ${getCSSBreakpoint('md')})`,
  );
  const isLg = useMediaQuery(
    `(min-width: ${getCSSBreakpoint('md')}) and (max-width: ${getCSSBreakpoint('lg')})`,
  );
  const isXl = useMediaQuery(`(min-width: ${getCSSBreakpoint('lg')})`);

  // Create "down" media queries (e.g., sm and smaller)
  const isXsDown = isXs;
  const isSmDown = useMediaQuery(`(max-width: ${getCSSBreakpoint('sm')})`);
  const isMdDown = useMediaQuery(`(max-width: ${getCSSBreakpoint('md')})`);
  const isLgDown = useMediaQuery(`(max-width: ${getCSSBreakpoint('lg')})`);
  const isXlDown = true; // Always true as it includes all sizes

  // Create "up" media queries (e.g., sm and larger)
  const isXsUp = true; // Always true as it includes all sizes
  const isSmUp = useMediaQuery(`(min-width: ${getCSSBreakpoint('xs')})`);
  const isMdUp = useMediaQuery(`(min-width: ${getCSSBreakpoint('sm')})`);
  const isLgUp = useMediaQuery(`(min-width: ${getCSSBreakpoint('md')})`);
  const isXlUp = useMediaQuery(`(min-width: ${getCSSBreakpoint('lg')})`);

  // Helper function to determine if the current breakpoint matches
  const is = (breakpoint: Breakpoint): boolean => {
    switch (breakpoint) {
      case 'xs':
        return isXs;
      case 'sm':
        return isSm;
      case 'md':
        return isMd;
      case 'lg':
        return isLg;
      case 'xl':
        return isXl;
      default:
        return false;
    }
  };

  // Helper function to determine if the current breakpoint is smaller than or equal to the given breakpoint
  const down = (breakpoint: Breakpoint): boolean => {
    switch (breakpoint) {
      case 'xs':
        return isXsDown;
      case 'sm':
        return isSmDown;
      case 'md':
        return isMdDown;
      case 'lg':
        return isLgDown;
      case 'xl':
        return isXlDown;
      default:
        return false;
    }
  };

  // Helper function to determine if the current breakpoint is larger than or equal to the given breakpoint
  const up = (breakpoint: Breakpoint): boolean => {
    switch (breakpoint) {
      case 'xs':
        return isXsUp;
      case 'sm':
        return isSmUp;
      case 'md':
        return isMdUp;
      case 'lg':
        return isLgUp;
      case 'xl':
        return isXlUp;
      default:
        return false;
    }
  };

  // Helper function to determine if the current breakpoint is between the given breakpoints (inclusive)
  const between = (start: Breakpoint, end: Breakpoint): boolean => {
    return up(start) && down(end);
  };

  // Helper function to determine if the current breakpoint matches exactly one of the given breakpoints
  const only = (breakpoint: Breakpoint): boolean => {
    return is(breakpoint);
  };

  // Memoize the return value to prevent unnecessary re-renders
  return useMemo(
    () => ({
      // Current breakpoint flags
      isXs,
      isSm,
      isMd,
      isLg,
      isXl,

      // Down breakpoint flags (e.g., sm and smaller)
      isXsDown,
      isSmDown,
      isMdDown,
      isLgDown,
      isXlDown,

      // Up breakpoint flags (e.g., sm and larger)
      isXsUp,
      isSmUp,
      isMdUp,
      isLgUp,
      isXlUp,

      // Helper functions
      is,
      down,
      up,
      between,
      only,
    }),
    [isXs, isSm, isMd, isLg, isXl, isSmDown, isMdDown, isLgDown, isSmUp, isMdUp, isLgUp, isXlUp],
  );
};

export default useResponsive;
