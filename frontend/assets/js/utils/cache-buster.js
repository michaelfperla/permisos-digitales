/**
 * =============================================================================
 * Permisos Digitales - Cache Busting Utility
 * =============================================================================
 *
 * This utility adds version parameters to CSS and JS files to prevent browser caching
 * when files are updated. It should be included before any other scripts.
 */

(function() {
    // Generate a timestamp-based version string
    const VERSION = new Date().getTime();

    // Function to add version parameter to resource URLs
    function addVersionToResources() {
        // Only add version to resources that don't already have a version parameter
        // and only if we're in development mode
        const isDevelopment = window.location.hostname === 'localhost' ||
                             window.location.hostname === '127.0.0.1';

        if (!isDevelopment) {
            console.log('[Cache Buster] Skipping in production environment');
            return;
        }

        // Add version to CSS links
        const cssLinks = document.querySelectorAll('link[rel="stylesheet"]');
        cssLinks.forEach(link => {
            const currentHref = link.getAttribute('href');
            if (currentHref && !currentHref.includes('?') && !currentHref.includes('fonts.googleapis.com')) {
                link.setAttribute('href', `${currentHref}?_t=${VERSION}`);
            }
        });

        // Add version to JS scripts
        const scripts = document.querySelectorAll('script[src]');
        scripts.forEach(script => {
            const currentSrc = script.getAttribute('src');
            if (currentSrc && !currentSrc.includes('?')) {
                script.setAttribute('src', `${currentSrc}?_t=${VERSION}`);
            }
        });

        console.log('[Cache Buster] Added version parameters to resources:', VERSION);
    }

    // Add version parameters when DOM is loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addVersionToResources);
    } else {
        addVersionToResources();
    }

    // Expose a function to dynamically load resources with cache busting
    window.loadResourceWithVersion = function(url, type) {
        const versionedUrl = `${url}?v=${VERSION}`;

        return new Promise((resolve, reject) => {
            if (type === 'css') {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = versionedUrl;
                link.onload = () => resolve(link);
                link.onerror = () => reject(new Error(`Failed to load CSS: ${url}`));
                document.head.appendChild(link);
            } else if (type === 'js') {
                const script = document.createElement('script');
                script.src = versionedUrl;
                script.async = true;
                script.onload = () => resolve(script);
                script.onerror = () => reject(new Error(`Failed to load JS: ${url}`));
                document.head.appendChild(script);
            } else {
                reject(new Error(`Unknown resource type: ${type}`));
            }
        });
    };

    // Function to force reload all resources
    window.forceReloadResources = function() {
        // Generate a new version
        const newVersion = new Date().getTime();

        // Remove all existing CSS and JS resources
        const cssLinks = document.querySelectorAll('link[rel="stylesheet"]');
        cssLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (href) {
                const baseHref = href.split('?')[0];
                link.setAttribute('href', `${baseHref}?v=${newVersion}`);
            }
        });

        const scripts = document.querySelectorAll('script[src]');
        scripts.forEach(script => {
            const src = script.getAttribute('src');
            if (src) {
                const baseSrc = src.split('?')[0];
                script.setAttribute('src', `${baseSrc}?v=${newVersion}`);
            }
        });

        console.log('[Cache Buster] Forced reload of all resources with new version:', newVersion);

        // Reload the current page
        window.location.reload(true);
    };

    // Add a keyboard shortcut for force reload (Ctrl+Shift+R)
    document.addEventListener('keydown', function(event) {
        if (event.ctrlKey && event.shiftKey && event.key === 'R') {
            event.preventDefault();
            window.forceReloadResources();
        }
    });

    console.log('[Cache Buster] Initialized');
})();
