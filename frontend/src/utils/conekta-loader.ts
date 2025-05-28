/**
 * Utility for dynamically loading Conekta.js and managing device fingerprinting
 */

// Track if Conekta is already loaded or loading
let isConektaLoading = false;
let isConektaLoaded = false;

/**
 * Dynamically loads the Conekta.js script
 * @returns Promise that resolves when Conekta is loaded
 */
export const loadConektaScript = (): Promise<void> => {
  if (isConektaLoaded && window.Conekta) {
    if (import.meta.env.DEV) {
      console.debug('[ConektaLoader] Conekta already loaded');
    }
    return Promise.resolve();
  }

  if (isConektaLoading) {
    if (import.meta.env.DEV) {
      console.debug('[ConektaLoader] Conekta already loading, waiting...');
    }
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (isConektaLoaded && window.Conekta) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
  }

  isConektaLoading = true;
  if (import.meta.env.DEV) {
    console.info('[ConektaLoader] Loading Conekta.js...');
  }

  return new Promise((resolve, reject) => {
    try {
      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = 'https://cdn.conekta.io/js/latest/conekta.js';
      script.async = true;

      script.onload = () => {
        if (import.meta.env.DEV) {
          console.info('[ConektaLoader] Conekta.js loaded successfully');
        }
        isConektaLoaded = true;
        isConektaLoading = false;
        resolve();
      };

      script.onerror = (error) => {
        console.error('[ConektaLoader] Failed to load Conekta.js:', error);
        isConektaLoading = false;
        reject(new Error('Failed to load Conekta.js'));
      };

      document.head.appendChild(script);
    } catch (error) {
      console.error('[ConektaLoader] Error setting up Conekta.js script:', error);
      isConektaLoading = false;
      reject(error);
    }
  });
};

/**
 * Initializes Conekta with the provided public key
 * @param publicKey Conekta public key
 * @returns Promise that resolves when Conekta is initialized
 */
export const initializeConekta = async (publicKey: string): Promise<void> => {
  try {
    await loadConektaScript();

    if (window.Conekta) {
      window.Conekta.setPublicKey(publicKey);
      if (import.meta.env.DEV) {
        console.info(
          '[ConektaLoader] Conekta initialized with public key:',
          publicKey.substring(0, 8) + '...',
        );
      }
    } else {
      throw new Error('Conekta not available after loading');
    }
  } catch (error) {
    console.error('[ConektaLoader] Error initializing Conekta:', error);
    throw error;
  }
};

/**
 * Gets the device fingerprint from Conekta using the standardized method
 * @returns The device fingerprint or null if not available
 */
export const getDeviceFingerprint = (): string | null => {
  if (!window.Conekta) {
    console.warn('[ConektaLoader] Conekta not loaded, cannot get device fingerprint');
    return null;
  }

  try {
    if (window.Conekta.deviceData && typeof window.Conekta.deviceData.getDeviceId === 'function') {
      const deviceId = window.Conekta.deviceData.getDeviceId();
      if (deviceId && typeof deviceId === 'string' && deviceId.length > 10) {
        if (import.meta.env.DEV) {
          console.info('[ConektaLoader] Got device fingerprint:', deviceId.substring(0, 8) + '...');
        }
        return deviceId;
      }
    }

    if (import.meta.env.DEV) {
      console.warn('[ConektaLoader] Device fingerprint not available using standard method');
    }
    return null;
  } catch (error) {
    console.error('[ConektaLoader] Error getting device fingerprint:', error);
    return null;
  }
};

export default {
  loadConektaScript,
  initializeConekta,
  getDeviceFingerprint,
};