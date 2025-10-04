import React, { useState, useEffect, useCallback } from 'react';
import {
  FaWhatsapp,
  FaUser,
  FaRobot,
  FaExclamationTriangle,
  FaCheckCircle,
  FaInfoCircle,
  FaTimes,
  FaBell,
  FaBellSlash
} from 'react-icons/fa';

import styles from './RealTimeNotifications.module.css';
import { useWhatsAppRealtime, RealtimeMessage } from '../../hooks/useWhatsAppRealtime';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface Notification {
  id: string;
  type: 'message_received' | 'message_sent' | 'connection' | 'error' | 'system';
  title: string;
  message: string;
  timestamp: Date;
  data?: any;
  read: boolean;
  priority: 'low' | 'medium' | 'high';
}

interface RealTimeNotificationsProps {
  onNotificationClick?: (notification: Notification) => void;
  maxNotifications?: number;
  autoHideDelay?: number;
}

const RealTimeNotifications: React.FC<RealTimeNotificationsProps> = ({
  onNotificationClick,
  maxNotifications = 50,
  autoHideDelay = 5000
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isEnabled, setIsEnabled] = useState(true);
  const [showPanel, setShowPanel] = useState(false);

  const { 
    isConnected, 
    lastMessage, 
    connectionError,
    messageCount 
  } = useWhatsAppRealtime();

  // Process real-time messages into notifications
  const processRealtimeMessage = useCallback((realtimeMessage: RealtimeMessage) => {
    if (!isEnabled) return;

    let notification: Notification | null = null;

    switch (realtimeMessage.type) {
      case 'message_received':
        notification = {
          id: `msg_${Date.now()}_${Math.random()}`,
          type: 'message_received',
          title: 'Nuevo mensaje recibido',
          message: `De ${realtimeMessage.data?.phoneNumber || 'Usuario desconocido'}`,
          timestamp: new Date(),
          data: realtimeMessage.data,
          read: false,
          priority: realtimeMessage.data?.hasSensitiveData ? 'high' : 'medium'
        };
        break;

      case 'message_sent':
        notification = {
          id: `sent_${Date.now()}_${Math.random()}`,
          type: 'message_sent',
          title: 'Mensaje enviado',
          message: `A ${realtimeMessage.data?.phoneNumber || 'Usuario desconocido'}`,
          timestamp: new Date(),
          data: realtimeMessage.data,
          read: false,
          priority: 'low'
        };
        break;

      case 'connection':
        notification = {
          id: `conn_${Date.now()}`,
          type: 'connection',
          title: 'Conexión establecida',
          message: 'Monitoreo en tiempo real activo',
          timestamp: new Date(),
          data: realtimeMessage.data,
          read: false,
          priority: 'low'
        };
        break;

      case 'error':
        notification = {
          id: `error_${Date.now()}`,
          type: 'error',
          title: 'Error de conexión',
          message: 'Problema con el monitoreo en tiempo real',
          timestamp: new Date(),
          data: realtimeMessage.data,
          read: false,
          priority: 'high'
        };
        break;
    }

    if (notification) {
      setNotifications(prev => {
        const updated = [notification!, ...prev].slice(0, maxNotifications);
        return updated;
      });

      // Show toast notification
      if (notification.type !== 'connection') {
        showToastNotification(notification);
      }
    }
  }, [isEnabled, maxNotifications]);

  // Show toast notification
  const showToastNotification = (notification: Notification) => {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `${styles.toast} ${styles[notification.priority]}`;

    const iconHtml = getNotificationIcon(notification.type);
    toast.innerHTML = `
      <div class="${styles.toastIcon}">
        ${iconHtml}
      </div>
      <div class="${styles.toastContent}">
        <div class="${styles.toastTitle}">${notification.title}</div>
        <div class="${styles.toastMessage}">${notification.message}</div>
      </div>
      <button class="${styles.toastClose}">×</button>
    `;

    // Add to DOM
    const container = getToastContainer();
    container.appendChild(toast);

    // Handle close button
    const closeButton = toast.querySelector(`.${styles.toastClose}`);
    closeButton?.addEventListener('click', () => {
      removeToast(toast);
    });

    // Auto-hide
    setTimeout(() => {
      removeToast(toast);
    }, autoHideDelay);

    // Click handler
    toast.addEventListener('click', (e) => {
      if (e.target !== closeButton) {
        onNotificationClick?.(notification);
        removeToast(toast);
      }
    });
  };

  // Get or create toast container
  const getToastContainer = () => {
    let container = document.getElementById('whatsapp-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'whatsapp-toast-container';
      container.className = styles.toastContainer;
      document.body.appendChild(container);
    }
    return container;
  };

  // Remove toast
  const removeToast = (toast: HTMLElement) => {
    toast.style.animation = 'slideOut 0.3s ease-in-out forwards';
    setTimeout(() => {
      toast.remove();
    }, 300);
  };

  // Get notification icon
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'message_received': return '📩';
      case 'message_sent': return '📤';
      case 'connection': return '🔗';
      case 'error': return '⚠️';
      default: return '📱';
    }
  };

  // Process last message
  useEffect(() => {
    if (lastMessage) {
      processRealtimeMessage(lastMessage);
    }
  }, [lastMessage, processRealtimeMessage]);

  // Handle connection errors
  useEffect(() => {
    if (connectionError) {
      const errorNotification: Notification = {
        id: `error_${Date.now()}`,
        type: 'error',
        title: 'Error de conexión',
        message: connectionError.message,
        timestamp: new Date(),
        read: false,
        priority: 'high'
      };

      setNotifications(prev => [errorNotification, ...prev].slice(0, maxNotifications));
      showToastNotification(errorNotification);
    }
  }, [connectionError, maxNotifications]);

  // Mark notification as read
  const markAsRead = (notificationId: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
  };

  // Clear all notifications
  const clearAll = () => {
    setNotifications([]);
  };

  // Get unread count
  const unreadCount = notifications.filter(n => !n.read).length;

  // Get notification display icon
  const getNotificationDisplayIcon = (notification: Notification) => {
    switch (notification.type) {
      case 'message_received':
        return <FaUser className={styles.iconIncoming} />;
      case 'message_sent':
        return <FaRobot className={styles.iconOutgoing} />;
      case 'connection':
        return <FaCheckCircle className={styles.iconSuccess} />;
      case 'error':
        return <FaExclamationTriangle className={styles.iconError} />;
      default:
        return <FaInfoCircle className={styles.iconInfo} />;
    }
  };

  return (
    <>
      {/* Notification Bell */}
      <div className={styles.notificationBell}>
        <button
          onClick={() => setShowPanel(!showPanel)}
          className={`${styles.bellButton} ${unreadCount > 0 ? styles.hasUnread : ''}`}
          title="Notificaciones WhatsApp"
        >
          <FaBell />
          {unreadCount > 0 && (
            <span className={styles.badge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
          )}
        </button>

        <button
          onClick={() => setIsEnabled(!isEnabled)}
          className={`${styles.toggleButton} ${!isEnabled ? styles.disabled : ''}`}
          title={isEnabled ? 'Desactivar notificaciones' : 'Activar notificaciones'}
        >
          {isEnabled ? <FaBell /> : <FaBellSlash />}
        </button>
      </div>

      {/* Notification Panel */}
      {showPanel && (
        <div className={styles.notificationPanel}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitle}>
              <FaWhatsapp className={styles.whatsappIcon} />
              Notificaciones WhatsApp
            </div>
            <div className={styles.panelActions}>
              <div className={styles.connectionStatus}>
                <div className={`${styles.statusDot} ${isConnected ? styles.connected : styles.disconnected}`}></div>
                {isConnected ? 'Conectado' : 'Desconectado'}
              </div>
              {notifications.length > 0 && (
                <button onClick={clearAll} className={styles.clearButton}>
                  Limpiar todo
                </button>
              )}
              <button
                onClick={() => setShowPanel(false)}
                className={styles.closeButton}
              >
                <FaTimes />
              </button>
            </div>
          </div>

          <div className={styles.panelContent}>
            {notifications.length === 0 ? (
              <div className={styles.emptyState}>
                <FaBell className={styles.emptyIcon} />
                <p>No hay notificaciones</p>
              </div>
            ) : (
              <div className={styles.notificationsList}>
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`${styles.notificationItem} ${
                      !notification.read ? styles.unread : ''
                    } ${styles[notification.priority]}`}
                    onClick={() => {
                      markAsRead(notification.id);
                      onNotificationClick?.(notification);
                    }}
                  >
                    <div className={styles.notificationIcon}>
                      {getNotificationDisplayIcon(notification)}
                    </div>
                    <div className={styles.notificationContent}>
                      <div className={styles.notificationTitle}>
                        {notification.title}
                      </div>
                      <div className={styles.notificationMessage}>
                        {notification.message}
                      </div>
                      <div className={styles.notificationTime}>
                        {formatDistanceToNow(notification.timestamp, {
                          addSuffix: true,
                          locale: es
                        })}
                      </div>
                    </div>
                    {!notification.read && (
                      <div className={styles.unreadDot}></div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={styles.panelFooter}>
            <div className={styles.stats}>
              Total: {messageCount} mensajes monitoreados
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {showPanel && (
        <div
          className={styles.overlay}
          onClick={() => setShowPanel(false)}
        />
      )}
    </>
  );
};

export default RealTimeNotifications;
