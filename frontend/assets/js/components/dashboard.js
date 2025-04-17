/**
 * =============================================================================
 * Permisos Digitales - Dashboard Component Logic (dashboard.js) - API Aligned
 * =============================================================================
 *
 * Handles the functionality of the client dashboard view:
 * - Checks authentication status via API.
 * - Fetches user's permit application data from /api/applications.
 * - Manages UI states: loading (skeleton), empty, error, and data display.
 * - Renders the application list and expiring permits using data structures
 *   defined in API.md.
 */

// --- Authentication Check ---
/**
 * Checks if the user is authenticated by calling the /api/auth/status endpoint.
 * Redirects to login if not authenticated. Stores basic user info if authenticated.
 * @returns {Promise<boolean>} True if the user is authenticated, false otherwise.
 */
async function checkDashboardAuthentication() {
    console.log('[Dashboard] Performing API authentication check via /api/auth/status...');
    try {
        const response = await fetch('/api/auth/status');

        console.log(`[Dashboard] Auth check response status: ${response.status}`); // Log status

        if (!response.ok) {
            console.error(`[Dashboard] Auth check API error: ${response.status} ${response.statusText}. Redirecting to login.`);
            window.location.hash = '#/login';
            return false;
        }

        // --- Debugging: Log the raw response text before parsing JSON ---
        // This helps if the response isn't valid JSON for some reason
        const responseText = await response.text();
        console.log('[Dashboard] Auth check raw response text:', responseText);
        // --- End Debugging ---

        let data;
        try {
            data = JSON.parse(responseText); // Parse the logged text
            console.log('[Dashboard] Auth check parsed JSON data:', data); // Log the parsed data
        } catch (parseError) {
            console.error('[Dashboard] Failed to parse auth status JSON:', parseError);
            console.error('[Dashboard] Response text was:', responseText); // Log the text that failed parsing
            window.location.hash = '#/login'; // Treat parse error as unauthenticated
            return false;
        }


// --- Refined Check ---
// Check specifically for the 'isLoggedIn' property sent by the backend.
if (data && data.isLoggedIn === true) { // <--- CORRECTED PROPERTY NAME
    // Log user info if present, but don't fail the check if it's missing for some reason
    const userEmail = data.user ? data.user.email : 'Unknown (user object missing)';
    console.log(`[Dashboard] Auth check successful. User: ${userEmail}`);

    // --- NEW: Update/Confirm Auth State in sessionStorage ---
    try {
        sessionStorage.setItem('isAuthenticated', 'true');
        if (data.user) {
            // Store minimal user info needed for display
            const userInfo = {
                id: data.user.id,
                email: data.user.email,
                name: data.user.name || '',
                accountType: data.user.accountType
            };
            sessionStorage.setItem('userInfo', JSON.stringify(userInfo));
            console.log('[Dashboard] User info updated in sessionStorage.');
        } else {
            sessionStorage.removeItem('userInfo'); // Clear if no user object received
        }
    } catch (e) {
        console.error('[Dashboard] Error updating session data:', e);
        // Continue even if storage fails
    }
    // --- END NEW ---

    return true;
} else {
    // Log the reason for failure more explicitly
    console.warn(`[Dashboard] Auth check failed: 'isLoggedIn' was not true. Received data:`, data);

    // --- NEW: Clear Auth State on failed check ---
    try {
        sessionStorage.removeItem('isAuthenticated');
        sessionStorage.removeItem('userInfo');
        console.log('[Dashboard] Cleared auth state from sessionStorage due to failed check.');
    } catch (e) {
        console.error('[Dashboard] Error clearing session data:', e);
    }
    // --- END NEW ---

    window.location.hash = '#/login';
    return false;
}
    } catch (error) {
        console.error('[Dashboard] Network error during authentication check:', error);

        // --- NEW: Clear Auth State on network error ---
        try {
            sessionStorage.removeItem('isAuthenticated');
            sessionStorage.removeItem('userInfo');
            console.log('[Dashboard] Cleared auth state from sessionStorage due to network error.');
        } catch (e) {
            console.error('[Dashboard] Error clearing session data:', e);
        }
        // --- END NEW ---

        window.location.hash = '#/login';
        return false;
    }
}

// --- Data Formatting Helper ---
/**
 * Formats an ISO date string (or Date object) into a more readable YYYY-MM-DD format.
 * Handles null/invalid dates gracefully.
 * @param {string | Date | null | undefined} dateInput - The date string or object to format.
 * @returns {string} Formatted date string or '---' for display.
 */
