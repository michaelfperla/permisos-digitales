/**
 * Application Constants
 * TypeScript version for frontend
 */

export enum ApplicationStatus {
  // Payment states
  AWAITING_PAYMENT = 'AWAITING_PAYMENT',
  AWAITING_OXXO_PAYMENT = 'AWAITING_OXXO_PAYMENT',
  PAYMENT_PROCESSING = 'PAYMENT_PROCESSING',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',

  // Permit generation states
  GENERATING_PERMIT = 'GENERATING_PERMIT',
  ERROR_GENERATING_PERMIT = 'ERROR_GENERATING_PERMIT',
  PERMIT_READY = 'PERMIT_READY',

  // Final states
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
  VENCIDO = 'VENCIDO', // Permit expired after 30 days

  // Renewal states
  RENEWAL_PENDING = 'RENEWAL_PENDING',
  RENEWAL_APPROVED = 'RENEWAL_APPROVED',
  RENEWAL_REJECTED = 'RENEWAL_REJECTED',
}

export const ApplicationStatusGroups: Record<string, ApplicationStatus[]> = {
  PAYMENT_STATES: [
    ApplicationStatus.AWAITING_PAYMENT,
    ApplicationStatus.AWAITING_OXXO_PAYMENT,
    ApplicationStatus.PAYMENT_PROCESSING,
    ApplicationStatus.PAYMENT_FAILED,
    ApplicationStatus.PAYMENT_RECEIVED,
  ],
  
  PROCESSING_STATES: [
    ApplicationStatus.GENERATING_PERMIT,
    ApplicationStatus.ERROR_GENERATING_PERMIT,
  ],
  
  FINAL_STATES: [
    ApplicationStatus.PERMIT_READY,
    ApplicationStatus.COMPLETED,
    ApplicationStatus.CANCELLED,
    ApplicationStatus.EXPIRED,
    ApplicationStatus.VENCIDO,
  ],
  
  RENEWAL_STATES: [
    ApplicationStatus.RENEWAL_PENDING,
    ApplicationStatus.RENEWAL_APPROVED,
    ApplicationStatus.RENEWAL_REJECTED,
  ],
  
  SUCCESS_STATES: [
    ApplicationStatus.PERMIT_READY,
    ApplicationStatus.COMPLETED,
    ApplicationStatus.RENEWAL_APPROVED,
  ],
  
  ERROR_STATES: [
    ApplicationStatus.PAYMENT_FAILED,
    ApplicationStatus.ERROR_GENERATING_PERMIT,
    ApplicationStatus.CANCELLED,
    ApplicationStatus.EXPIRED,
    ApplicationStatus.VENCIDO,
    ApplicationStatus.RENEWAL_REJECTED,
  ],
};

export enum ApplicationType {
  NEW = 'NEW',
  RENEWAL = 'RENEWAL',
  REPLACEMENT = 'REPLACEMENT',
}

// Helper functions with proper TypeScript typing
export const ApplicationHelpers = {
  isPaymentState: (status: ApplicationStatus): boolean => 
    ApplicationStatusGroups.PAYMENT_STATES.includes(status),
    
  isProcessingState: (status: ApplicationStatus): boolean => 
    ApplicationStatusGroups.PROCESSING_STATES.includes(status),
    
  isFinalState: (status: ApplicationStatus): boolean => 
    ApplicationStatusGroups.FINAL_STATES.includes(status),
    
  isRenewalState: (status: ApplicationStatus): boolean => 
    ApplicationStatusGroups.RENEWAL_STATES.includes(status),
    
  isSuccessState: (status: ApplicationStatus): boolean => 
    ApplicationStatusGroups.SUCCESS_STATES.includes(status),
    
  isErrorState: (status: ApplicationStatus): boolean => 
    ApplicationStatusGroups.ERROR_STATES.includes(status),
  
  canRetryPayment: (status: ApplicationStatus): boolean => 
    status === ApplicationStatus.PAYMENT_FAILED,
    
  canCancelApplication: (status: ApplicationStatus): boolean => 
    !ApplicationStatusGroups.FINAL_STATES.includes(status),
    
  canRenew: (status: ApplicationStatus): boolean => 
    status === ApplicationStatus.COMPLETED || status === ApplicationStatus.EXPIRED || status === ApplicationStatus.VENCIDO,
};

// Error categories for failed permit generation
export enum PermitErrorCategory {
  TIMEOUT = 'TIMEOUT',
  AUTH_FAILURE = 'AUTH_FAILURE',
  PORTAL_CHANGED = 'PORTAL_CHANGED',
  UNKNOWN = 'UNKNOWN',
}

// Error severity levels
export enum PermitErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

// Status display configuration
export const ApplicationStatusDisplay: Record<ApplicationStatus, { label: string; color: string; icon?: string }> = {
  [ApplicationStatus.AWAITING_PAYMENT]: { 
    label: 'Esperando Pago', 
    color: 'warning',
    icon: 'clock'
  },
  [ApplicationStatus.AWAITING_OXXO_PAYMENT]: { 
    label: 'Esperando Pago OXXO', 
    color: 'warning',
    icon: 'store'
  },
  [ApplicationStatus.PAYMENT_PROCESSING]: { 
    label: 'Procesando Pago', 
    color: 'info',
    icon: 'refresh'
  },
  [ApplicationStatus.PAYMENT_FAILED]: { 
    label: 'Pago Fallido', 
    color: 'error',
    icon: 'x-circle'
  },
  [ApplicationStatus.PAYMENT_RECEIVED]: { 
    label: 'Pago Recibido', 
    color: 'success',
    icon: 'check-circle'
  },
  [ApplicationStatus.GENERATING_PERMIT]: { 
    label: 'Generando Permiso', 
    color: 'info',
    icon: 'loader'
  },
  [ApplicationStatus.ERROR_GENERATING_PERMIT]: { 
    label: 'Error al Generar', 
    color: 'error',
    icon: 'alert-triangle'
  },
  [ApplicationStatus.PERMIT_READY]: { 
    label: 'Permiso Listo', 
    color: 'success',
    icon: 'file-check'
  },
  [ApplicationStatus.COMPLETED]: { 
    label: 'Completado', 
    color: 'success',
    icon: 'check-circle'
  },
  [ApplicationStatus.CANCELLED]: { 
    label: 'Cancelado', 
    color: 'neutral',
    icon: 'x-circle'
  },
  [ApplicationStatus.EXPIRED]: { 
    label: 'Expirado', 
    color: 'error',
    icon: 'calendar-x'
  },
  [ApplicationStatus.RENEWAL_PENDING]: { 
    label: 'Renovación Pendiente', 
    color: 'warning',
    icon: 'refresh'
  },
  [ApplicationStatus.RENEWAL_APPROVED]: { 
    label: 'Renovación Aprobada', 
    color: 'success',
    icon: 'check-circle'
  },
  [ApplicationStatus.RENEWAL_REJECTED]: { 
    label: 'Renovación Rechazada', 
    color: 'error',
    icon: 'x-circle'
  },
  [ApplicationStatus.VENCIDO]: { 
    label: 'Vencido', 
    color: 'error',
    icon: 'calendar-x'
  },
};