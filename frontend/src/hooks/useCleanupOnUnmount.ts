// Custom hook to ensure proper cleanup of resources on component unmount
import { useEffect, useRef } from 'react';
import { logger } from '../utils/logger';

interface CleanupFunction {
  (): void;
}

export const useCleanupOnUnmount = () => {
  const cleanupFunctions = useRef<CleanupFunction[]>([]);
  
  const registerCleanup = (cleanup: CleanupFunction) => {
    cleanupFunctions.current.push(cleanup);
  };
  
  useEffect(() => {
    return () => {
      // Execute all cleanup functions
      cleanupFunctions.current.forEach(cleanup => {
        try {
          cleanup();
        } catch (error) {
          logger.error('Error during cleanup:', error);
        }
      });
      
      // Clear the array
      cleanupFunctions.current = [];
    };
  }, []);
  
  return { registerCleanup };
};