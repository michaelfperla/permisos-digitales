import { useMemo, useCallback } from 'react';

import useMediaQuery from './useMediaQuery';

export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * Hook providing responsive design utilities based on design system breakpoints
 */
const useResponsive = () => {
  const getCSSBreakpoint = (name: string): string => {
    if (typeof document === 'undefined') return '0px';
    return getComputedStyle(document.documentElement)
      .getPropertyValue(`--breakpoint-${name}`)
      .trim();
  };

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

  const isXsDown = isXs;
  const isSmDown = useMediaQuery(`(max-width: ${getCSSBreakpoint('sm')})`);
  const isMdDown = useMediaQuery(`(max-width: ${getCSSBreakpoint('md')})`);
  const isLgDown = useMediaQuery(`(max-width: ${getCSSBreakpoint('lg')})`);
  const isXlDown = true;

  const isXsUp = true;
  const isSmUp = useMediaQuery(`(min-width: ${getCSSBreakpoint('xs')})`);
  const isMdUp = useMediaQuery(`(min-width: ${getCSSBreakpoint('sm')})`);
  const isLgUp = useMediaQuery(`(min-width: ${getCSSBreakpoint('md')})`);
  const isXlUp = useMediaQuery(`(min-width: ${getCSSBreakpoint('lg')})`);

  const is = useCallback((breakpoint: Breakpoint): boolean => {
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
  }, [isXs, isSm, isMd, isLg, isXl]);

  const down = useCallback((breakpoint: Breakpoint): boolean => {
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
  }, [isXsDown, isSmDown, isMdDown, isLgDown, isXlDown]);

  const up = useCallback((breakpoint: Breakpoint): boolean => {
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
  }, [isXsUp, isSmUp, isMdUp, isLgUp, isXlUp]);

  const between = useCallback((start: Breakpoint, end: Breakpoint): boolean => {
    return up(start) && down(end);
  }, [up, down]);

  const only = useCallback((breakpoint: Breakpoint): boolean => {
    return is(breakpoint);
  }, [is]);

  return useMemo(
    () => ({
      isXs,
      isSm,
      isMd,
      isLg,
      isXl,
      isXsDown,
      isSmDown,
      isMdDown,
      isLgDown,
      isXlDown,
      isXsUp,
      isSmUp,
      isMdUp,
      isLgUp,
      isXlUp,
      is,
      down,
      up,
      between,
      only,
    }),
    [
      isXs, isSm, isMd, isLg, isXl,
      isXsDown, isSmDown, isMdDown, isLgDown, isXlDown,
      isXsUp, isSmUp, isMdUp, isLgUp, isXlUp,
      is, down, up, between, only
    ],
  );
};

export default useResponsive;
