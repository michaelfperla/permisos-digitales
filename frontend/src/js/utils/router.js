/**
 * Client-side Router
 * Handles navigation without page reloads
 */

const routes = {
  '/': { view: 'home', title: 'Inicio' },
  '/login': { view: 'login', title: 'Iniciar Sesión' },
  '/register': { view: 'register', title: 'Crear Cuenta' },
  '/forgot-password': { view: 'forgot-password', title: 'Recuperar Contraseña' },
  '/reset-password': { view: 'reset-password', title: 'Restablecer Contraseña' },
  '/dashboard': { view: 'dashboard', title: 'Dashboard' },
  '/permits/new': { view: 'permit-form', title: 'Solicitar Permiso' },
  '/permits/:id': { view: 'permit-detail', title: 'Detalle de Permiso' },
  '/permits/:id/renew': { view: 'permit-renewal-confirmation', title: 'Renovar Permiso' },
  '/admin/login': { view: 'admin-login', title: 'Admin Login' },
  '/admin/dashboard': { view: 'admin-dashboard', title: 'Panel de Administración' },
  '/404': { view: '404', title: 'Página No Encontrada' }
};

let appRoot;

/**
 * Initialize the router
 */
export function initRouter() {
  appRoot = document.getElementById('app-root');
  
  if (!appRoot) {
    console.error('[Router] Fatal: Application root element #app-root not found');
    return;
  }
  
  // Handle clicks on anchor tags
  document.body.addEventListener('click', handleLinkClick);
  
  // Listen for hash changes
  window.addEventListener('hashchange', handleRouteChange);
  
  // Initial route handling
  handleRouteChange();
  
  console.log('[Router] Initialized successfully');
}

/**
 * Handle link clicks to use the router instead of browser navigation
 * @param {Event} e - Click event
 */
function handleLinkClick(e) {
  // Find the closest anchor tag if the click event wasn't directly on one
  const link = e.target.closest('a');
  
  // Check if this is a link that should be handled by the router
  if (link && link.getAttribute('href').startsWith('#/')) {
    e.preventDefault();
    const href = link.getAttribute('href');
    window.location.hash = href;
  }
}

/**
 * Handle route changes
 */
function handleRouteChange() {
  // Get the hash fragment (e.g., '#/dashboard') or default to '#/'
  const hash = window.location.hash || '#/';
  
  // Extract the path part (e.g., '/dashboard') without query parameters
  const fullPath = hash.substring(1);
  const path = fullPath.split('?')[0];
  
  loadView(path);
}

/**
 * Load and render the view for a given path
 * @param {string} path - The requested route path
 */
async function loadView(path) {
  console.log(`[Router] Navigating to path: ${path}`);
  
  // Show loading state
  appRoot.classList.add('view-loading');
  appRoot.innerHTML = '<div class="loading-indicator"><div class="spinner"></div></div>';
  
  try {
    // Determine which route config to use
    let routeConfig = matchRoute(path);
    
    if (!routeConfig) {
      console.error(`[Router] No route configuration found for path: ${path}`);
      routeConfig = routes['/404'];
    }
    
    // Get the view path
    const viewPath = `/views/${routeConfig.view}.html`;
    
    // Fetch the view content
    const response = await fetch(viewPath);
    
    if (!response.ok) {
      throw new Error(`Failed to load view: ${response.status} ${response.statusText}`);
    }
    
    const htmlContent = await response.text();
    
    // Update the DOM with the new view
    appRoot.innerHTML = htmlContent;
    
    // Update document title
    document.title = `${routeConfig.title} | Permisos Digitales`;
    
    // Initialize the view
    initView(routeConfig.view, extractParams(path));
    
  } catch (error) {
    console.error('[Router] Error loading view:', error);
    appRoot.innerHTML = `<div class="error-message">Error loading view: ${error.message}</div>`;
  } finally {
    // Remove loading state
    appRoot.classList.remove('view-loading');
  }
}

/**
 * Match a path to a route configuration, handling parameterized routes
 * @param {string} path - The path to match
 * @returns {Object|null} - Matching route configuration or null
 */
function matchRoute(path) {
  // Check for direct match first
  if (routes[path]) {
    return routes[path];
  }
  
  // Check for parameterized routes
  const permitDetailMatch = path.match(/^\/permits\/(\d+)$/);
  const permitRenewMatch = path.match(/^\/permits\/(\d+)\/renew$/);
  
  if (permitDetailMatch) {
    return routes['/permits/:id'];
  }
  
  if (permitRenewMatch) {
    return routes['/permits/:id/renew'];
  }
  
  // No match found
  return null;
}

/**
 * Extract parameters from a path
 * @param {string} path - The path to extract parameters from
 * @returns {Object} - Object with extracted parameters
 */
function extractParams(path) {
  const params = {};
  
  const permitDetailMatch = path.match(/^\/permits\/(\d+)$/);
  const permitRenewMatch = path.match(/^\/permits\/(\d+)\/renew$/);
  
  if (permitDetailMatch) {
    params.id = permitDetailMatch[1];
  }
  
  if (permitRenewMatch) {
    params.id = permitRenewMatch[1];
  }
  
  return params;
}

/**
 * Initialize a view based on its name
 * @param {string} viewName - The name of the view to initialize
 * @param {Object} params - Route parameters
 */
function initView(viewName, params) {
  // Import and initialize the corresponding view component
  // We'll use dynamic imports to load only what we need
  let initPromise;
  
  switch (viewName) {
    case 'home':
      import('../components/home').then(module => {
        if (module.initHome) module.initHome();
      });
      break;
      
    case 'login':
      import('../components/auth').then(module => {
        if (module.initLogin) module.initLogin();
      });
      break;
      
    case 'dashboard':
      import('../components/dashboard').then(module => {
        if (module.initDashboard) module.initDashboard();
      });
      break;
      
    case 'permit-detail':
      import('../components/permit-detail').then(module => {
        if (module.initPermitDetail) module.initPermitDetail(params);
      });
      break;
      
    // Add more cases as needed
      
    default:
      // No specific initialization needed
      console.log(`[Router] No specific initialization for view: ${viewName}`);
  }
}
