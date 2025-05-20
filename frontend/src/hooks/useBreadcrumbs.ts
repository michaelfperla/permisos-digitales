import { useMemo } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { clientRoutes, adminRoutes, BreadcrumbConfigItem, IconType } from '../utils/breadcrumbsConfig';
import { BreadcrumbItem } from '../components/navigation/Breadcrumbs/Breadcrumbs';

interface UseBreadcrumbsOptions {
  isAdmin?: boolean;
}

/**
 * Custom hook to generate breadcrumbs based on the current route
 *
 * @param options Configuration options
 * @returns Array of breadcrumb items for the current route
 */
const useBreadcrumbs = (options: UseBreadcrumbsOptions = {}) => {
  const { isAdmin = false } = options;
  const location = useLocation();
  const params = useParams();

  const breadcrumbs = useMemo(() => {
    // Determine which route configuration to use
    const routeConfig = isAdmin ? adminRoutes : clientRoutes;

    // Get the current pathname
    const { pathname } = location;

    // Find the matching route pattern
    // First try exact match
    let matchedRoute = routeConfig[pathname];

    // If no exact match, try to match patterns with parameters
    if (!matchedRoute) {
      // Get all route patterns
      const routePatterns = Object.keys(routeConfig);

      // Find a matching pattern
      const matchingPattern = routePatterns.find(pattern => {
        // Convert route pattern to regex
        // e.g., '/permits/:id' -> /^\/permits\/[^/]+$/
        const regexPattern = pattern
          .replace(/:[^/]+/g, '[^/]+')
          .replace(/\//g, '\\/');

        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(pathname);
      });

      if (matchingPattern) {
        matchedRoute = routeConfig[matchingPattern];

        // Replace parameter placeholders with actual values
        matchedRoute = matchedRoute.map(item => {
          // Create a new item to avoid mutating the original
          const newItem = { ...item };

          // If the path is empty, generate it from the current pathname
          if (!newItem.path) {
            // For items like "Detalles del Permiso" in a route like "/permits/:id"
            // we want to set the path to the actual current path
            newItem.path = pathname;

            // Special case for permit details breadcrumb
            if (newItem.label === 'Detalles del Permiso' && pathname.startsWith('/permits/')) {
              // This ensures the "Detalles del Permiso" breadcrumb has the correct path
              newItem.path = pathname;
            }
          } else if (newItem.path.includes(':')) {
            // Replace parameters in the path
            Object.entries(params).forEach(([key, value]) => {
              newItem.path = newItem.path.replace(`:${key}`, value as string);
            });
          }

          return newItem;
        });
      }
    }

    // If no match found, return a default breadcrumb
    if (!matchedRoute) {
      return isAdmin
        ? [{ label: 'Dashboard', path: '/', icon: null }]
        : [{ label: 'Inicio', path: '/', icon: null }];
    }

    // Convert BreadcrumbConfigItem[] to BreadcrumbItem[] by passing the iconType
    return matchedRoute.map(item => ({
      label: item.label,
      path: item.path,
      iconType: item.iconType
    }));
  }, [location, params, isAdmin]);

  return breadcrumbs;
};

export default useBreadcrumbs;
