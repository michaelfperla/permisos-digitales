/**
 * =============================================================================
 * Permisos Digitales - Permits Component Logic (permits.js)
 * =============================================================================
 *
 * Contains the JavaScript logic for permit-related views:
 * - New Permit Form (`initPermitFormPage`)
 * - Permit Detail View (`initPermitDetailPage`) including upload logic
 * - (Future) Permit Upload View (Standalone - if needed)
 */

// --- Module Scope Variables ---
// Attempt to reuse the CSRF token fetched by auth.js if available
// This relies on auth.js running first and setting a global 'csrfToken' variable.
// A more robust solution would use proper state management or module exports.
let permitCsrfToken = window.csrfToken || null; // Use token from auth.js if set

// --- Shared Helper Functions ---

/**
 * Helper to fetch CSRF token specifically for permit actions if needed.
 * Replicates logic from auth.js for now. Not ideal DRY practice.
 */
async function fetchPermitCsrfToken() {
    if (permitCsrfToken) return true; // Use existing if available
    console.log('[Permits][CSRF] Fetching CSRF token...');
    try {
        const response = await fetch('/api/auth/csrf-token');
        if (!response.ok) throw new Error(`Failed to fetch CSRF token: ${response.status}`);
        const data = await response.json();
        if (data && data.csrfToken) {
            permitCsrfToken = data.csrfToken;
            window.csrfToken = permitCsrfToken; // Update global potentially
            console.log('[Permits][CSRF] Token fetched.');
            return true;
        } else {
            throw new Error('Invalid CSRF token response.');
        }
    } catch (error) {
        console.error('[Permits][CSRF] Error fetching CSRF token:', error);
        permitCsrfToken = null;
        return false;
    }
}

/**
 * Displays a message (error or success) in the permit form message area.
 * @param {string} message - The message text.
 * @param {'error' | 'success'} [type='error'] - Type of message.
 */
function showPermitFormMessage(message, type = 'error') {
    const messageDiv = document.getElementById('permit-form-message');
    if (!messageDiv) return;
    messageDiv.textContent = message;
    messageDiv.className = 'message-area'; // Reset classes
    messageDiv.classList.add(type === 'success' ? 'success-message' : 'error-message');
    messageDiv.hidden = false;
}

/** Clears the permit form message area. */
function clearPermitFormMessage() {
    const messageDiv = document.getElementById('permit-form-message');
    if (!messageDiv) return;
    messageDiv.textContent = '';
    messageDiv.hidden = true;
    messageDiv.className = 'message-area'; // Reset classes
}

/**
 * Sets the loading state for the permit form submit button.
 * @param {boolean} isLoading - True to show loading, false otherwise.
 */
function setPermitFormLoading(isLoading) {
    const button = document.getElementById('permit-submit-btn');
    if (!button) return;
    const buttonText = button.querySelector('.button-text');
    const spinner = button.querySelector('.spinner');
    if (!buttonText || !spinner) return;

    if (isLoading) {
        button.disabled = true;
        button.classList.add('loading');
        buttonText.style.visibility = 'hidden';
        spinner.hidden = false;
    } else {
        button.disabled = false;
        button.classList.remove('loading');
        buttonText.style.visibility = 'visible';
        spinner.hidden = true;
    }
}

/**
 * Displays the payment instructions after successful form submission.
 * @param {object} instructions - The paymentInstructions object from the API response.
 */
function displayPaymentInstructions(instructions) {
    const area = document.getElementById('payment-instructions-area');
    const form = document.getElementById('permit-form');
    if (!area || !instructions) return;

    // Handle different response structures between permit form and renewal
    const paymentRef = instructions.reference || instructions.paymentReference || (instructions.applicationId ? `APP-${instructions.applicationId}` : 'N/A');
    document.getElementById('payment-reference').textContent = paymentRef;

    // Handle amount - could be in different formats depending on the endpoint
    const amountElement = document.getElementById('payment-amount');
    if (amountElement) {
        if (typeof instructions.amount === 'number') {
            amountElement.textContent = instructions.amount.toFixed(2);
        } else if (instructions.paymentAmount) {
            // For renewal response which might have a string like "135.00 MXN"
            const amountStr = instructions.paymentAmount;
            if (typeof amountStr === 'string' && amountStr.includes(' ')) {
                const parts = amountStr.split(' ');
                amountElement.textContent = parts[0];
                const currencyElement = document.getElementById('payment-currency');
                if (currencyElement) currencyElement.textContent = parts[1] || '';
            } else {
                amountElement.textContent = amountStr;
            }
        } else {
            amountElement.textContent = '197.00'; // Exact amount
        }
    }

    // Set currency if not already set and available
    const currencyElement = document.getElementById('payment-currency');
    if (currencyElement && !currencyElement.textContent && instructions.currency) {
        currencyElement.textContent = instructions.currency;
    } else if (currencyElement && !currencyElement.textContent) {
        currencyElement.textContent = 'MXN'; // Default currency
    }

    // Set next steps
    const nextStepsElement = document.getElementById('payment-next-steps');
    if (nextStepsElement) {
        nextStepsElement.textContent = instructions.nextSteps || 'Después de realizar su pago, regrese a la aplicación y haga clic en "Subir Comprobante de Pago" para enviar evidencia de su pago.';
    }

    // Format payment methods
    const methodsList = document.getElementById('payment-methods');
    if (methodsList) {
        methodsList.innerHTML = ''; // Clear previous methods

        if (instructions.paymentMethods && Array.isArray(instructions.paymentMethods)) {
            instructions.paymentMethods.forEach(method => {
                const li = document.createElement('li');

                // Handle different method structures
                if (method.type && (method.details || method.instructions)) {
                    // Simple format with type and details/instructions
                    const methodType = method.type.replace('_', ' ');
                    const methodDetails = method.details || method.instructions || '';
                    li.innerHTML = `<strong>${methodType}:</strong> ${methodDetails}`;
                } else if (method.type && method.accountDetails) {
                    // Complex format with account details (from renewal endpoint)
                    const methodType = method.type;
                    const accountDetails = method.accountDetails;
                    let detailsHtml = `<strong>${methodType}:</strong> ${method.instructions || ''}<br>`;

                    // Format account details
                    if (accountDetails) {
                        if (accountDetails.bank) detailsHtml += `<span class="detail-item">Banco: ${accountDetails.bank}</span><br>`;
                        if (accountDetails.accountHolder) detailsHtml += `<span class="detail-item">Beneficiario: ${accountDetails.accountHolder}</span><br>`;
                        if (accountDetails.accountNumber) detailsHtml += `<span class="detail-item">Cuenta: ${accountDetails.accountNumber}</span><br>`;
                        if (accountDetails.clabe) detailsHtml += `<span class="detail-item">CLABE: ${accountDetails.clabe}</span><br>`;
                        if (accountDetails.reference) detailsHtml += `<span class="detail-item">Referencia: <code>${accountDetails.reference}</code></span>`;
                    }

                    li.innerHTML = detailsHtml;
                } else {
                    // Fallback for unknown format
                    li.textContent = JSON.stringify(method);
                }

                methodsList.appendChild(li);
            });
        } else {
            methodsList.innerHTML = '<li>Información no disponible.</li>';
        }
    }

    // Show the instructions area and hide form if applicable
    area.hidden = false;
    if (form) form.hidden = true;
}


