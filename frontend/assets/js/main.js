/**
 * =============================================================================
 * Permisos Digitales - Main Application Router (main.js)
 * =============================================================================
 *
 * Handles client-side routing using URL hash changes (#) to simulate page navigation
 * without full page reloads. It dynamically loads HTML view partials into the
 * main application container (#app-root) and initializes component-specific JavaScript.
 * This creates the core Single Page Application (SPA) experience.
 */

// --- Load Cache Buster Utility ---
// Create and append the cache buster script
const cacheBusterScript = document.createElement('script');
cacheBusterScript.src = '/assets/js/utils/cache-buster.js?_t=' + new Date().getTime();
document.head.appendChild(cacheBusterScript);

// --- Wait for the DOM to be Ready ---
document.addEventListener('DOMContentLoaded', () => {

    console.log('[Router] DOM ready. Initializing SPA logic...');

    // --- Core Application References ---
    const appRoot = document.getElementById('app-root');
    
    // Create app-root if it doesn't exist (needed for initial page load)
    if (!appRoot) {
        console.log('[Router] Creating missing #app-root element');
        const newAppRoot = document.createElement('div');
        newAppRoot.id = 'app-root';
        document.body.appendChild(newAppRoot);
    }
    
    const transitionOverlay = document.getElementById('page-transition-overlay');

    // --- Critical Initialization Check ---
    if (!appRoot) {
        console.error('[Router] FATAL: Application root element #app-root not found in the DOM. SPA cannot mount.');
        document.body.innerHTML = '<p style="color: red; text-align: center; padding: 2rem; font-family: sans-serif;"><strong>Error Crítico:</strong> La aplicación no pudo iniciarse correctamente (falta el contenedor principal).</p>';
        return; // Halt script execution.
    }

    // We're removing the overlay functionality completely
    const toggleTransitionOverlay = () => {
        // No-op function to avoid errors
    };

    // --- Route Configuration ---
    // Maps hash paths to HTML partials, their initialization functions, and page titles.
    // Functions (like window.initLoginPage) must be globally accessible *before* this runs.
    const routes = {
        '/':           { view: '/views/home.html',         init: window.initHomePage || null,         title: 'Inicio' },
        '/login':      { view: '/views/login.html',        init: window.initLoginPage || null,        title: 'Iniciar Sesión' },
        '/register':   { view: '/views/register.html',     init: window.initRegisterPage || null,     title: 'Crear Cuenta' },
        '/forgot-password': { view: '/views/forgot-password.html', init: window.initForgotPasswordPage || null, title: 'Recuperar Contraseña' },
        '/reset-password': { view: '/views/reset-password.html', init: window.initResetPasswordPage || null, title: 'Restablecer Contraseña' },
        '/dashboard':  { view: '/views/dashboard.html',    init: window.initDashboardPage || null,    title: 'Dashboard' },
        '/permits/new':{ view: '/views/permit-form.html',  init: window.initPermitFormPage || null,  title: 'Solicitar Permiso' },
        // --- NEW PARAMETERIZED ROUTE DEFINITIONS ---
        '/permits/:id': { view: '/views/permit-detail.html', init: window.initPermitDetailPage || null, title: 'Detalle de Permiso' },
        '/permits/:id/renew': { view: '/views/permit-renewal-confirmation.html', init: window.initPermitRenewalPage || null, title: 'Renovar Permiso' },
        // '/permits/:id/upload': { view: '/views/permit-upload.html', init: window.initPermitUploadPage || null, title: 'Subir Documentos' }, // Add later
        '/admin/login': { view: '/views/admin-login.html', init: window.initAdminLoginPage || null, title: 'Admin Login' },
        '/admin/dashboard': { view: '/views/admin-dashboard.html', init: window.initAdminDashboard || null, title: 'Panel de Administración' },
        '/404':        { view: '/views/404.html',          init: window.init404Page || null,          title: 'Página No Encontrada' }
    };

        // --- View Loading and Rendering Function ---
    /**
     * Loads and renders the view corresponding to the given path,
     * handling basic parameterized routes (e.g., /permits/:id).
     * @param {string} path - The requested route path (e.g., '/login', '/permits/123').
     */
    async function loadView(path) {
        console.log(`[Router] Navigating to path: ${path}`);

        let routeConfig = null;
        let routeParams = {}; // To store extracted parameters like ID
        let effectivePath = path; // The path used for logging/init lookup

        // --- Parameterized Route Matching ---
        // Check for known patterns BEFORE exact matches
        const permitDetailMatch = path.match(/^\/permits\/(\d+)$/); // Matches /permits/ followed by numbers
        const permitUploadMatch = path.match(/^\/permits\/(\d+)\/upload$/); // Matches /permits/ID/upload
        const permitRenewMatch = path.match(/^\/permits\/(\d+)\/renew$/); // Matches /permits/ID/renew

        if (permitDetailMatch) {
            // Matched /permits/:id
            const id = permitDetailMatch[1]; // Extract the ID (group 1)
            routeConfig = routes['/permits/:id']; // Use the config for the pattern
            routeParams = { id: id }; // Store the extracted ID
            effectivePath = '/permits/:id'; // Use the pattern key for init lookup
            console.log(`[Router] Matched parameterized route: ${effectivePath} with params:`, routeParams);
        } else if (permitUploadMatch) {
            // Matched /permits/:id/upload
            const id = permitUploadMatch[1];
            routeConfig = routes['/permits/:id/upload'];
            routeParams = { id: id };
            effectivePath = '/permits/:id/upload';
            console.log(`[Router] Matched parameterized route: ${effectivePath} with params:`, routeParams);
        } else if (permitRenewMatch) {
            // Matched /permits/:id/renew
            const id = permitRenewMatch[1];
            routeConfig = routes['/permits/:id/renew'];
            routeParams = { id: id };
            effectivePath = '/permits/:id/renew';
            console.log(`[Router] Matched parameterized route: ${effectivePath} with params:`, routeParams);
        } else {
            // --- Exact Route Matching (Fallback) ---
            routeConfig = routes[path] || routes['/404'];
            effectivePath = routes[path] ? path : '/404';
        }

        // If no route config found even after checks (e.g., pattern defined but missing in routes object)
        if (!routeConfig) {
            console.error(`[Router] No route configuration found for path: ${path}. Loading 404.`);
            routeConfig = routes['/404'];
            effectivePath = '/404';
        }


        // 1. Start Fade Out
        console.log('[Router] Adding .view-loading class to #app-root');
        appRoot.classList.add('view-loading');

        const TRANSITION_DURATION_MS = 250; // Match CSS duration (0.25s = 250ms)

        // 2. Wait for fade-out transition to progress
        //    (Prevents content disappearing instantly before fade completes)
        await new Promise(resolve => setTimeout(resolve, TRANSITION_DURATION_MS));

        // Display loading indicator (now happens *after* fade-out starts)
        appRoot.innerHTML = '<div class="loading-indicator" style="display:flex;justify-content:center;align-items:center;min-height:200px;padding:2rem;"><div class="spinner" aria-label="Cargando vista..."></div></div>';

        try {
            console.log(`[Router] Fetching view partial: ${routeConfig.view}`);
            const response = await fetch(routeConfig.view);

            if (!response.ok) {
                 console.error(`[Router] Error fetching view partial ${routeConfig.view}: ${response.status} ${response.statusText}`);
                 // Ensure loading class is removed on error before loading 404 or showing error message
                 appRoot.classList.remove('view-loading');
                 if (effectivePath !== '/404') {
                    console.warn('[Router] Fetch failed, attempting to load 404 view instead.');
                    await loadView('/404'); // Load 404 (will handle its own transitions)
                 } else {
                    console.error('[Router] CRITICAL: Failed to load both the requested view AND the 404 view.');
                    appRoot.innerHTML = '<p style="color: red; text-align: center;">Error: No se pudo cargar la página solicitada ni la página de error.</p>';
                 }
                 return;
            }

            const htmlContent = await response.text();

            // 6. Inject new HTML (still invisible due to .view-loading class)
            appRoot.innerHTML = htmlContent;

            // 7. Update the document title based on the route
            let pageTitle = '';
            if (routeConfig.title) {
                // For home page, use a simpler title format
                if (effectivePath === '/') {
                    pageTitle = 'Permisos Digitales | ' + routeConfig.title;
                } else {
                    pageTitle = routeConfig.title + ' | Permisos Digitales';
                }
                document.title = pageTitle;
                console.log(`[Router] Updated page title to: ${pageTitle}`);
            }

            // 8. Dispatch a custom event before removing the loading class
            // This allows the header to synchronize its fade-in perfectly
            const transitionCompleteEvent = new CustomEvent('routeChangeCompleted', {
                detail: { path: path }
            });
            document.dispatchEvent(transitionCompleteEvent);
            console.log('[Router] Route change completion event dispatched');

            // 9. Remove loading class (triggers CSS fade-in transition)
            //    Do this *before* initializing component JS so elements are visible
            //    when the script runs, but allow a micro-task delay for rendering.
            requestAnimationFrame(() => { // Use rAF to ensure injection is rendered before fade-in starts
                console.log('[Router] Removing .view-loading class from #app-root');
                appRoot.classList.remove('view-loading');
            });

            // Ensure DOM update before init using setTimeout (as per previous fix)
            setTimeout(async () => {
                console.log(`[Router] DOM potentially updated (via setTimeout) for ${effectivePath}, attempting initialization.`);

                if (routeConfig.init && typeof routeConfig.init === 'function') {
                    console.log(`[Router] Initializing component script for: ${effectivePath}`);
                    try {
                        // Pass routeParams to the init function if needed (though our current init functions read from hash)
                        await routeConfig.init(routeParams); // Pass params object
                        console.log(`[Router] Component script for ${effectivePath} finished initialization.`);
                    } catch (initError) {
                        console.error(`[Router] Error executing initialization script for ${effectivePath}:`, initError);
                        const errorContainer = appRoot.querySelector('.message-area') || appRoot;
                        errorContainer.innerHTML = `<p class="error-message">Error al inicializar el componente de la página (${effectivePath}).</p>`;
                    }
                } else if (routeConfig.init) {
                    console.warn(`[Router] Initialization function specified for ${effectivePath} but not found or not a function.`);
                } else {
                    console.log(`[Router] No initialization script defined for path: ${effectivePath}`);
                }
            }, 10); // Small delay

        } catch (error) {
            // Handle network errors
            console.error(`[Router] Network error or other exception loading view for ${path}:`, error);
            // Ensure loading class is removed before showing error message
            appRoot.classList.remove('view-loading');
            appRoot.innerHTML = `<p style="color: orange; text-align: center;">Error de conexión al cargar la página. Por favor, verifique su conexión e intente de nuevo.</p>`;
        }
    } // End of loadView

    // --- Route Change Handler ---
    /**
     * Parses the current URL hash and triggers the loading of the corresponding view.
     */
    function handleRouteChange() {
        // Get the hash fragment (e.g., '#/dashboard') or default to '#/'
        const hash = window.location.hash || '#/';
        // Extract the path part (e.g., '/dashboard') without query parameters
        const fullPath = hash.substring(1);
        const path = fullPath.split('?')[0];

        console.log(`[Router] Processing route: ${path} (from full path: ${fullPath})`);

        // Check if we're on the admin portal and handle routes accordingly
        const isAdminPortal = sessionStorage.getItem('portalType') === 'admin' ||
                             sessionStorage.getItem('isAdminPortal') === 'true';
        const isAuthenticated = sessionStorage.getItem('isAuthenticated') === 'true';

        // If this is an admin route, use direct URL instead of SPA routing
        if (path.startsWith('/admin')) {
            console.log('[Router] Admin route detected in SPA - redirecting to direct URL');
            
            // Redirect to the appropriate admin page
            if (path === '/admin/login') {
                window.location.href = '/admin-login';
                return;
            } else if (path === '/admin/dashboard' || path === '/admin') {
                if (isAuthenticated && isAdminPortal) {
                    window.location.href = '/admin';
                } else {
                    window.location.href = '/admin-login';
                }
                return;
            }
        }

        // If we're on the admin portal and authenticated, redirect to admin dashboard
        if (path === '/admin' && isAdminPortal && isAuthenticated) {
            console.log('[Router] Detected direct access to /admin while authenticated, redirecting to admin dashboard');
            window.location.href = '/admin';
            return;
        }

        // If we're on the admin portal and not authenticated, redirect to admin login
        if (path === '/admin' && isAdminPortal && !isAuthenticated) {
            console.log('[Router] Detected direct access to /admin while not authenticated, redirecting to admin login');
            window.location.href = '/admin-login';
            return;
        }

        // Dispatch a custom event before starting the transition
        // This allows the header to synchronize its transition
        const routeChangeEvent = new CustomEvent('routeChangeStarted', {
            detail: { path: path, hash: hash, fullPath: fullPath }
        });
        document.dispatchEvent(routeChangeEvent);

        // Load the view corresponding to the extracted path
        loadView(path);
    }

    // --- Event Listeners Setup ---
    // Listen for hash changes (user clicks links, uses back/forward buttons)
    window.addEventListener('hashchange', handleRouteChange);
    console.log('[Router] Added hashchange event listener.');

    // --- Initial Page Load ---
    // Load the correct view based on the initial URL hash
    console.log('[Router] Performing initial route handling.');
    handleRouteChange();

    console.log('[Router] SPA Router initialization complete.');

}); // End of DOMContentLoaded listener