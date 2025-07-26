/**
 * Central type definitions for the Permisos Digitales application
 * Based on the API analysis document
 */

/**
 * Permit status values from backend - matches src/constants/index.js
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
  id: number;
  user_id: number;
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
  certificado_file_path?: string;
  placas_file_path?: string;
}

/**
 * Interface for expiring permit information
 */
export interface ExpiringPermitInfo {
  id: number;
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
 * Interface for document information
 */
export interface DocumentInfo {
  type: 'permiso' | 'certificado' | 'placas';
  displayName: string;
  path?: string;
  icon: string;
}

/**
 * Interface for permit card props
 */
export interface PermitCardProps {
  id: number;
  vehicleInfo: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: number | string;
  statusType: 'active' | 'expiring_soon' | 'needs_attention' | 'archived';
  statusText: string;
  creationDate: string;
  expirationDate?: string;
  primaryCta: {
    text: string;
    link: string;
    icon: string;
  };
  secondaryCta?: {
    text: string;
    link: string;
    icon: string;
  } | null;
  permitDocumentPath?: string;
  receiptDocumentPath?: string;
  certificateDocumentPath?: string;
  licensePlatesDocumentPath?: string;
  rawStatus: string;
}
