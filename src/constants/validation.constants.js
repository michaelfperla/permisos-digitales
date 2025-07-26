/**
 * Validation Constants
 * Input validation rules and regex patterns
 */

/**
 * Regular expression patterns for validation
 */
const ValidationPatterns = Object.freeze({
  // Personal information
  NAME: /^[a-zA-ZÀ-ÿ\u00f1\u00d1\s'-]{2,50}$/,
  FULL_NAME: /^[a-zA-ZÀ-ÿ\u00f1\u00d1\s'-]{2,100}$/,
  EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  PHONE: /^(\+?52)?[\s-]?1?[\s-]?\d{2}[\s-]?\d{4}[\s-]?\d{4}$/,
  RFC: /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/,
  CURP: /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/,
  
  // Address
  STREET: /^[a-zA-Z0-9À-ÿ\u00f1\u00d1\s,.-]{3,100}$/,
  POSTAL_CODE: /^\d{5}$/,
  CITY: /^[a-zA-ZÀ-ÿ\u00f1\u00d1\s'-]{2,50}$/,
  STATE: /^[a-zA-ZÀ-ÿ\u00f1\u00d1\s'-]{2,50}$/,
  
  // Vehicle information
  LICENSE_PLATE: /^[A-Z0-9]{6,8}$/,
  VIN: /^[A-HJ-NPR-Z0-9]{17}$/,
  YEAR: /^(19|20)\d{2}$/,
  
  // Security
  PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
  PIN: /^\d{4,6}$/,
  
  // URLs and slugs
  URL: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)$/,
  SLUG: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
});

/**
 * Field length constraints
 */
const FieldLengths = Object.freeze({
  // Personal information
  NAME_MIN: 2,
  NAME_MAX: 50,
  EMAIL_MAX: 100,
  PHONE_MIN: 10,
  PHONE_MAX: 15,
  RFC_LENGTH: 13,
  CURP_LENGTH: 18,
  
  // Address
  STREET_MIN: 3,
  STREET_MAX: 100,
  POSTAL_CODE_LENGTH: 5,
  
  // Vehicle
  LICENSE_PLATE_MIN: 6,
  LICENSE_PLATE_MAX: 8,
  VIN_LENGTH: 17,
  MAKE_MAX: 50,
  MODEL_MAX: 50,
  
  // Security
  PASSWORD_MIN: 8,
  PASSWORD_MAX: 128,
  PIN_MIN: 4,
  PIN_MAX: 6,
  
  // General text
  DESCRIPTION_MAX: 500,
  NOTES_MAX: 1000,
});

/**
 * Error messages for validation failures
 */
const ValidationMessages = Object.freeze({
  REQUIRED: 'Este campo es requerido',
  INVALID_FORMAT: 'Formato inválido',
  
  // Personal information
  NAME_INVALID: 'El nombre debe contener solo letras, espacios y guiones',
  EMAIL_INVALID: 'Correo electrónico inválido',
  PHONE_INVALID: 'Número de teléfono inválido (10 dígitos)',
  RFC_INVALID: 'RFC inválido (formato: AAAA######XXX)',
  CURP_INVALID: 'CURP inválido (18 caracteres)',
  
  // Address
  POSTAL_CODE_INVALID: 'Código postal inválido (5 dígitos)',
  
  // Vehicle
  LICENSE_PLATE_INVALID: 'Placa inválida (6-8 caracteres alfanuméricos)',
  VIN_INVALID: 'VIN inválido (17 caracteres)',
  YEAR_INVALID: 'Año inválido',
  
  // Security
  PASSWORD_WEAK: 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial',
  PASSWORD_MISMATCH: 'Las contraseñas no coinciden',
  
  // Length
  TOO_SHORT: 'Demasiado corto',
  TOO_LONG: 'Demasiado largo',
  
  // Numbers
  MIN_VALUE: 'El valor debe ser mayor a {min}',
  MAX_VALUE: 'El valor debe ser menor a {max}',
});

/**
 * Mexican states for validation
 */
const MexicanStates = Object.freeze([
  'Aguascalientes',
  'Baja California',
  'Baja California Sur',
  'Campeche',
  'Chiapas',
  'Chihuahua',
  'Ciudad de México',
  'Coahuila',
  'Colima',
  'Durango',
  'Estado de México',
  'Guanajuato',
  'Guerrero',
  'Hidalgo',
  'Jalisco',
  'Michoacán',
  'Morelos',
  'Nayarit',
  'Nuevo León',
  'Oaxaca',
  'Puebla',
  'Querétaro',
  'Quintana Roo',
  'San Luis Potosí',
  'Sinaloa',
  'Sonora',
  'Tabasco',
  'Tamaulipas',
  'Tlaxcala',
  'Veracruz',
  'Yucatán',
  'Zacatecas',
]);

/**
 * Helper functions for validation
 */
const ValidationHelpers = {
  // Pattern validators
  isValidEmail: (email) => ValidationPatterns.EMAIL.test(email),
  isValidPhone: (phone) => ValidationPatterns.PHONE.test(phone.replace(/\s|-/g, '')),
  isValidRFC: (rfc) => ValidationPatterns.RFC.test(rfc.toUpperCase()),
  isValidCURP: (curp) => ValidationPatterns.CURP.test(curp.toUpperCase()),
  isValidPostalCode: (code) => ValidationPatterns.POSTAL_CODE.test(code),
  isValidLicensePlate: (plate) => ValidationPatterns.LICENSE_PLATE.test(plate.toUpperCase().replace(/\s|-/g, '')),
  isValidVIN: (vin) => ValidationPatterns.VIN.test(vin.toUpperCase()),
  isValidPassword: (password) => ValidationPatterns.PASSWORD.test(password),
  
  // Length validators
  isWithinLength: (value, min, max) => value.length >= min && value.length <= max,
  
  // Formatters
  formatPhone: (phone) => {
    const cleaned = phone.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{2})(\d{4})(\d{4})$/);
    if (match) {
      return `${match[1]} ${match[2]} ${match[3]}`;
    }
    return phone;
  },
  
  formatRFC: (rfc) => rfc.toUpperCase(),
  formatCURP: (curp) => curp.toUpperCase(),
  formatLicensePlate: (plate) => plate.toUpperCase().replace(/\s|-/g, ''),
  
  // State validator
  isValidState: (state) => MexicanStates.includes(state),
  
  // Age validators
  calculateAge: (birthDate) => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  },
  
  isAdult: (birthDate) => ValidationHelpers.calculateAge(birthDate) >= 18,
};

module.exports = {
  ValidationPatterns,
  FieldLengths,
  ValidationMessages,
  MexicanStates,
  ValidationHelpers,
};