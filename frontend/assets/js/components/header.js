/**
 * =============================================================================
 * Permisos Digitales - Header Component Logic (header.js)
 * =============================================================================
 *
 * Contains the JavaScript logic for the site header:
 * - Initializes the header navigation based on authentication state
 * - Handles logout functionality
 * - Updates UI based on user state
 */

function initHeader() {
    console.log('[Header] Initializing header...');
    const navLinksContainer = document.getElementById('nav-links-container');
    if (!navLinksContainer) {
        console.error('[Header] Navigation links container #nav-links-container not found.');
        return;
    }

    // Initialize header scroll interaction
    initHeaderScrollInteraction();

    // Get reference to the logo link
    const logoLink = document.querySelector('.header-branding .logo-link');
    if (!logoLink) {
        console.warn('[Header] Logo link element not found. Logo context-awareness will not work.');
    }

    // Get current route for active state
    const currentHash = window.location.hash || '#/';
    const currentRoute = currentHash.split('?')[0]; // Remove query params if any

    // Check auth state using helper from utils.js
    const isAuthenticated = window.isUserAuthenticatedClientSide ? window.isUserAuthenticatedClientSide() : false;
    const userInfo = window.getUserInfoClientSide ? window.getUserInfoClientSide() : null;

    // Clear previous links
    navLinksContainer.innerHTML = '';

    if (isAuthenticated) {
        console.log('[Header] User is authenticated. Rendering logged-in links.');
        // Render Logged In State
        const userName = userInfo?.name || userInfo?.email || 'Usuario'; // Display name or email
        // Check if dashboard is active
        const isDashboardActive = currentRoute === '#/dashboard';

        navLinksContainer.innerHTML = `
            <li class="nav-user-info">Hola, <span id="user-name-display">${userName}</span>!</li>
            <li><a href="#/dashboard" class="nav-link ${isDashboardActive ? 'active' : ''}">Dashboard</a></li>
            <li>
                <button type="button" id="header-logout-btn" class="btn-like-link">
                    Cerrar Sesión
                </button>
            </li>
        `;
        // Add event listener to the newly created logout button
        const logoutBtn = document.getElementById('header-logout-btn');
        if (logoutBtn && typeof window.handleLogout === 'function') {
            logoutBtn.addEventListener('click', window.handleLogout);
        } else if (!logoutBtn) {
             console.error('[Header] Could not find logout button after rendering.');
        } else {
             console.error('[Header] Global handleLogout function not found for header button.');
        }

        // Update logo link to point to dashboard when logged in
        if (logoLink) {
            logoLink.href = '#/dashboard'; // Point logo to dashboard when logged in
            logoLink.setAttribute('aria-label', 'Permisos Digitales - Dashboard'); // Update aria-label
            console.log('[Header] Updated logo link to point to dashboard');
        }
    } else {
        console.log('[Header] User is not authenticated. Rendering logged-out links.');
        // Render Logged Out State
        // Check active states for login/register
        const isLoginActive = currentRoute === '#/login';
        const isRegisterActive = currentRoute === '#/register';

        navLinksContainer.innerHTML = `
            <li><a href="#/login" class="nav-link ${isLoginActive ? 'active' : ''}">Iniciar Sesión</a></li>
            <li><a href="#/register" class="btn btn-primary btn-small ${isRegisterActive ? 'active-btn' : ''}">Registrarse</a></li>
        `;

        // Ensure logo link points to home when logged out
        if (logoLink) {
            logoLink.href = '#/'; // Point logo to home when logged out
            logoLink.setAttribute('aria-label', 'Permisos Digitales - Inicio'); // Reset aria-label
            console.log('[Header] Updated logo link to point to home');
        }
    }

    // We already call setupMobileMenu() here, which will attach event listeners
    // to the newly created navigation links
    setupMobileMenu();

    console.log('[Header] Header initialization complete.');
}

