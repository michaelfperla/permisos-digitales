/**
 * =============================================================================
 * Permisos Digitales - Admin Dashboard Component Logic (admin-dashboard.js)
 * =============================================================================
 *
 * Contains the JavaScript logic for the admin dashboard:
 * - Dashboard statistics
 * - Payment verification queue
 * - Status chart
 * - Activity tracking
 * - Sidebar navigation and responsive layout
 */

// --- Global Variables ---
let statusChart = null;
let pendingVerifications = [];
let currentSection = 'dashboard';

// --- Dashboard Initialization ---
async function initAdminDashboard() {
    console.log('[AdminDashboard] Initializing Admin Dashboard...');
    
    // Check if user is authenticated and is admin
    const isAuthenticated = sessionStorage.getItem('isAuthenticated') === 'true';
    const isAdminPortal = sessionStorage.getItem('isAdminPortal') === 'true';
    
    if (!isAuthenticated || !isAdminPortal) {
        console.warn('[AdminDashboard] Unauthorized access attempt. Redirecting to admin login.');
        window.location.href = '/admin-login';
        return;
    }
    
    // Display user info
    displayUserInfo();
    
    // Initialize sidebar toggle and navigation
    initializeSidebar();
    
    // Initialize dashboard components
    await Promise.all([
        fetchDashboardStats(),
        fetchPendingVerifications(),
        fetchRecentActivity()
    ]);
    
    // Initialize modal functionality
    initializeModals();
    
    // Initialize mobile header navigation
    initializeMobileNavigation();
    
    // Handle logout button
    const logoutBtn = document.getElementById('admin-logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    console.log('[AdminDashboard] Dashboard initialization complete.');
}

// --- Handle Logout ---
function handleLogout() {
    console.log('[AdminDashboard] Logout initiated');
    
    // Clear session data
    sessionStorage.removeItem('isAuthenticated');
    sessionStorage.removeItem('isAdminPortal');
    sessionStorage.removeItem('userInfo');
    
    // Redirect to login
    window.location.href = '/admin-login';
}

// --- Display User Info ---
function displayUserInfo() {
    try {
        const userInfoStr = sessionStorage.getItem('userInfo');
        if (userInfoStr) {
            const userInfo = JSON.parse(userInfoStr);
            const nameElement = document.getElementById('admin-user-name');
            if (nameElement && userInfo.name) {
                nameElement.textContent = userInfo.name;
            }
        }
    } catch (error) {
        console.error('[AdminDashboard] Error displaying user info:', error);
    }
}

// --- Initialize Mobile Navigation ---
function initializeMobileNavigation() {
    const headerButton = document.querySelector('.mobile-menu-toggle');
    const sidebar = document.querySelector('.admin-sidebar');
    
    if (headerButton && sidebar) {
        headerButton.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            document.body.classList.toggle('sidebar-open');
        });
        
        // Close sidebar when clicking outside
        document.addEventListener('click', (event) => {
            if (sidebar.classList.contains('active') && 
                !sidebar.contains(event.target) && 
                !headerButton.contains(event.target)) {
                sidebar.classList.remove('active');
                document.body.classList.remove('sidebar-open');
            }
        });
    }
    
    // Notification dropdown
    const notificationBtn = document.querySelector('.notification-btn');
    const notificationDropdown = document.querySelector('.notification-dropdown');
    
    if (notificationBtn && notificationDropdown) {
        notificationBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            notificationDropdown.classList.toggle('show');
        });
        
        // Close dropdown when clicking elsewhere
        document.addEventListener('click', (event) => {
            if (notificationDropdown.classList.contains('show') && 
                !notificationDropdown.contains(event.target) && 
                !notificationBtn.contains(event.target)) {
                notificationDropdown.classList.remove('show');
            }
        });
    }
}

