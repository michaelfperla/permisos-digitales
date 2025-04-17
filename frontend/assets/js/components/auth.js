/**
 * =============================================================================
 * Permisos Digitales - Authentication Component Logic (auth.js) - API Aligned
 * =============================================================================
 *
 * Contains the JavaScript logic for user authentication flows:
 * - Login Page (`initLoginPage`)
 * - Registration Page (`initRegisterPage`)
 * - Forgot Password Page (`initForgotPasswordPage`)
 * - Reset Password Page (`initResetPasswordPage`)
 * Includes form handling, validation, API interaction (aligned with API.md),
 * CSRF token handling, user feedback, and shared helper functions.
 */

// --- Module Scope Variables ---
// Store the CSRF token fetched from the backend. Initialize as null.
let csrfToken = null;

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
    // Avoid fetching if we already have a token (could add expiry logic later)
    if (csrfToken) {
        console.log('[Auth][CSRF] Token already exists.');
        return true;
    }

    console.log('[Auth][CSRF] Fetching CSRF token from /api/auth/csrf-token...');
    try {
        const response = await fetch('/api/auth/csrf-token');
        if (!response.ok) {
            throw new Error(`Failed to fetch CSRF token: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        if (data && data.csrfToken) {
            csrfToken = data.csrfToken;
            console.log('[Auth][CSRF] Token fetched and stored successfully.');
            return true;
        } else {
            throw new Error('Invalid CSRF token response format.');
        }
    } catch (error) {
        console.error('[Auth][CSRF] Error fetching CSRF token:', error);
        csrfToken = null; // Ensure token is null on error
        // Display a critical error to the user? Maybe handled where this function is called.
        return false;
    }
}

/**
 * Displays a message (error or success) in a designated element within an auth form.
 * Handles visibility and applies appropriate styling classes.
 * @param {HTMLElement|null} element - The DOM element to display the message in (e.g., '#login-error-message').
 * @param {string} message - The message text to display.
 * @param {'error' | 'success'} [type='error'] - The type of message, determines styling.
 */
function showAuthMessage(element, message, type = 'error') {
    // ... (Helper function remains the same as previous version) ...
    if (!element) {
        console.warn('[Auth] Attempted to show message but target element was null.');
        return;
    }
    element.textContent = message;
    element.classList.remove('error-message', 'success-message', 'auth-success', 'auth-error');
    if (type === 'success') {
        element.classList.add('success-message');
    } else {
        element.classList.add('error-message');
    }
    element.hidden = false;
    console.log(`[Auth] Displayed ${type} message: "${message}"`);
}

/**
 * Clears any message displayed by showAuthMessage in a specific element.
 * @param {HTMLElement|null} element - The DOM element containing the message.
 */
function clearAuthMessage(element) {
    // ... (Helper function remains the same as previous version) ...
     if (!element) return;
    element.textContent = '';
    element.hidden = true;
    element.classList.remove('error-message', 'success-message', 'auth-success', 'auth-error');
}

/**
 * Manages the loading state of a form submission button.
 * Disables the button, hides text, and shows a spinner.
 * @param {HTMLButtonElement|null} button - The button element.
 * @param {boolean} isLoading - True to activate loading state, false to deactivate.
 */
function setAuthLoading(button, isLoading) {
    // ... (Helper function remains the same as previous version) ...
    if (!button) {
        console.warn('[Auth] Attempted to set loading state but button element was null.');
        return;
    }
    const buttonText = button.querySelector('.button-text');
    const spinner = button.querySelector('.spinner');

    if (!buttonText || !spinner) {
        console.warn('[Auth] Button loading state change failed: .button-text or .spinner element not found within the button.');
        button.disabled = isLoading;
        return;
    }

    if (isLoading) {
        button.disabled = true;
        button.classList.add('loading');
        buttonText.style.visibility = 'hidden';
        spinner.hidden = false;
        console.log('[Auth] Button loading state: ON');
    } else {
        button.disabled = false;
        button.classList.remove('loading');
        buttonText.style.visibility = 'visible';
        spinner.hidden = true;
        console.log('[Auth] Button loading state: OFF');
    }
}

/**
 * Sets up the interactive password visibility toggle for a password input field.
 * @param {HTMLInputElement|null} passwordInput - The password input element.
 * @param {HTMLButtonElement|null} toggleButton - The button element that triggers the toggle.
 */
function setupPasswordToggle(passwordInput, toggleButton) {
    // ... (Helper function remains the same as previous version) ...
    if (!passwordInput || !toggleButton) {
        if (!passwordInput) console.warn('[Auth] Password input not found for toggle setup.');
        if (!toggleButton) console.warn('[Auth] Password toggle button not found for setup.');
        return;
    }
    const iconElement = toggleButton.querySelector('.toggle-icon svg use');
    toggleButton.addEventListener('click', () => {
        const isCurrentlyPassword = passwordInput.type === 'password';
        console.log(`[Auth] Toggling password visibility. Currently: ${isCurrentlyPassword ? 'Hidden' : 'Shown'}`);
        passwordInput.type = isCurrentlyPassword ? 'text' : 'password';
        toggleButton.setAttribute('aria-label', isCurrentlyPassword ? 'Ocultar contraseña' : 'Mostrar contraseña');
        toggleButton.setAttribute('aria-pressed', isCurrentlyPassword ? 'true' : 'false');
        if (iconElement) {
            const currentIcon = isCurrentlyPassword ? 'icon-eye-slash' : 'icon-eye';
            // Create a completely new SVG element to avoid duplication issues
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
    console.log(`[Auth] Password toggle initialized for input: #${passwordInput.id}`);
}

/**
 * Placeholder for storing user data after login.
 * In a real app, this might involve setting context, storing in session/local storage (carefully!), etc.
 * @param {object} userData - The user object received from the API.
 */
function storeUserData(userData) {
    console.log('[Auth] Storing user data (placeholder):', userData);
    // Example: localStorage.setItem('currentUser', JSON.stringify(userData)); // Use with caution!
    // Example: sessionStorage.setItem('currentUser', JSON.stringify(userData));
    // Or update a global state/context object.
}

// --- Login Page Initialization ---
async function initLoginPage() { // Made async to await CSRF token fetch
    console.log('[Auth] Initializing Login Page...');

    // --- Get DOM Elements ---
    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    const submitButton = document.getElementById('login-submit-btn');
    const errorMessageDiv = document.getElementById('login-error-message');
    const togglePasswordButton = document.getElementById('login-toggle-password');

    // --- Element Existence Check ---
    if (!loginForm || !emailInput || !passwordInput || !submitButton || !errorMessageDiv || !togglePasswordButton) {
        console.error('[Auth] Login Page Error: One or more required form elements not found.');
        // Display error? Handled globally? For now, just log and return.
        return;
    }

    // --- Fetch Initial CSRF Token ---
    // Fetch the token when the page loads, so it's ready for submission.
    const csrfSuccess = await fetchAndStoreCsrfToken();
    if (!csrfSuccess) {
        // If CSRF fetch fails on load, show an error and disable the form.
        showAuthMessage(errorMessageDiv, 'Error de seguridad al cargar la página. Por favor, recargue.');
        if(submitButton) submitButton.disabled = true;
        return; // Don't proceed if CSRF token isn't available
    }

    // --- Setup Interactions ---
    setupPasswordToggle(passwordInput, togglePasswordButton);

    // --- Add Input Event Listeners to Clear Errors on Type ---
    const formInputs = [emailInput, passwordInput]; // List of inputs to monitor
    formInputs.forEach(input => {
        input.addEventListener('input', (event) => {
            const targetInput = event.target;
            targetInput.classList.remove('is-invalid'); // Remove highlight on type
            const errorSpan = document.getElementById(`${targetInput.id}-error`);
            if (errorSpan) {
                errorSpan.hidden = true; // Hide specific error on type
                errorSpan.textContent = '';
            }
            // Optional: Clear general top message as well
            clearAuthMessage(errorMessageDiv);
        });
    });

    // --- Form Submission Handler ---
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        console.log('[Auth] Login form submitted.');

        // 1. Clear previous feedback (General and Field-specific)
        clearAuthMessage(errorMessageDiv); // Clear top message
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

        // 3. Basic Client-Side Validation (Field-specific)
        if (!email) {
            isValid = false;
            emailInput.classList.add('is-invalid');
            const errorSpan = document.getElementById('login-email-error');
            if(errorSpan) { errorSpan.textContent = 'Correo electrónico es requerido.'; errorSpan.hidden = false; }
            if (!firstInvalidField) firstInvalidField = emailInput;
        } else if (!isValidEmail(email)) { // Check format only if not empty
             isValid = false;
             emailInput.classList.add('is-invalid');
             const errorSpan = document.getElementById('login-email-error');
             if(errorSpan) { errorSpan.textContent = 'Formato de correo inválido.'; errorSpan.hidden = false; }
             if (!firstInvalidField) firstInvalidField = emailInput;
        }

        if (!password) {
            isValid = false;
            passwordInput.classList.add('is-invalid');
            const errorSpan = document.getElementById('login-password-error');
            if(errorSpan) { errorSpan.textContent = 'Contraseña es requerida.'; errorSpan.hidden = false; }
             if (!firstInvalidField) firstInvalidField = passwordInput;
        }

        if (!isValid) {
             console.log('[Auth] Client-side validation failed.');
             // Optional: Keep a general message at the top
             // showAuthMessage(errorMessageDiv, 'Por favor, corrija los errores.');
             if (firstInvalidField) firstInvalidField.focus();
             return; // Stop submission
        }

        // 4. Check for CSRF Token (should exist from initial fetch)
        if (!csrfToken) {
            // Attempt to fetch again just in case, though failure is likely systemic
            console.warn('[Auth][CSRF] CSRF Token missing at submit time, attempting re-fetch...');
            const retrySuccess = await fetchAndStoreCsrfToken();
            if (!retrySuccess) {
                showAuthMessage(errorMessageDiv, 'Error de seguridad (token CSRF no disponible). Por favor, recargue la página.');
                return; // Stop submission if still no token
            }
            // If retry worked, csrfToken variable is now set.
        }

        // 5. Set Loading State
        setAuthLoading(submitButton, true);

        // 6. Prepare API Request Body (matches API.md)
        const requestBody = JSON.stringify({
            email,
            password,
            portal: "client" // Specify client portal login as per API doc (optional)
        });

        // 7. Perform API Call to /api/auth/login
        try {
            console.log(`[Auth] Attempting login API call to /api/auth/login for user: ${email}`);
            const response = await fetch('/api/auth/login', { // Updated URL
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-Token': csrfToken // Include CSRF token in header
                },
                body: requestBody
            });

            // 8. Handle API Response
            const responseData = await response.json(); // Parse JSON regardless of status for potential error messages

            if (response.ok) { // Status 200 OK
                // --- Login Successful ---
                console.log('[Auth] Login successful!', responseData);

                // --- NEW: Store Auth State in sessionStorage ---
                try {
                    sessionStorage.setItem('isAuthenticated', 'true');
                    if (responseData.user) {
                        // Store minimal user info needed for display
                        const userInfo = {
                            id: responseData.user.id,
                            email: responseData.user.email,
                            name: responseData.user.first_name || '',
                            accountType: responseData.user.accountType
                        };
                        sessionStorage.setItem('userInfo', JSON.stringify(userInfo));
                        console.log('[Auth] User info stored in sessionStorage.');

                        // Also call the original storeUserData function if needed
                        storeUserData(responseData.user);
                    } else {
                        sessionStorage.removeItem('userInfo'); // Clear if no user object received
                    }
                } catch (e) {
                    console.error('[Auth] Error storing session data:', e);
                    // Proceed with redirect even if storage fails
                }
                // --- END NEW ---

                // Redirect to dashboard
                window.location.hash = '#/dashboard';
                // Don't turn off loading state, navigating away.

            } else {
                // --- Login Failed (Server-Side Error) ---
                // Use message from responseData if available, fallback based on status
                let errorMessage = responseData.message || `Error ${response.status}`;
                if (response.status === 401) { // Unauthorized
                    errorMessage = responseData.message || 'Credenciales inválidas.';
                } else if (response.status === 400) { // Bad Request
                     errorMessage = responseData.message || 'Solicitud inválida.';
                } else if (response.status === 429) { // Too Many Requests
                     errorMessage = responseData.message || 'Demasiados intentos. Por favor, espere.';
                }

                // --- NEW: Ensure state is cleared on failed login ---
                try {
                    sessionStorage.removeItem('isAuthenticated');
                    sessionStorage.removeItem('userInfo');
                } catch (e) {
                    console.error('[Auth] Error clearing session data:', e);
                }
                // --- END NEW ---

                console.error(`[Auth] Login failed (${response.status}): ${errorMessage}`);
                showAuthMessage(errorMessageDiv, errorMessage);
                setAuthLoading(submitButton, false);
                passwordInput.focus();
                passwordInput.select();
            }

        } catch (error) {
            // --- Network Error or Fetch Exception ---
            console.error('[Auth] Network error during login fetch:', error);
            showAuthMessage(errorMessageDiv, 'Error de red al intentar iniciar sesión. Verifique su conexión.');
            setAuthLoading(submitButton, false);
        }
    }); // End of form submit listener

    console.log('[Auth] Login Page initialization complete.');
} // --- End of initLoginPage ---