// --- Helper Function for File Upload ---
/**
 * Handles the actual file upload process.
 * @param {number} applicationId - The ID of the application.
 * @param {File} file - The file object to upload.
 * @param {string} paymentReference - Optional payment reference text.
 * @param {string} desiredStartDate - Optional desired start date (YYYY-MM-DD).
 */
async function handleFileUpload(applicationId, file, paymentReference, desiredStartDate) {
    const uploadForm = document.getElementById('upload-form'); // Used to potentially disable
    const submitButton = document.getElementById('upload-submit-btn');
    const messageDiv = document.getElementById('upload-message');
    const dateInput = document.getElementById('desired-start-date');
    const dateErrorSpan = document.getElementById('desired-start-date-error');

    if (!submitButton || !messageDiv) {
        console.error('[Permits] Upload Error: Cannot find upload button or message area.');
        return;
    }

    // --- Client-side File Validation ---
    if (!file) {
        messageDiv.textContent = 'Por favor, seleccione un archivo para subir.';
        messageDiv.className = 'message-area error-message';
        messageDiv.hidden = false;
        return;
    }
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB (match backend)
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
    if (file.size > MAX_FILE_SIZE) {
        messageDiv.textContent = 'Error: El archivo es demasiado grande (máximo 5MB).';
        messageDiv.className = 'message-area error-message';
        messageDiv.hidden = false;
        return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
         messageDiv.textContent = 'Error: Tipo de archivo no válido (solo JPG, PNG, PDF).';
         messageDiv.className = 'message-area error-message';
         messageDiv.hidden = false;
         return;
    }
    // --- End File Validation ---

    // --- Date Validation (if provided) ---
    let dateValidationError = null;
    if (desiredStartDate) {
        try {
            // Parse the date string
            const dateObj = new Date(desiredStartDate);

            // Check if it's a valid date
            if (isNaN(dateObj.getTime())) {
                dateValidationError = 'Formato de fecha inválido. Use el formato YYYY-MM-DD.';
            } else {
                // Check if the date is not in the past
                const today = new Date();
                today.setHours(0, 0, 0, 0); // Set to beginning of day for comparison

                if (dateObj < today) {
                    dateValidationError = 'La fecha de inicio no puede ser en el pasado.';
                }

                // Check if the date is within a reasonable future window (e.g., 90 days)
                const maxFutureDate = new Date();
                maxFutureDate.setDate(maxFutureDate.getDate() + 90);

                if (dateObj > maxFutureDate) {
                    dateValidationError = 'La fecha de inicio no puede ser más de 90 días en el futuro.';
                }
            }
        } catch (error) {
            console.error('[Permits] Error validating desired start date:', error);
            dateValidationError = 'Error al validar la fecha. Use el formato YYYY-MM-DD.';
        }
    }

    // Display date validation error if any
    if (dateValidationError && dateErrorSpan) {
        dateErrorSpan.textContent = dateValidationError;
        dateErrorSpan.hidden = false;
        if (dateInput) {
            dateInput.classList.add('is-invalid');
            dateInput.focus();
        }
        return; // Stop the upload process if date is invalid
    }

    // --- End All Validation ---

    // Clear previous messages and set loading state
    messageDiv.hidden = true;
    messageDiv.textContent = '';
    messageDiv.className = 'message-area'; // Reset class

    // Clear date validation error if any
    if (dateErrorSpan) {
        dateErrorSpan.textContent = '';
        dateErrorSpan.hidden = true;
    }
    if (dateInput) {
        dateInput.classList.remove('is-invalid');
    }

    // Use a generic loading setter if available, or adapt setPermitFormLoading
    const setUploadLoading = (isLoading) => { // Simple inline helper
        const btnText = submitButton.querySelector('.button-text');
        const spinner = submitButton.querySelector('.spinner');
        if (!btnText || !spinner) return;
        submitButton.disabled = isLoading;
        if(isLoading) submitButton.classList.add('loading'); else submitButton.classList.remove('loading');
        btnText.style.visibility = isLoading ? 'hidden' : 'visible';
        spinner.hidden = !isLoading;
    };
    setUploadLoading(true);

    // --- Ensure CSRF Token ---
    // Use the globally exposed function from auth.js
    let currentCsrfToken = null;
    if (typeof window.getStoredCsrfToken === 'function') {
         currentCsrfToken = await window.getStoredCsrfToken(); // Ensure token is fetched/available
    }

    if (!currentCsrfToken) {
        console.error('[Permits][CSRF] Upload Error: Could not retrieve CSRF token.');
        messageDiv.textContent = 'Error de seguridad. Recargue la página e intente de nuevo.';
        messageDiv.className = 'message-area error-message';
        messageDiv.hidden = false;
        setUploadLoading(false);
        return;
    }

    // --- Create FormData ---
    const formData = new FormData();
    formData.append('paymentProof', file, file.name); // Key 'paymentProof' must match backend Multer field name
    if (paymentReference) {
        formData.append('paymentReference', paymentReference); // Add reference if provided
    }
    if (desiredStartDate) {
        formData.append('desiredStartDate', desiredStartDate); // Add desired start date if provided
        console.log(`[Permits] Including desired start date: ${desiredStartDate}`);
    }
    // Add CSRF token to FormData body (as per API.md alternative)
    formData.append('_csrf', currentCsrfToken);

    // --- Perform API Call ---
    try {
        console.log(`[Permits] Uploading payment proof for application ${applicationId}`);
        const response = await fetch(`/api/applications/${applicationId}/payment-proof`, {
            method: 'POST',
            headers: {
                // 'Content-Type': 'multipart/form-data' is set automatically by browser when using FormData
                'Accept': 'application/json',
                // Include CSRF token in header as well
                'X-CSRF-Token': currentCsrfToken
            },
            body: formData // Send FormData object
        });

        const responseData = await response.json();

        if (response.ok) { // Status 200 OK
            console.log('[Permits] Upload successful:', responseData);
            messageDiv.textContent = responseData.message || 'Comprobante subido con éxito. Su pago será verificado pronto.';
            messageDiv.className = 'message-area success-message';
            messageDiv.hidden = false;
            setUploadLoading(false);
            submitButton.disabled = true; // Disable after successful upload
            if(uploadForm) uploadForm.reset(); // Reset form fields
            const fileNameDisplay = document.getElementById('file-name-display');
            if(fileNameDisplay) fileNameDisplay.textContent = ''; // Clear file name display

            // Refresh details after a delay to show updated status
            setTimeout(() => {
                 const detailInitFunc = window.initPermitDetailPage;
                 if (typeof detailInitFunc === 'function') {
                     console.log('[Permits] Refreshing details after upload...');
                     // We need to re-run the init function for the *current* page,
                     // which means we need the ID again. It's safer to trigger a full
                     // re-route or have loadPermitDetails globally accessible.
                     // For now, let's just log - manual refresh might be needed.
                     // detailInitFunc(); // This might cause issues if called directly again
                     // Alternative: Reload the current view via router
                     const currentHash = window.location.hash;
                     window.location.hash = ''; // Force change
                     window.location.hash = currentHash; // Trigger reload
                 }
            }, 2000); // Refresh after 2 seconds

        } else {
            // Handle API errors (400, 404, 409, etc.)
            let errorMessage = responseData.message || `Error al subir (${response.status})`;
            console.error(`[Permits] Upload failed (${response.status}):`, responseData);
            messageDiv.textContent = errorMessage;
            messageDiv.className = 'message-area error-message';
            messageDiv.hidden = false;
            setUploadLoading(false); // Re-enable button on error
        }

    } catch (error) {
        // Handle network errors
        console.error('[Permits] Network error during file upload:', error);
        messageDiv.textContent = `Error de red al subir: ${error.message}. Verifique su conexión.`;
        messageDiv.className = 'message-area error-message';
        messageDiv.hidden = false;
        setUploadLoading(false);
    }
}


