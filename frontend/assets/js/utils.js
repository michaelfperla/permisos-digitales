/**
 * =============================================================================
 * Permisos Digitales - Utility Functions (utils.js)
 * =============================================================================
 *
 * Contains shared utility functions used across the application.
 */

// --- Auth State Helpers ---
/**
 * Checks if the user is authenticated based on client-side sessionStorage.
 * This provides an immediate response without waiting for an API call.
 * @returns {boolean} True if the user appears to be authenticated based on client state.
 */
function isUserAuthenticatedClientSide() {
    try {
        return sessionStorage.getItem('isAuthenticated') === 'true';
    } catch (e) {
        console.error('[Utils] Error checking authentication state:', e);
        return false; // Assume false if sessionStorage fails
    }
}

/**
 * Gets the stored user information from sessionStorage.
 * @returns {Object|null} User information object or null if not available.
 */
function getUserInfoClientSide() {
    try {
        const info = sessionStorage.getItem('userInfo');
        return info ? JSON.parse(info) : null;
    } catch (e) {
        console.error('[Utils] Error retrieving user info:', e);
        return null;
    }
}

/**
 * Updates the client-side authentication state in sessionStorage.
 * @param {boolean} isAuthenticated Whether the user is authenticated.
 * @param {Object|null} userInfo User information to store (null to clear).
 */
function updateAuthStateClientSide(isAuthenticated, userInfo = null) {
    try {
        if (isAuthenticated) {
            sessionStorage.setItem('isAuthenticated', 'true');
            if (userInfo) {
                sessionStorage.setItem('userInfo', JSON.stringify(userInfo));
            }
        } else {
            sessionStorage.removeItem('isAuthenticated');
            sessionStorage.removeItem('userInfo');
        }
        console.log(`[Utils] Auth state updated: isAuthenticated=${isAuthenticated}`);
    } catch (e) {
        console.error('[Utils] Error updating auth state:', e);
    }
}

/**
 * Clears the client-side authentication state from sessionStorage.
 */
function clearAuthStateClientSide() {
    try {
        sessionStorage.removeItem('isAuthenticated');
        sessionStorage.removeItem('userInfo');
        console.log('[Utils] Auth state cleared from sessionStorage');
    } catch (e) {
        console.error('[Utils] Error clearing auth state:', e);
    }
}

// --- Reusable Logout Function ---
/**
 * Handles the logout process via API call.
 * @param {function} [callback] - Optional function to call after successful logout/redirect attempt.
 */
async function handleLogout(callback) {
    console.log('[Utils] Attempting logout...');
    // We need CSRF token - assume auth.js exposed getStoredCsrfToken globally
    let csrfToken = null;
    if (typeof window.getStoredCsrfToken === 'function') {
        csrfToken = await window.getStoredCsrfToken();
    } else {
        console.error('[Utils] Logout Error: getStoredCsrfToken function not found.');
        alert('Error interno al cerrar sesión (Falta función CSRF).'); // Simple alert for now
        return;
    }

    if (!csrfToken) {
        console.error('[Utils] Logout Error: Could not retrieve CSRF token.');
        alert('Error de seguridad al cerrar sesión. Por favor, recargue la página.');
        return;
    }

    // Optional: Add loading state indication somewhere? (e.g., disable button passed via callback)

    try {
        const response = await fetch('/api/auth/logout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({ _csrf: csrfToken })
        });

        if (response.ok) {
            console.log('[Utils] Logout successful via API.');
            clearAuthStateClientSide(); // Clear client state
            window.location.hash = '#/login'; // Redirect
            if (typeof callback === 'function') callback(null); // Indicate success
        } else {
            let errorMsg = 'Error al cerrar sesión.';
            try { const errorData = await response.json(); errorMsg = errorData.message || errorMsg; } catch (e) {}
            console.error(`[Utils] Logout API failed (${response.status}): ${errorMsg}`);
            alert(`Error al cerrar sesión: ${errorMsg}`); // Simple alert
            if (typeof callback === 'function') callback(new Error(errorMsg)); // Indicate error
        }
    } catch (error) {
        console.error('[Utils] Network error during logout:', error);
        alert('Error de red al cerrar sesión. Verifique su conexión.');
        if (typeof callback === 'function') callback(error); // Indicate error
    }
    // Optional: Remove loading state here if managed via callback
}

// Expose globally if not using modules
window.isUserAuthenticatedClientSide = isUserAuthenticatedClientSide;
window.getUserInfoClientSide = getUserInfoClientSide;
window.updateAuthStateClientSide = updateAuthStateClientSide;
window.clearAuthStateClientSide = clearAuthStateClientSide;
window.handleLogout = handleLogout; // Expose logout handler

console.log('[Utils] Utility functions loaded.');