// --- Registration Page Initialization ---
async function initRegisterPage() { // Made async for CSRF token fetch
    console.log('[Auth] Initializing Registration Page...');

    // --- Get DOM Elements ---
    const registerForm = document.getElementById('register-form');
    const firstNameInput = document.getElementById('register-first-name'); // Updated ID
    const lastNameInput = document.getElementById('register-last-name');   // Updated ID
    const emailInput = document.getElementById('register-email');
    const passwordInput = document.getElementById('register-password');
    const confirmPasswordInput = document.getElementById('register-confirm-password');
    const submitButton = document.getElementById('register-submit-btn');
    const errorMessageDiv = document.getElementById('register-error-message');
    const togglePasswordButton = document.getElementById('register-toggle-password');
    const toggleConfirmPasswordButton = document.getElementById('register-toggle-confirm-password');

    // --- Element Existence Check ---
     if (!registerForm || !firstNameInput || !lastNameInput || !emailInput || !passwordInput || !confirmPasswordInput || !submitButton || !errorMessageDiv || !togglePasswordButton || !toggleConfirmPasswordButton) {
        console.error('[Auth] Registration Page Error: One or more required form elements not found. Check HTML structure and IDs.');
        return; // Stop initialization
    }

    // --- Fetch Initial CSRF Token ---
    const csrfSuccess = await fetchAndStoreCsrfToken();
    if (!csrfSuccess) {
        showAuthMessage(errorMessageDiv, 'Error de seguridad al cargar la página. Por favor, recargue.');
        if(submitButton) submitButton.disabled = true;
        return;
    }

    // --- Setup Interactions ---
    setupPasswordToggle(passwordInput, togglePasswordButton);
    setupPasswordToggle(confirmPasswordInput, toggleConfirmPasswordButton);

    // --- Add Input Event Listeners to Clear Errors on Type ---
    const formInputs = [firstNameInput, lastNameInput, emailInput, passwordInput, confirmPasswordInput];
    formInputs.forEach(input => {
        input.addEventListener('input', (event) => {
            const targetInput = event.target;
            targetInput.classList.remove('is-invalid');
            const errorSpan = document.getElementById(`${targetInput.id}-error`);
            if (errorSpan) {
                errorSpan.hidden = true;
                errorSpan.textContent = '';
            }
            // Optional: Clear general top message as well
            clearAuthMessage(errorMessageDiv);
        });
    });

    // --- Form Submission Handler ---
    registerForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        console.log('[Auth] Registration form submitted.');

        // 1. Clear previous feedback (General and Field-specific)
        clearAuthMessage(errorMessageDiv);
        formInputs.forEach(input => {
            input.classList.remove('is-invalid');
            const errorSpan = document.getElementById(`${input.id}-error`);
            if (errorSpan) {
                errorSpan.hidden = true;
                errorSpan.textContent = '';
            }
        });

        // 2. Get Form Values (Matches updated HTML and API.md)
        const firstName = firstNameInput.value.trim();
        const lastName = lastNameInput.value.trim();
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        let isValid = true;
        let firstInvalidField = null;

        // 3. Client-Side Validation (Field-specific)
        if (!firstName) {
            isValid = false;
            firstNameInput.classList.add('is-invalid');
            const errorSpan = document.getElementById('register-first-name-error');
            if(errorSpan) { errorSpan.textContent = 'Nombre es requerido.'; errorSpan.hidden = false; }
            if (!firstInvalidField) firstInvalidField = firstNameInput;
        }

        if (!lastName) {
            isValid = false;
            lastNameInput.classList.add('is-invalid');
            const errorSpan = document.getElementById('register-last-name-error');
            if(errorSpan) { errorSpan.textContent = 'Apellidos son requeridos.'; errorSpan.hidden = false; }
            if (!firstInvalidField) firstInvalidField = lastNameInput;
        }

        if (!email) {
            isValid = false;
            emailInput.classList.add('is-invalid');
            const errorSpan = document.getElementById('register-email-error');
            if(errorSpan) { errorSpan.textContent = 'Correo electrónico es requerido.'; errorSpan.hidden = false; }
            if (!firstInvalidField) firstInvalidField = emailInput;
        } else if (!isValidEmail(email)) {
            isValid = false;
            emailInput.classList.add('is-invalid');
            const errorSpan = document.getElementById('register-email-error');
            if(errorSpan) { errorSpan.textContent = 'Formato de correo inválido.'; errorSpan.hidden = false; }
            if (!firstInvalidField) firstInvalidField = emailInput;
        }

        const MIN_PASSWORD_LENGTH = 8; // Consider making this a shared constant
        if (!password) {
            isValid = false;
            passwordInput.classList.add('is-invalid');
            const errorSpan = document.getElementById('register-password-error');
            if(errorSpan) { errorSpan.textContent = 'Contraseña es requerida.'; errorSpan.hidden = false; }
            if (!firstInvalidField) firstInvalidField = passwordInput;
        } else if (password.length < MIN_PASSWORD_LENGTH) {
            isValid = false;
            passwordInput.classList.add('is-invalid');
            const errorSpan = document.getElementById('register-password-error');
            if(errorSpan) { errorSpan.textContent = `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`; errorSpan.hidden = false; }
            if (!firstInvalidField) firstInvalidField = passwordInput;
        }

        if (!confirmPassword) {
            isValid = false;
            confirmPasswordInput.classList.add('is-invalid');
            const errorSpan = document.getElementById('register-confirm-password-error');
            if(errorSpan) { errorSpan.textContent = 'Confirmación de contraseña es requerida.'; errorSpan.hidden = false; }
            if (!firstInvalidField) firstInvalidField = confirmPasswordInput;
        } else if (password !== confirmPassword) {
            isValid = false;
            confirmPasswordInput.classList.add('is-invalid');
            const errorSpan = document.getElementById('register-confirm-password-error');
            if(errorSpan) { errorSpan.textContent = 'Las contraseñas ingresadas no coinciden.'; errorSpan.hidden = false; }
            if (!firstInvalidField) firstInvalidField = confirmPasswordInput;
            confirmPasswordInput.value = '';
        }

        if (!isValid) {
            console.log('[Auth] Client-side validation failed.');
            // Optional: Keep a general message at the top
            // showAuthMessage(errorMessageDiv, 'Por favor, corrija los errores.');
            if (firstInvalidField) firstInvalidField.focus();
            return; // Stop submission
        }

        // 4. Check for CSRF Token
         if (!csrfToken) {
            console.warn('[Auth][CSRF] CSRF Token missing at submit time, attempting re-fetch...');
            const retrySuccess = await fetchAndStoreCsrfToken();
            if (!retrySuccess) {
                showAuthMessage(errorMessageDiv, 'Error de seguridad (token CSRF no disponible). Por favor, recargue la página.');
                return;
            }
        }

        // 5. Set Loading State
        setAuthLoading(submitButton, true);

        // 6. Prepare API Request Body (Matches API.md for /api/auth/register)
        const requestBody = JSON.stringify({
            email,
            password,
            first_name: firstName, // Use snake_case as per API doc
            last_name: lastName    // Use snake_case as per API doc
        });

        // 7. Perform API Call to /api/auth/register
        try {
            console.log(`[Auth] Attempting registration API call to /api/auth/register for user: ${email}`);
            const response = await fetch('/api/auth/register', { // Updated URL
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-Token': csrfToken // Include CSRF token
                },
                body: requestBody
            });

            // 8. Handle API Response
            const responseData = await response.json(); // Parse JSON

            if (response.status === 201) { // 201 Created
                // --- Registration Successful ---
                console.log('[Auth] Registration successful!', responseData);

                // Store authentication state in sessionStorage
                try {
                    sessionStorage.setItem('isAuthenticated', 'true');
                    if (responseData.user) {
                        // Store minimal user info needed for display
                        const userInfo = {
                            id: responseData.user.id,
                            email: responseData.user.email,
                            name: responseData.user.first_name || '',
                            accountType: responseData.user.accountType
                        };
                        sessionStorage.setItem('userInfo', JSON.stringify(userInfo));
                        console.log('[Auth] User info stored in sessionStorage after registration.');

                        // Also call the original storeUserData function if needed
                        if (typeof storeUserData === 'function') {
                            storeUserData(responseData.user);
                        }
                    }
                } catch (e) {
                    console.error('[Auth] Error storing session data after registration:', e);
                    // Proceed with redirect even if storage fails
                }

                // Redirect to dashboard
                console.log('[Auth] Redirecting to dashboard after successful registration');
                window.location.hash = '#/dashboard';
                // Don't reset form or show success message since we're redirecting

            } else {
                // --- Registration Failed (Server-Side Error) ---
                let errorMessage = responseData.message || `Error ${response.status}`;
                 if (response.status === 409) { // Conflict (Email exists)
                    errorMessage = responseData.message || 'Este correo electrónico ya está registrado.';
                    emailInput.focus();
                } else if (response.status === 400) { // Bad Request (Validation)
                    // Try to extract specific validation errors if API provides them
                    if (responseData.errors && Array.isArray(responseData.errors)) {
                        errorMessage = responseData.errors.map(err => err.msg || err.message).join(' ');
                    } else {
                         errorMessage = responseData.message || 'Error en los datos enviados.';
                    }
                    // Focus the first field as a fallback
                     firstNameInput.focus();
                } else if (response.status === 429) { // Too Many Requests
                     errorMessage = responseData.message || 'Demasiados intentos de registro. Por favor, espere.';
                }
                console.error(`[Auth] Registration failed (${response.status}): ${errorMessage}`);
                showAuthMessage(errorMessageDiv, errorMessage);
                setAuthLoading(submitButton, false); // Re-enable button on error
            }

        } catch (error) {
            // --- Network Error or Fetch Exception ---
            console.error('[Auth] Network error during registration fetch:', error);
            showAuthMessage(errorMessageDiv, 'Error de red al intentar registrarse. Verifique su conexión.');
            setAuthLoading(submitButton, false);
        }
    }); // End of form submit listener

    console.log('[Auth] Registration Page initialization complete.');
} // --- End of initRegisterPage ---

