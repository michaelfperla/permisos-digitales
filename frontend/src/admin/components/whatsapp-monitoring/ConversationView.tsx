import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FaUser,
  FaRobot,
  FaPhone,
  FaEnvelope,
  FaCar,
  FaShieldAlt,
  FaCheckCircle,
  FaTimesCircle,
  FaClock,
  FaArrowLeft,
  FaSync
} from 'react-icons/fa';

import styles from './ConversationView.module.css';
import { 
  getConversationDetails, 
  WhatsAppConversation, 
  WhatsAppMessage 
} from '../../services/whatsappMonitoringService';
import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ConversationViewProps {
  conversationId: string;
  onBack?: () => void;
  realTimeEnabled?: boolean;
}

const ConversationView: React.FC<ConversationViewProps> = ({
  conversationId,
  onBack,
  realTimeEnabled = true
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Query for conversation details
  const {
    data: conversationData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['conversation-details', conversationId],
    queryFn: () => getConversationDetails(conversationId),
    refetchInterval: realTimeEnabled ? 10000 : false, // Poll every 10 seconds if real-time is enabled
    enabled: !!conversationId
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversationData?.messages, autoScroll]);

  // Handle scroll to detect if user scrolled up
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isAtBottom = scrollHeight - scrollTop <= clientHeight + 50;
    setAutoScroll(isAtBottom);
  };

  // Format message content based on privacy settings
  const formatMessageContent = (message: WhatsAppMessage) => {
    if (message.hasSensitiveData && !message.privacyInfo.canViewFull) {
      return (
        <div className={styles.sensitiveContent}>
          <FaShieldAlt className={styles.privacyIcon} />
          <span>Contenido protegido por privacidad</span>
          <div className={styles.privacyDetails}>
            Nivel de sanitización: {message.privacyInfo.sanitizationLevel}
          </div>
        </div>
      );
    }
    return message.preview || '[Sin contenido]';
  };

  // Get message type display
  const getMessageTypeDisplay = (type: string) => {
    const types = {
      text: { icon: '💬', label: 'Texto' },
      audio: { icon: '🎵', label: 'Audio' },
      image: { icon: '🖼️', label: 'Imagen' },
      document: { icon: '📄', label: 'Documento' },
      interactive: { icon: '🔘', label: 'Interactivo' },
      system: { icon: '⚙️', label: 'Sistema' }
    };
    return types[type as keyof typeof types] || { icon: '📱', label: type };
  };

  // Get processing status display
  const getProcessingStatusDisplay = (status: string) => {
    const statuses = {
      received: { color: 'info', label: 'Recibido' },
      processing: { color: 'warning', label: 'Procesando' },
      completed: { color: 'success', label: 'Completado' },
      failed: { color: 'error', label: 'Fallido' },
      ignored: { color: 'neutral', label: 'Ignorado' }
    };
    return statuses[status as keyof typeof statuses] || { color: 'neutral', label: status };
  };

  if (error) {
    return (
      <div className={styles.errorState}>
        <FaTimesCircle className={styles.errorIcon} />
        <h3>Error al cargar conversación</h3>
        <p>{error.message}</p>
        <div className={styles.errorActions}>
          <button onClick={() => refetch()} className={styles.retryButton}>
            <FaSync />
            Reintentar
          </button>
          {onBack && (
            <button onClick={onBack} className={styles.backButton}>
              <FaArrowLeft />
              Volver
            </button>
          )}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.spinner}></div>
        <p>Cargando conversación...</p>
      </div>
    );
  }

  const { conversation, messages } = conversationData || {};

  if (!conversation) {
    return (
      <div className={styles.emptyState}>
        <h3>Conversación no encontrada</h3>
        {onBack && (
          <button onClick={onBack} className={styles.backButton}>
            <FaArrowLeft />
            Volver
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={styles.conversationView}>
      {/* Header */}
      <div className={styles.header}>
        {onBack && (
          <button onClick={onBack} className={styles.backButton}>
            <FaArrowLeft />
          </button>
        )}

        <div className={styles.conversationInfo}>
          <div className={styles.userInfo}>
            <div className={styles.avatar}>
              <FaUser />
            </div>
            <div className={styles.userDetails}>
              <h2 className={styles.userName}>
                {conversation.userName || 'Usuario Anónimo'}
              </h2>
              <div className={styles.phoneNumber}>
                <FaPhone className={styles.phoneIcon} />
                {conversation.phoneNumber}
              </div>
              {conversation.userEmail && (
                <div className={styles.userEmail}>
                  <FaEnvelope className={styles.emailIcon} />
                  {conversation.userEmail}
                </div>
              )}
            </div>
          </div>

          <div className={styles.conversationStats}>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Mensajes:</span>
              <span className={styles.statValue}>{conversation.totalMessages}</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Estado:</span>
              <span className={`${styles.statValue} ${styles.state}`}>
                {conversation.currentState || 'Sin estado'}
              </span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Última actividad:</span>
              <span className={styles.statValue}>
                {conversation.lastActivityAt ? 
                  formatDistanceToNow(new Date(conversation.lastActivityAt), {
                    addSuffix: true,
                    locale: es
                  }) : 'N/A'
                }
              </span>
            </div>
          </div>
        </div>

        <div className={styles.headerActions}>
          <button onClick={() => refetch()} className={styles.refreshButton}>
            <FaSync />
          </button>
        </div>
      </div>

      {/* Conversation Metadata */}
      <div className={styles.metadata}>
        <div className={styles.metadataSection}>
          <h4>Información de la conversación</h4>
          <div className={styles.metadataGrid}>
            <div className={styles.metadataItem}>
              <span className={styles.metadataLabel}>ID de conversación:</span>
              <span className={styles.metadataValue}>{conversation.conversationId}</span>
            </div>
            <div className={styles.metadataItem}>
              <span className={styles.metadataLabel}>Mensajes entrantes:</span>
              <span className={styles.metadataValue}>{conversation.incomingMessages}</span>
            </div>
            <div className={styles.metadataItem}>
              <span className={styles.metadataLabel}>Mensajes salientes:</span>
              <span className={styles.metadataValue}>{conversation.outgoingMessages}</span>
            </div>
            <div className={styles.metadataItem}>
              <span className={styles.metadataLabel}>Última intención:</span>
              <span className={styles.metadataValue}>{conversation.lastIntent || 'N/A'}</span>
            </div>
          </div>
        </div>

        {conversation.vehicleInfo && (
          <div className={styles.metadataSection}>
            <h4>
              <FaCar className={styles.sectionIcon} />
              Información del vehículo
            </h4>
            <div className={styles.vehicleInfo}>
              {conversation.vehicleInfo}
            </div>
          </div>
        )}

        <div className={styles.privacySection}>
          <h4>
            <FaShieldAlt className={styles.sectionIcon} />
            Estado de privacidad
          </h4>
          <div className={styles.privacyStatus}>
            {conversation.userConsented ? (
              <div className={styles.consentGranted}>
                <FaCheckCircle />
                <span>Usuario ha dado consentimiento</span>
                {conversation.consentDate && (
                  <span className={styles.consentDate}>
                    ({format(new Date(conversation.consentDate), 'dd/MM/yyyy', { locale: es })})
                  </span>
                )}
              </div>
            ) : (
              <div className={styles.consentDenied}>
                <FaTimesCircle />
                <span>Sin consentimiento del usuario</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className={styles.messagesContainer} onScroll={handleScroll}>
        <div className={styles.messagesList}>
          {messages && messages.length > 0 ? (
            messages.map((message, index) => {
              const messageType = getMessageTypeDisplay(message.messageType);
              const processingStatus = getProcessingStatusDisplay(message.processingStatus);
              const isLastMessage = index === messages.length - 1;

              return (
                <div
                  key={message.id}
                  className={`${styles.messageItem} ${
                    message.direction === 'incoming' ? styles.incoming : styles.outgoing
                  }`}
                >
                  <div className={styles.messageHeader}>
                    <div className={styles.messageInfo}>
                      <div className={styles.directionIcon}>
                        {message.direction === 'incoming' ? <FaUser /> : <FaRobot />}
                      </div>
                      <div className={styles.messageTypeInfo}>
                        <span className={styles.messageTypeIcon}>{messageType.icon}</span>
                        <span className={styles.messageTypeLabel}>{messageType.label}</span>
                      </div>
                    </div>
                    <div className={styles.messageTimestamp}>
                      <FaClock className={styles.clockIcon} />
                      {format(new Date(message.messageTimestamp), 'HH:mm:ss', { locale: es })}
                    </div>
                  </div>

                  <div className={styles.messageContent}>
                    {formatMessageContent(message)}
                  </div>

                  <div className={styles.messageFooter}>
                    <div className={styles.messageMetadata}>
                      {message.conversationState && (
                        <span className={styles.messageState}>
                          Estado: {message.conversationState}
                        </span>
                      )}
                      {message.intent && (
                        <span className={styles.messageIntent}>
                          Intención: {message.intent}
                        </span>
                      )}
                    </div>

                    <div className={styles.processingStatus}>
                      <span className={`${styles.statusBadge} ${styles[processingStatus.color]}`}>
                        {processingStatus.label}
                      </span>
                    </div>
                  </div>

                  {message.processingError && (
                    <div className={styles.errorMessage}>
                      <FaTimesCircle className={styles.errorIcon} />
                      {message.processingError}
                    </div>
                  )}

                  {/* Privacy indicators */}
                  <div className={styles.privacyIndicators}>
                    {message.hasSensitiveData && (
                      <div className={styles.privacyBadge} title="Contiene datos sensibles">
                        <FaShieldAlt />
                      </div>
                    )}
                    {message.userConsented && (
                      <div className={styles.consentBadge} title="Usuario ha dado consentimiento">
                        ✓
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className={styles.noMessages}>
              <p>No hay mensajes en esta conversación</p>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Auto-scroll indicator */}
        {!autoScroll && (
          <div className={styles.scrollIndicator}>
            <button
              onClick={() => {
                setAutoScroll(true);
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
              }}
              className={styles.scrollToBottomButton}
            >
              ↓ Ir al final
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConversationView;
