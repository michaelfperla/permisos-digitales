/**
 * WhatsApp Monitoring Service
 * API client for WhatsApp message monitoring endpoints
 */

import api from './api';

export interface WhatsAppMessage {
  id: number;
  messageId: string;
  conversationId: string;
  direction: 'incoming' | 'outgoing';
  messageType: string;
  preview: string;
  messageLength: number;
  hasSensitiveData: boolean;
  userId?: number;
  phoneNumber: string;
  userName?: string;
  conversationState?: string;
  intent?: string;
  processingStatus: string;
  processingError?: string;
  userConsented: boolean;
  consentDate?: string;
  messageTimestamp: string;
  processedAt?: string;
  createdAt: string;
  privacyInfo: {
    canViewFull: boolean;
    sanitizationLevel: string;
    isTruncated: boolean;
  };
}

export interface WhatsAppConversation {
  id: number;
  conversationId: string;
  phoneNumber: string;
  userId?: number;
  userName?: string;
  userEmail?: string;
  totalMessages: number;
  incomingMessages: number;
  outgoingMessages: number;
  firstMessageAt?: string;
  lastMessageAt?: string;
  lastActivityAt?: string;
  currentState?: string;
  lastIntent?: string;
  isActive: boolean;
  isCompleted: boolean;
  applicationId?: number;
  applicationStatus?: string;
  vehicleInfo?: string;
  userConsented: boolean;
  consentDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WhatsAppStatistics {
  period: string;
  timeRange: {
    start: string;
    end: string;
  };
  summary: {
    totalMessages: number;
    incomingMessages: number;
    outgoingMessages: number;
    sensitiveMessages: number;
    failedMessages: number;
    activeConversations: number;
    uniqueUsers: number;
    avgMessageLength: number;
  };
  hourlyBreakdown: Array<{
    hour: string;
    message_count: number;
    incoming_count: number;
    outgoing_count: number;
  }>;
  topIntents: Array<{
    intent: string;
    count: number;
  }>;
}

export interface MessageFilters {
  page?: number;
  limit?: number;
  direction?: 'incoming' | 'outgoing' | 'all';
  conversation_id?: string;
  phone_number?: string;
  date_from?: string;
  date_to?: string;
  message_type?: string;
  has_sensitive_data?: boolean;
  search?: string;
}

export interface ConversationFilters {
  page?: number;
  limit?: number;
  is_active?: boolean;
  has_application?: boolean;
  search?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  filters: any;
  adminLevel: string;
}

/**
 * Get WhatsApp messages with filtering and pagination
 */
export const getWhatsAppMessages = async (
  filters: MessageFilters = {}
): Promise<{ messages: WhatsAppMessage[] } & PaginatedResponse<WhatsAppMessage>> => {
  const params = new URLSearchParams();
  
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, value.toString());
    }
  });

  const response = await api.get(`/admin/whatsapp/messages?${params.toString()}`);
  return response.data;
};

/**
 * Get WhatsApp conversations with filtering and pagination
 */
export const getWhatsAppConversations = async (
  filters: ConversationFilters = {}
): Promise<{ conversations: WhatsAppConversation[] } & PaginatedResponse<WhatsAppConversation>> => {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, value.toString());
    }
  });

  const response = await api.get(`/admin/whatsapp/conversations?${params.toString()}`);
  return response.data;
};

/**
 * Get conversation details with message history
 */
export const getConversationDetails = async (
  conversationId: string,
  limit: number = 100
): Promise<{
  conversation: WhatsAppConversation;
  messages: WhatsAppMessage[];
  adminLevel: string;
}> => {
  const response = await api.get(
    `/admin/whatsapp/conversations/${conversationId}?limit=${limit}`
  );
  return response.data;
};

/**
 * Get WhatsApp monitoring statistics
 */
export const getWhatsAppStatistics = async (
  period: '1h' | '24h' | '7d' | '30d' = '24h'
): Promise<WhatsAppStatistics> => {
  const response = await api.get(`/admin/whatsapp/statistics?period=${period}`);
  return response.data;
};

/**
 * Real-time message stream using Server-Sent Events
 */
export class WhatsAppRealtimeService {
  private eventSource: EventSource | null = null;
  private listeners: Map<string, Function[]> = new Map();

  /**
   * Connect to real-time message stream
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Close existing connection
        this.disconnect();

        // Create new EventSource connection
        this.eventSource = new EventSource('https://api.permisosdigitales.com.mx/admin/whatsapp/stream', {
          withCredentials: true
        });

        this.eventSource.onopen = () => {
          console.log('WhatsApp real-time connection established');
          resolve();
        };

        this.eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.emit(data.type, data);
          } catch (error) {
            console.error('Error parsing SSE message:', error);
          }
        };

        this.eventSource.onerror = (error) => {
          console.error('WhatsApp real-time connection error:', error);
          this.emit('error', error);
          
          // Auto-reconnect after 5 seconds
          setTimeout(() => {
            if (this.eventSource?.readyState === EventSource.CLOSED) {
              this.connect();
            }
          }, 5000);
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from real-time stream
   */
  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  /**
   * Subscribe to events
   */
  on(eventType: string, callback: Function): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(callback);
  }

  /**
   * Unsubscribe from events
   */
  off(eventType: string, callback: Function): void {
    const callbacks = this.listeners.get(eventType);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to listeners
   */
  private emit(eventType: string, data: any): void {
    const callbacks = this.listeners.get(eventType);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in event callback:', error);
        }
      });
    }
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN;
  }
}

// Export singleton instance
export const whatsappRealtimeService = new WhatsAppRealtimeService();