/**
 * Returns the currently stored CSRF token.
 * Ensures the token fetch has been attempted if it hasn't already.
 * @returns {Promise<string|null>} The CSRF token string or null if unavailable.
 */
async function getStoredCsrfToken() {
    if (!csrfToken) {
        // If token is null, attempt to fetch it first.
        console.warn('[Auth][CSRF] getStoredCsrfToken called when token was null. Attempting fetch...');
        const success = await fetchAndStoreCsrfToken();
        if (!success) {
            console.error('[Auth][CSRF] Failed to fetch CSRF token on demand.');
            return null; // Return null if fetch failed
        }
    }
    return csrfToken; // Return the stored token (which might still be null if fetch failed)
}


// --- Forgot Password Page Initialization ---
async function initForgotPasswordPage() {
    console.log('[Auth] Initializing Forgot Password Page...');

    // --- Get DOM Elements ---
    const forgotPasswordForm = document.getElementById('forgot-password-form');
    const emailInput = document.getElementById('forgot-password-email');
    const submitButton = document.getElementById('forgot-password-submit-btn');
    const messageDiv = document.getElementById('forgot-password-message');
    const emailErrorSpan = document.getElementById('forgot-password-email-error');

    // --- Element Existence Check ---
    if (!forgotPasswordForm || !emailInput || !submitButton || !messageDiv || !emailErrorSpan) {
        console.error('[Auth] Forgot Password Page Error: One or more required form elements not found.');
        return;
    }

    // --- Fetch Initial CSRF Token ---
    const csrfSuccess = await fetchAndStoreCsrfToken();
    if (!csrfSuccess) {
        showAuthMessage(messageDiv, 'Error de seguridad al cargar la página. Por favor, recargue.', 'error');
        if(submitButton) submitButton.disabled = true;
        return;
    }

    // --- Form Submission Handler ---
    forgotPasswordForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        console.log('[Auth] Forgot Password form submitted.');

        // 1. Clear previous feedback
        clearAuthMessage(messageDiv);
        emailInput.classList.remove('is-invalid');
        emailErrorSpan.hidden = true;
        emailErrorSpan.textContent = '';

        // 2. Get Form Values
        const email = emailInput.value.trim();
        let isValid = true;

        // 3. Validate Email
        if (!email) {
            emailInput.classList.add('is-invalid');
            emailErrorSpan.textContent = 'Por favor, ingresa tu correo electrónico.';
            emailErrorSpan.hidden = false;
            isValid = false;
        } else if (!isValidEmail(email)) {
            emailInput.classList.add('is-invalid');
            emailErrorSpan.textContent = 'Por favor, ingresa un correo electrónico válido.';
            emailErrorSpan.hidden = false;
            isValid = false;
        }

        // 4. If validation fails, stop here
        if (!isValid) {
            return;
        }

        // 5. Set Loading State
        setAuthLoading(submitButton, true);

        // 6. Prepare API Request Body
        const requestBody = JSON.stringify({ email });

        // 7. Perform API Call to /api/auth/forgot-password
        try {
            console.log(`[Auth] Sending password reset request for: ${email}`);
            const response = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-Token': csrfToken
                },
                body: requestBody
            });

            // 8. Handle API Response
            const responseData = await response.json();

            if (response.ok) {
                // Success - Show success message
                console.log('[Auth] Password reset request successful');
                showAuthMessage(messageDiv, responseData.message || 'Se ha enviado un enlace de recuperación a tu correo electrónico.', 'success');
                forgotPasswordForm.reset();
            } else {
                // Error - Show error message
                const errorMessage = responseData.message || 'Error al procesar la solicitud. Por favor, intenta nuevamente.';
                console.error(`[Auth] Password reset request failed: ${errorMessage}`);
                showAuthMessage(messageDiv, errorMessage, 'error');
            }
        } catch (error) {
            // Network Error
            console.error('[Auth] Network error during password reset request:', error);
            showAuthMessage(messageDiv, 'Error de red al procesar la solicitud. Verifique su conexión.', 'error');
        } finally {
            // Always reset loading state
            setAuthLoading(submitButton, false);
        }
    });

    console.log('[Auth] Forgot Password Page initialization complete.');
}

