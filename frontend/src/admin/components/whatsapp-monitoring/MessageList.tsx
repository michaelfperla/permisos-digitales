import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FaSearch,
  FaFilter,
  FaEye,
  FaEyeSlash,
  FaShieldAlt,
  FaExclamationTriangle,
  FaUser,
  FaRobot,
  FaClock,
  FaChevronLeft,
  FaChevronRight
} from 'react-icons/fa';

import styles from './MessageList.module.css';
import { 
  getWhatsAppMessages, 
  WhatsAppMessage, 
  MessageFilters 
} from '../../services/whatsappMonitoringService';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface MessageListProps {
  onMessageSelect?: (message: WhatsAppMessage) => void;
  selectedMessageId?: number;
  realTimeEnabled?: boolean;
}

const MessageList: React.FC<MessageListProps> = ({
  onMessageSelect,
  selectedMessageId,
  realTimeEnabled = true
}) => {
  const [filters, setFilters] = useState<MessageFilters>({
    page: 1,
    limit: 50,
    direction: 'all',
    message_type: 'all',
    search: '',
    date_from: '',
    date_to: '',
    has_sensitive_data: undefined
  });

  const [showFilters, setShowFilters] = useState(false);

  // Query for messages
  const {
    data: messagesData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['whatsapp-messages', filters],
    queryFn: () => getWhatsAppMessages(filters),
    refetchInterval: realTimeEnabled ? false : 30000, // Don't poll if real-time is active
    staleTime: 30000
  });

  // Handle filter changes
  const handleFilterChange = (newFilters: Partial<MessageFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters, page: 1 }));
  };

  // Handle pagination
  const handlePageChange = (page: number) => {
    setFilters(prev => ({ ...prev, page }));
  };

  // Handle search
  const handleSearch = (searchTerm: string) => {
    handleFilterChange({ search: searchTerm });
  };

  // Format message preview based on privacy settings
  const formatMessagePreview = (message: WhatsAppMessage) => {
    if (message.hasSensitiveData && !message.privacyInfo.canViewFull) {
      return (
        <div className={styles.sensitiveMessage}>
          <FaShieldAlt className={styles.privacyIcon} />
          <span>Mensaje con datos sensibles (protegido)</span>
        </div>
      );
    }
    return message.preview || '[Sin contenido]';
  };

  // Get message type icon
  const getMessageTypeIcon = (type: string) => {
    switch (type) {
      case 'text': return '💬';
      case 'audio': return '🎵';
      case 'image': return '🖼️';
      case 'document': return '📄';
      case 'interactive': return '🔘';
      default: return '📱';
    }
  };

  // Get processing status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'failed': return 'error';
      case 'processing': return 'warning';
      default: return 'info';
    }
  };

  const messages = messagesData?.messages || [];
  const pagination = messagesData?.pagination;

  if (error) {
    return (
      <div className={styles.errorState}>
        <FaExclamationTriangle className={styles.errorIcon} />
        <h3>Error al cargar mensajes</h3>
        <p>{error.message}</p>
        <button onClick={() => refetch()} className={styles.retryButton}>
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className={styles.messageList}>
      {/* Header with search and filters */}
      <div className={styles.header}>
        <div className={styles.searchContainer}>
          <FaSearch className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Buscar mensajes, usuarios o intenciones..."
            value={filters.search || ''}
            onChange={(e) => handleSearch(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`${styles.filterButton} ${showFilters ? styles.active : ''}`}
        >
          <FaFilter />
          Filtros
        </button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className={styles.filtersPanel}>
          <div className={styles.filterRow}>
            <div className={styles.filterGroup}>
              <label>Dirección:</label>
              <select
                value={filters.direction || 'all'}
                onChange={(e) => handleFilterChange({ direction: e.target.value as any })}
              >
                <option value="all">Todos</option>
                <option value="incoming">Entrantes</option>
                <option value="outgoing">Salientes</option>
              </select>
            </div>

            <div className={styles.filterGroup}>
              <label>Tipo:</label>
              <select
                value={filters.message_type || 'all'}
                onChange={(e) => handleFilterChange({ message_type: e.target.value })}
              >
                <option value="all">Todos</option>
                <option value="text">Texto</option>
                <option value="audio">Audio</option>
                <option value="image">Imagen</option>
                <option value="document">Documento</option>
              </select>
            </div>

            <div className={styles.filterGroup}>
              <label>Datos sensibles:</label>
              <select
                value={filters.has_sensitive_data === undefined ? 'all' : filters.has_sensitive_data.toString()}
                onChange={(e) => {
                  const value = e.target.value === 'all' ? undefined : e.target.value === 'true';
                  handleFilterChange({ has_sensitive_data: value });
                }}
              >
                <option value="all">Todos</option>
                <option value="true">Con datos sensibles</option>
                <option value="false">Sin datos sensibles</option>
              </select>
            </div>
          </div>

          <div className={styles.filterRow}>
            <div className={styles.filterGroup}>
              <label>Desde:</label>
              <input
                type="datetime-local"
                value={filters.date_from || ''}
                onChange={(e) => handleFilterChange({ date_from: e.target.value })}
              />
            </div>

            <div className={styles.filterGroup}>
              <label>Hasta:</label>
              <input
                type="datetime-local"
                value={filters.date_to || ''}
                onChange={(e) => handleFilterChange({ date_to: e.target.value })}
              />
            </div>

            <div className={styles.filterActions}>
              <button
                onClick={() => setFilters({
                  page: 1,
                  limit: 50,
                  direction: 'all',
                  message_type: 'all',
                  search: '',
                  date_from: '',
                  date_to: '',
                  has_sensitive_data: undefined
                })}
                className={styles.clearFilters}
              >
                Limpiar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messages List */}
      <div className={styles.messagesContainer}>
        {isLoading ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner}></div>
            <p>Cargando mensajes...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className={styles.emptyState}>
            <FaEyeSlash className={styles.emptyIcon} />
            <h3>No hay mensajes</h3>
            <p>No se encontraron mensajes con los filtros aplicados.</p>
          </div>
        ) : (
          <div className={styles.messagesList}>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`${styles.messageItem} ${
                  selectedMessageId === message.id ? styles.selected : ''
                } ${message.direction === 'incoming' ? styles.incoming : styles.outgoing}`}
                onClick={() => onMessageSelect?.(message)}
              >
                <div className={styles.messageHeader}>
                  <div className={styles.messageInfo}>
                    <div className={styles.directionIcon}>
                      {message.direction === 'incoming' ? <FaUser /> : <FaRobot />}
                    </div>
                    <div className={styles.messageDetails}>
                      <span className={styles.phoneNumber}>{message.phoneNumber}</span>
                      {message.userName && (
                        <span className={styles.userName}>({message.userName})</span>
                      )}
                    </div>
                    <div className={styles.messageType}>
                      {getMessageTypeIcon(message.messageType)}
                    </div>
                  </div>

                  <div className={styles.messageTimestamp}>
                    <FaClock className={styles.clockIcon} />
                    {formatDistanceToNow(new Date(message.messageTimestamp), {
                      addSuffix: true,
                      locale: es
                    })}
                  </div>
                </div>

                <div className={styles.messageContent}>
                  <div className={styles.messagePreview}>
                    {formatMessagePreview(message)}
                  </div>

                  <div className={styles.messageMetadata}>
                    {message.conversationState && (
                      <span className={styles.state}>Estado: {message.conversationState}</span>
                    )}
                    {message.intent && (
                      <span className={styles.intent}>Intención: {message.intent}</span>
                    )}
                    <span className={`${styles.status} ${styles[getStatusColor(message.processingStatus)]}`}>
                      {message.processingStatus}
                    </span>
                  </div>
                </div>

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
                  {message.privacyInfo.isTruncated && (
                    <div className={styles.truncatedBadge} title="Mensaje truncado">
                      ...
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={!pagination.hasPrev}
            className={styles.paginationButton}
          >
            <FaChevronLeft />
            Anterior
          </button>

          <div className={styles.paginationInfo}>
            Página {pagination.page} de {pagination.totalPages}
            <span className={styles.totalCount}>
              ({pagination.total} mensajes total)
            </span>
          </div>

          <button
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={!pagination.hasNext}
            className={styles.paginationButton}
          >
            Siguiente
            <FaChevronRight />
          </button>
        </div>
      )}
    </div>
  );
};

export default MessageList;
