import { useCallback, useMemo, useRef, useEffect } from 'react';
import { useQuery, UseQueryOptions } from '@tanstack/react-query';

/**
 * Performance optimization hooks for admin portal
 * Implements professional memoization and optimization strategies
 */

/**
 * Debounced callback hook for search and filter inputs
 */
export const useDebouncedCallback = <T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T => {
  const timeoutRef = useRef<NodeJS.Timeout>();

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay]
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback as T;
};

/**
 * Optimized pagination hook with memoized calculations
 */
export const usePagination = (
  currentPage: number,
  totalItems: number,
  itemsPerPage: number
) => {
  return useMemo(() => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
    
    const hasNextPage = currentPage < totalPages;
    const hasPreviousPage = currentPage > 1;
    
    // Generate page numbers for pagination UI
    const generatePageNumbers = () => {
      const delta = 2; // Pages to show around current page
      const pages: number[] = [];
      
      for (let i = Math.max(1, currentPage - delta); i <= Math.min(totalPages, currentPage + delta); i++) {
        pages.push(i);
      }
      
      return pages;
    };

    return {
      totalPages,
      startIndex,
      endIndex,
      hasNextPage,
      hasPreviousPage,
      pageNumbers: generatePageNumbers(),
      itemsShown: `${startIndex + 1}-${endIndex} de ${totalItems}`
    };
  }, [currentPage, totalItems, itemsPerPage]);
};

/**
 * Optimized query hook with smart caching and background updates
 */
export const useOptimizedQuery = <TData = unknown, TError = unknown>(
  queryKey: any[],
  queryFn: () => Promise<TData>,
  options?: UseQueryOptions<TData, TError>
) => {
  return useQuery({
    queryKey,
    queryFn,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: 'always',
    retry: 2,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...options,
  });
};

/**
 * Table sorting and filtering optimization hook
 */
export const useTableOptimization = <T>(
  data: T[],
  searchTerm: string,
  sortConfig: { key: string; direction: 'asc' | 'desc' } | null,
  searchFields: (keyof T)[]
) => {
  return useMemo(() => {
    let processedData = [...data];

    // Filter by search term
    if (searchTerm.trim()) {
      const lowerSearch = searchTerm.toLowerCase();
      processedData = processedData.filter(item =>
        searchFields.some(field => {
          const value = item[field];
          return value && 
                 String(value).toLowerCase().includes(lowerSearch);
        })
      );
    }

    // Sort data
    if (sortConfig) {
      processedData.sort((a, b) => {
        const aValue = a[sortConfig.key as keyof T];
        const bValue = b[sortConfig.key as keyof T];

        if (aValue == null) return 1;
        if (bValue == null) return -1;

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return processedData;
  }, [data, searchTerm, sortConfig, searchFields]);
};

/**
 * Virtual scrolling hook for large datasets
 */
export const useVirtualScroll = (
  items: any[],
  itemHeight: number,
  containerHeight: number
) => {
  return useMemo(() => {
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const bufferSize = Math.max(5, Math.floor(visibleCount * 0.5));
    
    return {
      visibleCount,
      bufferSize,
      totalHeight: items.length * itemHeight,
      getVisibleRange: (scrollTop: number) => {
        const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - bufferSize);
        const endIndex = Math.min(items.length, startIndex + visibleCount + bufferSize * 2);
        
        return {
          startIndex,
          endIndex,
          offsetY: startIndex * itemHeight,
          visibleItems: items.slice(startIndex, endIndex)
        };
      }
    };
  }, [items.length, itemHeight, containerHeight]);
};

/**
 * Intersection Observer hook for lazy loading
 */
export const useIntersectionObserver = (
  callback: () => void,
  options?: IntersectionObserverInit
) => {
  const targetRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver>();

  useEffect(() => {
    if (!targetRef.current) return;

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          callback();
        }
      },
      {
        threshold: 0.1,
        rootMargin: '50px',
        ...options
      }
    );

    observerRef.current.observe(targetRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [callback, options]);

  return targetRef;
};

/**
 * Performance monitoring hook for admin actions
 */
export const usePerformanceMonitor = (actionName: string) => {
  const startTime = useRef<number>();

  const startTracking = useCallback(() => {
    startTime.current = performance.now();
  }, []);

  const endTracking = useCallback(() => {
    if (startTime.current) {
      const duration = performance.now() - startTime.current;
      
      // Log performance data
      if (duration > 1000) { // Warn about slow operations
        console.warn(`Slow admin operation detected: ${actionName} took ${duration.toFixed(2)}ms`);
      }
      
      // Send to analytics if available
      if (window.gtag) {
        window.gtag('event', 'timing_complete', {
          name: actionName,
          value: Math.round(duration),
          event_category: 'admin_performance'
        });
      }
      
      startTime.current = undefined;
      return duration;
    }
    return 0;
  }, [actionName]);

  return { startTracking, endTracking };
};