// --- New Permit Form Initialization ---
async function initPermitFormPage() {
    console.log('[Permits] Initializing New Permit Form Page...');

    // --- Get DOM Elements ---
    console.log('[Permits] Attempting to get elements...'); // Debug log
    const form = document.getElementById('permit-form');
    const submitButton = document.getElementById('permit-submit-btn');
    const messageDiv = document.getElementById('permit-form-message');
    const paymentArea = document.getElementById('payment-instructions-area');
    const inputs = {
        nombre_completo: document.getElementById('permit-nombre-completo'),
        curp_rfc: document.getElementById('permit-curp-rfc'),
        domicilio: document.getElementById('permit-domicilio'),
        marca: document.getElementById('permit-marca'),
        linea: document.getElementById('permit-linea'),
        color: document.getElementById('permit-color'),
        numero_serie: document.getElementById('permit-numero-serie'),
        numero_motor: document.getElementById('permit-numero-motor'),
        ano_modelo: document.getElementById('permit-ano-modelo'),
    };
     // Log results of getElementById
    console.log(`[Permits]   form:`, form);
    console.log(`[Permits]   submitButton:`, submitButton);
    console.log(`[Permits]   messageDiv:`, messageDiv);
    console.log(`[Permits]   paymentArea:`, paymentArea);
    for (const key in inputs) { console.log(`[Permits]   inputs.${key}:`, inputs[key]); }
    console.log('[Permits] Finished attempting to get elements.');

    // --- Element Existence Check ---
    const allInputsFound = !Object.values(inputs).some(input => !input);
    if (!form || !submitButton || !messageDiv || !paymentArea || !allInputsFound) {
        console.error('[Permits] New Permit Form Error: One or more required elements were null/not found.');
        // ... (error logging and display) ...
        const container = document.querySelector('.permit-container');
        if(container) container.innerHTML = '<p class="error-message">Error al cargar la estructura del formulario de solicitud (Error ID Check).</p>';
        return;
    }
    console.log('[Permits] Element existence check passed.');


    // --- Fetch Initial CSRF Token ---
    const csrfSuccess = await fetchPermitCsrfToken(); // Use the helper
    if (!csrfSuccess) {
        showPermitFormMessage('Error de seguridad al cargar. Por favor, recargue la página.');
        if(submitButton) submitButton.disabled = true;
        return;
    }

    // --- Initialize Form Wizard ---
    if (typeof window.initFormWizard === 'function') {
        window.initFormWizard();
    } else {
        console.warn('[Permits] Form wizard initialization function not found.');
    }

    // --- Add Input Event Listeners to Clear Errors on Type ---
    const formInputsArray = Object.values(inputs);
    formInputsArray.forEach(input => {
        input.addEventListener('input', (event) => {
            const targetInput = event.target;
            targetInput.classList.remove('is-invalid');
            const errorSpan = document.getElementById(`${targetInput.id}-error`);
            if (errorSpan) {
                errorSpan.hidden = true;
                errorSpan.textContent = '';
            }
            // Optional: Clear general top message as well
            clearPermitFormMessage();
        });
    });

    // --- Form Submission Handler ---
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        console.log('[Permits] Permit form submitted.');
        clearPermitFormMessage();

        // --- Clear previous validation feedback ---
        formInputsArray.forEach(input => {
            input.classList.remove('is-invalid');
            const errorSpan = document.getElementById(`${input.id}-error`);
            if (errorSpan) {
                errorSpan.hidden = true;
                errorSpan.textContent = '';
            }
        });

        // --- Client-Side Validation with Field-Specific Errors ---
        let isValid = true;
        let firstInvalidField = null;

        // Check each input field
        Object.entries(inputs).forEach(([key, input]) => {
            if (!input.value.trim()) {
                isValid = false;
                input.classList.add('is-invalid');
                const errorSpan = document.getElementById(`${input.id}-error`);
                if (errorSpan) {
                    // Customize error message based on field
                    let errorMessage = 'Este campo es requerido.';
                    if (key === 'nombre_completo') errorMessage = 'Nombre completo es requerido.';
                    else if (key === 'curp_rfc') errorMessage = 'CURP o RFC es requerido.';
                    else if (key === 'domicilio') errorMessage = 'Domicilio es requerido.';
                    else if (key === 'marca') errorMessage = 'Marca del vehículo es requerida.';
                    else if (key === 'linea') errorMessage = 'Línea/Modelo es requerido.';
                    else if (key === 'color') errorMessage = 'Color del vehículo es requerido.';
                    else if (key === 'numero_serie') errorMessage = 'Número de serie (VIN) es requerido.';
                    else if (key === 'numero_motor') errorMessage = 'Número de motor es requerido.';
                    else if (key === 'ano_modelo') errorMessage = 'Año modelo es requerido.';

                    errorSpan.textContent = errorMessage;
                    errorSpan.hidden = false;
                }
                if (!firstInvalidField) firstInvalidField = input;
            }
        });

        // Special validation for VIN (numero_serie)
        if (inputs.numero_serie.value.trim() && inputs.numero_serie.value.trim().length !== 17) {
            isValid = false;
            inputs.numero_serie.classList.add('is-invalid');
            const errorSpan = document.getElementById('permit-numero-serie-error');
            if (errorSpan) {
                errorSpan.textContent = 'El número de serie (VIN) debe tener exactamente 17 caracteres.';
                errorSpan.hidden = false;
            }
            if (!firstInvalidField) firstInvalidField = inputs.numero_serie;
        }

        if (!isValid) {
            console.log('[Permits] Client-side validation failed.');
            // Optional: Keep a general message at the top
            // showPermitFormMessage('Por favor, corrija los errores.');
            if (firstInvalidField) firstInvalidField.focus();
            return;
        }

        // --- Check for CSRF Token ---
        if (!permitCsrfToken) {
            console.warn('[Permits][CSRF] Token missing at submit, attempting re-fetch...');
            const retrySuccess = await fetchPermitCsrfToken();
            if (!retrySuccess) { showPermitFormMessage('Error de seguridad (token CSRF no disponible). Recargue la página.'); return; }
        }

        // --- Set Loading State ---
        setPermitFormLoading(true);

        // --- Prepare API Request Body ---
        const requestBody = {};
        Object.keys(inputs).forEach(key => { requestBody[key] = inputs[key].value.trim(); });
        requestBody._csrf = permitCsrfToken; // Add CSRF to body

        // --- Perform API Call ---
        try {
            console.log('[Permits] Sending application data to /api/applications');
            const response = await fetch('/api/applications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-Token': permitCsrfToken },
                body: JSON.stringify(requestBody)
            });
            const responseData = await response.json();

            // --- Handle API Response ---
            if (response.status === 201) { // Use status code for success check
                console.log('[Permits] Application submitted successfully!', responseData);
                // Check for the CORRECT nested paymentInstructions object
                if (responseData.paymentInstructions) {
                    displayPaymentInstructions(responseData.paymentInstructions); // Pass the nested object
                } else {
                    console.warn('[Permits] Success response missing paymentInstructions object.');
                    showPermitFormMessage('Solicitud creada con éxito. Revisa tu dashboard para los siguientes pasos.', 'success');
                    const messageArea = document.getElementById('permit-form-message');
                    if(messageArea) messageArea.insertAdjacentHTML('beforeend', ' <a href="#/dashboard" style="font-weight: bold;">Ir al Dashboard</a>');
                    form.hidden = true; // Hide form even with generic success
                }
                setPermitFormLoading(false);
                submitButton.disabled = true;

            } else {
                // --- Handle API Errors ---
                let errorMessage = responseData.message || `Error ${response.status}`;
                 if (response.status === 409) { errorMessage = responseData.message || 'Conflicto: El vehículo ya podría tener una solicitud activa.'; inputs.numero_serie.focus(); }
                 else if (response.status === 400) { errorMessage = responseData.message || 'Error en los datos enviados. Revise la información.'; if (responseData.errors && Array.isArray(responseData.errors)) { errorMessage += ' Detalles: ' + responseData.errors.map(e => e.msg).join(', '); } if (firstInvalidField) firstInvalidField.focus(); else inputs.nombre_completo.focus(); }
                 else if (response.status === 401) { errorMessage = responseData.message || 'No autorizado. Inicie sesión de nuevo.'; window.location.hash = '#/login'; }
                 else if (response.status === 429) { errorMessage = responseData.message || 'Demasiadas solicitudes. Intente más tarde.'; }
                 console.error(`[Permits] API Error (${response.status}): ${errorMessage}`);
                showPermitFormMessage(errorMessage);
                setPermitFormLoading(false);
            }
        } catch (error) {
            // --- Handle Network Errors ---
            console.error('[Permits] Network error submitting permit form:', error);
            showPermitFormMessage(`Error de red: ${error.message}. Verifique su conexión.`);
            setPermitFormLoading(false);
        }
    }); // End form submit listener

    console.log('[Permits] New Permit Form Page initialization complete.');

} // --- End of initPermitFormPage ---


