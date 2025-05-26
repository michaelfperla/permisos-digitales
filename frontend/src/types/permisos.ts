/**
 * Central type definitions for the Permisos Digitales application
 * Based on the API analysis document
 */

/**
 * Permit status values from backend
 */
export enum PermitStatus {
  AWAITING_PAYMENT = 'AWAITING_PAYMENT',
  AWAITING_OXXO_PAYMENT = 'AWAITING_OXXO_PAYMENT',
  PAYMENT_PROCESSING = 'PAYMENT_PROCESSING',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  GENERATING_PERMIT = 'GENERATING_PERMIT',
  ERROR_GENERATING_PERMIT = 'ERROR_GENERATING_PERMIT',
  PERMIT_READY = 'PERMIT_READY',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
  RENEWAL_PENDING = 'RENEWAL_PENDING',
  RENEWAL_APPROVED = 'RENEWAL_APPROVED',
  RENEWAL_REJECTED = 'RENEWAL_REJECTED',
}

/**
 * Interface for a permit list item as returned by the API
 */
export interface PermitListItem {
  id: string;
  user_id: string;
  status: PermitStatus;
  created_at: string;
  updated_at: string;

  // Applicant Data
  nombre_completo: string;
  curp_rfc: string;
  domicilio: string;

  // Vehicle Data
  marca: string;
  linea: string;
  color: string;
  numero_serie: string;
  numero_motor: string;
  ano_modelo: string | number;

  // Permit Data
  folio?: string;
  importe?: number;
  fecha_expedicion?: string;
  fecha_vencimiento?: string;

  // Payment Data
  payment_reference?: string;
  payment_processor_order_id?: string;

  // Document Paths
  permit_file_path?: string;
  recibo_file_path?: string;
  certificado_file_path?: string;
  placas_file_path?: string;
}

/**
 * Interface for expiring permit information
 */
export interface ExpiringPermitInfo {
  id: string;
  status: PermitStatus;
  marca: string;
  linea: string;
  ano_modelo: string | number;
  fecha_expedicion?: string;
  fecha_vencimiento?: string;
  days_remaining: number;
}

/**
 * Interface for user profile information
 */
export interface UserProfile {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  account_type: string;
  created_at: string;
  updated_at: string;
}

/**
 * Interface for API response containing user profile
 */
export interface UserProfileResponse {
  success: boolean;
  data: {
    user: UserProfile;
  };
}

/**
 * Interface for API response containing permit list
 */
export interface PermitsResponse {
  success: boolean;
  applications: PermitListItem[];
  expiringPermits: ExpiringPermitInfo[];
}

/**
 * Interface for call-to-action props
 */
export interface CtaProps {
  text: string;
  link: string;
  icon?: string;
}

/**
 * Interface for focus item props (deprecated - kept for reference)
 * @deprecated This interface was used by the removed TodaysFocus component
 */
export interface FocusItemProps {
  type: 'critical_action' | 'warning_action' | 'info_action' | 'all_clear';
  title: string;
  message: string;
  cta?: CtaProps;
  iconName?: string;
}

/**
 * Interface for permit card props (deprecated - kept for reference)
 * @deprecated This interface was used by the removed PermitsOverview component
 */
export interface PermitCardProps {
  id: string;
  vehicleIdentifier: string; // e.g., "Toyota Camry - ABC123"
  permitType: string; // e.g., "Residencial Anual"
  statusText: string; // e.g., "Activo", "Expira en 15 días"
  statusType: 'active' | 'expiring_soon' | 'needs_attention' | 'archived'; // For styling card
  expirationDate: string; // e.g., "Expira: 31 Dic, 2025"
  primaryCta: CtaProps;
  secondaryCta?: CtaProps; // Optional

  // Additional vehicle details
  vehicleMake: string;
  vehicleModel: string;
  vehicleColor: string;
  vehicleYear: string | number;
  vehicleSerialNumber: string;

  // Permit details
  folioNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  amount?: number;

  // Payment details
  paymentReference?: string;
  paymentStatus?: string;

  // Document paths
  permitDocumentPath?: string;
  receiptDocumentPath?: string;
  certificateDocumentPath?: string;
  licensePlatesDocumentPath?: string;

  // Raw status for specific handling
  rawStatus: string;
}

/**
 * Interface for document information
 */
export interface DocumentInfo {
  type: 'permiso' | 'recibo' | 'certificado' | 'placas';
  displayName: string;
  path?: string;
  icon: string;
}
