/**
 * Router module for the frontend
 * Handles client-side routing using hash-based navigation
 */

const router = {
  /**
   * Route definitions
   * Each route has:
   * - view: The name of the view to render
   * - title: The page title to set
   * - authRequired: Whether authentication is required to access the route
   * - adminRequired: Whether admin privileges are required to access the route
   */
  routes: {
    '/': { view: 'home', title: 'Inicio', authRequired: false },
    '/login': { view: 'login', title: 'Iniciar Sesión', authRequired: false },
    '/register': { view: 'register', title: 'Registrarse', authRequired: false },
    '/forgot-password': { view: 'forgot-password', title: 'Recuperar Contraseña', authRequired: false },
    '/dashboard': { view: 'dashboard', title: 'Dashboard', authRequired: true },
    '/permits/new': { view: 'permit-form', title: 'Solicitar Permiso', authRequired: true },
    '/permits/:id': { view: 'permit-detail', title: 'Detalle de Permiso', authRequired: true },
    '/permits/:id/renew': { view: 'permit-renew', title: 'Renovar Permiso', authRequired: true },
    '/admin': { view: 'admin-dashboard', title: 'Admin Dashboard', authRequired: true, adminRequired: true }
  },
  
  /**
   * Current route information
   */
  currentRoute: null,
  
  /**
   * Parse the current URL and return the route path
   * @returns {string} The route path
   */
  parseLocation() {
    let path = window.location.hash.slice(1).toLowerCase() || '/';
    const queryStringStart = path.indexOf('?');
    
    if (queryStringStart !== -1) {
      path = path.slice(0, queryStringStart);
    }
    
    return path;
  },
  
  /**
   * Extract route parameters from the URL
   * @param {string} route - The route pattern
   * @param {string} path - The actual path
   * @returns {Object} The extracted parameters
   */
  extractRouteParams(route, path) {
    if (!route.includes(':')) return {};
    
    const routeParts = route.split('/');
    const pathParts = path.split('/');
    const params = {};
    
    routeParts.forEach((part, i) => {
      if (part.startsWith(':')) {
        const paramName = part.slice(1);
        params[paramName] = pathParts[i];
      }
    });
    
    return params;
  },
  
  /**
   * Find the matching route for the given path
   * @param {string} path - The path to match
   * @returns {Object} The matching route information
   */
  findMatchingRoute(path) {
    // First try exact match
    if (this.routes[path]) {
      return { route: this.routes[path], params: {}, path };
    }
    
    // Then try parameterized routes
    for (const route in this.routes) {
      if (this.isParameterizedMatch(route, path)) {
        return {
          route: this.routes[route],
          params: this.extractRouteParams(route, path),
          path: route
        };
      }
    }
    
    // Return 404 if no match
    return { route: { view: '404', title: 'Página no encontrada', authRequired: false }, params: {}, path: '/404' };
  },
  
  /**
   * Check if a parameterized route matches the path
   * @param {string} route - The route pattern
   * @param {string} path - The actual path
   * @returns {boolean} Whether the route matches the path
   */
  isParameterizedMatch(route, path) {
    if (!route.includes(':')) return false;
    
    const routeParts = route.split('/');
    const pathParts = path.split('/');
    
    if (routeParts.length !== pathParts.length) return false;
    
    return routeParts.every((part, i) => {
      if (part.startsWith(':')) return true;
      return part === pathParts[i];
    });
  },
  
  /**
   * Navigate to a route
   * @param {string} path - The path to navigate to
   */
  navigate(path) {
    window.location.hash = path;
  },
  
  /**
   * Check if the user is authenticated
   * @returns {boolean} Whether the user is authenticated
   */
  isAuthenticated() {
    return sessionStorage.getItem('isAuthenticated') === 'true';
  },
  
  /**
   * Check if the user is an admin
   * @returns {boolean} Whether the user is an admin
   */
  isAdmin() {
    const userInfo = sessionStorage.getItem('userInfo');
    if (!userInfo) return false;
    
    try {
      const user = JSON.parse(userInfo);
      return user.role === 'admin';
    } catch (e) {
      return false;
    }
  },
  
  /**
   * Initialize the router
   */
  init() {
    // Handle initial route
    this.handleRouteChange();
    
    // Listen for hash changes
    window.addEventListener('hashchange', () => this.handleRouteChange());
  },
  
  /**
   * Handle route changes
   */
  handleRouteChange() {
    const path = this.parseLocation();
    const { route, params } = this.findMatchingRoute(path);
    
    // Check authentication
    if (route.authRequired && !this.isAuthenticated()) {
      this.navigate('/login');
      return;
    }
    
    // Check admin privileges
    if (route.adminRequired && !this.isAdmin()) {
      this.navigate('/dashboard');
      return;
    }
    
    // Update current route
    this.currentRoute = { route, params, path };
    
    // Update page title
    document.title = `${route.title} | Permisos Digitales`;
    
    // Render the view
    this.renderView(route.view, params);
    
    // Update active navigation links
    this.updateNavigation();
  },
  
  /**
   * Render a view
   * @param {string} view - The name of the view to render
   * @param {Object} params - The route parameters
   */
  renderView(view, params) {
    // Get the app root element
    const appRoot = document.getElementById('app-root');
    if (!appRoot) return;
    
    // Clear previous view
    appRoot.innerHTML = '';
    
    // Add transition class
    appRoot.classList.add('view-transition');
    
    // Initialize the view
    switch (view) {
      case 'home':
        this.initHomeView(appRoot);
        break;
      case 'login':
        this.initLoginView(appRoot);
        break;
      case 'register':
        this.initRegisterView(appRoot);
        break;
      case 'forgot-password':
        this.initForgotPasswordView(appRoot);
        break;
      case 'dashboard':
        this.initDashboardView(appRoot);
        break;
      case 'permit-form':
        this.initPermitFormView(appRoot);
        break;
      case 'permit-detail':
        this.initPermitDetailView(appRoot, params);
        break;
      case 'permit-renew':
        this.initPermitRenewView(appRoot, params);
        break;
      case 'admin-dashboard':
        this.initAdminDashboardView(appRoot);
        break;
      case '404':
        this.init404View(appRoot);
        break;
      default:
        this.init404View(appRoot);
    }
    
    // Remove transition class after animation completes
    setTimeout(() => {
      appRoot.classList.remove('view-transition');
    }, 300);
  },
  
  /**
   * Update navigation links based on current route
   */
  updateNavigation() {
    // Update active navigation links
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (href === window.location.hash || (href === '#/' && window.location.hash === '')) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
    
    // Update authentication-dependent elements
    const authRequired = document.querySelectorAll('.auth-required');
    const noAuthRequired = document.querySelectorAll('.no-auth-required');
    
    if (this.isAuthenticated()) {
      authRequired.forEach(el => el.hidden = false);
      noAuthRequired.forEach(el => el.hidden = true);
    } else {
      authRequired.forEach(el => el.hidden = true);
      noAuthRequired.forEach(el => el.hidden = false);
    }
    
    // Update admin-dependent elements
    const adminRequired = document.querySelectorAll('.admin-required');
    
    if (this.isAdmin()) {
      adminRequired.forEach(el => el.hidden = false);
    } else {
      adminRequired.forEach(el => el.hidden = true);
    }
  },
  
  /**
   * Initialize the home view
   * @param {HTMLElement} container - The container element
   */
  initHomeView(container) {
    // Load the home view template
    fetch('/views/home.html')
      .then(response => response.text())
      .then(html => {
        container.innerHTML = html;
        
        // Initialize home page functionality
        if (typeof window.initHomePage === 'function') {
          window.initHomePage();
        }
      })
      .catch(error => {
        console.error('[Router] Error loading home view:', error);
        container.innerHTML = '<div class="error-message">Error loading view</div>';
      });
  },
  
  /**
   * Initialize the login view
   * @param {HTMLElement} container - The container element
   */
  initLoginView(container) {
    // Load the login view template
    fetch('/views/login.html')
      .then(response => response.text())
      .then(html => {
        container.innerHTML = html;
        
        // Initialize login page functionality
        if (typeof window.initLoginPage === 'function') {
          window.initLoginPage();
        }
      })
      .catch(error => {
        console.error('[Router] Error loading login view:', error);
        container.innerHTML = '<div class="error-message">Error loading view</div>';
      });
  },
  
  /**
   * Initialize the register view
   * @param {HTMLElement} container - The container element
   */
  initRegisterView(container) {
    // Load the register view template
    fetch('/views/register.html')
      .then(response => response.text())
      .then(html => {
        container.innerHTML = html;
        
        // Initialize register page functionality
        if (typeof window.initRegisterPage === 'function') {
          window.initRegisterPage();
        }
      })
      .catch(error => {
        console.error('[Router] Error loading register view:', error);
        container.innerHTML = '<div class="error-message">Error loading view</div>';
      });
  },
  
  /**
   * Initialize the forgot password view
   * @param {HTMLElement} container - The container element
   */
  initForgotPasswordView(container) {
    // Load the forgot password view template
    fetch('/views/forgot-password.html')
      .then(response => response.text())
      .then(html => {
        container.innerHTML = html;
        
        // Initialize forgot password page functionality
        if (typeof window.initForgotPasswordPage === 'function') {
          window.initForgotPasswordPage();
        }
      })
      .catch(error => {
        console.error('[Router] Error loading forgot password view:', error);
        container.innerHTML = '<div class="error-message">Error loading view</div>';
      });
  },
  
  /**
   * Initialize the dashboard view
   * @param {HTMLElement} container - The container element
   */
  initDashboardView(container) {
    // Load the dashboard view template
    fetch('/views/dashboard.html')
      .then(response => response.text())
      .then(html => {
        container.innerHTML = html;
        
        // Initialize dashboard page functionality
        if (typeof window.initDashboardPage === 'function') {
          window.initDashboardPage();
        }
      })
      .catch(error => {
        console.error('[Router] Error loading dashboard view:', error);
        container.innerHTML = '<div class="error-message">Error loading view</div>';
      });
  },
  
  /**
   * Initialize the permit form view
   * @param {HTMLElement} container - The container element
   */
  initPermitFormView(container) {
    // Load the permit form view template
    fetch('/views/permit-form.html')
      .then(response => response.text())
      .then(html => {
        container.innerHTML = html;
        
        // Initialize permit form page functionality
        if (typeof window.initPermitFormPage === 'function') {
          window.initPermitFormPage();
        }
      })
      .catch(error => {
        console.error('[Router] Error loading permit form view:', error);
        container.innerHTML = '<div class="error-message">Error loading view</div>';
      });
  },
  
  /**
   * Initialize the permit detail view
   * @param {HTMLElement} container - The container element
   * @param {Object} params - The route parameters
   */
  initPermitDetailView(container, params) {
    // Load the permit detail view template
    fetch('/views/permit-detail.html')
      .then(response => response.text())
      .then(html => {
        container.innerHTML = html;
        
        // Initialize permit detail page functionality
        if (typeof window.initPermitDetailPage === 'function') {
          window.initPermitDetailPage(params.id);
        }
      })
      .catch(error => {
        console.error('[Router] Error loading permit detail view:', error);
        container.innerHTML = '<div class="error-message">Error loading view</div>';
      });
  },
  
  /**
   * Initialize the permit renew view
   * @param {HTMLElement} container - The container element
   * @param {Object} params - The route parameters
   */
  initPermitRenewView(container, params) {
    // Load the permit renew view template
    fetch('/views/permit-renew.html')
      .then(response => response.text())
      .then(html => {
        container.innerHTML = html;
        
        // Initialize permit renew page functionality
        if (typeof window.initPermitRenewPage === 'function') {
          window.initPermitRenewPage(params.id);
        }
      })
      .catch(error => {
        console.error('[Router] Error loading permit renew view:', error);
        container.innerHTML = '<div class="error-message">Error loading view</div>';
      });
  },
  
  /**
   * Initialize the admin dashboard view
   * @param {HTMLElement} container - The container element
   */
  initAdminDashboardView(container) {
    // Load the admin dashboard view template
    fetch('/views/admin-dashboard.html')
      .then(response => response.text())
      .then(html => {
        container.innerHTML = html;
        
        // Initialize admin dashboard page functionality
        if (typeof window.initAdminDashboardPage === 'function') {
          window.initAdminDashboardPage();
        }
      })
      .catch(error => {
        console.error('[Router] Error loading admin dashboard view:', error);
        container.innerHTML = '<div class="error-message">Error loading view</div>';
      });
  },
  
  /**
   * Initialize the 404 view
   * @param {HTMLElement} container - The container element
   */
  init404View(container) {
    // Load the 404 view template
    fetch('/views/404.html')
      .then(response => response.text())
      .then(html => {
        container.innerHTML = html;
      })
      .catch(error => {
        console.error('[Router] Error loading 404 view:', error);
        container.innerHTML = '<div class="error-message">Página no encontrada</div>';
      });
  }
};

// Export the router object for use in other modules
window.router = router;

// Initialize the router when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  router.init();
});