// --- Permit Detail Page Initialization ---
async function initPermitDetailPage() {
    console.log('[Permits] Initializing Permit Detail Page...');

    // --- Get Static DOM Elements ---
    const loadingDiv = document.getElementById('detail-loading');
    const errorDiv = document.getElementById('detail-error-message');
    const contentDiv = document.getElementById('detail-content');
    const appIdSpan = document.getElementById('detail-application-id');
    const actionsContainer = document.getElementById('permit-actions');
    const uploadSection = document.getElementById('upload-section');
    const uploadForm = document.getElementById('upload-form');
    const fileInput = document.getElementById('payment-proof-file');
    const fileNameDisplay = document.getElementById('file-name-display');
    const referenceInput = document.getElementById('payment-reference-input');
    const uploadSubmitButton = document.getElementById('upload-submit-btn');
    const uploadMessageDiv = document.getElementById('upload-message');

    // --- Element Existence Check ---
    if (!loadingDiv || !errorDiv || !contentDiv || !appIdSpan || !actionsContainer || !uploadSection || !uploadForm || !fileInput || !fileNameDisplay || !referenceInput || !uploadSubmitButton || !uploadMessageDiv) {
        console.error('[Permits] Detail Page Error: Core container or upload section elements not found.');
        const container = document.querySelector('.permit-container');
        if (container) container.innerHTML = '<p class="error-message">Error al cargar la estructura de la página de detalles.</p>';
        return;
    }

    // --- Extract Application ID from Hash ---
    let applicationId = null;
    try {
        const hashParts = window.location.hash.split('/');
        const idStr = hashParts[hashParts.length - 1];
        applicationId = parseInt(idStr, 10);
        if (isNaN(applicationId)) throw new Error('Invalid ID found in URL hash.');
        appIdSpan.textContent = applicationId;
        console.log(`[Permits] Extracted Application ID: ${applicationId}`);
    } catch (e) {
        console.error('[Permits] Detail Page Error:', e.message);
        loadingDiv.hidden = true; contentDiv.hidden = true; errorDiv.textContent = 'Error: ID de solicitud inválido.'; errorDiv.hidden = false;
        return;
    }

    // --- Helper to Update DOM ---
    const updateElementText = (id, text) => {
        const el = document.getElementById(id);
        if (el) { el.textContent = text || '---'; } else { console.warn(`[Permits] Detail Page: Element with ID ${id} not found.`); }
    };

    // --- Initialize Tabs ---
    if (typeof window.initTabs === 'function') {
        window.initTabs();
    } else {
        console.warn('[Permits] Tabs initialization function not found.');
    }

    // --- Initialize Enhanced File Upload ---
    if (typeof window.initFileUpload === 'function') {
        window.initFileUpload();
    } else {
        console.warn('[Permits] Enhanced file upload initialization function not found.');

        // Fallback to basic file input handling
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) {
                const fileNameElement = fileNameDisplay.querySelector('.file-name');
                if (fileNameElement) {
                    fileNameElement.textContent = fileInput.files[0].name;
                    fileNameDisplay.hidden = false;
                } else {
                    fileNameDisplay.textContent = `Archivo seleccionado: ${fileInput.files[0].name}`;
                }
                uploadMessageDiv.hidden = true;
                uploadMessageDiv.textContent = '';
                uploadMessageDiv.className = 'message-area';
            } else {
                fileNameDisplay.hidden = true;
            }
        });
    }

    // --- Add Event Listener for Date Input Change ---
    const dateInput = document.getElementById('desired-start-date');
    const dateErrorSpan = document.getElementById('desired-start-date-error');

    if (dateInput && dateErrorSpan) {
        // Set minimum date to today
        const today = new Date();
        const formattedToday = today.toISOString().split('T')[0]; // Format as YYYY-MM-DD
        dateInput.min = formattedToday;

        // Clear validation error when date changes
        dateInput.addEventListener('input', () => {
            dateInput.classList.remove('is-invalid');
            dateErrorSpan.textContent = '';
            dateErrorSpan.hidden = true;
        });
    }

    // --- Add Event Listener for Upload Form Submission ---
    uploadForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const file = fileInput.files[0];
        const reference = referenceInput.value.trim();
        const dateInput = document.getElementById('desired-start-date');
        const desiredStartDate = dateInput ? dateInput.value.trim() : null;

        handleFileUpload(applicationId, file, reference, desiredStartDate); // Call the helper with date
    });


    // --- Function to Fetch and Render Details ---
    async function loadPermitDetails(id) {
        console.log(`[Permits] Fetching details for application ID: ${id}`);
        loadingDiv.hidden = false; errorDiv.hidden = true; contentDiv.hidden = true; uploadSection.hidden = true; actionsContainer.innerHTML = '';

        try {
            const response = await fetch(`/api/applications/${id}/status`);
            if (!response.ok) {
                 if (response.status === 404) throw new Error('Solicitud no encontrada.');
                 else if (response.status === 401 || response.status === 403) { window.location.hash = '#/login'; return; }
                 else { const errorText = await response.text(); throw new Error(`Error del servidor (${response.status}): ${response.statusText}. ${errorText}`); }
            }
            const data = await response.json();
            console.log('[Permits] Details received:', data);

            // --- Populate DOM Elements ---
            if (data && data.application && data.status) {
                const app = data.application;
                const statusInfo = data.status;

                // Populate status, vehicle, owner, dates... (same as before)
                updateElementText('detail-status-description', statusInfo.description || statusInfo.displayMessage);
                updateElementText('detail-status-next-steps', statusInfo.nextSteps);
                updateElementText('detail-last-updated', formatDate(app.dates?.updated));
                const statusBadge = document.getElementById('detail-status-badge');
                if (statusBadge) {
                     const statusKey = statusInfo.currentStatus ? String(statusInfo.currentStatus).toUpperCase() : 'UNKNOWN';
                     statusBadge.className = `status-badge status-${statusKey}`;
                     statusBadge.textContent = statusKey.replace(/_/g, ' ').replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
                }
                const rejectionContainer = document.getElementById('rejection-reason-container');
                if (app.payment_rejection_reason && rejectionContainer) { updateElementText('detail-payment-rejection', app.payment_rejection_reason); rejectionContainer.hidden = false; } else if(rejectionContainer) { rejectionContainer.hidden = true; }
                updateElementText('detail-vehicle-marca', app.vehicleInfo?.marca);
                updateElementText('detail-vehicle-linea', app.vehicleInfo?.linea);
                updateElementText('detail-vehicle-ano', app.vehicleInfo?.ano_modelo);
                updateElementText('detail-vehicle-color', app.vehicleInfo?.color);
                updateElementText('detail-vehicle-serie', app.vehicleInfo?.numero_serie);
                updateElementText('detail-vehicle-motor', app.vehicleInfo?.numero_motor);
                updateElementText('detail-owner-name', app.ownerInfo?.nombre_completo);
                updateElementText('detail-owner-curp', app.ownerInfo?.curp_rfc);
                updateElementText('detail-owner-domicilio', app.ownerInfo?.domicilio);
                updateElementText('detail-date-created', formatDate(app.dates?.created));
                updateElementText('detail-date-proof-uploaded', formatDate(app.dates?.paymentProofUploaded));
                updateElementText('detail-date-payment-verified', formatDate(app.dates?.paymentVerified));
                updateElementText('detail-payment-reference', app.payment?.reference || app.paymentReference);


                // --- Render Conditional Actions (Corrected Download Links & Certificado) ---
                actionsContainer.innerHTML = ''; // Clear first
                const canDownload = statusInfo.currentStatus === 'PERMIT_READY' || statusInfo.currentStatus === 'COMPLETED';
                const isEligibleForRenewal = ['PERMIT_READY', 'COMPLETED', 'EXPIRED'].includes(statusInfo.currentStatus);
                const allowed = statusInfo.allowedActions || [];

                // Download Permit Button
                if (allowed.includes('downloadPermit') || canDownload) {
                     const downloadPermiso = document.createElement('a');
                     downloadPermiso.href = `/api/applications/${id}/download/permiso`; // Type: permiso
                     downloadPermiso.className = 'btn btn-success btn-download';
                     downloadPermiso.textContent = 'Descargar Permiso';
                     downloadPermiso.title = 'Descargar Permiso PDF';
                     downloadPermiso.target = '_blank';
                     downloadPermiso.setAttribute('aria-label', `Descargar Permiso para la solicitud ${id}`);
                     actionsContainer.appendChild(downloadPermiso);
                }
                // Download Receipt Button
                if (allowed.includes('downloadReceipt') || canDownload) {
                     const downloadRecibo = document.createElement('a');
                     downloadRecibo.href = `/api/applications/${id}/download/recibo`; // Type: recibo
                     downloadRecibo.className = 'btn btn-secondary btn-download';
                     downloadRecibo.textContent = 'Descargar Recibo';
                     downloadRecibo.title = 'Descargar Recibo PDF';
                     downloadRecibo.target = '_blank';
                     downloadRecibo.setAttribute('aria-label', `Descargar Recibo para la solicitud ${id}`);
                     actionsContainer.appendChild(downloadRecibo);
                }
                // Download Certificate Button
                if (allowed.includes('downloadCertificate') || canDownload) {
                     const downloadCertificado = document.createElement('a');
                     downloadCertificado.href = `/api/applications/${id}/download/certificado`; // Type: certificado
                     downloadCertificado.className = 'btn btn-info btn-download';
                     downloadCertificado.textContent = 'Descargar Certificado';
                     downloadCertificado.title = 'Descargar Certificado PDF';
                     downloadCertificado.target = '_blank';
                     downloadCertificado.setAttribute('aria-label', `Descargar Certificado para la solicitud ${id}`);
                     actionsContainer.appendChild(downloadCertificado);
                }
                // --- End Download Buttons ---

                // Renewal Button
                if (isEligibleForRenewal) {
                    const renewButton = document.createElement('a');
                    renewButton.href = `#/permits/${id}/renew`;
                    renewButton.className = 'btn btn-primary btn-renew';
                    renewButton.innerHTML = `<svg class="icon icon-renew" focusable="false" aria-hidden="true"><use xlink:href="/assets/icons/sprite.svg#icon-renew"></use></svg> <span class="button-text-action">Renovar Permiso</span>`;
                    renewButton.title = 'Iniciar proceso de renovación para este permiso';
                    renewButton.setAttribute('aria-label', 'Iniciar proceso de renovación para este permiso');
                    actionsContainer.appendChild(renewButton);
                }

                // Show/Hide Upload Section based on status/allowedActions
                 const canUpload = allowed.includes('upload_payment') || allowed.includes('uploadPaymentProof') || statusInfo.currentStatus === 'PENDING_PAYMENT' || statusInfo.currentStatus === 'PROOF_REJECTED';
                 if (canUpload) {
                    console.log('[Permits] Status allows payment proof upload. Showing upload section.');
                    uploadSection.hidden = false;
                    // Reset upload form state
                    if(uploadForm) uploadForm.reset();
                    if(fileNameDisplay) fileNameDisplay.textContent = '';
                    if(uploadMessageDiv) uploadMessageDiv.hidden = true;
                    if(uploadSubmitButton) {
                        uploadSubmitButton.disabled = false;
                        uploadSubmitButton.classList.remove('loading');
                        const btnText = uploadSubmitButton.querySelector('.button-text');
                        const spinner = uploadSubmitButton.querySelector('.spinner');
                        if(btnText) btnText.style.visibility = 'visible';
                        if(spinner) spinner.hidden = true;
                    }
                 } else {
                    console.log('[Permits] Status does not require/allow payment proof upload. Hiding upload section.');
                    uploadSection.hidden = true;
                 }


                // Generate Timeline
                if (typeof window.generateTimeline === 'function') {
                    window.generateTimeline(app);
                } else {
                    console.warn('[Permits] Timeline generation function not found.');
                }

                // Show content, hide loading
                contentDiv.hidden = false;
                loadingDiv.hidden = true;

            } else {
                throw new Error('Formato de datos inválido recibido del servidor.');
            }

        } catch (error) {
            console.error(`[Permits] Error loading details for application ${id}:`, error);
            loadingDiv.hidden = true; contentDiv.hidden = true; errorDiv.textContent = `Error al cargar detalles: ${error.message}`; errorDiv.hidden = false;
        }
    } // End of loadPermitDetails

    // --- Initial Load ---
    loadPermitDetails(applicationId);

    console.log('[Permits] Permit Detail Page initialization complete.');

} // --- End of initPermitDetailPage ---


