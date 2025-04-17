/**
 * Components initialization
 * Centralizes the initialization of all UI components
 */

/**
 * Initialize all global components
 */
export function initializeComponents() {
  // Initialize ticker component if present
  initTickerComponent();
  
  // Initialize dropdown components
  initializeDropdowns();
  
  // Initialize modal dialogs
  initializeModals();
  
  // Initialize tooltips and popovers
  initializeTooltips();
  
  // Initialize alert dismiss buttons
  initializeAlertDismiss();
  
  console.log('[Components] Global UI components initialized');
}

/**
 * Initialize ticker component
 */
function initTickerComponent() {
  const tickerWrap = document.querySelector('.ticker-wrap');
  
  if (!tickerWrap) {
    return; // No ticker found
  }
  
  // Get all ticker items
  const tickerItems = tickerWrap.querySelectorAll('.ticker-item');
  
  if (tickerItems.length === 0) {
    return; // No items to show
  }
  
  // Clone items to ensure continuous scrolling
  const originalWidth = tickerWrap.scrollWidth;
  
  // Set a custom property for animation calculation
  tickerWrap.style.setProperty('--ticker-copies', '2');
  
  // Clone the items
  tickerItems.forEach(item => {
    const clone = item.cloneNode(true);
    tickerWrap.appendChild(clone);
  });
  
  // Clone the separators too
  const separators = tickerWrap.querySelectorAll('.ticker-separator');
  separators.forEach(separator => {
    const clone = separator.cloneNode(true);
    tickerWrap.appendChild(clone);
  });
  
  // Adjust animation duration based on content length
  const itemCount = tickerItems.length;
  let duration = Math.max(10, Math.min(30, itemCount * 2));
  
  // Respect reduced motion preference
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    tickerWrap.style.animationPlayState = 'paused';
  } else {
    tickerWrap.style.animationDuration = `${duration}s`;
  }
}

/**
 * Initialize dropdown components
 */
function initializeDropdowns() {
  const dropdownToggles = document.querySelectorAll('[data-toggle="dropdown"]');
  
  dropdownToggles.forEach(toggle => {
    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Close all other dropdowns
      const otherDropdowns = document.querySelectorAll('.dropdown-menu.show');
      otherDropdowns.forEach(dropdown => {
        if (dropdown !== toggle.nextElementSibling) {
          dropdown.classList.remove('show');
        }
      });
      
      // Toggle this dropdown
      const dropdownMenu = toggle.nextElementSibling;
      if (dropdownMenu && dropdownMenu.classList.contains('dropdown-menu')) {
        dropdownMenu.classList.toggle('show');
        
        // Update aria-expanded
        const expanded = dropdownMenu.classList.contains('show');
        toggle.setAttribute('aria-expanded', expanded.toString());
      }
    });
  });
  
  // Close dropdowns when clicking outside
  document.addEventListener('click', () => {
    const openDropdowns = document.querySelectorAll('.dropdown-menu.show');
    openDropdowns.forEach(dropdown => {
      dropdown.classList.remove('show');
      
      // Find and update the toggle
      const toggle = dropdown.previousElementSibling;
      if (toggle && toggle.hasAttribute('data-toggle')) {
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  });
}

/**
 * Initialize modal dialogs
 */
function initializeModals() {
  // Modal open buttons
  const modalTriggers = document.querySelectorAll('[data-toggle="modal"]');
  
  modalTriggers.forEach(trigger => {
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      
      const modalId = trigger.getAttribute('data-target');
      const modal = document.querySelector(modalId);
      
      if (modal) {
        openModal(modal);
      }
    });
  });
  
  // Modal close buttons
  const closeButtons = document.querySelectorAll('[data-dismiss="modal"]');
  
  closeButtons.forEach(button => {
    button.addEventListener('click', () => {
      const modal = button.closest('.modal');
      if (modal) {
        closeModal(modal);
      }
    });
  });
  
  // Close modal when clicking overlay
  const modals = document.querySelectorAll('.modal');
  
  modals.forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal(modal);
      }
    });
    
    // Handle escape key
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeModal(modal);
      }
    });
  });
}

/**
 * Open a modal dialog
 * @param {HTMLElement} modal - The modal element to open
 */
function openModal(modal) {
  // Store focus to restore later
  modal._previouslyFocused = document.activeElement;
  
  // Show modal and backdrop
  modal.classList.add('show');
  document.body.classList.add('modal-open');
  
  // Prevent body scrolling
  document.body.style.overflow = 'hidden';
  
  // Set focus on first focusable element
  const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (focusable.length > 0) {
    focusable[0].focus();
  }
  
  // Trap focus inside modal
  modal._handleTabKey = (e) => {
    if (e.key === 'Tab') {
      const focusableElements = Array.from(modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'));
      
      if (focusableElements.length === 0) return;
      
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  };
  
  document.addEventListener('keydown', modal._handleTabKey);
}

/**
 * Close a modal dialog
 * @param {HTMLElement} modal - The modal element to close
 */
function closeModal(modal) {
  // Hide modal
  modal.classList.remove('show');
  
  // Check if there are other open modals before removing body classes
  const otherModals = document.querySelectorAll('.modal.show');
  if (otherModals.length === 0) {
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
  }
  
  // Remove keyboard trap
  document.removeEventListener('keydown', modal._handleTabKey);
  
  // Restore focus
  if (modal._previouslyFocused && modal._previouslyFocused.focus) {
    modal._previouslyFocused.focus();
  }
}

/**
 * Initialize tooltips
 */
function initializeTooltips() {
  const tooltipTriggers = document.querySelectorAll('[data-tooltip]');
  
  tooltipTriggers.forEach(trigger => {
    // Create tooltip element
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.textContent = trigger.getAttribute('data-tooltip');
    tooltip.style.display = 'none';
    document.body.appendChild(tooltip);
    
    // Store reference to tooltip
    trigger._tooltip = tooltip;
    
    // Show tooltip on hover/focus
    const showTooltip = () => {
      const rect = trigger.getBoundingClientRect();
      tooltip.style.display = 'block';
      
      // Position tooltip
      const tooltipRect = tooltip.getBoundingClientRect();
      tooltip.style.top = `${rect.top - tooltipRect.height - 8 + window.scrollY}px`;
      tooltip.style.left = `${rect.left + rect.width / 2 - tooltipRect.width / 2 + window.scrollX}px`;
    };
    
    // Hide tooltip
    const hideTooltip = () => {
      tooltip.style.display = 'none';
    };
    
    // Add event listeners
    trigger.addEventListener('mouseenter', showTooltip);
    trigger.addEventListener('mouseleave', hideTooltip);
    trigger.addEventListener('focus', showTooltip);
    trigger.addEventListener('blur', hideTooltip);
  });
}

/**
 * Initialize alert dismiss buttons
 */
function initializeAlertDismiss() {
  const alertCloseButtons = document.querySelectorAll('.alert-close');
  
  alertCloseButtons.forEach(button => {
    button.addEventListener('click', () => {
      const alert = button.closest('.alert');
      
      if (alert) {
        // Add animate-out class for animation
        alert.classList.add('alert-animate-out');
        
        // Remove after animation completes
        setTimeout(() => {
          alert.remove();
        }, 300);
      }
    });
  });
}
