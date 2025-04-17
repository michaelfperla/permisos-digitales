/**
 * =============================================================================
 * Permisos Digitales - Admin Authentication Component Logic (admin-auth.js)
 * =============================================================================
 *
 * Contains the JavaScript logic for admin user authentication flows:
 * - Admin Login Page (`initAdminLoginPage`)
 * Includes form handling, validation, API interaction,
 * CSRF token handling, user feedback, and shared helper functions.
 */

// --- Module Scope Variables ---
// Store the CSRF token fetched from the backend
let adminCsrfToken = null;

// --- Shared Helper Functions ---

/**
 * Validates an email address format
 * @param {string} email - The email address to validate
 * @returns {boolean} True if the email format is valid
 */
function isValidEmail(email) {
    return /\S+@\S+\.\S+/.test(email);
}

/**
 * Fetches the CSRF token from the backend API and stores it in the module scope.
 * This should be called before making any state-changing POST/PUT/DELETE requests.
 * @returns {Promise<boolean>} True if the token was fetched successfully, false otherwise.
 */
async function fetchAndStoreCsrfToken() {
    // Avoid fetching if we already have a token
    if (adminCsrfToken) {
        console.log('[AdminAuth][CSRF] Token already exists.');
        return true;
    }

    console.log('[AdminAuth][CSRF] Fetching CSRF token from /api/admin/csrf-token...');
    try {
        // First check if we have a valid session
        const isAuthenticated = sessionStorage.getItem('isAuthenticated') === 'true';
        const isAdminPortal = sessionStorage.getItem('isAdminPortal') === 'true';

        // Endpoint to use based on authentication state
        const endpoint = (isAuthenticated && isAdminPortal) ?
            '/api/admin/csrf-token' : '/api/auth/csrf-token';

        const response = await fetch(endpoint);
        if (!response.ok) {
            throw new Error(`Failed to fetch CSRF token: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        if (data && data.csrfToken) {
            adminCsrfToken = data.csrfToken;
            console.log(`[AdminAuth][CSRF] Token fetched from ${endpoint} and stored successfully.`);
            return true;
        } else {
            throw new Error('Invalid CSRF token response format.');
        }
    } catch (error) {
        console.error('[AdminAuth][CSRF] Error fetching CSRF token:', error);
        adminCsrfToken = null; // Ensure token is null on error
        return false;
    }
}

/**
 * Displays a message (error or success) in a designated element within an auth form.
 * @param {HTMLElement|null} element - The DOM element to display the message in
 * @param {string} message - The message text to display.
 * @param {'error' | 'success'} [type='error'] - The type of message, determines styling.
 */
function showAuthMessage(element, message, type = 'error') {
    if (!element) {
        console.warn('[AdminAuth] Attempted to show message but target element was null.');
        return;
    }
    element.textContent = message;
    element.classList.remove('error-message', 'success-message');
    if (type === 'success') {
        element.classList.add('success-message');
    } else {
        element.classList.add('error-message');
    }
    element.hidden = false;
    console.log(`[AdminAuth] Displayed ${type} message: "${message}"`);
}

/**
 * Clears any message displayed by showAuthMessage in a specific element.
 * @param {HTMLElement|null} element - The DOM element containing the message.
 */
function clearAuthMessage(element) {
    if (!element) return;
    element.textContent = '';
    element.hidden = true;
    element.classList.remove('error-message', 'success-message');
}

/**
 * Manages the loading state of a form submission button.
 * @param {HTMLButtonElement|null} button - The button element.
 * @param {boolean} isLoading - True to activate loading state, false to deactivate.
 */
function setAuthLoading(button, isLoading) {
    if (!button) {
        console.warn('[AdminAuth] Attempted to set loading state but button element was null.');
        return;
    }
    const buttonText = button.querySelector('.button-text');
    const spinner = button.querySelector('.spinner');

    if (!buttonText || !spinner) {
        console.warn('[AdminAuth] Button loading state change failed: .button-text or .spinner element not found.');
        button.disabled = isLoading;
        return;
    }

    if (isLoading) {
        button.disabled = true;
        button.classList.add('loading');
        buttonText.style.visibility = 'hidden';
        spinner.hidden = false;
        console.log('[AdminAuth] Button loading state: ON');
    } else {
        button.disabled = false;
        button.classList.remove('loading');
        buttonText.style.visibility = 'visible';
        spinner.hidden = true;
        console.log('[AdminAuth] Button loading state: OFF');
    }
}

/**
 * Sets up the interactive password visibility toggle for a password input field.
 * @param {HTMLInputElement|null} passwordInput - The password input element.
 * @param {HTMLButtonElement|null} toggleButton - The button element that triggers the toggle.
 */
function setupPasswordToggle(passwordInput, toggleButton) {
    if (!passwordInput || !toggleButton) {
        if (!passwordInput) console.warn('[AdminAuth] Password input not found for toggle setup.');
        if (!toggleButton) console.warn('[AdminAuth] Password toggle button not found for setup.');
        return;
    }
    const iconElement = toggleButton.querySelector('.toggle-icon svg use');
    toggleButton.addEventListener('click', () => {
        const isCurrentlyPassword = passwordInput.type === 'password';
        console.log(`[AdminAuth] Toggling password visibility. Currently: ${isCurrentlyPassword ? 'Hidden' : 'Shown'}`);
        passwordInput.type = isCurrentlyPassword ? 'text' : 'password';
        toggleButton.setAttribute('aria-label', isCurrentlyPassword ? 'Ocultar contraseña' : 'Mostrar contraseña');
        toggleButton.setAttribute('aria-pressed', isCurrentlyPassword ? 'true' : 'false');
        if (iconElement) {
            const currentIcon = isCurrentlyPassword ? 'icon-eye-slash' : 'icon-eye';
            const iconContainer = toggleButton.querySelector('.toggle-icon');
            if (iconContainer) {
                // Clear the container first
                iconContainer.innerHTML = '';

                // Create new SVG element
                const newSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                newSvg.setAttribute('class', `icon ${currentIcon}`);
                newSvg.setAttribute('viewBox', '0 0 24 24');
                newSvg.setAttribute('focusable', 'false');
                newSvg.setAttribute('aria-hidden', 'true');

                // Create use element
                const useElement = document.createElementNS('http://www.w3.org/2000/svg', 'use');
                useElement.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', `/assets/icons/sprite.svg#${currentIcon}`);

                // Append use to svg, and svg to container
                newSvg.appendChild(useElement);
                iconContainer.appendChild(newSvg);
            }
        }
    });
    console.log(`[AdminAuth] Password toggle initialized for input: #${passwordInput.id}`);
}

