/**
 * Utility functions for date handling and formatting
 */

/**
 * Format time remaining until expiration
 */
export const formatTimeRemaining = (expiresAt: string): string => {
  const now = new Date();
  const expiration = new Date(expiresAt);
  const diff = expiration.getTime() - now.getTime();

  if (diff <= 0) {
    return 'Expirado';
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) {
    return `${days}d ${hours}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
};

/**
 * Check if expiration is soon (less than 4 hours)
 */
export const isExpiringSoon = (expiresAt: string): boolean => {
  const now = new Date();
  const expiration = new Date(expiresAt);
  const diff = expiration.getTime() - now.getTime();
  const hoursRemaining = diff / (1000 * 60 * 60);
  
  return hoursRemaining <= 4 && hoursRemaining > 0;
};

/**
 * Check if already expired
 */
export const isExpired = (expiresAt: string): boolean => {
  const now = new Date();
  const expiration = new Date(expiresAt);
  return expiration.getTime() <= now.getTime();
};

/**
 * Format date for display
 */
export const formatDate = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

/**
 * Format date and time for display
 */
export const formatDateTime = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Get countdown with more detailed formatting
 */
export const getDetailedCountdown = (expiresAt: string): {
  timeRemaining: string;
  isExpiringSoon: boolean;
  isExpired: boolean;
  urgencyLevel: 'critical' | 'warning' | 'normal';
} => {
  const now = new Date();
  const expiration = new Date(expiresAt);
  const diff = expiration.getTime() - now.getTime();

  if (diff <= 0) {
    return {
      timeRemaining: 'Expirado',
      isExpiringSoon: false,
      isExpired: true,
      urgencyLevel: 'critical',
    };
  }

  const hours = diff / (1000 * 60 * 60);
  
  let urgencyLevel: 'critical' | 'warning' | 'normal' = 'normal';
  if (hours <= 2) {
    urgencyLevel = 'critical';
  } else if (hours <= 4) {
    urgencyLevel = 'warning';
  }

  return {
    timeRemaining: formatTimeRemaining(expiresAt),
    isExpiringSoon: hours <= 4,
    isExpired: false,
    urgencyLevel,
  };
};