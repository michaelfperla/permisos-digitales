/**
 * Frontend Business Day Permit Expiration Utilities
 * Handles permit expiration calculation and display in Mexico timezone
 */

const MEXICO_TIMEZONE = 'America/Mexico_City';

/**
 * Convert date to Mexico timezone
 */
export function convertToMexicoTimezone(date: Date | string): Date {
  const dateObj = new Date(date);
  
  // For weekend calculation, we only care about the date part in Mexico timezone
  // Get the Mexico date components directly to avoid timezone conversion issues
  const mexicoTime = new Date(dateObj.toLocaleString("en-US", {
    timeZone: MEXICO_TIMEZONE
  }));
  
  // Create a clean date object with just the Mexico date (no time component)
  return new Date(mexicoTime.getFullYear(), mexicoTime.getMonth(), mexicoTime.getDate());
}

/**
 * Check if date is weekend (Saturday or Sunday)
 */
export function isWeekend(date: Date): boolean {
  const dayOfWeek = date.getDay();
  return dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
}

/**
 * Get previous Friday from a weekend date
 */
export function getPreviousFriday(date: Date): Date {
  const dayOfWeek = date.getDay();
  let daysToSubtract: number;
  
  if (dayOfWeek === 0) { // Sunday
    daysToSubtract = 2; // Go back to Friday
  } else if (dayOfWeek === 6) { // Saturday
    daysToSubtract = 1; // Go back to Friday
  } else {
    // Not a weekend, return same date
    return new Date(date);
  }
  
  const friday = new Date(date);
  friday.setDate(date.getDate() - daysToSubtract);
  return friday;
}

/**
 * Calculate the base date for permit expiration
 * Business rule: Use PERMIT_READY date, but if it's weekend, use previous Friday
 */
export function getPermitExpirationBaseDate(permitReadyDate: Date | string): Date {
  // Convert to Mexico timezone
  const mexicoDate = convertToMexicoTimezone(permitReadyDate);
  
  // If it's a weekend, use previous Friday
  if (isWeekend(mexicoDate)) {
    return getPreviousFriday(mexicoDate);
  }
  
  return mexicoDate;
}

/**
 * Calculate permit expiration date based on business rules
 */
export function calculatePermitExpirationDate(permitReadyDate: Date | string): Date {
  if (!permitReadyDate) {
    throw new Error('Permit ready date is required for expiration calculation');
  }
  
  // Get the base date (accounting for weekend rule)
  const baseDate = getPermitExpirationBaseDate(permitReadyDate);
  
  // Add 30 days
  const expirationDate = new Date(baseDate);
  expirationDate.setDate(baseDate.getDate() + 30);
  
  return expirationDate;
}

/**
 * Check if a permit is expired based on business rules
 */
export function isPermitExpiredByBusinessRules(permitReadyDate: Date | string): boolean {
  if (!permitReadyDate) {
    return false; // Can't be expired without permit ready date
  }
  
  const expirationDate = calculatePermitExpirationDate(permitReadyDate);
  const currentMexicoDate = convertToMexicoTimezone(new Date());
  
  return currentMexicoDate > expirationDate;
}

/**
 * Get days remaining until permit expires based on business rules
 */
export function getDaysUntilExpiration(permitReadyDate: Date | string): number | null {
  if (!permitReadyDate) {
    return null;
  }
  
  const expirationDate = calculatePermitExpirationDate(permitReadyDate);
  const currentMexicoDate = convertToMexicoTimezone(new Date());
  
  const diffTime = expirationDate.getTime() - currentMexicoDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

/**
 * Format date for display in Mexico timezone
 */
export function formatDateMexico(date: Date | string | null): string {
  if (!date) return 'N/A';
  
  const dateObj = new Date(date);
  return dateObj.toLocaleDateString('es-MX', {
    timeZone: MEXICO_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

/**
 * Format date with Mexico timezone indicator
 */
export function formatDateMexicoWithTZ(date: Date | string | null): string {
  if (!date) return 'N/A';
  
  const formatted = formatDateMexico(date);
  return `${formatted} (México)`;
}

/**
 * Calculate expiration status message based on business rules
 */
export function getExpirationStatusMessage(permitReadyDate: Date | string | null, currentStatus: string): { 
  isExpired: boolean; 
  daysRemaining: number | null; 
  message: string; 
  urgency: 'expired' | 'critical' | 'warning' | 'normal';
} {
  if (!permitReadyDate || currentStatus !== 'PERMIT_READY') {
    return {
      isExpired: false,
      daysRemaining: null,
      message: 'N/A',
      urgency: 'normal'
    };
  }
  
  const isExpired = isPermitExpiredByBusinessRules(permitReadyDate);
  const daysRemaining = getDaysUntilExpiration(permitReadyDate);
  
  if (isExpired) {
    return {
      isExpired: true,
      daysRemaining,
      message: 'Permiso vencido',
      urgency: 'expired'
    };
  }
  
  if (daysRemaining !== null) {
    if (daysRemaining <= 1) {
      return {
        isExpired: false,
        daysRemaining,
        message: daysRemaining === 0 ? 'Vence hoy' : 'Vence mañana',
        urgency: 'critical'
      };
    } else if (daysRemaining <= 7) {
      return {
        isExpired: false,
        daysRemaining,
        message: `Vence en ${daysRemaining} días`,
        urgency: 'warning'
      };
    } else {
      return {
        isExpired: false,
        daysRemaining,
        message: `Válido por ${daysRemaining} días más`,
        urgency: 'normal'
      };
    }
  }
  
  return {
    isExpired: false,
    daysRemaining: null,
    message: 'Válido',
    urgency: 'normal'
  };
}