// --- (Future) Permit Upload Page Initialization (Standalone - if needed) ---
function initPermitUploadPage() {
     console.log('[Permits] Initializing Permit Upload Page (Placeholder)...');
     // This might not be needed if upload is integrated into detail page
     const appRoot = document.getElementById('app-root');
     if (appRoot) appRoot.innerHTML += '<p><em>Página de Subir Comprobante (Pendiente de Implementar)</em></p>';
}


// --- Permit Renewal Page Initialization ---
async function initPermitRenewalPage() {
    console.log('[Permits] Initializing Permit Renewal Page...');

    // --- Get DOM Element References ---
    const renewalTitle = document.getElementById('renewal-title');
    const originalPermitId = document.getElementById('original-permit-id');
    const originalPermitVehicle = document.getElementById('original-permit-vehicle');
    const originalPermitExpiry = document.getElementById('original-permit-expiry');
    const renewalPaymentAmount = document.getElementById('renewal-payment-amount');
    const confirmRenewalBtn = document.getElementById('confirm-renewal-btn');
    const renewalMessageArea = document.getElementById('renewal-message-area');
    const renewalConfirmationContent = document.getElementById('renewal-confirmation-content');
    const paymentInstructionsArea = document.getElementById('payment-instructions-area');

    // --- Element Existence Check ---
    if (!renewalTitle || !originalPermitId || !originalPermitVehicle || !originalPermitExpiry ||
        !renewalPaymentAmount || !confirmRenewalBtn || !renewalMessageArea ||
        !renewalConfirmationContent || !paymentInstructionsArea) {
        console.error('[Permits] Renewal Page Error: One or more required elements not found.');
        const container = document.querySelector('.renewal-container');
        if (container) container.innerHTML = '<p class="error-message">Error al cargar la estructura de la página de renovación.</p>';
        return;
    }

    // --- Extract Original Application ID from Hash ---
    let originalId = null;
    try {
        const hashParts = window.location.hash.split('/');
        const idStr = hashParts[hashParts.length - 2]; // Get the ID part from /permits/ID/renew
        originalId = parseInt(idStr, 10);
        if (isNaN(originalId)) throw new Error('Invalid ID found in URL hash.');
        originalPermitId.textContent = originalId;
        console.log(`[Permits] Extracted Original Application ID: ${originalId}`);
    } catch (e) {
        console.error('[Permits] Renewal Page Error:', e.message);
        renewalConfirmationContent.hidden = true;
        renewalMessageArea.textContent = 'Error: ID de solicitud inválido.';
        renewalMessageArea.className = 'message-area error-message';
        renewalMessageArea.hidden = false;
        return;
    }

    // --- Fetch Original Permit Data ---
    try {
        console.log(`[Permits] Fetching details for original application ID: ${originalId}`);
        const response = await fetch(`/api/applications/${originalId}/status`);

        if (!response.ok) {
            if (response.status === 404) throw new Error('Solicitud original no encontrada.');
            else if (response.status === 401 || response.status === 403) { window.location.hash = '#/login'; return; }
            else { const errorText = await response.text(); throw new Error(`Error del servidor (${response.status}): ${response.statusText}. ${errorText}`); }
        }

        const data = await response.json();
        console.log('[Permits] Original permit details received:', data);

        // --- Populate Original Permit Details ---
        if (data && data.application && data.status) {
            const app = data.application;

            // Check if permit is eligible for renewal
            const eligibleStatuses = ['PERMIT_READY', 'COMPLETED', 'EXPIRED'];
            if (!eligibleStatuses.includes(data.status.currentStatus)) {
                throw new Error('Este permiso no es elegible para renovación en este momento.');
            }

            // Display vehicle information
            const vehicleInfo = app.vehicleInfo || {};
            const vehicleDesc = `${vehicleInfo.marca || ''} ${vehicleInfo.linea || ''} (${vehicleInfo.ano_modelo || 'N/A'})`;
            originalPermitVehicle.textContent = vehicleDesc;

            // Display expiry date
            originalPermitExpiry.textContent = formatDate(app.fecha_vencimiento || 'N/A');

            // Display exact payment amount
            renewalPaymentAmount.textContent = '197.00 MXN';
        } else {
            throw new Error('Formato de datos inválido recibido del servidor.');
        }
    } catch (error) {
        console.error(`[Permits] Error loading details for original application ${originalId}:`, error);
        renewalConfirmationContent.hidden = true;
        renewalMessageArea.textContent = `Error al cargar detalles del permiso original: ${error.message}`;
        renewalMessageArea.className = 'message-area error-message';
        renewalMessageArea.hidden = false;
        return;
    }

    // --- Add Confirm Button Listener ---
    confirmRenewalBtn.addEventListener('click', async () => {
        // Show loading state
        const setButtonLoading = (isLoading) => {
            const buttonText = confirmRenewalBtn.querySelector('.button-text');
            const spinner = confirmRenewalBtn.querySelector('.spinner');
            if (!buttonText || !spinner) return;

            confirmRenewalBtn.disabled = isLoading;
            if (isLoading) confirmRenewalBtn.classList.add('loading'); else confirmRenewalBtn.classList.remove('loading');
            spinner.hidden = !isLoading;
        };

        setButtonLoading(true);
        renewalMessageArea.hidden = true;

        // Get CSRF token
        let csrfToken = null;
        if (typeof window.getStoredCsrfToken === 'function') {
            csrfToken = await window.getStoredCsrfToken();
        }

        if (!csrfToken) {
            console.error('[Permits] Renewal Error: Could not retrieve CSRF token.');
            renewalMessageArea.textContent = 'Error de seguridad. Recargue la página e intente de nuevo.';
            renewalMessageArea.className = 'message-area error-message';
            renewalMessageArea.hidden = false;
            setButtonLoading(false);
            return;
        }

        // Call the renewal API endpoint
        try {
            const response = await fetch(`/api/applications/${originalId}/renew`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-Token': csrfToken
                },
                body: JSON.stringify({ _csrf: csrfToken })
            });

            const responseData = await response.json();

            if (response.status === 201) {
                console.log('[Permits] Renewal successful:', responseData);

                // Hide confirmation content
                renewalConfirmationContent.hidden = true;

                // Update new application ID and link
                const newApplicationId = responseData.application?.id;
                document.getElementById('new-application-id').textContent = newApplicationId || 'N/A';
                const linkToNewPermit = document.getElementById('link-to-new-permit');
                if (linkToNewPermit && newApplicationId) {
                    linkToNewPermit.href = `#/permits/${newApplicationId}`;
                }

                // Log the response data to debug renewal relationship
                console.log('[Permits] Renewal response data:', responseData);

                // Check if the response includes renewal relationship information
                if (responseData.application) {
                    const app = responseData.application;
                    console.log('[Permits] New application data:', app);

                    // Check for renewal relationship fields
                    const renewalFields = {
                        renewed_from_id: app.renewed_from_id, // This is the actual field name used in the database
                        renewal_for_permit_id: app.renewal_for_permit_id,
                        renewal_for_id: app.renewal_for_id,
                        original_permit_id: app.original_permit_id,
                        parent_id: app.parent_id
                    };

                    console.log('[Permits] Renewal relationship fields:', renewalFields);
                }

                // Display payment instructions
                if (responseData.paymentInstructions) {
                    displayPaymentInstructions(responseData.paymentInstructions);
                    paymentInstructionsArea.hidden = false;

                    // Start countdown for auto-redirect
                    startRedirectCountdown();
                } else {
                    renewalMessageArea.textContent = 'Renovación creada con éxito, pero no se recibieron instrucciones de pago. Verifique su dashboard.';
                    renewalMessageArea.className = 'message-area success-message';
                    renewalMessageArea.hidden = false;

                    // Redirect to dashboard after a short delay even if no payment instructions
                    setTimeout(() => {
                        window.location.hash = '#/dashboard';
                    }, 3000);
                }

                // Disable confirm button
                confirmRenewalBtn.disabled = true;
            } else {
                // Handle error response
                const errorMessage = responseData.message || `Error del servidor (${response.status})`;
                console.error('[Permits] Renewal API Error:', errorMessage);
                renewalMessageArea.textContent = `Error al procesar la renovación: ${errorMessage}`;
                renewalMessageArea.className = 'message-area error-message';
                renewalMessageArea.hidden = false;
                setButtonLoading(false);
            }
        } catch (error) {
            console.error('[Permits] Renewal network error:', error);
            renewalMessageArea.textContent = `Error de red: ${error.message}. Verifique su conexión.`;
            renewalMessageArea.className = 'message-area error-message';
            renewalMessageArea.hidden = false;
            setButtonLoading(false);
        }
    });

    // --- Function to handle redirect countdown ---
    function startRedirectCountdown() {
        const countdownElement = document.getElementById('countdown-timer');
        const progressFill = document.querySelector('.progress-fill');

        if (!countdownElement) {
            console.error('[Permits] Countdown timer element not found');
            return;
        }

        // Set initial countdown value
        const totalSeconds = 5;
        let secondsLeft = totalSeconds;
        countdownElement.textContent = secondsLeft;

        // Reset progress bar
        if (progressFill) {
            progressFill.style.width = '100%';
        }

        // Start countdown
        const countdownInterval = setInterval(() => {
            secondsLeft--;

            // Update progress bar width
            if (progressFill) {
                const percentLeft = (secondsLeft / totalSeconds) * 100;
                progressFill.style.width = `${percentLeft}%`;
            }

            if (secondsLeft <= 0) {
                clearInterval(countdownInterval);
                // Redirect to dashboard
                window.location.hash = '#/dashboard';
            } else {
                countdownElement.textContent = secondsLeft;
            }
        }, 1000);

        // Add event listener to cancel redirect if user clicks on view application button
        const viewApplicationBtn = document.getElementById('link-to-new-permit');
        if (viewApplicationBtn) {
            viewApplicationBtn.addEventListener('click', () => {
                clearInterval(countdownInterval);
                // Hide the countdown section
                const countdownSection = document.querySelector('.redirect-countdown');
                if (countdownSection) {
                    countdownSection.style.display = 'none';
                }
            });
        }

        // Add event listener to immediate redirect button
        const immediateRedirectBtn = document.querySelector('.action-buttons .btn-primary');
        if (immediateRedirectBtn) {
            immediateRedirectBtn.addEventListener('click', () => {
                clearInterval(countdownInterval);
            });
        }
    }

    console.log('[Permits] Permit Renewal Page initialization complete.');
} // --- End of initPermitRenewalPage ---

// --- Make Initialization Functions Globally Accessible ---
window.initPermitFormPage = initPermitFormPage;
window.initPermitDetailPage = initPermitDetailPage;
window.initPermitUploadPage = initPermitUploadPage; // Keep placeholder
window.initPermitRenewalPage = initPermitRenewalPage;

console.log('[Permits] Permits script loaded.');