// --- Reset Password Page Initialization ---
async function initResetPasswordPage() {
    console.log('[Auth] Initializing Reset Password Page...');

    // --- Get DOM Elements ---
    const resetPasswordForm = document.getElementById('reset-password-form');
    const tokenInput = document.getElementById('reset-password-token');
    const newPasswordInput = document.getElementById('reset-password-new');
    const confirmPasswordInput = document.getElementById('reset-password-confirm');
    const submitButton = document.getElementById('reset-password-submit-btn');
    const messageDiv = document.getElementById('reset-password-message');
    const newPasswordErrorSpan = document.getElementById('reset-password-new-error');
    const confirmPasswordErrorSpan = document.getElementById('reset-password-confirm-error');
    const togglePasswordButton = document.getElementById('reset-toggle-password');
    const toggleConfirmPasswordButton = document.getElementById('reset-toggle-confirm-password');

    // --- Element Existence Check ---
    if (!resetPasswordForm || !tokenInput || !newPasswordInput || !confirmPasswordInput ||
        !submitButton || !messageDiv || !newPasswordErrorSpan || !confirmPasswordErrorSpan ||
        !togglePasswordButton || !toggleConfirmPasswordButton) {
        console.error('[Auth] Reset Password Page Error: One or more required form elements not found.');
        return;
    }

    // --- Initialize Password Toggle Buttons ---
    setupPasswordToggle(newPasswordInput, togglePasswordButton);
    setupPasswordToggle(confirmPasswordInput, toggleConfirmPasswordButton);

    // --- Fetch Initial CSRF Token ---
    const csrfSuccess = await fetchAndStoreCsrfToken();
    if (!csrfSuccess) {
        showAuthMessage(messageDiv, 'Error de seguridad al cargar la página. Por favor, recargue.', 'error');
        if(submitButton) submitButton.disabled = true;
        return;
    }

    // --- Extract Token from URL ---
    const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const token = urlParams.get('token');

    if (!token) {
        showAuthMessage(messageDiv, 'Enlace de restablecimiento inválido. Por favor, solicita un nuevo enlace.', 'error');
        resetPasswordForm.style.display = 'none';
        return;
    }

    // Clean up the token (remove any non-hex characters)
    const cleanToken = token.replace(/[^a-fA-F0-9]/g, '');
    console.log(`[Auth] Reset token found in URL: ${cleanToken.substring(0, 10)}...`);

    // Set the token in the hidden input
    tokenInput.value = cleanToken;

    // --- Validate Token with API ---
    try {
        console.log('[Auth] Validating reset token...');
        const response = await fetch(`/api/auth/reset-password/${cleanToken}`);
        const data = await response.json();

        if (!response.ok || !data.valid) {
            showAuthMessage(messageDiv, data.message || 'El enlace de restablecimiento es inválido o ha expirado.', 'error');
            resetPasswordForm.style.display = 'none';
            return;
        }

        console.log('[Auth] Token validated successfully');
    } catch (error) {
        console.error('[Auth] Error validating reset token:', error);
        // Don't hide the form on error, just show a warning
        showAuthMessage(messageDiv, 'No se pudo validar el enlace de restablecimiento. Intenta restablecer tu contraseña de todos modos.', 'warning');
    }

    // --- Form Submission Handler ---
    resetPasswordForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        console.log('[Auth] Reset Password form submitted.');

        // 1. Clear previous feedback
        clearAuthMessage(messageDiv);
        newPasswordInput.classList.remove('is-invalid');
        confirmPasswordInput.classList.remove('is-invalid');
        newPasswordErrorSpan.hidden = true;
        confirmPasswordErrorSpan.hidden = true;
        newPasswordErrorSpan.textContent = '';
        confirmPasswordErrorSpan.textContent = '';

        // 2. Get Form Values
        const token = tokenInput.value;
        const password = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        let isValid = true;

        // 3. Validate Passwords
        if (!password) {
            newPasswordInput.classList.add('is-invalid');
            newPasswordErrorSpan.textContent = 'Por favor, ingresa una contraseña.';
            newPasswordErrorSpan.hidden = false;
            isValid = false;
        } else if (password.length < 8) {
            newPasswordInput.classList.add('is-invalid');
            newPasswordErrorSpan.textContent = 'La contraseña debe tener al menos 8 caracteres.';
            newPasswordErrorSpan.hidden = false;
            isValid = false;
        }

        if (!confirmPassword) {
            confirmPasswordInput.classList.add('is-invalid');
            confirmPasswordErrorSpan.textContent = 'Por favor, confirma tu contraseña.';
            confirmPasswordErrorSpan.hidden = false;
            isValid = false;
        } else if (password !== confirmPassword) {
            confirmPasswordInput.classList.add('is-invalid');
            confirmPasswordErrorSpan.textContent = 'Las contraseñas no coinciden.';
            confirmPasswordErrorSpan.hidden = false;
            isValid = false;
        }

        // 4. If validation fails, stop here
        if (!isValid) {
            return;
        }

        // 5. Set Loading State
        setAuthLoading(submitButton, true);

        // 6. Prepare API Request Body
        const requestBody = JSON.stringify({ token, password });

        // 7. Perform API Call to /api/auth/reset-password
        try {
            console.log('[Auth] Submitting new password...');
            const response = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-Token': csrfToken
                },
                body: requestBody
            });

            // 8. Handle API Response
            const responseData = await response.json();

            if (response.ok) {
                // Success - Show success message
                console.log('[Auth] Password reset successful');
                showAuthMessage(messageDiv, responseData.message || 'Tu contraseña ha sido restablecida exitosamente.', 'success');
                resetPasswordForm.reset();

                // Redirect to login page after a delay
                setTimeout(() => {
                    window.location.hash = '#/login';
                }, 3000);
            } else {
                // Error - Show error message
                const errorMessage = responseData.message || 'Error al restablecer la contraseña. Por favor, intenta nuevamente.';
                console.error(`[Auth] Password reset failed: ${errorMessage}`);
                showAuthMessage(messageDiv, errorMessage, 'error');
            }
        } catch (error) {
            // Network Error
            console.error('[Auth] Network error during password reset:', error);
            showAuthMessage(messageDiv, 'Error de red al restablecer la contraseña. Verifique su conexión.', 'error');
        } finally {
            // Always reset loading state
            setAuthLoading(submitButton, false);
        }
    });

    console.log('[Auth] Reset Password Page initialization complete.');
}

