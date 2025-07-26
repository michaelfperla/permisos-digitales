// frontend/src/components/permit/QueueStatusDisplay.tsx
import React from 'react';
import { useQueueStatus } from '../../hooks/useQueueStatus';
import LoadingSpinner from '../ui/LoadingSpinner';
import Button from '../ui/Button/Button';
import styles from './QueueStatusDisplay.module.css';

interface QueueStatusDisplayProps {
  applicationId: number;
  onComplete?: () => void;
  enablePolling?: boolean;
  maxRetries?: number;
}

const QueueStatusDisplay: React.FC<QueueStatusDisplayProps> = ({ 
  applicationId, 
  onComplete,
  enablePolling = true,
  maxRetries = 3 
}) => {
  const {
    queueStatus,
    loading,
    error,
    isPolling,
    retryCount,
    lastUpdated,
    refresh,
    startPolling,
    stopPolling,
  } = useQueueStatus(applicationId, {
    onComplete,
    enablePolling,
    maxRetries,
  });

  if (loading && !queueStatus) {
    return (
      <div className={styles.queueStatus}>
        <div className={styles.loadingContainer}>
          <LoadingSpinner size="sm" />
          <p className={styles.loadingText}>Obteniendo estado de la cola...</p>
        </div>
      </div>
    );
  }

  if (error && !queueStatus) {
    return (
      <div className={`${styles.queueStatus} ${styles.error}`}>
        <div className={styles.statusHeader}>
          <span className={styles.statusIcon}>⚠️</span>
          <h3 className={styles.statusTitle}>Error al obtener el estado</h3>
        </div>
        <div className={styles.statusContent}>
          <p className={styles.errorMessage}>{error}</p>
          {retryCount > 0 && (
            <p className={styles.retryInfo}>
              Intento {retryCount} de {maxRetries} fallido
            </p>
          )}
          <div className={styles.errorActions}>
            <Button onClick={refresh} size="small" variant="primary">
              Reintentar
            </Button>
            {!isPolling && (
              <Button onClick={startPolling} size="small" variant="secondary">
                Activar actualización automática
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!queueStatus) {
    return null;
  }

  const getStatusIcon = () => {
    switch (queueStatus.queueStatus) {
      case 'queued':
        return '⏳';
      case 'processing':
        return '⚙️';
      case 'completed':
        return '✅';
      case 'failed':
        return '❌';
      default:
        return '📋';
    }
  };

  const getStatusClass = () => {
    switch (queueStatus.queueStatus) {
      case 'processing':
        return styles.processing;
      case 'completed':
        return styles.completed;
      case 'failed':
        return styles.failed;
      default:
        return styles.queued;
    }
  };

  return (
    <div className={`${styles.queueStatus} ${getStatusClass()}`}>
      <div className={styles.statusHeader}>
        <span className={styles.statusIcon}>{getStatusIcon()}</span>
        <h3 className={styles.statusTitle}>Estado de Generación</h3>
        <div className={styles.statusActions}>
          {!loading && (
            <Button 
              onClick={refresh} 
              size="small" 
              variant="ghost"
              className={styles.refreshButton}
              title="Actualizar estado"
            >
              🔄
            </Button>
          )}
          {isPolling ? (
            <Button 
              onClick={stopPolling} 
              size="small" 
              variant="ghost"
              className={styles.pollingToggle}
              title="Detener actualización automática"
            >
              ⏸️
            </Button>
          ) : (
            <Button 
              onClick={startPolling} 
              size="small" 
              variant="ghost"
              className={styles.pollingToggle}
              title="Activar actualización automática"
            >
              ▶️
            </Button>
          )}
        </div>
      </div>
      
      <div className={styles.statusContent}>
        <p className={styles.message}>{queueStatus.message}</p>
        
        {error && (
          <div className={styles.errorBanner}>
            <p className={styles.errorText}>{error}</p>
            {retryCount > 0 && (
              <span className={styles.retryBadge}>
                Reintento {retryCount}/{maxRetries}
              </span>
            )}
          </div>
        )}
        
        {queueStatus.queuePosition && queueStatus.queuePosition > 0 && (
          <div className={styles.queueInfo}>
            <div className={styles.position}>
              <span className={styles.positionLabel}>Posición en cola:</span>
              <span className={styles.positionNumber}>#{queueStatus.queuePosition}</span>
            </div>
            
            {queueStatus.estimatedWaitMinutes && (
              <div className={styles.waitTime}>
                <span className={styles.waitLabel}>Tiempo estimado:</span>
                <span className={styles.waitValue}>
                  {queueStatus.estimatedWaitMinutes} {queueStatus.estimatedWaitMinutes === 1 ? 'minuto' : 'minutos'}
                </span>
              </div>
            )}
          </div>
        )}
        
        {queueStatus.queueStatus === 'processing' && (
          <div className={styles.processingAnimation}>
            <LoadingSpinner size="sm" />
            <span>Generando tu permiso...</span>
          </div>
        )}
        
        {queueStatus.queuePosition && queueStatus.queuePosition > 5 && (
          <p className={styles.tip}>
            💡 Puedes cerrar esta página y volver más tarde. Tu lugar en la cola está reservado.
          </p>
        )}
        
        {lastUpdated && (
          <div className={styles.lastUpdate}>
            <span className={styles.lastUpdateLabel}>Última actualización:</span>
            <span className={styles.lastUpdateTime}>
              {lastUpdated.toLocaleTimeString('es-MX', { 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit' 
              })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default QueueStatusDisplay;