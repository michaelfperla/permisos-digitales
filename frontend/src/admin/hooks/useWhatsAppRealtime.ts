/**
 * WhatsApp Real-time Hook
 * Manages real-time WhatsApp message updates using Server-Sent Events
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { whatsappRealtimeService } from '../services/whatsappMonitoringService';

export interface RealtimeMessage {
  type: 'connection' | 'message_received' | 'message_sent' | 'heartbeat' | 'error';
  timestamp: string;
  data?: any;
  adminLevel?: string;
}

export interface UseWhatsAppRealtimeReturn {
  isConnected: boolean;
  lastMessage: RealtimeMessage | null;
  connectionError: Error | null;
  messageCount: number;
  connect: () => Promise<void>;
  disconnect: () => void;
  clearError: () => void;
}

export const useWhatsAppRealtime = (): UseWhatsAppRealtimeReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<RealtimeMessage | null>(null);
  const [connectionError, setConnectionError] = useState<Error | null>(null);
  const [messageCount, setMessageCount] = useState(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectingRef = useRef(false);

  // Event handlers
  const handleConnection = useCallback((data: RealtimeMessage) => {
    console.log('WhatsApp real-time connected:', data);
    setIsConnected(true);
    setConnectionError(null);
    setLastMessage(data);
    isConnectingRef.current = false;
  }, []);

  const handleMessageReceived = useCallback((data: RealtimeMessage) => {
    console.log('New WhatsApp message received:', data);
    setLastMessage(data);
    setMessageCount(prev => prev + 1);
  }, []);

  const handleMessageSent = useCallback((data: RealtimeMessage) => {
    console.log('WhatsApp message sent:', data);
    setLastMessage(data);
    setMessageCount(prev => prev + 1);
  }, []);

  const handleHeartbeat = useCallback((data: RealtimeMessage) => {
    // Silent heartbeat - just update connection status
    setIsConnected(true);
    setConnectionError(null);
  }, []);

  const handleError = useCallback((error: any) => {
    console.error('WhatsApp real-time error:', error);
    setIsConnected(false);
    setConnectionError(new Error(error.message || 'Connection error'));
    isConnectingRef.current = false;

    // Clear any existing reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    // Auto-reconnect after 5 seconds
    reconnectTimeoutRef.current = setTimeout(() => {
      if (!isConnectingRef.current) {
        console.log('Attempting to reconnect to WhatsApp real-time...');
        connect();
      }
    }, 5000);
  }, []);

  // Connect function
  const connect = useCallback(async () => {
    if (isConnectingRef.current || whatsappRealtimeService.isConnected()) {
      return;
    }

    try {
      isConnectingRef.current = true;
      setConnectionError(null);

      // Set up event listeners
      whatsappRealtimeService.on('connection', handleConnection);
      whatsappRealtimeService.on('message_received', handleMessageReceived);
      whatsappRealtimeService.on('message_sent', handleMessageSent);
      whatsappRealtimeService.on('heartbeat', handleHeartbeat);
      whatsappRealtimeService.on('error', handleError);

      // Connect to the stream
      await whatsappRealtimeService.connect();

    } catch (error) {
      console.error('Failed to connect to WhatsApp real-time:', error);
      setConnectionError(error as Error);
      setIsConnected(false);
      isConnectingRef.current = false;
    }
  }, [handleConnection, handleMessageReceived, handleMessageSent, handleHeartbeat, handleError]);

  // Disconnect function
  const disconnect = useCallback(() => {
    // Clear reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Remove event listeners
    whatsappRealtimeService.off('connection', handleConnection);
    whatsappRealtimeService.off('message_received', handleMessageReceived);
    whatsappRealtimeService.off('message_sent', handleMessageSent);
    whatsappRealtimeService.off('heartbeat', handleHeartbeat);
    whatsappRealtimeService.off('error', handleError);

    // Disconnect from service
    whatsappRealtimeService.disconnect();

    // Reset state
    setIsConnected(false);
    setLastMessage(null);
    setConnectionError(null);
    isConnectingRef.current = false;
  }, [handleConnection, handleMessageReceived, handleMessageSent, handleHeartbeat, handleError]);

  // Clear error function
  const clearError = useCallback(() => {
    setConnectionError(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  // Monitor connection status
  useEffect(() => {
    const checkConnection = () => {
      const serviceConnected = whatsappRealtimeService.isConnected();
      if (isConnected !== serviceConnected) {
        setIsConnected(serviceConnected);
      }
    };

    const interval = setInterval(checkConnection, 1000);
    return () => clearInterval(interval);
  }, [isConnected]);

  return {
    isConnected,
    lastMessage,
    connectionError,
    messageCount,
    connect,
    disconnect,
    clearError
  };
};