function formatDate(dateInput) {
    if (!dateInput) return 'N/A'; // Return N/A for empty dates in table

    try {
        const date = new Date(dateInput);
        if (isNaN(date.getTime())) {
            throw new Error('Invalid date value');
        }

        // Format: "13 de abril de 2023, 15:30 p.m."
        return date.toLocaleDateString('es-MX', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            hour12: true
        });
    } catch (e) {
        console.error(`[Dashboard] Error formatting date "${dateInput}":`, e);
        return 'Inválida'; // Return error indicator
    }
}

/**
 * Translate status keys to Spanish
 * @param {string} statusKey - The status key in English
 * @returns {string} Translated status in Spanish
 */
function translateStatus(statusKey) {
    const statusTranslations = {
        'PENDING_PAYMENT': 'Pago Pendiente',
        'PENDING_PROOF': 'Comprobante Pendiente',
        'PROOF_SUBMITTED': 'Comprobante Enviado',
        'PROOF_REJECTED': 'Comprobante Rechazado',
        'PROOF_RECEIVED_SCHEDULED': 'Comprobante Recibido',
        'PENDING_APPROVAL': 'Aprobación Pendiente',
        'PAYMENT_RECEIVED': 'Pago Recibido',
        'PERMIT_READY': 'Permiso Listo',
        'PERMIT_ISSUED': 'Permiso Emitido',
        'COMPLETED': 'Completado',
        'EXPIRED': 'Expirado',
        'CANCELLED': 'Cancelado',
        'ERROR_GENERATING_PERMIT': 'Error Generando Permiso',
        'UNKNOWN': 'Desconocido'
    };

    return statusTranslations[statusKey] || statusKey.replace(/_/g, ' ');
}

