/**
 * Types related to permit applications
 */

/**
 * Interface for raw application form data as entered in the UI forms
 * This represents the data as it exists in form inputs before final validation
 */
export interface ApplicationFormRawData {
  // Applicant Information
  nombre_completo: string;
  curp_rfc: string;
  domicilio: string;

  // Vehicle Information
  marca: string;
  linea: string;
  color: string;
  numero_serie: string;
  numero_motor: string;
  ano_modelo: string | number; // Can be string in form inputs

  // Renewal Information (optional, only used in renewal forms)
  renewal_reason?: string;
  renewal_notes?: string;

  // Other optional fields that might be present
  parent_application_id?: string; // For renewals
  payment_reference?: string; // For payment uploads
  payment_token?: string; // Payment token for card payments
  payment_method?: string; // Payment method ('card', 'oxxo')
  device_session_id?: string; // Device fingerprint for fraud prevention
}

/**
 * Interface for validated application form data
 * Used in service calls to the API - ano_modelo must be a number
 */
export interface ApplicationFormData extends Omit<ApplicationFormRawData, 'ano_modelo'> {
  ano_modelo: number; // Must be a number when sent to API
  payment_token?: string; // Payment token for card payments
  payment_method?: string; // Payment method ('card' or 'oxxo')
  device_session_id?: string; // Device fingerprint for fraud prevention
  email?: string; // User email for notifications
}

/**
 * Interface for renewal form data
 * Subset of ApplicationFormData used specifically for renewals
 */
export interface RenewalFormData {
  domicilio: string;
  color: string;
  renewal_reason: string;
  renewal_notes: string;
}
