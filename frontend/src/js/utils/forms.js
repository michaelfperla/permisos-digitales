/**
 * Form utilities
 * Handles form validation, submission, and error handling
 */

/**
 * Initialize form handling across the site
 */
export function setupForms() {
  // Find and process all forms
  const forms = document.querySelectorAll('form[data-validate]');
  
  forms.forEach(form => {
    initFormValidation(form);
  });
  
  console.log(`[Forms] Initialized validation for ${forms.length} forms`);
}

/**
 * Set up validation for a specific form
 * @param {HTMLFormElement} form - The form to initialize
 */
function initFormValidation(form) {
  // Add submit handler
  form.addEventListener('submit', handleFormSubmit);
  
  // Add validation handlers to inputs
  const inputs = form.querySelectorAll('input, select, textarea');
  
  inputs.forEach(input => {
    // Skip submit buttons and hidden fields
    if (input.type === 'submit' || input.type === 'hidden') {
      return;
    }
    
    // Add blur (unfocus) validation
    input.addEventListener('blur', () => {
      validateInput(input);
    });
    
    // For select elements, also validate on change
    if (input.tagName === 'SELECT') {
      input.addEventListener('change', () => {
        validateInput(input);
      });
    }
  });
}

/**
 * Handle form submission
 * @param {Event} event - The form submit event
 */
async function handleFormSubmit(event) {
  const form = event.target;
  
  // Validate all inputs before submission
  const inputs = form.querySelectorAll('input, select, textarea');
  let isValid = true;
  
  inputs.forEach(input => {
    // Skip hidden fields
    if (input.type === 'hidden') {
      return;
    }
    
    const inputValid = validateInput(input);
    if (!inputValid) {
      isValid = false;
    }
  });
  
  // If validation fails, prevent submission
  if (!isValid) {
    event.preventDefault();
    return;
  }
  
  // Check if form should be submitted via AJAX
  if (form.dataset.ajax === 'true') {
    event.preventDefault();
    await submitFormAjax(form);
  }
}

/**
 * Validate a single input field
 * @param {HTMLElement} input - The input to validate
 * @returns {boolean} - Whether the input is valid
 */
function validateInput(input) {
  // Get the validation type
  const validationType = input.dataset.validate;
  
  if (!validationType) {
    return true; // No validation needed
  }
  
  const value = input.value.trim();
  let isValid = true;
  let errorMessage = '';
  
  // Check if field is required
  if (input.required && value === '') {
    isValid = false;
    errorMessage = 'Este campo es obligatorio';
  }
  // Skip other validations if empty and not required
  else if (value === '' && !input.required) {
    isValid = true;
  }
  // Run specific validations based on type
  else {
    switch (validationType) {
      case 'email':
        isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        errorMessage = 'Ingrese un correo electrónico válido';
        break;
      
      case 'password':
        isValid = value.length >= 8;
        errorMessage = 'La contraseña debe tener al menos 8 caracteres';
        break;
      
      case 'phone':
        isValid = /^\+?[0-9\s\-\(\)]{8,}$/.test(value);
        errorMessage = 'Ingrese un número de teléfono válido';
        break;
      
      case 'number':
        isValid = !isNaN(value) && value !== '';
        errorMessage = 'Ingrese un número válido';
        break;
        
      case 'date':
        isValid = isValidDate(value);
        errorMessage = 'Ingrese una fecha válida';
        break;
        
      // Add more validation types as needed
    }
  }
  
  // Update the UI based on validation result
  updateInputValidationUI(input, isValid, errorMessage);
  
  return isValid;
}

/**
 * Update the input UI based on validation result
 * @param {HTMLElement} input - The input being validated
 * @param {boolean} isValid - Whether the input is valid
 * @param {string} errorMessage - The error message to display
 */
function updateInputValidationUI(input, isValid, errorMessage) {
  // Find or create the feedback element
  let feedbackElement = input.nextElementSibling;
  
  if (!feedbackElement || !feedbackElement.classList.contains('invalid-feedback')) {
    feedbackElement = document.createElement('div');
    feedbackElement.className = 'invalid-feedback';
    input.parentNode.insertBefore(feedbackElement, input.nextSibling);
  }
  
  // Update classes and feedback text
  if (isValid) {
    input.classList.remove('is-invalid');
    input.classList.add('is-valid');
    feedbackElement.textContent = '';
  } else {
    input.classList.remove('is-valid');
    input.classList.add('is-invalid');
    feedbackElement.textContent = errorMessage;
  }
}

/**
 * Submit a form via AJAX
 * @param {HTMLFormElement} form - The form to submit
 */