/**
 * Stores user data after login.
 * @param {object} userData - The user object received from the API.
 */
function storeUserData(userData) {
    console.log('[AdminAuth] Storing user data:', userData);

    try {
        sessionStorage.setItem('isAuthenticated', 'true');
        sessionStorage.setItem('isAdminPortal', 'true');

        if (userData) {
            // Store minimal user info needed for display
            const userInfo = {
                id: userData.id,
                email: userData.email,
                name: userData.first_name ? `${userData.first_name} ${userData.last_name || ''}` : userData.email,
                accountType: 'admin'
            };
            sessionStorage.setItem('userInfo', JSON.stringify(userInfo));
            console.log('[AdminAuth] User info stored in sessionStorage.');
        }
    } catch (e) {
        console.error('[AdminAuth] Error storing session data:', e);
    }
}

// --- Admin Login Page Initialization ---
async function initAdminLoginPage() {
    console.log('[AdminAuth] Initializing Admin Login Page...');

    // --- Get DOM Elements ---
    const loginForm = document.getElementById('admin-login-form');
    const emailInput = document.getElementById('admin-login-email');
    const passwordInput = document.getElementById('admin-login-password');
    const submitButton = document.getElementById('admin-login-submit-btn');
    const errorMessageDiv = document.getElementById('admin-login-error-message');
    const togglePasswordButton = document.getElementById('admin-login-toggle-password');

    // --- Element Existence Check ---
    if (!loginForm || !emailInput || !passwordInput || !submitButton || !errorMessageDiv || !togglePasswordButton) {
        console.error('[AdminAuth] Admin Login Page Error: One or more required form elements not found.');
        return;
    }

    // --- Fetch Initial CSRF Token ---
    // We'll try to fetch the token but won't block the login form if it fails
    // since we'll retry when submitting the form
    try {
        const csrfSuccess = await fetchAndStoreCsrfToken();
        if (!csrfSuccess) {
            console.warn('[AdminAuth] Initial CSRF token fetch failed, will retry at form submission');
        }
    } catch (error) {
        console.error('[AdminAuth] Error during initial CSRF token fetch:', error);
    }

    // --- Setup Interactions ---
    setupPasswordToggle(passwordInput, togglePasswordButton);

    // --- Add Input Event Listeners to Clear Errors on Type ---
    const formInputs = [emailInput, passwordInput];
    formInputs.forEach(input => {
        input.addEventListener('input', (event) => {
            const targetInput = event.target;
            targetInput.classList.remove('is-invalid');
            const errorSpan = document.getElementById(`${targetInput.id}-error`);
            if (errorSpan) {
                errorSpan.hidden = true;
                errorSpan.textContent = '';
            }
            clearAuthMessage(errorMessageDiv);
        });
    });

    // --- Form Submission Handler ---
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        console.log('[AdminAuth] Admin login form submitted.');

        // 1. Clear previous feedback
        clearAuthMessage(errorMessageDiv);
        formInputs.forEach(input => {
            input.classList.remove('is-invalid');
            const errorSpan = document.getElementById(`${input.id}-error`);
            if (errorSpan) {
                errorSpan.hidden = true;
                errorSpan.textContent = '';
            }
        });

        // 2. Get Form Values
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        let isValid = true;
        let firstInvalidField = null;

        // 3. Basic Client-Side Validation
        if (!email) {
            isValid = false;
            emailInput.classList.add('is-invalid');
            const errorSpan = document.getElementById('admin-login-email-error');
            if(errorSpan) { errorSpan.textContent = 'Correo electrónico es requerido.'; errorSpan.hidden = false; }
            if (!firstInvalidField) firstInvalidField = emailInput;
        } else if (!isValidEmail(email)) {
            isValid = false;
            emailInput.classList.add('is-invalid');
            const errorSpan = document.getElementById('admin-login-email-error');
            if(errorSpan) { errorSpan.textContent = 'Formato de correo inválido.'; errorSpan.hidden = false; }
            if (!firstInvalidField) firstInvalidField = emailInput;
        }

        if (!password) {
            isValid = false;
            passwordInput.classList.add('is-invalid');
            const errorSpan = document.getElementById('admin-login-password-error');
            if(errorSpan) { errorSpan.textContent = 'Contraseña es requerida.'; errorSpan.hidden = false; }
            if (!firstInvalidField) firstInvalidField = passwordInput;
        }

        if (!isValid) {
            console.log('[AdminAuth] Client-side validation failed.');
            if (firstInvalidField) firstInvalidField.focus();
            return;
        }

        // 4. Check for CSRF Token
        if (!adminCsrfToken) {
            console.warn('[AdminAuth][CSRF] CSRF Token missing at submit time, attempting re-fetch...');
            const retrySuccess = await fetchAndStoreCsrfToken();
            if (!retrySuccess) {
                showAuthMessage(errorMessageDiv, 'Error de seguridad (token CSRF no disponible). Por favor, recargue la página.');
                return;
            }
        }

        // 5. Set Loading State
        setAuthLoading(submitButton, true);

        // 6. Prepare API Request Body
        const requestBody = JSON.stringify({
            email,
            password,
            portal: "admin" // Specify admin portal login
        });

        // 7. Perform API Call to /api/auth/login
        try {
            console.log(`[AdminAuth] Attempting admin login API call for user: ${email}`);
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-Token': adminCsrfToken,
                    'X-Portal-Type': 'admin' // Special header to indicate admin portal
                },
                body: requestBody
            });

            // 8. Handle API Response
            const responseData = await response.json();

            if (response.ok) {
                // Login Successful
                console.log('[AdminAuth] Admin login successful!', responseData);

                // Store auth state
                storeUserData(responseData.user);

                // Redirect to admin dashboard
                window.location.href = '/admin';
            } else {
                // Login Failed
                let errorMessage = responseData.message || `Error ${response.status}`;
                if (response.status === 401) {
                    errorMessage = responseData.message || 'Credenciales inválidas o usuario no es administrador.';
                } else if (response.status === 400) {
                    errorMessage = responseData.message || 'Solicitud inválida.';
                } else if (response.status === 429) {
                    errorMessage = responseData.message || 'Demasiados intentos. Por favor, espere.';
                }

                // Clear auth state
                try {
                    sessionStorage.removeItem('isAuthenticated');
                    sessionStorage.removeItem('isAdminPortal');
                    sessionStorage.removeItem('userInfo');
                } catch (e) {
                    console.error('[AdminAuth] Error clearing session data:', e);
                }

                console.error(`[AdminAuth] Admin login failed (${response.status}): ${errorMessage}`);
                showAuthMessage(errorMessageDiv, errorMessage);
                setAuthLoading(submitButton, false);
                passwordInput.focus();
                passwordInput.select();
            }
        } catch (error) {
            // Network Error
            console.error('[AdminAuth] Network error during admin login:', error);
            showAuthMessage(errorMessageDiv, 'Error de red al intentar iniciar sesión. Verifique su conexión.');
            setAuthLoading(submitButton, false);
        }
    });

    console.log('[AdminAuth] Admin Login Page initialization complete.');
}

// --- Admin Logout Function ---
async function logoutAdmin() {
    console.log('[AdminAuth] Logging out admin user...');

    try {
        // Call the logout API
        const response = await fetch('/api/auth/logout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        // Clear session storage regardless of API response
        sessionStorage.removeItem('isAuthenticated');
        sessionStorage.removeItem('isAdminPortal');
        sessionStorage.removeItem('userInfo');

        // Redirect to admin login page
        window.location.hash = '#/admin/login';

        console.log('[AdminAuth] Admin logout complete');
    } catch (error) {
        console.error('[AdminAuth] Error during logout:', error);
        // Still clear session and redirect even if API call fails
        sessionStorage.removeItem('isAuthenticated');
        sessionStorage.removeItem('isAdminPortal');
        sessionStorage.removeItem('userInfo');
        window.location.hash = '#/admin/login';
    }
}

// --- Export functions globally ---
window.initAdminLoginPage = initAdminLoginPage;
window.logoutAdmin = logoutAdmin;
window.fetchAndStoreCsrfToken = fetchAndStoreCsrfToken;
// Make token available globally
Object.defineProperty(window, 'adminCsrfToken', {
    get: function() { return adminCsrfToken; }
});

console.log('[AdminAuth] Admin authentication script loaded.');