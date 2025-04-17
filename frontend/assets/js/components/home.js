/**
 * =============================================================================
 * Permisos Digitales - Home Page Component (home.js)
 * =============================================================================
 *
 * Handles initialization and functionality specific to the home page view.
 */

/**
 * Initializes the home page functionality
 */
function initHomePage() {
    console.log('[Home] Initializing home page...');

    // Update the current year in the footer
    updateCurrentYear();

    // Initialize the ticker with a slight delay to ensure DOM is fully loaded
    setTimeout(() => {
        initializeTicker();
    }, 100);

    console.log('[Home] Home page initialization complete.');
}

/**
 * Initialize the ticker component
 */
function initializeTicker() {
    console.log('[Home] Initializing ticker...');

    // First try the global function if available
    if (typeof window.initContinuousTicker === 'function') {
        console.log('[Home] Found ticker initialization function, calling it now...');
        try {
            window.initContinuousTicker();
            return; // If successful, exit the function
        } catch (error) {
            console.error('[Home] Error initializing ticker with global function:', error);
            // Continue to fallback method
        }
    } else {
        console.warn('[Home] Continuous ticker initialization function not found, using fallback');
    }

    // Fallback: Initialize the ticker directly
    const tickerWrap = document.querySelector('.ticker-wrap');
    if (tickerWrap) {
        console.log('[Home] Found ticker element, initializing directly...');
        try {
            // Get the original content
            const originalContent = tickerWrap.innerHTML;

            // Duplicate the content to ensure continuous scrolling
            let newContent = originalContent;
            for (let i = 0; i < 3; i++) { // Create multiple copies for longer scrolling
                newContent += originalContent;
            }

            // Update the ticker with duplicated content
            tickerWrap.innerHTML = newContent;

            // Set animation duration based on content length
            const contentWidth = tickerWrap.scrollWidth;
            const viewportWidth = window.innerWidth;
            const calculatedDuration = (contentWidth / viewportWidth) * 20; // Base duration factor

            // Apply the calculated duration
            tickerWrap.style.animationDuration = `${calculatedDuration}s`;

            console.log(`[Home] Ticker initialized with duration: ${calculatedDuration}s`);
        } catch (error) {
            console.error('[Home] Error in fallback ticker initialization:', error);
        }
    } else {
        console.warn('[Home] Ticker element not found on page');
    }
}

/**
 * Updates the current year in the footer copyright text
 */
function updateCurrentYear() {
    const currentYearElement = document.getElementById('current-year');
    if (currentYearElement) {
        const currentYear = new Date().getFullYear();
        currentYearElement.textContent = currentYear;
        console.log(`[Home] Updated footer copyright year to ${currentYear}`);
    } else {
        console.warn('[Home] Current year element not found in the footer');
    }
}

// Make initialization function globally accessible for the router (main.js)
window.initHomePage = initHomePage;

console.log('[Home] Home script loaded.');