/**
 * Sets up the mobile menu toggle functionality
 * This is called both during initial header setup and after navigation links are updated
 */
function setupMobileMenu() {
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const headerNav = document.getElementById('header-nav');
    const appHeader = document.getElementById('app-header');
    const mobileMenuOverlay = document.getElementById('mobile-menu-overlay');

    if (!mobileMenuToggle || !headerNav || !appHeader) {
        console.warn('[Header] Mobile menu elements not found. Mobile menu may not work properly.');
        return;
    }

    // Get reference to the close button (now included in HTML)
    const closeButton = document.getElementById('mobile-menu-close');
    if (!closeButton) {
        console.warn('[Header] Mobile menu close button not found. Mobile menu may not work properly.');
    }

    // Function to open the mobile menu
    const openMobileMenu = () => {
        appHeader.classList.add('mobile-menu-open');
        mobileMenuToggle.setAttribute('aria-expanded', 'true');
        document.body.classList.add('mobile-menu-open'); // Prevent body scrolling

        // Only show close button on mobile
        if (window.innerWidth <= 768) {
            closeButton.style.display = 'flex';
        } else {
            closeButton.style.display = 'none';
        }

        // Set focus to the first focusable element in the menu
        setTimeout(() => {
            const firstFocusable = headerNav.querySelector('a, button');
            if (firstFocusable) firstFocusable.focus();
        }, 100);

        console.log('[Header] Mobile menu opened');
    };

    // Function to close the mobile menu
    const closeMobileMenu = () => {
        appHeader.classList.remove('mobile-menu-open');
        mobileMenuToggle.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('mobile-menu-open'); // Re-enable body scrolling

        // Close button visibility is handled by CSS

        // Return focus to the toggle button
        mobileMenuToggle.focus();

        console.log('[Header] Mobile menu closed');
    };

    // Setup toggle button click handler (only once)
    if (!mobileMenuToggle.hasAttribute('data-initialized')) {
        mobileMenuToggle.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent any default action

            if (appHeader.classList.contains('mobile-menu-open')) {
                closeMobileMenu();
            } else {
                openMobileMenu();
            }
        });

        // Mark as initialized to prevent duplicate event listeners
        mobileMenuToggle.setAttribute('data-initialized', 'true');
    }

    // Setup close button click handler
    closeButton.addEventListener('click', (e) => {
        e.preventDefault();
        closeMobileMenu();
    });

    // Setup overlay click handler
    if (mobileMenuOverlay) {
        mobileMenuOverlay.addEventListener('click', () => {
            closeMobileMenu();
        });
    }

    // Add click handlers to all navigation links (including newly added ones)
    const navLinks = headerNav.querySelectorAll('a, button:not(.mobile-menu-close)');
    navLinks.forEach(link => {
        // Skip if already initialized
        if (link.hasAttribute('data-mobile-menu-initialized')) {
            return;
        }

        link.addEventListener('click', () => {
            closeMobileMenu();
        });

        // Mark as initialized
        link.setAttribute('data-mobile-menu-initialized', 'true');
    });

    // Handle escape key to close menu
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && appHeader.classList.contains('mobile-menu-open')) {
            closeMobileMenu();
        }
    });

    // Trap focus within the menu when it's open
    document.addEventListener('focusin', (e) => {
        if (!appHeader.classList.contains('mobile-menu-open')) return;

        // If focus moves outside the menu, bring it back
        if (!headerNav.contains(e.target) && e.target !== mobileMenuToggle) {
            e.preventDefault();
            closeButton.focus();
        }
    });

    // Handle window resize - close menu when viewport width exceeds mobile breakpoint
    const handleResize = () => {
        if (window.innerWidth > 768) {
            // Always hide close button in desktop view
            closeButton.style.display = 'none !important';

            // Close mobile menu if it's open
            if (appHeader.classList.contains('mobile-menu-open')) {
                closeMobileMenu();
                console.log('[Header] Mobile menu closed due to viewport resize');
            }
        }
    };

    // Add resize listener (only once)
    if (!window.mobileMenuResizeListenerAdded) {
        window.addEventListener('resize', handleResize);
        window.mobileMenuResizeListenerAdded = true;
        console.log('[Header] Added resize listener for mobile menu');
    }

    // Ensure close button is hidden on desktop initially
    if (window.innerWidth > 768) {
        closeButton.style.display = 'none !important';
        console.log('[Header] Initially hiding close button on desktop');
    }

    console.log(`[Header] Mobile menu setup complete. Found ${navLinks.length} navigation links.`);
}

