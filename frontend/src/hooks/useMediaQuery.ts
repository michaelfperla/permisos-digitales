import { useState, useEffect } from 'react';

/**
 * Custom hook for responsive design that detects if a media query matches
 *
 * @param query - CSS media query string (e.g., '(max-width: 768px)')
 * @returns boolean indicating if the media query matches
 *
 * @example
 * // Check if screen is mobile size
 * const isMobile = useMediaQuery('(max-width: 768px)');
 *
 * // Use CSS variables from breakpoint system
 * const isMobile = useMediaQuery(`(max-width: ${getComputedStyle(document.documentElement).getPropertyValue('--breakpoint-md')})`);
 */
const useMediaQuery = (query: string): boolean => {
  // Initialize with the current match state
  const getMatches = (mediaQuery: string): boolean => {
    // Check if window is available (for SSR)
    if (typeof window !== 'undefined') {
      return window.matchMedia(mediaQuery).matches;
    }
    return false;
  };

  const [matches, setMatches] = useState<boolean>(getMatches(query));

  useEffect(() => {
    // Check if window is available (for SSR)
    if (typeof window === 'undefined') return undefined;

    const mediaQuery = window.matchMedia(query);

    // Update the state initially
    setMatches(mediaQuery.matches);

    // Define a callback function to handle changes
    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Add the callback as a listener for changes to the media query
    mediaQuery.addEventListener('change', handleChange);

    // Remove the listener when the component is unmounted
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [query]);

  return matches;
};

export default useMediaQuery;