async function submitFormAjax(form) {
  // Get the form data
  const formData = new FormData(form);
  
  // Disable form during submission
  const submitButton = form.querySelector('[type="submit"]');
  const originalButtonText = submitButton.textContent;
  setFormSubmitting(form, true);
  
  try {
    // Get the submission endpoint
    const endpoint = form.action;
    const method = form.method.toUpperCase() || 'POST';
    
    // Prepare the request options
    const options = {
      method,
      headers: {
        'Accept': 'application/json'
      },
      credentials: 'same-origin'
    };
    
    // Handle different request types
    if (method === 'GET') {
      // For GET requests, convert form data to query parameters
      const params = new URLSearchParams(formData).toString();
      const url = `${endpoint}?${params}`;
      options.body = null;
    } else {
      // For POST/PUT/DELETE/etc., send as JSON if specified
      if (form.dataset.ajaxJson === 'true') {
        options.headers['Content-Type'] = 'application/json';
        const formObject = {};
        formData.forEach((value, key) => {
          formObject[key] = value;
        });
        options.body = JSON.stringify(formObject);
      } else {
        // Otherwise send as FormData
        options.body = formData;
      }
    }
    
    // Send the request
    const response = await fetch(endpoint, options);
    const result = await response.json();
    
    // Handle the response
    if (response.ok) {
      handleFormSuccess(form, result);
    } else {
      handleFormError(form, result);
    }
  } catch (error) {
    console.error('[Forms] Error submitting form:', error);
    handleFormError(form, { error: 'Error de conexión. Por favor, intente de nuevo.' });
  } finally {
    // Re-enable the form
    setFormSubmitting(form, false);
  }
}

/**
 * Set the form's submitting state
 * @param {HTMLFormElement} form - The form being submitted
 * @param {boolean} isSubmitting - Whether the form is submitting
 */
function setFormSubmitting(form, isSubmitting) {
  const submitButton = form.querySelector('[type="submit"]');
  const inputs = form.querySelectorAll('input, select, textarea');
  
  if (isSubmitting) {
    // Disable the form
    submitButton.setAttribute('disabled', true);
    submitButton.classList.add('btn-loading');
    
    inputs.forEach(input => {
      if (input !== submitButton) {
        input.setAttribute('readonly', true);
      }
    });
  } else {
    // Re-enable the form
    submitButton.removeAttribute('disabled');
    submitButton.classList.remove('btn-loading');
    
    inputs.forEach(input => {
      if (input !== submitButton) {
        input.removeAttribute('readonly');
      }
    });
  }
}

/**
 * Handle successful form submission
 * @param {HTMLFormElement} form - The form that was submitted
 * @param {Object} result - The result from the server
 */
function handleFormSuccess(form, result) {
  // Check for redirect instruction
  if (result.redirect) {
    if (result.redirect.startsWith('#')) {
      // Internal SPA navigation
      window.location.hash = result.redirect;
    } else {
      // External redirect
      window.location.href = result.redirect;
    }
    return;
  }
  
  // Check for success message
  if (result.message) {
    // Show success message
    const formResult = document.createElement('div');
    formResult.className = 'alert alert-success';
    formResult.innerHTML = `
      <div class="alert-content">
        <div class="alert-title">¡Éxito!</div>
        <p>${result.message}</p>
      </div>
    `;
    
    // Replace form with success message or insert before form
    if (form.dataset.ajaxReplace === 'true') {
      form.parentNode.replaceChild(formResult, form);
    } else {
      form.parentNode.insertBefore(formResult, form);
      form.reset(); // Reset the form inputs
    }
  }
  
  // Call custom success handler if defined
  if (window.formSuccessHandlers && window.formSuccessHandlers[form.id]) {
    window.formSuccessHandlers[form.id](result);
  }
}

/**
 * Handle form submission error
 * @param {HTMLFormElement} form - The form that was submitted
 * @param {Object} result - The error result from the server
 */
function handleFormError(form, result) {
  // Clear previous error messages
  const existingAlert = form.previousElementSibling;
  if (existingAlert && existingAlert.classList.contains('alert-danger')) {
    existingAlert.remove();
  }
  
  // Create error message container
  const errorAlert = document.createElement('div');
  errorAlert.className = 'alert alert-danger';
  
  // Handle different error formats
  if (result.error) {
    // Single error message
    errorAlert.innerHTML = `
      <div class="alert-content">
        <div class="alert-title">Error</div>
        <p>${result.error}</p>
      </div>
    `;
  } else if (result.errors) {
    // Multiple field-specific errors
    const errorList = Object.entries(result.errors).map(([field, message]) => {
      // Also highlight the specific field
      const inputField = form.querySelector(`[name="${field}"]`);
      if (inputField) {
        updateInputValidationUI(inputField, false, message);
      }
      
      return `<li>${message}</li>`;
    }).join('');
    
    errorAlert.innerHTML = `
      <div class="alert-content">
        <div class="alert-title">Errores de validación</div>
        <ul>${errorList}</ul>
      </div>
    `;
  } else {
    // Generic error
    errorAlert.innerHTML = `
      <div class="alert-content">
        <div class="alert-title">Error</div>
        <p>Ha ocurrido un error. Por favor, intente de nuevo más tarde.</p>
      </div>
    `;
  }
  
  // Insert error message before the form
  form.parentNode.insertBefore(errorAlert, form);
  
  // Scroll to the error message
  errorAlert.scrollIntoView({ behavior: 'smooth', block: 'center' });
  
  // Call custom error handler if defined
  if (window.formErrorHandlers && window.formErrorHandlers[form.id]) {
    window.formErrorHandlers[form.id](result);
  }
}

/**
 * Check if a date string is valid
 * @param {string} dateString - The date string to validate
 * @returns {boolean} - Whether the date is valid
 */
function isValidDate(dateString) {
  // Try to create a valid date from the string
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}