// --- Initialize Sidebar Toggle ---
function initializeSidebar() {
    const toggleBtn = document.getElementById('toggle-sidebar');
    const adminLayout = document.querySelector('.admin-layout');
    
    if (toggleBtn && adminLayout) {
        // Toggle sidebar collapsed state
        toggleBtn.addEventListener('click', () => {
            adminLayout.classList.toggle('sidebar-collapsed');
            // Store preference in localStorage
            const isCollapsed = adminLayout.classList.contains('sidebar-collapsed');
            localStorage.setItem('admin-sidebar-collapsed', isCollapsed);
        });
        
        // Apply saved preference
        const savedCollapsed = localStorage.getItem('admin-sidebar-collapsed') === 'true';
        if (savedCollapsed) {
            adminLayout.classList.add('sidebar-collapsed');
        }
        
        // Add event listeners to all menu links
        setupSidebarNavigation();
    }
}

// --- Setup Sidebar Navigation ---
function setupSidebarNavigation() {
    const navLinks = document.querySelectorAll('.admin-nav a');
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Get section name
            const section = link.getAttribute('data-section');
            if (!section) return;
            
            // Update active state
            navLinks.forEach(l => l.parentElement.classList.remove('active'));
            link.parentElement.classList.add('active');
            
            // Update current section
            currentSection = section;
            
            console.log(`[AdminDashboard] Navigation to section: ${section}`);
            
            // Update page title
            updateSectionTitle(section);
            
            // Handle mobile sidebar
            const sidebar = document.querySelector('.admin-sidebar');
            if (window.innerWidth < 768 && sidebar) {
                sidebar.classList.remove('active');
                document.body.classList.remove('sidebar-open');
            }
            
            // Show/hide content sections based on selected section
            showSelectedSection(section);
        });
    });
}

// --- Update Section Title ---
function updateSectionTitle(section) {
    const sectionTitles = {
        dashboard: 'Dashboard',
        verifications: 'Verificaciones',
        applications: 'Solicitudes',
        users: 'Usuarios',
        reports: 'Reportes',
        settings: 'Configuración'
    };
    
    // Update header title
    const headerTitle = document.querySelector('.header-left h1');
    if (headerTitle && sectionTitles[section]) {
        headerTitle.textContent = sectionTitles[section];
    }
    
    // Update document title
    document.title = `${sectionTitles[section] || 'Admin'} | Permisos Digitales`;
}

// --- Show Selected Section ---
function showSelectedSection(section) {
    // For now, we're just simulating section changes
    // In a real implementation, you would load different content sections
    
    // Get all content sections (or create them dynamically)
    const contentSections = document.querySelectorAll('.content-section');
    
    // If we have multiple sections setup, show/hide them
    if (contentSections.length > 0) {
        contentSections.forEach(sectionEl => {
            const sectionId = sectionEl.getAttribute('data-section');
            if (sectionId === section) {
                sectionEl.classList.remove('hidden');
            } else {
                sectionEl.classList.add('hidden');
            }
        });
    } else {
        // For simplicity in this implementation, show a message
        const contentArea = document.querySelector('.admin-content');
        if (contentArea) {
            if (section !== 'dashboard') {
                // Show a message for non-dashboard sections
                const dashboardContent = contentArea.innerHTML;
                
                // Store dashboard content if not already stored
                if (!contentArea.getAttribute('data-dashboard-content')) {
                    contentArea.setAttribute('data-dashboard-content', dashboardContent);
                }
                
                // Show a section-specific message
                contentArea.innerHTML = `
                    <div class="section-placeholder">
                        <div class="section-icon">
                            <svg class="icon"><use xlink:href="/assets/icons/sprite.svg#icon-${getIconForSection(section)}"></use></svg>
                        </div>
                        <h2>Sección de ${sectionTitles[section]}</h2>
                        <p>Esta sección está en desarrollo. Pronto estará disponible.</p>
                        <button class="btn btn-primary return-dashboard">Volver al Dashboard</button>
                    </div>
                `;
                
                // Add event listener to return button
                const returnBtn = contentArea.querySelector('.return-dashboard');
                if (returnBtn) {
                    returnBtn.addEventListener('click', () => {
                        // Return to dashboard
                        const dashboardLink = document.querySelector('.admin-nav a[data-section="dashboard"]');
                        if (dashboardLink) {
                            dashboardLink.click();
                        }
                    });
                }
            } else {
                // Restore dashboard content if needed
                const storedContent = contentArea.getAttribute('data-dashboard-content');
                if (storedContent) {
                    contentArea.innerHTML = storedContent;
                    
                    // Reinitialize charts and other components
                    initializeStatusChart(lastStatusData || []);
                    displayPendingVerifications();
                }
            }
        }
    }
}

