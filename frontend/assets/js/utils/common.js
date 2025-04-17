/**
 * Common utility functions for the frontend
 */

const utils = {
  /**
   * Format a date string to a localized date
   * @param {string} dateString - The date string to format
   * @param {Object} options - The formatting options
   * @returns {string} The formatted date
   */
  formatDate(dateString, options = {}) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const defaultOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    
    return date.toLocaleDateString('es-MX', { ...defaultOptions, ...options });
  },
  
  /**
   * Format a date string to a localized date and time
   * @param {string} dateString - The date string to format
   * @param {Object} options - The formatting options
   * @returns {string} The formatted date and time
   */
  formatDateTime(dateString, options = {}) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const defaultOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    
    return date.toLocaleDateString('es-MX', { ...defaultOptions, ...options });
  },
  
  /**
   * Format a number as currency
   * @param {number} amount - The amount to format
   * @param {string} currency - The currency code
   * @returns {string} The formatted currency
   */
  formatCurrency(amount, currency = 'MXN') {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency
    }).format(amount);
  },
  
  /**
   * Get the CSS class for a permit status
   * @param {string} status - The permit status
   * @returns {string} The CSS class
   */
  getStatusClass(status) {
    const statusMap = {
      'PENDING_PAYMENT': 'status-warning',
      'PAYMENT_VERIFICATION': 'status-info',
      'PERMIT_READY': 'status-success',
      'REJECTED': 'status-danger',
      'EXPIRED': 'status-danger'
    };
    
    return statusMap[status] || 'status-default';
  },
  
  /**
   * Get the display text for a permit status
   * @param {string} status - The permit status
   * @returns {string} The display text
   */
  getStatusText(status) {
    const statusMap = {
      'PENDING_PAYMENT': 'Pago Pendiente',
      'PAYMENT_VERIFICATION': 'Verificando Pago',
      'PERMIT_READY': 'Permiso Listo',
      'REJECTED': 'Rechazado',
      'EXPIRED': 'Expirado'
    };
    
    return statusMap[status] || status;
  },
  
  /**
   * Show a loading indicator
   * @param {HTMLElement} container - The container element
   * @param {boolean} isLoading - Whether to show or hide the loading indicator
   */
  setLoading(container, isLoading) {
    if (!container) return;
    
    // Find loading elements
    const loadingIndicator = container.querySelector('.loading-indicator');
    const submitButton = container.querySelector('button[type="submit"]');
    const buttonText = submitButton ? submitButton.querySelector('.button-text') : null;
    const spinner = submitButton ? submitButton.querySelector('.spinner-border') : null;
    
    // Update loading state
    if (loadingIndicator) loadingIndicator.hidden = !isLoading;
    if (submitButton) submitButton.disabled = isLoading;
    if (buttonText) buttonText.hidden = isLoading;
    if (spinner) spinner.hidden = !isLoading;
  },
  
  /**
   * Show a message
   * @param {HTMLElement} container - The container element
   * @param {string} message - The message to show
   * @param {string} type - The message type (error, success, info, warning)
   */
  showMessage(container, message, type = 'error') {
    if (!container) return;
    
    // Find message element
    const messageElement = container.querySelector('.message-area');
    if (!messageElement) return;
    
    // Update message
    messageElement.textContent = message;
    messageElement.className = `message-area ${type}`;
    messageElement.hidden = false;
  },
  
  /**
   * Hide a message
   * @param {HTMLElement} container - The container element
   */
  hideMessage(container) {
    if (!container) return;
    
    // Find message element
    const messageElement = container.querySelector('.message-area');
    if (!messageElement) return;
    
    // Hide message
    messageElement.hidden = true;
  },
  
  /**
   * Get form data as an object
   * @param {HTMLFormElement} form - The form element
   * @returns {Object} The form data
   */
  getFormData(form) {
    if (!form) return {};
    
    const formData = new FormData(form);
    const data = {};
    
    for (const [key, value] of formData.entries()) {
      data[key] = value;
    }
    
    return data;
  },
  
  /**
   * Set form data from an object
   * @param {HTMLFormElement} form - The form element
   * @param {Object} data - The data to set
   */
  setFormData(form, data) {
    if (!form || !data) return;
    
    for (const key in data) {
      const input = form.elements[key];
      if (input) {
        input.value = data[key];
      }
    }
  },
  
  /**
   * Toggle password visibility
   * @param {HTMLInputElement} passwordInput - The password input element
   * @param {HTMLElement} toggleButton - The toggle button element
   */
  togglePasswordVisibility(passwordInput, toggleButton) {
    if (!passwordInput || !toggleButton) return;
    
    const type = passwordInput.type === 'password' ? 'text' : 'password';
    passwordInput.type = type;
    
    const icon = toggleButton.querySelector('i');
    if (icon) {
      icon.className = type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
    }
  },
  
  /**
   * Initialize a form wizard
   * @param {HTMLElement} container - The container element
   */
  initFormWizard(container) {
    if (!container) return;
    
    const wizardSteps = container.querySelectorAll('.wizard-step');
    const wizardContents = container.querySelectorAll('.wizard-content');
    const nextButtons = container.querySelectorAll('.btn-next');
    const prevButtons = container.querySelectorAll('.btn-prev');
    
    // Function to validate a step
    function validateStep(stepNumber) {
      const stepContent = container.querySelector(`.wizard-content[data-step="${stepNumber}"]`);
      if (!stepContent) return true;
      
      const requiredInputs = stepContent.querySelectorAll('input[required], textarea[required], select[required]');
      let isValid = true;
      
      requiredInputs.forEach(input => {
        if (!input.value.trim()) {
          isValid = false;
          input.classList.add('is-invalid');
          
          const errorSpan = document.getElementById(`${input.id}-error`);
          if (errorSpan) {
            errorSpan.textContent = 'Este campo es obligatorio';
            errorSpan.hidden = false;
          }
        }
      });
      
      return isValid;
    }
    
    // Function to go to a specific step
    function goToStep(stepNumber) {
      // Update step indicators
      wizardSteps.forEach(step => {
        const stepNum = parseInt(step.getAttribute('data-step'));
        step.classList.remove('active', 'completed');
        
        if (stepNum === stepNumber) {
          step.classList.add('active');
        } else if (stepNum < stepNumber) {
          step.classList.add('completed');
        }
      });
      
      // Update content visibility
      wizardContents.forEach(content => {
        const contentStep = parseInt(content.getAttribute('data-step'));
        content.classList.remove('active');
        
        if (contentStep === stepNumber) {
          content.classList.add('active');
        }
      });
      
      // If going to review step, populate review data
      if (stepNumber === 3) {
        populateReviewData();
      }
    }
    
    // Function to populate review data
    function populateReviewData() {
      // Get all review fields
      const reviewFields = container.querySelectorAll('[id^="review-"]');
      
      reviewFields.forEach(field => {
        const fieldName = field.id.replace('review-', '');
        const input = container.querySelector(`[name="${fieldName}"]`);
        
        if (input) {
          const value = input.value.trim();
          field.textContent = value || '-';
        }
      });
    }
    
    // Next button click handler
    nextButtons.forEach(button => {
      button.addEventListener('click', () => {
        const currentStep = parseInt(button.closest('.wizard-content').getAttribute('data-step'));
        const nextStep = parseInt(button.getAttribute('data-next'));
        
        if (validateStep(currentStep)) {
          goToStep(nextStep);
        }
      });
    });
    
    // Previous button click handler
    prevButtons.forEach(button => {
      button.addEventListener('click', () => {
        const prevStep = parseInt(button.getAttribute('data-prev'));
        goToStep(prevStep);
      });
    });
    
    // Add input event listeners to clear validation errors
    const allInputs = container.querySelectorAll('.form-wizard input, .form-wizard textarea, .form-wizard select');
    allInputs.forEach(input => {
      input.addEventListener('input', () => {
        input.classList.remove('is-invalid');
        const errorSpan = document.getElementById(`${input.id}-error`);
        if (errorSpan) {
          errorSpan.hidden = true;
          errorSpan.textContent = '';
        }
      });
    });
  },
  
  /**
   * Initialize a file upload field
   * @param {HTMLElement} container - The container element
   * @param {string} inputId - The ID of the file input element
   */
  initFileUpload(container, inputId) {
    if (!container) return;
    
    const fileInput = document.getElementById(inputId);
    if (!fileInput) return;
    
    const fileContainer = fileInput.closest('.file-upload-container');
    if (!fileContainer) return;
    
    const placeholder = fileContainer.querySelector('.file-upload-placeholder');
    const nameDisplay = fileContainer.querySelector('.file-name-display');
    const removeButton = fileContainer.querySelector('.file-remove');
    
    // Click on container to trigger file input
    if (placeholder) {
      placeholder.addEventListener('click', () => {
        fileInput.click();
      });
    }
    
    // Update file name display when file is selected
    fileInput.addEventListener('change', () => {
      if (fileInput.files.length > 0) {
        const fileName = fileInput.files[0].name;
        
        if (nameDisplay) {
          nameDisplay.textContent = fileName;
          nameDisplay.hidden = false;
        }
        
        if (placeholder) {
          placeholder.hidden = true;
        }
        
        if (removeButton) {
          removeButton.hidden = false;
        }
      } else {
        if (nameDisplay) {
          nameDisplay.textContent = '';
          nameDisplay.hidden = true;
        }
        
        if (placeholder) {
          placeholder.hidden = false;
        }
        
        if (removeButton) {
          removeButton.hidden = true;
        }
      }
    });
    
    // Remove file when remove button is clicked
    if (removeButton) {
      removeButton.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // Clear file input
        fileInput.value = '';
        
        // Trigger change event
        fileInput.dispatchEvent(new Event('change'));
      });
    }
  }
};

// Export the utils object for use in other modules
window.utils = utils;
