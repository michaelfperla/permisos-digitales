/**
 * Device detection utilities for mobile-specific functionality
 */

/**
 * Detects if the current device is mobile based on user agent and screen size
 */
export const isMobileDevice = (): boolean => {
  // Check user agent for mobile patterns
  const userAgent = navigator.userAgent.toLowerCase();
  const mobileKeywords = [
    'android', 'webos', 'iphone', 'ipad', 'ipod', 'blackberry', 'windows phone',
    'mobile', 'tablet', 'opera mini', 'iemobile'
  ];
  
  const isMobileUA = mobileKeywords.some(keyword => userAgent.includes(keyword));
  
  // Check screen size (mobile typically < 768px width)
  const isMobileScreen = window.innerWidth < 768;
  
  // Check for touch capability
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  // Consider it mobile if any of these conditions are true
  return isMobileUA || (isMobileScreen && isTouchDevice);
};

/**
 * Detects if the device is iOS specifically
 */
export const isIOSDevice = (): boolean => {
  const userAgent = navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(userAgent);
};

/**
 * Detects if the device is Android
 */
export const isAndroidDevice = (): boolean => {
  const userAgent = navigator.userAgent.toLowerCase();
  return /android/.test(userAgent);
};

/**
 * Gets a user-friendly device type string
 */
export const getDeviceType = (): 'mobile' | 'tablet' | 'desktop' => {
  if (isMobileDevice()) {
    return window.innerWidth < 600 ? 'mobile' : 'tablet';
  }
  return 'desktop';
};