// --- Get Icon For Section ---
function getIconForSection(section) {
    const iconMap = {
        dashboard: 'dashboard',
        verifications: 'check-circle',
        applications: 'document',
        users: 'users',
        reports: 'chart',
        settings: 'settings'
    };
    
    return iconMap[section] || 'dashboard';
}

// --- Store Last Status Data ---
let lastStatusData = null;

// --- Fetch Dashboard Statistics ---
async function fetchDashboardStats() {
    console.log('[AdminDashboard] Fetching dashboard statistics...');
    
    try {
        // For demo we'll use mock data
        // In production, uncomment the API call:
        /*
        const response = await fetch('/api/admin/dashboard-stats');
        
        if (!response.ok) {
            throw new Error(`Error fetching dashboard stats: ${response.status}`);
        }
        
        const data = await response.json();
        */
        
        // Mock data for demonstration
        const data = {
            pendingVerifications: 12,
            todayVerifications: {
                approved: 18,
                rejected: 5
            },
            statusCounts: [
                { status: 'PENDING', count: 32 },
                { status: 'PROOF_SUBMITTED', count: 12 },
                { status: 'PAYMENT_VERIFIED', count: 76 },
                { status: 'PAYMENT_REJECTED', count: 8 },
                { status: 'PERMIT_GENERATED', count: 45 },
                { status: 'COMPLETED', count: 124 },
                { status: 'CANCELLED', count: 15 }
            ]
        };
        
        console.log('[AdminDashboard] Dashboard stats retrieved:', data);
        
        // Update stats counters
        document.getElementById('pending-count').textContent = data.pendingVerifications || 0;
        document.getElementById('approved-count').textContent = data.todayVerifications?.approved || 0;
        document.getElementById('rejected-count').textContent = data.todayVerifications?.rejected || 0;
        
        // Calculate total active applications
        const totalActive = data.statusCounts?.reduce((total, item) => {
            // Exclude cancelled applications
            if (item.status !== 'CANCELLED') {
                return total + (item.count || 0);
            }
            return total;
        }, 0) || 0;
        
        document.getElementById('total-count').textContent = totalActive;
        
        // Save status data for later reuse
        lastStatusData = data.statusCounts || [];
        
        // Initialize status chart
        initializeStatusChart(lastStatusData);
        
    } catch (error) {
        console.error('[AdminDashboard] Error fetching dashboard stats:', error);
        // Display error message
        const statsElements = document.querySelectorAll('.stat-content h3');
        statsElements.forEach(el => {
            el.innerHTML = '<span class="error-text">Error</span>';
        });
    }
}