// Note: showAuthMessage function is already defined at the top of the file

/**
 * Initializes the 404 Not Found page
 * Checks authentication status and updates the redirect link accordingly
 */
function init404Page() {
    console.log('[Auth] Initializing 404 Not Found Page...');

    const redirectLink = document.getElementById('redirect-link');
    const buttonText = redirectLink ? redirectLink.querySelector('.button-text') : null;

    if (redirectLink && buttonText) {
        const isAuthenticated = sessionStorage.getItem('isAuthenticated') === 'true';

        if (isAuthenticated) {
            redirectLink.href = '#/dashboard';
            buttonText.textContent = 'Ir al Dashboard';
            console.log('[Auth] User is authenticated. 404 page redirect set to dashboard.');
        } else {
            redirectLink.href = '#/';
            buttonText.textContent = 'Ir a la Página Principal';
            console.log('[Auth] User is not authenticated. 404 page redirect set to home page.');
        }
    } else {
        console.warn('[Auth] Could not find redirect link or button text in 404 page.');
    }

    console.log('[Auth] 404 Not Found Page initialization complete.');
}

// --- Make Initialization Functions Globally Accessible ---
// Attach to window object for the router (main.js)
window.initLoginPage = initLoginPage;
window.initRegisterPage = initRegisterPage;
window.initForgotPasswordPage = initForgotPasswordPage;
window.initResetPasswordPage = initResetPasswordPage;
window.init404Page = init404Page;
window.getStoredCsrfToken = getStoredCsrfToken;

console.log('[Auth] Authentication script loaded and aligned with API docs.');
