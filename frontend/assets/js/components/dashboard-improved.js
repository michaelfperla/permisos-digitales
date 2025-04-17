/**
 * =============================================================================
 * Permisos Digitales - Improved Dashboard Component Logic
 * =============================================================================
 *
 * This is an improved version of the dashboard component with:
 * - Better separation of concerns
 * - More testable structure
 * - Cleaner async handling
 */

// --- Dashboard State Management ---
// Centralized state object to make testing easier
const dashboardState = {
  isLoading: true,
  hasError: false,
  errorMessage: '',
  isEmpty: false,
  applications: [],
  expiringPermits: []
};

// --- UI Helper Functions ---
// These functions are separated to make them easier to test and mock
const UI = {
  // Show/hide different dashboard states
  showLoading: () => {
    const loadingDiv = document.getElementById('dashboard-loading');
    const errorDiv = document.getElementById('dashboard-error');
    const emptyDiv = document.getElementById('dashboard-empty');
    const contentDiv = document.getElementById('dashboard-content');
    
    if (loadingDiv) loadingDiv.hidden = false;
    if (errorDiv) errorDiv.hidden = true;
    if (emptyDiv) emptyDiv.hidden = true;
    if (contentDiv) contentDiv.hidden = true;
    
    dashboardState.isLoading = true;
  },
  
  showContent: () => {
    const loadingDiv = document.getElementById('dashboard-loading');
    const errorDiv = document.getElementById('dashboard-error');
    const emptyDiv = document.getElementById('dashboard-empty');
    const contentDiv = document.getElementById('dashboard-content');
    
    if (loadingDiv) loadingDiv.hidden = true;
    if (errorDiv) errorDiv.hidden = true;
    if (emptyDiv) emptyDiv.hidden = true;
    if (contentDiv) contentDiv.hidden = false;
    
    dashboardState.isLoading = false;
    dashboardState.hasError = false;
    dashboardState.isEmpty = false;
  },
  
  showEmpty: () => {
    const loadingDiv = document.getElementById('dashboard-loading');
    const errorDiv = document.getElementById('dashboard-error');
    const emptyDiv = document.getElementById('dashboard-empty');
    const contentDiv = document.getElementById('dashboard-content');
    
    if (loadingDiv) loadingDiv.hidden = true;
    if (errorDiv) errorDiv.hidden = true;
    if (emptyDiv) emptyDiv.hidden = false;
    if (contentDiv) contentDiv.hidden = true;
    
    dashboardState.isLoading = false;
    dashboardState.hasError = false;
    dashboardState.isEmpty = true;
  },
  
  showError: (message) => {
    const loadingDiv = document.getElementById('dashboard-loading');
    const errorDiv = document.getElementById('dashboard-error');
    const errorMessageDiv = document.getElementById('dashboard-error-message');
    const emptyDiv = document.getElementById('dashboard-empty');
    const contentDiv = document.getElementById('dashboard-content');
    
    if (loadingDiv) loadingDiv.hidden = true;
    if (errorDiv) errorDiv.hidden = false;
    if (errorMessageDiv) errorMessageDiv.textContent = message;
    if (emptyDiv) emptyDiv.hidden = true;
    if (contentDiv) contentDiv.hidden = true;
    
    dashboardState.isLoading = false;
    dashboardState.hasError = true;
    dashboardState.errorMessage = message;
  },
  
  // Render applications table
  renderApplicationsTable: (applications) => {
    const tableBody = document.querySelector('#applications-table tbody');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    applications.forEach(app => {
      const row = document.createElement('tr');
      
      // ID column
      const idCell = document.createElement('td');
      idCell.textContent = app.id;
      row.appendChild(idCell);
      
      // Vehicle column
      const vehicleCell = document.createElement('td');
      vehicleCell.textContent = `${app.vehicle_make} ${app.vehicle_model} (${app.vehicle_year})`;
      row.appendChild(vehicleCell);
      
      // License plate column
      const plateCell = document.createElement('td');
      plateCell.textContent = app.license_plate;
      row.appendChild(plateCell);
      
      // Status column
      const statusCell = document.createElement('td');
      const statusBadge = document.createElement('span');
      statusBadge.className = `status-badge ${window.getStatusClass(app.status)}`;
      statusBadge.textContent = window.getStatusText(app.status);
      statusCell.appendChild(statusBadge);
      row.appendChild(statusCell);
      
      // Date column
      const dateCell = document.createElement('td');
      dateCell.textContent = window.formatDate(app.created_at);
      row.appendChild(dateCell);
      
      // Actions column
      const actionsCell = document.createElement('td');
      const detailsLink = document.createElement('a');
      detailsLink.href = `#/permits/${app.id}`;
      detailsLink.className = 'btn btn-sm btn-primary';
      detailsLink.textContent = 'Ver Detalles';
      actionsCell.appendChild(detailsLink);
      row.appendChild(actionsCell);
      
      tableBody.appendChild(row);
    });
  },
  
  // Render expiring permits
  renderExpiringPermits: (expiringPermits) => {
    const container = document.getElementById('expiring-permits-container');
    const list = document.getElementById('expiring-permits-list');
    if (!container || !list) return;
    
    // Show container if there are expiring permits
    container.hidden = expiringPermits.length === 0;
    if (expiringPermits.length === 0) return;
    
    // Clear existing items
    list.innerHTML = '';
    
    // Add expiring permit items
    expiringPermits.forEach(permit => {
      const item = document.createElement('div');
      item.className = 'expiring-permit-item';
      
      const header = document.createElement('h4');
      header.textContent = `${permit.vehicle_make} ${permit.vehicle_model}`;
      item.appendChild(header);
      
      const details = document.createElement('p');
      details.textContent = `Placa: ${permit.license_plate} - Vence: ${window.formatDate(permit.expiration_date)}`;
      item.appendChild(details);
      
      const renewLink = document.createElement('a');
      renewLink.href = `#/permits/${permit.id}/renew`;
      renewLink.className = 'btn btn-sm btn-warning';
      renewLink.textContent = 'Renovar';
      item.appendChild(renewLink);
      
      list.appendChild(item);
    });
  }
};

