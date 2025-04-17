/**
 * =============================================================================
 * Permisos Digitales - Ticker Component (ticker.js)
 * =============================================================================
 *
 * Handles the continuous scrolling ticker functionality.
 */

/**
 * Initializes the continuous ticker
 * This ensures there's always enough content to prevent empty spaces while scrolling
 */
function initContinuousTicker() {
    console.log('[Ticker] Initializing continuous ticker...');

    // Try to find the ticker element
    const tickerWrap = document.querySelector('.ticker-wrap');
    if (!tickerWrap) {
        console.warn('[Ticker] Ticker wrap element not found');
        return;
    }

    try {
        // Get the original ticker content (first set of items)
        const tickerContent = tickerWrap.innerHTML;
        const tickerWidth = tickerWrap.scrollWidth;
        const viewportWidth = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;

        // Calculate how many duplicates we need to ensure continuous scrolling
        // We'll add enough copies to cover at least 4x the viewport width for smoother scrolling
        const requiredWidth = viewportWidth * 4;
        const duplicatesNeeded = Math.max(3, Math.ceil(requiredWidth / tickerWidth));

        console.log(`[Ticker] Viewport width: ${viewportWidth}px, Ticker width: ${tickerWidth}px`);
        console.log(`[Ticker] Creating ${duplicatesNeeded} duplicates for continuous scrolling`);

        // Create a new string with duplicated content
        let newContent = tickerContent;
        for (let i = 0; i < duplicatesNeeded; i++) {
            newContent += tickerContent;
        }

        // Update the ticker with duplicated content
        tickerWrap.innerHTML = newContent;

        // Adjust animation duration based on content length for smooth scrolling
        // The longer the content, the longer the animation should be
        const finalTickerWidth = tickerWrap.scrollWidth;
        const baseDuration = 30; // Increased base duration for smoother scrolling
        const calculatedDuration = Math.max(15, (finalTickerWidth / viewportWidth) * baseDuration);

        // Apply the calculated duration to the animation
        tickerWrap.style.animationDuration = `${calculatedDuration}s`;

        // Add a CSS variable to help with animation calculations
        document.documentElement.style.setProperty('--ticker-copies', duplicatesNeeded + 1);

        console.log(`[Ticker] Ticker initialized with ${duplicatesNeeded + 1} copies and ${calculatedDuration}s duration`);

        // Handle window resize to adjust ticker if needed
        window.removeEventListener('resize', handleResize); // Remove any existing listener
        window.addEventListener('resize', handleResize);

        return true; // Indicate successful initialization
    } catch (error) {
        console.error('[Ticker] Error initializing ticker:', error);
        return false;
    }
}

/**
 * Handle window resize events for the ticker
 */
const handleResize = debounce(() => {
    console.log('[Ticker] Window resized, reinitializing ticker');
    initContinuousTicker();
}, 250);

/**
 * Debounce function to limit how often a function is called
 * @param {Function} func - The function to debounce
 * @param {number} wait - The debounce delay in milliseconds
 * @returns {Function} - The debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Make initialization function globally accessible
window.initContinuousTicker = initContinuousTicker;

console.log('[Ticker] Ticker script loaded. Version 1.1');
