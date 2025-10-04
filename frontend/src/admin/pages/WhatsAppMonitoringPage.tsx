import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FaWhatsapp,
  FaEye,
  FaUsers,
  FaChartLine,
  FaSync,
  FaExclamationTriangle,
  FaShieldAlt,
  FaCog
} from 'react-icons/fa';

import styles from './WhatsAppMonitoringPage.module.css';
import {
  getWhatsAppMessages,
  getWhatsAppConversations,
  getWhatsAppStatistics,
  WhatsAppMessage,
  WhatsAppConversation
} from '../services/whatsappMonitoringService';
import { useWhatsAppRealtime } from '../hooks/useWhatsAppRealtime';

// Import components
import MessageList from '../components/whatsapp-monitoring/MessageList';
import ConversationView from '../components/whatsapp-monitoring/ConversationView';
import MonitoringDashboard from '../components/whatsapp-monitoring/MonitoringDashboard';
import RealTimeNotifications from '../components/whatsapp-monitoring/RealTimeNotifications';

interface WhatsAppMonitoringPageProps {}

const WhatsAppMonitoringPage: React.FC<WhatsAppMonitoringPageProps> = () => {
  const queryClient = useQueryClient();

  // State management
  const [activeTab, setActiveTab] = useState<'messages' | 'conversations' | 'dashboard'>('messages');
  const [selectedMessage, setSelectedMessage] = useState<WhatsAppMessage | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [showConversationView, setShowConversationView] = useState(false);

  // Real-time connection
  const {
    isConnected,
    lastMessage,
    connectionError,
    messageCount,
    connect,
    disconnect
  } = useWhatsAppRealtime();

  // Connect to real-time updates on mount
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  // Handle real-time message updates
  useEffect(() => {
    if (lastMessage && (lastMessage.type === 'message_received' || lastMessage.type === 'message_sent')) {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-statistics'] });
    }
  }, [lastMessage, queryClient]);

  // Handle message selection
  const handleMessageSelect = useCallback((message: WhatsAppMessage) => {
    setSelectedMessage(message);
    setSelectedConversationId(message.conversationId);
    setShowConversationView(true);
  }, []);

  // Handle conversation selection
  const handleConversationSelect = useCallback((conversation: WhatsAppConversation) => {
    setSelectedConversationId(conversation.conversationId);
    setShowConversationView(true);
  }, []);

  // Handle notification click
  const handleNotificationClick = useCallback((notification: any) => {
    if (notification.data?.conversationId) {
      setSelectedConversationId(notification.data.conversationId);
      setShowConversationView(true);
      setActiveTab('messages');
    }
  }, []);

  // Handle back from conversation view
  const handleBackFromConversation = useCallback(() => {
    setShowConversationView(false);
    setSelectedMessage(null);
    setSelectedConversationId(null);
  }, []);

  // Handle tab change
  const handleTabChange = useCallback((tab: typeof activeTab) => {
    setActiveTab(tab);
    setShowConversationView(false);
    setSelectedMessage(null);
    setSelectedConversationId(null);
  }, []);

  // Manual refresh all data
  const handleRefreshAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['whatsapp-messages'] });
    queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
    queryClient.invalidateQueries({ queryKey: ['whatsapp-statistics'] });
  }, [queryClient]);

  return (
    <div className={styles.monitoringPage}>
      {/* Real-time Notifications */}
      <RealTimeNotifications
        onNotificationClick={handleNotificationClick}
        maxNotifications={100}
        autoHideDelay={5000}
      />

      {/* Page Header */}
      <div className={styles.pageHeader}>
        <div className={styles.titleSection}>
          <div className={styles.titleIcon}>
            <FaWhatsapp />
          </div>
          <div className={styles.titleContent}>
            <h1 className={styles.pageTitle}>Monitoreo WhatsApp</h1>
            <p className={styles.pageSubtitle}>
              Supervisión en tiempo real de mensajes y conversaciones
            </p>
          </div>
        </div>

        <div className={styles.headerActions}>
          <div className={styles.connectionStatus}>
            <div className={`${styles.statusIndicator} ${isConnected ? styles.connected : styles.disconnected}`}>
              <span className={styles.statusDot}></span>
              <span className={styles.statusText}>
                {isConnected ? 'Conectado' : 'Desconectado'}
              </span>
            </div>
            {messageCount > 0 && (
              <div className={styles.messageCount}>
                {messageCount} mensajes monitoreados
              </div>
            )}
          </div>

          <button
            onClick={handleRefreshAll}
            className={styles.refreshButton}
            title="Actualizar todos los datos"
          >
            <FaSync />
            Actualizar
          </button>
        </div>
      </div>

      {/* Connection Error Alert */}
      {connectionError && (
        <div className={styles.errorAlert}>
          <FaExclamationTriangle className={styles.errorIcon} />
          <div className={styles.errorContent}>
            <strong>Error de conexión en tiempo real:</strong>
            <span>{connectionError.message}</span>
          </div>
          <button
            onClick={connect}
            className={styles.reconnectButton}
          >
            Reconectar
          </button>
        </div>
      )}

      {/* Privacy Notice */}
      <div className={styles.privacyNotice}>
        <FaShieldAlt className={styles.privacyIcon} />
        <div className={styles.privacyText}>
          <strong>Aviso de Privacidad:</strong> Los datos sensibles están protegidos según GDPR.
          Solo se muestran datos de usuarios que han dado su consentimiento.
        </div>
      </div>

      {/* Main Content */}
      {showConversationView && selectedConversationId ? (
        // Conversation Detail View
        <div className={styles.conversationContainer}>
          <ConversationView
            conversationId={selectedConversationId}
            onBack={handleBackFromConversation}
            realTimeEnabled={isConnected}
          />
        </div>
      ) : (
        // Tab-based Main View
        <>
          {/* Tab Navigation */}
          <div className={styles.tabNavigation}>
            <button
              className={`${styles.tab} ${activeTab === 'messages' ? styles.activeTab : ''}`}
              onClick={() => handleTabChange('messages')}
            >
              <FaEye className={styles.tabIcon} />
              <span>Mensajes</span>
            </button>

            <button
              className={`${styles.tab} ${activeTab === 'conversations' ? styles.activeTab : ''}`}
              onClick={() => handleTabChange('conversations')}
            >
              <FaUsers className={styles.tabIcon} />
              <span>Conversaciones</span>
            </button>

            <button
              className={`${styles.tab} ${activeTab === 'dashboard' ? styles.activeTab : ''}`}
              onClick={() => handleTabChange('dashboard')}
            >
              <FaChartLine className={styles.tabIcon} />
              <span>Dashboard</span>
            </button>
          </div>

          {/* Tab Content */}
          <div className={styles.tabContent}>
            {activeTab === 'messages' && (
              <MessageList
                onMessageSelect={handleMessageSelect}
                selectedMessageId={selectedMessage?.id}
                realTimeEnabled={isConnected}
              />
            )}

            {activeTab === 'conversations' && (
              <ConversationList
                onConversationSelect={handleConversationSelect}
                realTimeEnabled={isConnected}
              />
            )}

            {activeTab === 'dashboard' && (
              <MonitoringDashboard
                realTimeEnabled={isConnected}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
};

// Conversation List Component (simplified version)
const ConversationList: React.FC<{
  onConversationSelect: (conversation: WhatsAppConversation) => void;
  realTimeEnabled: boolean;
}> = ({ onConversationSelect, realTimeEnabled }) => {
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    search: '',
    is_active: true
  });

  const {
    data: conversationsData,
    isLoading,
    error
  } = useQuery({
    queryKey: ['whatsapp-conversations', filters],
    queryFn: () => getWhatsAppConversations(filters),
    refetchInterval: realTimeEnabled ? 30000 : false,
    staleTime: 15000
  });

  if (error) {
    return (
      <div className={styles.errorState}>
        <FaExclamationTriangle className={styles.errorIcon} />
        <h3>Error al cargar conversaciones</h3>
        <p>{error.message}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.spinner}></div>
        <p>Cargando conversaciones...</p>
      </div>
    );
  }

  const conversations = conversationsData?.conversations || [];

  return (
    <div className={styles.conversationsList}>
      <div className={styles.searchContainer}>
        <input
          type="text"
          placeholder="Buscar conversaciones..."
          value={filters.search}
          onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value, page: 1 }))}
          className={styles.searchInput}
        />
      </div>

      <div className={styles.conversationsGrid}>
        {conversations.map((conversation) => (
          <div
            key={conversation.id}
            className={styles.conversationCard}
            onClick={() => onConversationSelect(conversation)}
          >
            <div className={styles.conversationHeader}>
              <div className={styles.userInfo}>
                <div className={styles.userName}>
                  {conversation.userName || 'Usuario Anónimo'}
                </div>
                <div className={styles.phoneNumber}>
                  {conversation.phoneNumber}
                </div>
              </div>
              <div className={styles.conversationStats}>
                <span className={styles.messageCount}>
                  {conversation.totalMessages} mensajes
                </span>
              </div>
            </div>

            <div className={styles.conversationMeta}>
              {conversation.currentState && (
                <span className={styles.state}>
                  Estado: {conversation.currentState}
                </span>
              )}
              {conversation.lastActivityAt && (
                <span className={styles.lastActivity}>
                  Última actividad: {new Date(conversation.lastActivityAt).toLocaleString()}
                </span>
              )}
            </div>

            <div className={styles.conversationIndicators}>
              {conversation.isActive && (
                <span className={styles.activeIndicator}>Activa</span>
              )}
              {conversation.userConsented && (
                <span className={styles.consentIndicator}>
                  <FaShieldAlt /> Consentimiento
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {conversations.length === 0 && (
        <div className={styles.emptyState}>
          <FaUsers className={styles.emptyIcon} />
          <h3>No hay conversaciones</h3>
          <p>No se encontraron conversaciones activas.</p>
        </div>
      )}
    </div>
  );
};

export default WhatsAppMonitoringPage;