// --- Initialize Status Chart ---
function initializeStatusChart(statusCounts) {
    const chartCanvas = document.getElementById('status-chart');
    
    if (!chartCanvas) {
        console.warn('[AdminDashboard] Status chart canvas not found');
        return;
    }
    
    // Destroy existing chart if it exists
    if (statusChart) {
        statusChart.destroy();
    }
    
    // Define status labels and their colors
    const statusMapping = {
        'PENDING': { label: 'Pendiente de Pago', color: 'rgba(59, 130, 246, 0.7)' },
        'PROOF_SUBMITTED': { label: 'Comprobante Enviado', color: 'rgba(245, 158, 11, 0.7)' },
        'PAYMENT_VERIFIED': { label: 'Pago Verificado', color: 'rgba(16, 185, 129, 0.7)' },
        'PAYMENT_REJECTED': { label: 'Pago Rechazado', color: 'rgba(239, 68, 68, 0.7)' },
        'PERMIT_GENERATED': { label: 'Permiso Generado', color: 'rgba(139, 92, 246, 0.7)' },
        'COMPLETED': { label: 'Completado', color: 'rgba(5, 150, 105, 0.7)' },
        'CANCELLED': { label: 'Cancelado', color: 'rgba(107, 114, 128, 0.7)' }
    };
    
    // Map the data for the chart
    const chartData = statusCounts.map(item => ({
        status: item.status,
        count: item.count || 0,
        ...statusMapping[item.status] || { label: item.status, color: 'rgba(31, 41, 55, 0.7)' }
    }));
    
    // Sort data for better visualization
    chartData.sort((a, b) => b.count - a.count);
    
    // Create chart using Chart.js
    statusChart = new Chart(chartCanvas, {
        type: 'bar',
        data: {
            labels: chartData.map(item => item.label),
            datasets: [{
                label: 'Número de Solicitudes',
                data: chartData.map(item => item.count),
                backgroundColor: chartData.map(item => item.color),
                borderColor: chartData.map(item => item.color.replace('0.7', '1')),
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0 // Show only integers
                    },
                    grid: {
                        color: 'rgba(226, 232, 240, 0.6)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(31, 41, 55, 0.9)',
                    titleFont: {
                        weight: 'bold'
                    },
                    bodyFont: {
                        size: 14
                    },
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        title: (tooltipItems) => {
                            return tooltipItems[0].label;
                        },
                        label: (context) => {
                            return `Solicitudes: ${context.raw}`;
                        }
                    }
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeOutQuart'
            }
        }
    });
    
    console.log('[AdminDashboard] Status chart initialized');
}

