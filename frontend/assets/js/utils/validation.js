/**
 * Form validation utility functions
 * Provides validation for common form fields and a form validation system
 */

const validation = {
  /**
   * Validates an email address
   * @param {string} email - The email to validate
   * @returns {boolean} - Whether the email is valid
   */
  validateEmail(email) {
    // More strict email validation that catches double dots
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email) && !email.includes('..');
  },
  
  /**
   * Validates a password
   * @param {string} password - The password to validate
   * @returns {boolean} - Whether the password is valid
   */
  validatePassword(password) {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
    const re = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    return re.test(password);
  },
  
  /**
   * Validates a Mexican phone number
   * @param {string} phone - The phone number to validate
   * @returns {boolean} - Whether the phone number is valid
   */
  validatePhone(phone) {
    // Mexican phone number format (10 digits)
    const re = /^\d{10}$/;
    return re.test(phone);
  },
  
  /**
   * Validates a Mexican license plate
   * @param {string} plate - The license plate to validate
   * @returns {boolean} - Whether the license plate is valid
   */
  validateLicensePlate(plate) {
    // Mexican license plate format (3 letters followed by 3 numbers, or 2-3 letters followed by 4 numbers)
    const re = /^[A-Z]{3}\d{3}$|^[A-Z]{2,3}\d{4}$/;
    return re.test(plate);
  },
  
  /**
   * Validates a Vehicle Identification Number (VIN)
   * @param {string} vin - The VIN to validate
   * @returns {boolean} - Whether the VIN is valid
   */
  validateVIN(vin) {
    // VIN format (17 alphanumeric characters, excluding I, O, Q)
    const re = /^[A-HJ-NPR-Z0-9]{17}$/;
    return re.test(vin);
  },
  
  /**
   * Validates a year
   * @param {string|number} year - The year to validate
   * @returns {boolean} - Whether the year is valid
   */
  validateYear(year) {
    // Year between 1990 and current year + 1
    const currentYear = new Date().getFullYear();
    const yearNum = parseInt(year, 10);
    return !isNaN(yearNum) && yearNum >= 1990 && yearNum <= currentYear + 1;
  },
  
  /**
   * Validates that a value is not empty
   * @param {*} value - The value to validate
   * @returns {boolean} - Whether the value is not empty
   */
  validateRequired(value) {
    return value !== null && value !== undefined && value.toString().trim() !== '';
  },
  
  /**
   * Validates that a value has at least a minimum length
   * @param {string} value - The value to validate
   * @param {number} minLength - The minimum length
   * @returns {boolean} - Whether the value has at least the minimum length
   */
  validateMinLength(value, minLength) {
    return value !== undefined && value !== null && value.length >= minLength;
  },
  
  /**
   * Validates that a value has at most a maximum length
   * @param {string} value - The value to validate
   * @param {number} maxLength - The maximum length
   * @returns {boolean} - Whether the value has at most the maximum length
   */
  validateMaxLength(value, maxLength) {
    return value && value.length <= maxLength;
  },
  
  /**
   * Validates a form against a set of validation rules
   * @param {Object} formData - The form data to validate
   * @param {Object} validationRules - The validation rules to apply
   * @returns {Object} - The validation result with isValid and errors properties
   */
  validateForm(formData, validationRules) {
    const errors = {};
    
    for (const field in validationRules) {
      const rules = validationRules[field];
      const value = formData[field];
      
      // Check each rule for the field
      for (const rule of rules) {
        let isValid = true;
        let message = '';
        
        switch (rule.type) {
          case 'required':
            isValid = this.validateRequired(value);
            message = 'Este campo es obligatorio';
            break;
          case 'email':
            isValid = !value || this.validateEmail(value);
            message = 'Correo electrónico inválido';
            break;
          case 'password':
            isValid = !value || this.validatePassword(value);
            message = 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número';
            break;
          case 'phone':
            isValid = !value || this.validatePhone(value);
            message = 'Número de teléfono inválido (debe tener 10 dígitos)';
            break;
          case 'licensePlate':
            isValid = !value || this.validateLicensePlate(value);
            message = 'Placa inválida';
            break;
          case 'vin':
            isValid = !value || this.validateVIN(value);
            message = 'VIN inválido (debe tener 17 caracteres alfanuméricos)';
            break;
          case 'year':
            isValid = !value || this.validateYear(value);
            message = 'Año inválido (debe estar entre 1990 y el año actual)';
            break;
          case 'minLength':
            isValid = !value || this.validateMinLength(value, rule.value);
            message = `Debe tener al menos ${rule.value} caracteres`;
            break;
          case 'maxLength':
            isValid = !value || this.validateMaxLength(value, rule.value);
            message = `Debe tener máximo ${rule.value} caracteres`;
            break;
          default:
            isValid = true;
        }
        
        if (!isValid) {
          errors[field] = rule.message || message;
          break; // Stop checking other rules for this field once an error is found
        }
      }
    }
    
    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  },
  
  /**
   * Displays validation errors on a form
   * @param {Object} errors - The validation errors
   * @param {string} formId - The ID of the form
   */
  displayValidationErrors(errors, formId) {
    // Clear previous errors
    const errorElements = document.querySelectorAll(`#${formId} .error-message`);
    errorElements.forEach(element => {
      element.textContent = '';
      element.hidden = true;
    });
    
    const inputElements = document.querySelectorAll(`#${formId} input, #${formId} textarea, #${formId} select`);
    inputElements.forEach(element => {
      element.classList.remove('is-invalid');
    });
    
    // Display new errors
    for (const field in errors) {
      const errorElement = document.getElementById(`${formId}-${field}-error`);
      const inputElement = document.getElementById(`${formId}-${field}`);
      
      if (errorElement) {
        errorElement.textContent = errors[field];
        errorElement.hidden = false;
      }
      
      if (inputElement) {
        inputElement.classList.add('is-invalid');
      }
    }
  },
  
  /**
   * Adds input event listeners to clear validation errors
   * @param {string} formId - The ID of the form
   */
  setupValidationErrorClearingOnInput(formId) {
    const inputElements = document.querySelectorAll(`#${formId} input, #${formId} textarea, #${formId} select`);
    
    inputElements.forEach(input => {
      input.addEventListener('input', () => {
        input.classList.remove('is-invalid');
        
        const fieldName = input.id.replace(`${formId}-`, '');
        const errorElement = document.getElementById(`${formId}-${fieldName}-error`);
        
        if (errorElement) {
          errorElement.textContent = '';
          errorElement.hidden = true;
        }
      });
    });
  }
};

// Export the validation object for use in other modules
window.validation = validation;