// --- Dashboard Page Initialization Function ---
// Called by the router (main.js) when the #/dashboard route is loaded.
async function initDashboardPage() { // Made async for auth check
    console.log('[Dashboard] Initializing Dashboard Page...');

    // 1. --- Authentication Check ---
    // Verify user is logged in *before* attempting to load dashboard elements/data.
    const isAuthenticated = await checkDashboardAuthentication();
    if (!isAuthenticated) {
        // If the check fails and redirects, stop executing this function.
        console.log('[Dashboard] Halting initialization due to failed authentication.');
        return;
    }
    // If we reach here, the user is authenticated.

    // 2. --- Get DOM Element References ---
    // ... (References remain the same as previous version) ...
    const dashboardContainer = document.querySelector('.dashboard-container');
    const errorMessageDiv = document.getElementById('dashboard-error-message');
    const expiringSection = document.getElementById('expiring-permits');
    const expiringList = document.getElementById('expiring-permits-list');
    const emptyStateMessage = document.getElementById('empty-state-message');
    const skeletonBody = document.getElementById('skeleton-tbody');
    const applicationListBody = document.getElementById('application-list-body');
    const applicationTable = document.getElementById('application-table');


    // --- Critical Element Check ---
    if (!dashboardContainer || !errorMessageDiv || !expiringSection || !expiringList || !emptyStateMessage || !skeletonBody || !applicationListBody || !applicationTable) {
        console.error('[Dashboard] Dashboard Page Error: One or more required elements not found. Check dashboard.html structure and IDs. Dashboard functionality may be broken.');
        if (dashboardContainer) {
            dashboardContainer.innerHTML = '<div class="error-message" style="text-align: center;">Error crítico al cargar la estructura del dashboard.</div>';
        } else {
            const appRoot = document.getElementById('app-root');
            if (appRoot) appRoot.innerHTML = '<div class="error-message" style="text-align: center;">Error cargando el dashboard.</div>';
        }
        return;
    }

    // 3. --- UI State Management Helper Functions ---
    // ... (Helpers remain the same: showSkeleton, hideSkeleton, etc.) ...
    const showSkeleton = () => {
        console.log('[Dashboard] UI State: Showing Skeleton');
        skeletonBody.hidden = false;
        skeletonBody.setAttribute('aria-busy', 'true');
        applicationListBody.hidden = true;
        emptyStateMessage.hidden = true;
    };
    const hideSkeleton = () => {
        console.log('[Dashboard] UI State: Hiding Skeleton');
        skeletonBody.hidden = true;
        skeletonBody.setAttribute('aria-busy', 'false');
    };
    const showEmptyState = () => {
        console.log('[Dashboard] UI State: Showing Empty State');
        hideSkeleton();
        applicationListBody.innerHTML = '';
        applicationListBody.hidden = true;
        emptyStateMessage.hidden = false;
        hideExpiringSection();
    };
    const showTableWithData = () => {
        console.log('[Dashboard] UI State: Showing Data Table');
        hideSkeleton();
        emptyStateMessage.hidden = true;
        applicationListBody.hidden = false;
    };
    const showExpiringSection = () => { expiringSection.hidden = false; };
    const hideExpiringSection = () => { expiringSection.hidden = true; };
    const showDashboardError = (message) => {
        console.log(`[Dashboard] UI State: Showing Error - "${message}"`);
        hideSkeleton();
        applicationListBody.hidden = true;
        emptyStateMessage.hidden = true;
        errorMessageDiv.textContent = message;
        errorMessageDiv.hidden = false;
    };
    const clearDashboardError = () => {
        errorMessageDiv.textContent = '';
        errorMessageDiv.hidden = true;
    };

    // 4. --- Data Rendering Functions ---

    /**
     * Renders the list of expiring permits based on API.md structure.
     * @param {Array<object>} expiringPermits - Array from data.expiringPermits.
     * @param {Array<object>} allApplications - All applications to check for renewals in progress.
     */
    function renderExpiringPermits(expiringPermits, allApplications) {
        expiringList.innerHTML = ''; // Clear previous list items

        if (!expiringPermits || expiringPermits.length === 0) {
            console.log('[Dashboard] No expiring permits data found.');
            hideExpiringSection();
            return;
        }

        console.log(`[Dashboard] Rendering ${expiringPermits.length} expiring permit(s).`);

        // Create a map of permits being renewed
        const renewalsInProgress = new Map();

        // Check if any applications are renewals of expiring permits
        if (allApplications && allApplications.length > 0) {
            console.log('[Dashboard] Checking for renewals in progress among', allApplications.length, 'applications');

            allApplications.forEach(app => {
                // Log each application to debug
                console.log('[Dashboard] Checking application:', app);

                // Check for different possible field names for renewal relationship
                // Based on database analysis, the actual field name is 'renewed_from_id'
                const renewalForId = app.renewed_from_id || app.renewal_for_permit_id || app.renewal_for_id || app.original_permit_id || app.parent_id;

                if (renewalForId) {
                    console.log(`[Dashboard] Found renewal: Application ${app.id} is a renewal for permit ${renewalForId}`);
                    renewalsInProgress.set(renewalForId, {
                        renewalId: app.id,
                        status: app.status,
                        created_at: app.created_at
                    });
                }
            });

            // Log the renewals map
            console.log('[Dashboard] Renewals in progress map:', [...renewalsInProgress.entries()]);
        }

        // Filter out permits that already have renewals in progress
        const permitsToShow = expiringPermits.filter(permit => !renewalsInProgress.has(permit.id));

        console.log(`[Dashboard] After filtering: ${permitsToShow.length} of ${expiringPermits.length} expiring permits will be shown (${expiringPermits.length - permitsToShow.length} have renewals in progress)`);

        // If no permits to show after filtering, hide the section
        if (permitsToShow.length === 0) {
            console.log('[Dashboard] No expiring permits to show after filtering out those with renewals in progress.');
            hideExpiringSection();
            return;
        }

        permitsToShow.forEach(permit => {
            // Use fields from API.md: id, marca, linea, ano_modelo, fecha_vencimiento, days_remaining
            const li = document.createElement('li');
            const vehicleDesc = `${permit.marca || ''} ${permit.linea || ''} (${permit.ano_modelo || 'N/A'})`;
            const permitIdText = permit.id ? `Permiso #${permit.id}` : 'Permiso';
            const expiryDateText = formatDate(permit.fecha_vencimiento); // Use fecha_vencimiento
            const daysRemainingText = permit.days_remaining !== undefined ? ` (${permit.days_remaining} días restantes)` : '';

            // Check if this permit has a renewal in progress
            const hasRenewal = renewalsInProgress.has(permit.id);
            const renewalInfo = hasRenewal ? renewalsInProgress.get(permit.id) : null;

            // Add a class to style differently if being renewed
            if (hasRenewal) {
                li.classList.add('permit-being-renewed');
            }

            // Base text content
            li.textContent = `${permitIdText} (${vehicleDesc}) vence el ${expiryDateText}${daysRemainingText}. `;

            // If there's a renewal in progress, add a badge
            if (hasRenewal) {
                const renewalBadge = document.createElement('span');
                renewalBadge.className = 'renewal-badge';
                renewalBadge.textContent = 'Renovación en Proceso';
                renewalBadge.title = `Renovación iniciada el ${formatDate(renewalInfo.created_at)}`;
                li.appendChild(renewalBadge);

                // Add link to the renewal application
                const renewalLink = document.createElement('a');
                renewalLink.href = `#/permits/${renewalInfo.renewalId}`;
                renewalLink.innerHTML = `<svg class="icon icon-link" focusable="false" aria-hidden="true"><use xlink:href="/assets/icons/sprite.svg#icon-link"></use></svg> <span class="button-text-action">Ver Renovación #${renewalInfo.renewalId}</span>`;
                renewalLink.style.marginLeft = '8px';
                renewalLink.className = 'renewal-link';
                li.appendChild(renewalLink);
            }

            // Add view link (always show this)
            const viewLink = document.createElement('a');
            viewLink.href = `#/permits/${permit.id}`;
            viewLink.innerHTML = `<svg class="icon icon-eye" focusable="false" aria-hidden="true"><use xlink:href="/assets/icons/sprite.svg#icon-eye"></use></svg> <span class="button-text-action">Ver</span>`;
            viewLink.style.marginLeft = '8px';
            li.appendChild(viewLink);

            // Add renew link only if no renewal is in progress
            if (!hasRenewal && permit.status !== 'EXPIRED') {
                const renewLink = document.createElement('a');
                renewLink.href = `#/permits/${permit.id}/renew`;
                renewLink.innerHTML = `<svg class="icon icon-renew" focusable="false" aria-hidden="true"><use xlink:href="/assets/icons/sprite.svg#icon-renew"></use></svg> <span class="button-text-action">Renovar</span>`;
                renewLink.style.marginLeft = '8px';
                li.appendChild(renewLink);
            }

            expiringList.appendChild(li);
        });
        showExpiringSection();
    }

    /**
     * Renders the main applications table based on API.md structure for GET /api/applications.
     * @param {Array<object>} applications - Array from data.applications.
     */
    function renderApplicationsTable(applications) {
        applicationListBody.innerHTML = ''; // Clear previous content

        if (!applications || applications.length === 0) {
            console.warn('[Dashboard] renderApplicationsTable called with no applications.');
            showEmptyState();
            return;
        }

        console.log(`[Dashboard] Rendering ${applications.length} application(s) into the table.`);

        // Create a map of renewal relationships
        const renewalRelationships = new Map();

        // First pass: build the renewal relationships map
        applications.forEach(app => {
            const renewedFromId = app.renewed_from_id || app.renewal_for_permit_id || app.renewal_for_id || app.original_permit_id || app.parent_id;
            if (renewedFromId) {
                renewalRelationships.set(renewedFromId, {
                    renewalId: app.id,
                    status: app.status,
                    created_at: app.created_at
                });
            }
        });

        console.log('[Dashboard] Renewal relationships map:', [...renewalRelationships.entries()]);

        // Second pass: render the table with relationship information
        applications.forEach(app => {
            // Use fields from API.md: id, status, folio, marca, linea, ano_modelo, created_at, fecha_vencimiento
            const row = applicationListBody.insertRow();

            // Cell 0: ID Solicitud
            const idCell = row.insertCell();
            idCell.textContent = app.id || 'N/A';
            idCell.setAttribute('data-label', 'ID');

            // Cell 1: Vehículo
            const vehicleCell = row.insertCell();
            const vehicleDesc = `${app.marca || ''} ${app.linea || ''} (${app.ano_modelo || 'N/A'})`;
            vehicleCell.textContent = vehicleDesc;
            vehicleCell.className = 'vehicle-cell';
            vehicleCell.setAttribute('data-tooltip', vehicleDesc); // Add data-tooltip for tooltip
            vehicleCell.setAttribute('data-label', 'Vehículo');

            // Cell 2: Folio Permiso
            const folioCell = row.insertCell();
            folioCell.textContent = app.folio || '---'; // Use folio field
            folioCell.setAttribute('data-label', 'Folio');

            // Cell 3: Estado
            const statusCell = row.insertCell();
            statusCell.className = 'status-cell';
            statusCell.setAttribute('data-label', 'Estado');
            const statusBadge = document.createElement('span');
            const statusKey = app.status ? String(app.status).toUpperCase() : 'UNKNOWN';
            statusBadge.className = `status-badge status-${statusKey}`;
            const statusText = translateStatus(statusKey); // Use our translation function
            statusBadge.textContent = statusText;
            statusCell.appendChild(statusBadge);

            // Cell 4: Fecha Solicitud
            const createdCell = row.insertCell();
            createdCell.textContent = formatDate(app.created_at); // Use created_at
            createdCell.setAttribute('data-label', 'Fecha Solicitud');

            // Cell 5: Fecha Vencimiento
            const expiryCell = row.insertCell();
            expiryCell.textContent = app.fecha_vencimiento ? formatDate(app.fecha_vencimiento) : 'N/A'; // Use fecha_vencimiento
            expiryCell.setAttribute('data-label', 'Fecha Vencimiento');

            // Cell 6: Relación (Renewal relationship)
            const relationshipCell = row.insertCell();
            relationshipCell.className = 'relationship-cell';
            relationshipCell.setAttribute('data-label', 'Relación');

            // Check if this permit is a renewal of another permit
            const renewedFromId = app.renewed_from_id || app.renewal_for_permit_id || app.renewal_for_id || app.original_permit_id || app.parent_id;
            if (renewedFromId) {
                const relationshipBadge = document.createElement('span');
                relationshipBadge.className = 'relationship-badge renewal-of';
                const badgeText = `Renovación de #${renewedFromId}`;
                relationshipBadge.innerHTML = `Renovación de <a href="#/permits/${renewedFromId}">#${renewedFromId}</a>`;
                relationshipBadge.setAttribute('data-tooltip', badgeText);
                relationshipCell.setAttribute('data-tooltip', badgeText);
                relationshipCell.appendChild(relationshipBadge);
            }

            // Check if this permit has been renewed by another permit
            if (renewalRelationships.has(app.id)) {
                const renewalInfo = renewalRelationships.get(app.id);
                const relationshipBadge = document.createElement('span');
                relationshipBadge.className = 'relationship-badge has-renewal';
                const badgeText = `Renovado por #${renewalInfo.renewalId}`;
                relationshipBadge.innerHTML = `Renovado por <a href="#/permits/${renewalInfo.renewalId}">#${renewalInfo.renewalId}</a>`;
                relationshipBadge.setAttribute('data-tooltip', badgeText);

                // Update the cell tooltip to include both relationships if needed
                const currentTooltip = relationshipCell.getAttribute('data-tooltip') || '';
                const newTooltip = currentTooltip ? `${currentTooltip}, ${badgeText}` : badgeText;
                relationshipCell.setAttribute('data-tooltip', newTooltip);

                relationshipCell.appendChild(relationshipBadge);
            }

            // If no relationship, show a dash
            if (!renewedFromId && !renewalRelationships.has(app.id)) {
                relationshipCell.textContent = '---';
            }

            // Cell 7: Acciones (Conditional)
            const actionsCell = row.insertCell();
            actionsCell.className = 'actions-cell';
            actionsCell.setAttribute('data-label', 'Acciones');

            // Determine if a permit is eligible for renewal
            const isEligibleForRenewal = ['PERMIT_READY', 'COMPLETED', 'EXPIRED'].includes(app.status);

            // Check if this permit already has a renewal in progress
            const hasRenewalInProgress = renewalRelationships.has(app.id);

            if (isEligibleForRenewal && !hasRenewalInProgress) {
                // Add Renewal Button
                const renewLink = document.createElement('a');
                renewLink.href = `#/permits/${app.id}/renew`;
                renewLink.className = 'btn btn-primary btn-renew';
                renewLink.innerHTML = `<svg class="icon icon-renew" focusable="false" aria-hidden="true"><use xlink:href="/assets/icons/sprite.svg#icon-renew"></use></svg> <span class="button-text-action">Renovar</span>`;
                renewLink.title = `Renovar permiso basado en solicitud ${app.id}`;
                renewLink.setAttribute('aria-label', `Renovar permiso basado en solicitud ${app.id}`);
                actionsCell.appendChild(renewLink);

                // Add View Button as secondary action
                const viewLinkSecondary = document.createElement('a');
                viewLinkSecondary.href = `#/permits/${app.id}`;
                viewLinkSecondary.className = 'btn-view';
                viewLinkSecondary.innerHTML = `<svg class="icon icon-eye" focusable="false" aria-hidden="true"><use xlink:href="/assets/icons/sprite.svg#icon-eye"></use></svg> <span class="button-text-action">Ver</span>`;
                viewLinkSecondary.title = `Ver detalles de la solicitud ${app.id}`;
                viewLinkSecondary.setAttribute('aria-label', `Ver detalles de la solicitud ${app.id}`);
                // No need for margin as we're using flex with gap
                actionsCell.appendChild(viewLinkSecondary);
            } else {
                // Standard View Button for non-renewable permits
                const viewLink = document.createElement('a');
                viewLink.href = `#/permits/${app.id}`;
                viewLink.className = 'btn-view';
                viewLink.innerHTML = `<svg class="icon icon-eye" focusable="false" aria-hidden="true"><use xlink:href="/assets/icons/sprite.svg#icon-eye"></use></svg> <span class="button-text-action">Ver</span>`;
                viewLink.title = `Ver detalles de la solicitud ${app.id}`;
                viewLink.setAttribute('aria-label', `Ver detalles de la solicitud ${app.id}`);
                actionsCell.appendChild(viewLink);
            }

            // Action: Upload Proof (Only if PENDING_PAYMENT or PROOF_REJECTED)
            // Assuming PENDING_PAYMENT also needs upload after payment is made externally
            if (app.status === 'PENDING_PAYMENT' || app.status === 'PROOF_REJECTED') {
                const uploadLink = document.createElement('a');
                uploadLink.href = `#/permits/${app.id}`; // Direct to permit detail page which has the upload section
                uploadLink.className = 'btn-upload';
                uploadLink.innerHTML = `<svg class="icon icon-upload" focusable="false" aria-hidden="true"><use xlink:href="/assets/icons/sprite.svg#icon-upload"></use></svg> <span class="button-text-action">Subir Pago</span>`;
                uploadLink.title = 'Subir comprobante de pago';
                uploadLink.setAttribute('aria-label', `Subir comprobante para la solicitud ${app.id}`);
                actionsCell.appendChild(uploadLink);
            }

            // Action: Download Permit (Only if PERMIT_READY or PERMIT_ISSUED/COMPLETED?)
            // API doc has /api/applications/:id/download/:type (permiso, recibo, certificado)
            // Let's assume PERMIT_READY means the 'permiso' is available
            if (app.status === 'PERMIT_READY' || app.status === 'PERMIT_ISSUED' || app.status === 'COMPLETED') {
                const downloadLink = document.createElement('a');
                downloadLink.href = `/api/applications/${app.id}/download/permiso`; // Link to download API
                downloadLink.className = 'btn-download';
                downloadLink.innerHTML = `<svg class="icon icon-download" focusable="false" aria-hidden="true"><use xlink:href="/assets/icons/sprite.svg#icon-download"></use></svg> <span class="button-text-action">Descargar</span>`;
                downloadLink.title = 'Descargar permiso PDF';
                downloadLink.setAttribute('aria-label', `Descargar permiso para la solicitud ${app.id}`);
                downloadLink.setAttribute('target', '_blank'); // Open in new tab/download directly
                actionsCell.appendChild(downloadLink);
            }

            // Action: Renew Permit (Example: If status is COMPLETED or EXPIRED)
            // if (app.status === 'COMPLETED' || app.status === 'EXPIRED') {
            //     const renewLink = document.createElement('a');
            //     renewLink.href = `#/permits/renew/${app.id}`; // Example SPA route
            //     renewLink.className = 'btn-renew';
            //     renewLink.innerHTML = `<svg class="icon icon-renew" focusable="false" aria-hidden="true"><use xlink:href="/assets/icons/sprite.svg#icon-renew"></use></svg> <span class="button-text-action">Renovar</span>`;
            //     renewLink.title = 'Renovar este permiso';
            //     renewLink.setAttribute('aria-label', `Renovar permiso para la solicitud ${app.id}`);
            //     actionsCell.appendChild(renewLink);
            // }
        }); // End of applications.forEach

        showTableWithData(); // Ensure table is visible after populating

    } // End of renderApplicationsTable

    // Logout button removed - now handled by header component


    // 5. --- Data Fetching Function ---
    /**
     * Fetches the dashboard data from /api/applications and updates the UI.
     */
    async function loadDashboardData() {
        console.log('[Dashboard] Fetching dashboard data from /api/applications...');
        clearDashboardError();
        showSkeleton(); // Show loading placeholders

        try {
            // Perform the API request (GET, no body, no CSRF typically needed for GET)
            const response = await fetch('/api/applications', {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                    // Session cookie should be sent automatically by the browser
                }
            });

            // --- Handle API Response ---
            if (!response.ok) {
                // Handle specific HTTP error statuses
                if (response.status === 401) { // Unauthorized
                    // This case should ideally be caught by checkDashboardAuthentication,
                    // but handle it here as a fallback.
                    console.warn(`[Dashboard] API request unauthorized (401). Redirecting to login.`);
                    window.location.hash = '#/login';
                    return;
                } else {
                    // Handle other server errors (e.g., 500)
                    const errorText = await response.text(); // Try to get more info
                    throw new Error(`Error del servidor (${response.status}): ${response.statusText}. ${errorText}`);
                }
            }

            // --- Process Successful Response (Status 200 OK) ---
            const data = await response.json();
            console.log('[Dashboard] API data received successfully:', data);

            // --- Update UI with Fetched Data ---
            hideSkeleton(); // Hide loading indicators

            // Log the complete API response for debugging
            console.log('[Dashboard] Complete API response:', data);

            // Validate the received data structure based on API.md
            if (data && Array.isArray(data.applications)) {
                // Log the applications array to check for renewed_from_id field
                console.log('[Dashboard] Applications array fields:',
                    data.applications.length > 0 ? Object.keys(data.applications[0]) : 'No applications');

                if (data.applications.length > 0) {
                    // Render main table
                    renderApplicationsTable(data.applications);
                    // Render expiring permits (handle if key is missing or not an array)
                    // Pass all applications to check for renewals in progress
                    renderExpiringPermits(
                        Array.isArray(data.expiringPermits) ? data.expiringPermits : [],
                        data.applications
                    );
                    // showTableWithData() is called within renderApplicationsTable
                } else {
                    // API call successful, but no applications found for the user.
                    console.log('[Dashboard] User has no applications. Showing empty state.');
                    showEmptyState();
                }
            } else {
                // The API response structure was not as expected.
                console.error('[Dashboard] Invalid data structure received from /api/applications:', data);
                throw new Error('Formato de datos inesperado recibido del servidor.');
            }

        } catch (error) {
            // --- Handle Fetch/Network Errors or JSON Parsing Errors ---
            console.error('[Dashboard] Failed to load or process dashboard data:', error);
            hideSkeleton(); // Ensure skeleton is hidden on error
            showDashboardError(`No se pudieron cargar los datos del dashboard: ${error.message}. Por favor, intente recargar la página.`);
        }
    } // End of loadDashboardData

    // 6. --- Initial Data Load ---
    // --- Event Listeners ---
    // Add event listeners for dashboard-specific interactions
    function setupEventListeners() {
        // Set up the clear cache button
        const clearCacheBtn = document.getElementById('clear-cache-btn');
        if (clearCacheBtn) {
            clearCacheBtn.addEventListener('click', function() {
                console.log('[Dashboard] Clear cache button clicked');
                if (window.forceReloadResources) {
                    window.forceReloadResources();
                } else {
                    // Fallback if the cache buster utility isn't loaded
                    window.location.reload(true);
                }
            });
            console.log('[Dashboard] Clear cache button event listener set up.');
        }

        // Set up the force reload button
        const forceReloadBtn = document.getElementById('force-reload-btn');
        if (forceReloadBtn) {
            forceReloadBtn.addEventListener('click', function() {
                console.log('[Dashboard] Force reload button clicked');
                // Hard reload the page
                window.location.reload(true);
            });
            console.log('[Dashboard] Force reload button event listener set up.');
        }
    }

    // Trigger the data fetching process.
    loadDashboardData();

    // Set up event listeners
    setupEventListeners();

    console.log('[Dashboard] Dashboard Page initialization complete.');

} // --- End of initDashboardPage ---


// --- Make Initialization Function Globally Accessible ---
// Attach to the `window` object for the router (main.js) to call.
window.initDashboardPage = initDashboardPage;

console.log('[Dashboard] Dashboard script loaded and aligned with API docs.');