// --- Data Fetching ---
// Separated data fetching logic for better testing
const API = {
  // Fetch dashboard data
  fetchDashboardData: async () => {
    try {
      const response = await fetch('/api/applications', {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      
      const data = await response.json();
      console.log('[Dashboard] Data received:', data);
      
      // Update state
      dashboardState.applications = data.applications || [];
      dashboardState.expiringPermits = data.expiringPermits || [];
      
      return data;
    } catch (error) {
      console.error('[Dashboard] Error fetching dashboard data:', error);
      throw error;
    }
  }
};

// --- Authentication ---
// Separated authentication logic
const Auth = {
  checkAuthentication: () => {
    const isAuthenticated = sessionStorage.getItem('isAuthenticated') === 'true';
    if (!isAuthenticated) {
      console.warn('[Dashboard] User not authenticated. Redirecting to login.');
      window.location.hash = '#/login';
      return false;
    }
    return true;
  }
};

// --- Event Handlers ---
// Separated event handlers for better testing
const EventHandlers = {
  // Handle retry button click
  handleRetryClick: async () => {
    try {
      UI.showLoading();
      const data = await API.fetchDashboardData();
      
      if (data.applications && data.applications.length > 0) {
        UI.renderApplicationsTable(data.applications);
        UI.renderExpiringPermits(data.expiringPermits || []);
        UI.showContent();
      } else {
        UI.showEmpty();
      }
    } catch (error) {
      UI.showError(`Error al cargar datos: ${error.message}`);
    }
  },
  
  // Set up event listeners
  setupEventListeners: () => {
    const retryButton = document.getElementById('retry-button');
    if (retryButton) {
      retryButton.addEventListener('click', EventHandlers.handleRetryClick);
    }
  }
};

// --- Main Dashboard Initialization ---
// The main function is now much cleaner and easier to test
async function initDashboardPage() {
  console.log('[Dashboard] Initializing Dashboard Page...');
  
  // Check authentication
  if (!Auth.checkAuthentication()) {
    return;
  }
  
  // Show loading state
  UI.showLoading();
  
  // Set up event listeners
  EventHandlers.setupEventListeners();
  
  try {
    // Fetch dashboard data
    const data = await API.fetchDashboardData();
    
    // Process data and update UI
    if (data.applications && data.applications.length > 0) {
      UI.renderApplicationsTable(data.applications);
      UI.renderExpiringPermits(data.expiringPermits || []);
      UI.showContent();
    } else {
      UI.showEmpty();
    }
  } catch (error) {
    UI.showError(`Error al cargar datos: ${error.message}`);
  }
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initDashboardPage,
    dashboardState,
    UI,
    API,
    Auth,
    EventHandlers
  };
}

// Make available globally
window.initDashboardPage = initDashboardPage;