// --- Initialization Trigger ---
// If header HTML is always present in index.html (static approach):
document.addEventListener('DOMContentLoaded', initHeader);

// If header HTML is loaded dynamically by main.js (dynamic approach):
// main.js would need to call initHeader() after injecting header HTML.

// Listen for the custom route change event from main.js
// This ensures perfect synchronization with the main content transitions
document.addEventListener('routeChangeStarted', (event) => {
    console.log('[Header] Route change detected:', event.detail.hash);

    // Get reference to the header
    const header = document.getElementById('app-header');
    if (!header) return;

    // Add updating class to trigger header fade-out at exactly the same time as main content
    header.classList.add('header-updating');

    // Wait for the fade-out transition to complete before updating header content
    // This matches the exact timing in main.js loadView function
    const TRANSITION_DURATION_MS = 250; // Match CSS duration (0.25s = 250ms)
    setTimeout(() => {
        // Update header content while main content is transitioning
        initHeader();
    }, TRANSITION_DURATION_MS);
});

// Listen for the route change completion event
document.addEventListener('routeChangeCompleted', (event) => {
    console.log('[Header] Route change completion detected:', event.detail.path);

    // Get reference to the header
    const header = document.getElementById('app-header');
    if (!header) return;

    // In main.js, the routeChangeCompleted event is dispatched with a 200ms delay
    // after removing the .view-loading class. However, the main content starts fading in
    // immediately when .view-loading is removed. To perfectly synchronize with the main content,
    // we need to remove the .header-updating class at the same time as .view-loading is removed,
    // which is 200ms BEFORE this event is received.
    // Since we can't go back in time, we'll remove the class immediately without any delay.
    header.classList.remove('header-updating');
});

// Also keep the hashchange listener as a fallback
window.addEventListener('hashchange', () => {
    // This is just a safety net in case the custom event doesn't fire
    // It will be slightly delayed to avoid conflicts
    setTimeout(() => {
        if (!document.getElementById('app-header').classList.contains('header-updating')) {
            console.log('[Header] Fallback header update via hashchange');
            initHeader();
        }
    }, 400); // After main transition should be complete
});

/**
 * Initialize header scroll interaction
 * Hides header on scroll down, shows on scroll up
 */
function initHeaderScrollInteraction() {
    const header = document.getElementById('app-header');
    if (!header) {
        console.error('[Header] Header element #app-header not found.');
        return;
    }

    let lastScrollTop = 0;
    const delta = 5; // Minimum amount of pixels scrolled before triggering hide/show
    const headerHeight = header.offsetHeight;

    // Add scroll event listener
    window.addEventListener('scroll', function() {
        // Get current scroll position
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

        // Ignore small scrolls
        if (Math.abs(lastScrollTop - scrollTop) <= delta) {
            return;
        }

        // Scrolling down AND past the header height
        if (scrollTop > lastScrollTop && scrollTop > headerHeight) {
            header.classList.add('header-hidden');
        }
        // Scrolling up OR at the top
        else {
            header.classList.remove('header-hidden');
        }

        // Update last scroll position
        lastScrollTop = scrollTop;
    }, { passive: true }); // Use passive listener for better performance
}

console.log('[Header] Header script loaded.');