// --- Fetch Pending Verifications ---
async function fetchPendingVerifications() {
    console.log('[AdminDashboard] Fetching pending verifications...');
    
    try {
        // For demo we'll use mock data
        // In production, uncomment the API call:
        /*
        const response = await fetch('/api/admin/pending-verifications');
        
        if (!response.ok) {
            throw new Error(`Error fetching pending verifications: ${response.status}`);
        }
        
        pendingVerifications = await response.json();
        */
        
        // Mock data for demonstration
        pendingVerifications = [
            {
                id: 12345,
                applicant_name: 'Juan Pérez',
                applicant_email: 'juan.perez@example.com',
                payment_reference: 'REF-001-2023',
                marca: 'Toyota',
                linea: 'Corolla',
                ano_modelo: '2020',
                payment_proof_uploaded_at: '2023-04-14T10:30:00Z',
                amount: 1450.00
            },
            {
                id: 12346,
                applicant_name: 'María González',
                applicant_email: 'maria.glez@example.com',
                payment_reference: 'REF-002-2023',
                marca: 'Honda',
                linea: 'CR-V',
                ano_modelo: '2021',
                payment_proof_uploaded_at: '2023-04-14T11:45:00Z',
                amount: 1520.00
            },
            {
                id: 12347,
                applicant_name: 'Carlos Rodríguez',
                applicant_email: 'carlos.rdz@example.com',
                payment_reference: 'REF-003-2023',
                marca: 'Nissan',
                linea: 'Sentra',
                ano_modelo: '2019',
                payment_proof_uploaded_at: '2023-04-14T13:15:00Z',
                amount: 1380.00
            }
        ];
        
        console.log('[AdminDashboard] Pending verifications retrieved:', pendingVerifications);
        
        displayPendingVerifications();
        
    } catch (error) {
        console.error('[AdminDashboard] Error fetching pending verifications:', error);
        // Display error message or use fallback data
        const tableBody = document.querySelector('#verification-table tbody');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center">
                        Error al cargar verificaciones. <button class="btn-retry">Reintentar</button>
                    </td>
                </tr>
            `;
            
            const retryBtn = tableBody.querySelector('.btn-retry');
            if (retryBtn) {
                retryBtn.addEventListener('click', fetchPendingVerifications);
            }
        }
    }
}

// --- Fetch Recent Activity ---
async function fetchRecentActivity() {
    console.log('[AdminDashboard] Fetching recent activity...');
    
    try {
        // Mock data for demonstration
        const activities = [
            {
                type: 'approval',
                message: 'Pago verificado para solicitud #12345',
                time: '2023-04-14T14:30:00Z',
                icon: 'check-circle'
            },
            {
                type: 'rejection',
                message: 'Pago rechazado para solicitud #12344',
                time: '2023-04-14T13:15:00Z',
                icon: 'times-circle'
            },
            {
                type: 'document',
                message: 'Permiso generado para solicitud #12342',
                time: '2023-04-14T12:00:00Z',
                icon: 'document'
            }
        ];
        
        displayRecentActivity(activities);
        
    } catch (error) {
        console.error('[AdminDashboard] Error fetching recent activity:', error);
        
        // Display error message
        const activityList = document.getElementById('activity-list');
        if (activityList) {
            activityList.innerHTML = '<li class="text-center">Error al cargar actividad reciente</li>';
        }
    }
}

// --- Display Recent Activity ---
function displayRecentActivity(activities) {
    const activityList = document.getElementById('activity-list');
    
    if (!activityList) {
        console.warn('[AdminDashboard] Activity list element not found');
        return;
    }
    
    if (!activities || activities.length === 0) {
        activityList.innerHTML = '<li class="text-center">No hay actividad reciente</li>';
        return;
    }
    
    // Build activity HTML
    activityList.innerHTML = activities.map(activity => `
        <li class="activity-item">
            <div class="activity-icon ${activity.type || ''}">
                <svg class="icon icon-${activity.icon}"><use xlink:href="/assets/icons/sprite.svg#icon-${activity.icon}"></use></svg>
            </div>
            <div class="activity-content">
                <p>${activity.message}</p>
                <span class="activity-time">${formatTimeAgo(activity.time)}</span>
            </div>
        </li>
    `).join('');
    
    console.log('[AdminDashboard] Displayed recent activity');
}

// --- Display Pending Verifications ---
function displayPendingVerifications() {
    const tableBody = document.querySelector('#verification-table tbody');
    
    if (!tableBody) {
        console.warn('[AdminDashboard] Verification table body not found');
        return;
    }
    
    if (!pendingVerifications || pendingVerifications.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">No hay verificaciones pendientes</td>
            </tr>
        `;
        return;
    }
    
    // Limit to 5 recent items for the dashboard
    const displayVerifications = pendingVerifications.slice(0, 5);
    
    tableBody.innerHTML = displayVerifications.map(item => `
        <tr>
            <td>${item.id}</td>
            <td>${item.applicant_name || 'N/A'}</td>
            <td>${item.payment_reference || 'N/A'}</td>
            <td>${item.marca} ${item.linea} ${item.ano_modelo}</td>
            <td>${formatDate(item.payment_proof_uploaded_at)}</td>
            <td>
                <div class="btn-group">
                    <button class="btn-icon btn-view" title="Ver Detalles" data-id="${item.id}">
                        <svg class="icon icon-eye"><use xlink:href="/assets/icons/sprite.svg#icon-eye"></use></svg>
                    </button>
                    <button class="btn-icon btn-approve" title="Aprobar Pago" data-id="${item.id}">
                        <svg class="icon icon-check"><use xlink:href="/assets/icons/sprite.svg#icon-check"></use></svg>
                    </button>
                    <button class="btn-icon btn-reject" title="Rechazar Pago" data-id="${item.id}">
                        <svg class="icon icon-times"><use xlink:href="/assets/icons/sprite.svg#icon-times"></use></svg>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
    
    // Add event listeners to buttons
    tableBody.querySelectorAll('.btn-view, .btn-approve, .btn-reject').forEach(button => {
        button.addEventListener('click', handleVerificationAction);
    });
    
    console.log('[AdminDashboard] Displayed pending verifications in table');
}

// --- Handle Verification Actions ---
function handleVerificationAction(event) {
    const button = event.currentTarget;
    const applicationId = button.getAttribute('data-id');
    
    if (!applicationId) {
        console.error('[AdminDashboard] No application ID found on button');
        return;
    }
    
    // Find the verification in the data
    const verification = pendingVerifications.find(item => item.id.toString() === applicationId);
    
    if (!verification) {
        console.error(`[AdminDashboard] Verification with ID ${applicationId} not found in data`);
        return;
    }
    
    if (button.classList.contains('btn-view') || button.classList.contains('btn-approve')) {
        // Show verification modal with data
        showVerificationModal(verification);
    } else if (button.classList.contains('btn-reject')) {
        // Show rejection modal with data
        showRejectionModal(verification);
    }
}

// --- Initialize Modals ---
function initializeModals() {
    console.log('[AdminDashboard] Initializing modals...');
    
    const verifyModal = document.getElementById('verify-modal');
    const rejectModal = document.getElementById('reject-modal');
    
    if (!verifyModal || !rejectModal) {
        console.warn('[AdminDashboard] One or more modal elements not found');
        return;
    }
    
    // Close buttons for both modals
    document.querySelectorAll('[data-action="close"]').forEach(button => {
        button.addEventListener('click', () => {
            verifyModal.hidden = true;
            rejectModal.hidden = true;
            // Remove any open modal classes
            document.body.classList.remove('modal-open');
        });
    });
    
    // Modal overlays should also close the modals when clicked
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', () => {
            verifyModal.hidden = true;
            rejectModal.hidden = true;
            // Remove any open modal classes
            document.body.classList.remove('modal-open');
        });
    });
    
    // Back button in reject modal
    const backButton = document.querySelector('[data-action="back"]');
    if (backButton) {
        backButton.addEventListener('click', () => {
            rejectModal.hidden = true;
            verifyModal.hidden = false;
        });
    }
    
    // Approve button in verify modal
    const approveButton = document.querySelector('[data-action="approve"]');
    if (approveButton) {
        approveButton.addEventListener('click', handleApprovePayment);
    }
    
    // Reject button in verify modal
    const rejectButton = document.querySelector('[data-action="reject"]');
    if (rejectButton) {
        rejectButton.addEventListener('click', () => {
            verifyModal.hidden = true;
            rejectModal.hidden = false;
        });
    }
    
    // Confirm reject button in reject modal
    const confirmRejectButton = document.querySelector('[data-action="confirm-reject"]');
    if (confirmRejectButton) {
        confirmRejectButton.addEventListener('click', handleRejectPayment);
    }
    
    // Prevent modal content clicks from closing modal
    document.querySelectorAll('.modal-container').forEach(container => {
        container.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    });
    
    // Close modals when ESC key is pressed
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            verifyModal.hidden = true;
            rejectModal.hidden = true;
            document.body.classList.remove('modal-open');
        }
    });
    
    console.log('[AdminDashboard] Modal initialization complete');
}

// --- Show Verification Modal ---
function showVerificationModal(verification) {
    console.log('[AdminDashboard] Showing verification modal for:', verification);
    
    const modal = document.getElementById('verify-modal');
    if (!modal) return;
    
    // Add modal open class to body to prevent background scrolling
    document.body.classList.add('modal-open');
    
    // Fill in the verification data
    document.getElementById('modal-applicant-name').textContent = verification.applicant_name || 'N/A';
    document.getElementById('modal-applicant-email').textContent = verification.applicant_email || 'N/A';
    document.getElementById('modal-vehicle').textContent = `${verification.marca} ${verification.linea} ${verification.ano_modelo}`;
    document.getElementById('modal-reference').textContent = verification.payment_reference || 'N/A';
    document.getElementById('modal-amount').textContent = `$${verification.amount?.toFixed(2) || '0.00'} MXN`;
    document.getElementById('modal-date').textContent = formatDate(verification.payment_proof_uploaded_at);
    document.getElementById('verification-id').value = verification.id;
    
    // Clear any previous notes
    document.getElementById('verification-notes').value = '';
    
    // Set the proof image URL
    const proofImage = document.getElementById('proof-image');
    if (proofImage) {
        // For demo purposes, use a placeholder image
        proofImage.src = 'https://placehold.co/600x400/e2e8f0/475569?text=Comprobante+de+Pago';
        
        // In production, uncomment this:
        // proofImage.src = `/api/admin/applications/${verification.id}/payment-proof-file`;
        
        proofImage.onerror = () => {
            proofImage.src = 'https://placehold.co/600x400/f1f5f9/64748b?text=Error+al+cargar+imagen';
            console.warn(`[AdminDashboard] Error loading proof image for application ${verification.id}`);
        };
    }
    
    // Show the modal
    modal.hidden = false;
}

// --- Show Rejection Modal ---
function showRejectionModal(verification) {
    console.log('[AdminDashboard] Showing rejection modal for:', verification);
    
    const modal = document.getElementById('reject-modal');
    if (!modal) return;
    
    // Add modal open class to body to prevent background scrolling
    document.body.classList.add('modal-open');
    
    // Reset form fields
    document.getElementById('rejection-reason').value = '';
    document.getElementById('rejection-notes').value = '';
    
    // Store verification ID (use the same hidden input)
    document.getElementById('verification-id').value = verification.id;
    
    // Show the modal
    modal.hidden = false;
}

// --- Handle Approve Payment ---
async function handleApprovePayment() {
    const applicationId = document.getElementById('verification-id').value;
    const notes = document.getElementById('verification-notes').value.trim();
    
    if (!applicationId) {
        console.error('[AdminDashboard] No application ID found for approval');
        return;
    }
    
    console.log(`[AdminDashboard] Approving payment for application ${applicationId}`);
    
    // Disable buttons to prevent double submission
    const approveButton = document.querySelector('[data-action="approve"]');
    const rejectButton = document.querySelector('[data-action="reject"]');
    
    if (approveButton) approveButton.disabled = true;
    if (rejectButton) rejectButton.disabled = true;
    
    try {
        // For demo, we'll simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Simulating success
        console.log('[AdminDashboard] Payment approved successfully');
        
        // Close the modal
        document.getElementById('verify-modal').hidden = true;
        document.body.classList.remove('modal-open');
        
        // Show success notification
        showNotification('Pago verificado correctamente. Generación de permiso iniciada.', 'success');
        
        // Remove the verified item from the list
        pendingVerifications = pendingVerifications.filter(item => item.id.toString() !== applicationId);
        displayPendingVerifications();
        
        // Update stats
        const pendingCount = document.getElementById('pending-count');
        const approvedCount = document.getElementById('approved-count');
        
        if (pendingCount) {
            const currentCount = parseInt(pendingCount.textContent) || 0;
            pendingCount.textContent = Math.max(0, currentCount - 1);
        }
        
        if (approvedCount) {
            const currentCount = parseInt(approvedCount.textContent) || 0;
            approvedCount.textContent = currentCount + 1;
        }
        
    } catch (error) {
        console.error('[AdminDashboard] Error in approve payment process:', error);
        showNotification('Error al procesar la aprobación. Verifique su conexión.', 'error');
    } finally {
        // Re-enable buttons
        if (approveButton) approveButton.disabled = false;
        if (rejectButton) rejectButton.disabled = false;
    }
}

// --- Handle Reject Payment ---
async function handleRejectPayment() {
    const applicationId = document.getElementById('verification-id').value;
    const reason = document.getElementById('rejection-reason').value;
    const notes = document.getElementById('rejection-notes').value.trim();
    
    if (!applicationId) {
        console.error('[AdminDashboard] No application ID found for rejection');
        return;
    }
    
    if (!reason) {
        showNotification('Por favor, seleccione un motivo de rechazo.', 'error');
        return;
    }
    
    console.log(`[AdminDashboard] Rejecting payment for application ${applicationId}`);
    
    // Disable button to prevent double submission
    const confirmRejectButton = document.querySelector('[data-action="confirm-reject"]');
    if (confirmRejectButton) confirmRejectButton.disabled = true;
    
    try {
        // For demo, we'll simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Simulating success
        console.log('[AdminDashboard] Payment rejected successfully');
        
        // Close the modal
        document.getElementById('reject-modal').hidden = true;
        document.body.classList.remove('modal-open');
        
        // Show success notification
        showNotification('Pago rechazado correctamente. El cliente será notificado.', 'success');
        
        // Remove the rejected item from the list
        pendingVerifications = pendingVerifications.filter(item => item.id.toString() !== applicationId);
        displayPendingVerifications();
        
        // Update stats
        const pendingCount = document.getElementById('pending-count');
        const rejectedCount = document.getElementById('rejected-count');
        
        if (pendingCount) {
            const currentCount = parseInt(pendingCount.textContent) || 0;
            pendingCount.textContent = Math.max(0, currentCount - 1);
        }
        
        if (rejectedCount) {
            const currentCount = parseInt(rejectedCount.textContent) || 0;
            rejectedCount.textContent = currentCount + 1;
        }
        
    } catch (error) {
        console.error('[AdminDashboard] Error in reject payment process:', error);
        showNotification('Error al procesar el rechazo. Verifique su conexión.', 'error');
    } finally {
        // Re-enable button
        if (confirmRejectButton) confirmRejectButton.disabled = false;
    }
}

// --- Show Notification ---
function showNotification(message, type = 'info') {
    // Check if a notification container exists
    let notificationContainer = document.querySelector('.notification-container');
    
    // Create one if it doesn't exist
    if (!notificationContainer) {
        notificationContainer = document.createElement('div');
        notificationContainer.className = 'notification-container';
        document.body.appendChild(notificationContainer);
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <div class="notification-icon">
                <svg class="icon icon-${type === 'success' ? 'check-circle' : type === 'error' ? 'alert-circle' : 'info-circle'}">
                    <use xlink:href="/assets/icons/sprite.svg#icon-${type === 'success' ? 'check-circle' : type === 'error' ? 'alert-circle' : 'info-circle'}"></use>
                </svg>
            </div>
            <div class="notification-message">${message}</div>
            <button class="notification-close">
                <svg class="icon icon-close">
                    <use xlink:href="/assets/icons/sprite.svg#icon-close"></use>
                </svg>
            </button>
        </div>
    `;
    
    // Add close button functionality
    const closeButton = notification.querySelector('.notification-close');
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            notification.classList.add('notification-hide');
            setTimeout(() => {
                notification.remove();
            }, 300);
        });
    }
    
    // Add notification to container
    notificationContainer.appendChild(notification);
    
    // Trigger animation
    setTimeout(() => {
        notification.classList.add('notification-show');
    }, 10);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        notification.classList.add('notification-hide');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 5000);
}

// --- Helper Functions ---

/**
 * Format a date string to a user-friendly format
 * @param {string} dateString - The date string to format
 * @returns {string} - The formatted date string
 */
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) return 'N/A';
    
    // Format: DD/MM/YYYY HH:MM
    return date.toLocaleString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Format a time string to a "time ago" format
 * @param {string} dateString - The date string to format
 * @returns {string} - The formatted time ago string
 */
function formatTimeAgo(dateString) {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) return 'N/A';
    
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    
    if (diffDay > 0) {
        return diffDay === 1 ? 'Hace 1 día' : `Hace ${diffDay} días`;
    } else if (diffHour > 0) {
        return diffHour === 1 ? 'Hace 1 hora' : `Hace ${diffHour} horas`;
    } else if (diffMin > 0) {
        return diffMin === 1 ? 'Hace 1 minuto' : `Hace ${diffMin} minutos`;
    } else {
        return 'Hace unos segundos';
    }
}

// --- Export Functions ---
window.initAdminDashboard = initAdminDashboard;

console.log('[AdminDashboard] Admin dashboard script loaded.');