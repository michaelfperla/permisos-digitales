import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FaChartLine,
  FaUsers,
  FaComments,
  FaExclamationTriangle,
  FaShieldAlt,
  FaClock,
  FaArrowUp,
  FaArrowDown,
  FaSync
} from 'react-icons/fa';

import styles from './MonitoringDashboard.module.css';
import { 
  getWhatsAppStatistics, 
  WhatsAppStatistics 
} from '../../services/whatsappMonitoringService';
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';

interface MonitoringDashboardProps {
  realTimeEnabled?: boolean;
}

const MonitoringDashboard: React.FC<MonitoringDashboardProps> = ({
  realTimeEnabled = true
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<'1h' | '24h' | '7d' | '30d'>('24h');

  // Helper function to safely format hour strings
  const formatHourSafely = (hourString: string): string => {
    if (!hourString || typeof hourString !== 'string' || hourString.trim() === '') {
      return 'N/A';
    }

    try {
      let dateToFormat;

      // If it's already in HH:mm format, create a date for today
      if (/^\d{2}:\d{2}$/.test(hourString)) {
        const today = new Date();
        const [hours, minutes] = hourString.split(':');
        dateToFormat = new Date(today.getFullYear(), today.getMonth(), today.getDate(), parseInt(hours), parseInt(minutes));
      } else {
        // Try to parse as ISO string
        dateToFormat = parseISO(hourString);
      }

      // Validate the parsed date using date-fns isValid
      if (dateToFormat && isValid(dateToFormat)) {
        return format(dateToFormat, 'HH:mm', { locale: es });
      }
    } catch (error) {
      console.warn('Error formatting hour:', hourString, error);
    }

    return 'N/A';
  };

  // Query for statistics
  const {
    data: statisticsData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['whatsapp-statistics', selectedPeriod],
    queryFn: () => getWhatsAppStatistics(selectedPeriod),
    refetchInterval: realTimeEnabled ? 60000 : false, // Refresh every minute if real-time is enabled
    staleTime: 30000
  });

  // Calculate trends and insights
  const insights = useMemo(() => {
    if (!statisticsData) return null;

    // Handle both wrapped and unwrapped API responses
    const summary = statisticsData.summary || statisticsData;
    const hourlyBreakdown = statisticsData.hourlyBreakdown || statisticsData.messagesByHour || [];
    
    // Calculate response rate
    const responseRate = summary.totalMessages > 0 
      ? ((summary.outgoingMessages / summary.incomingMessages) * 100).toFixed(1)
      : '0';

    // Calculate average messages per conversation
    const avgMessagesPerConversation = summary.activeConversations > 0
      ? (summary.totalMessages / summary.activeConversations).toFixed(1)
      : '0';

    // Calculate sensitive data percentage (handle missing sensitiveMessages)
    const sensitiveDataPercentage = summary.totalMessages > 0 && summary.sensitiveMessages
      ? ((summary.sensitiveMessages / summary.totalMessages) * 100).toFixed(1)
      : '0';

    // Calculate peak hour with proper error handling
    let peakHourFormatted = 'N/A';

    if (hourlyBreakdown && hourlyBreakdown.length > 0) {
      const peakHour = hourlyBreakdown.reduce((peak, current) =>
        (current?.message_count || 0) > (peak?.message_count || 0) ? current : peak,
        hourlyBreakdown[0] || { hour: '', message_count: 0 }
      );

      if (peakHour && peakHour.hour) {
        peakHourFormatted = formatHourSafely(peakHour.hour);
      }
    }

    return {
      responseRate,
      avgMessagesPerConversation,
      sensitiveDataPercentage,
      peakHour: peakHourFormatted
    };
  }, [statisticsData]);

  // Format period label
  const getPeriodLabel = (period: string) => {
    const labels = {
      '1h': 'Última hora',
      '24h': 'Últimas 24 horas',
      '7d': 'Últimos 7 días',
      '30d': 'Últimos 30 días'
    };
    return labels[period as keyof typeof labels] || period;
  };

  // Get trend indicator (for future use)
  const getTrendIndicator = (current: number, previous: number) => {
    if (current > previous) {
      return { icon: FaArrowUp, color: 'success', text: 'Incremento' };
    } else if (current < previous) {
      return { icon: FaArrowDown, color: 'error', text: 'Descenso' };
    }
    return { icon: null, color: 'neutral', text: 'Sin cambios' };
  };

  if (error) {
    return (
      <div className={styles.errorState}>
        <FaExclamationTriangle className={styles.errorIcon} />
        <h3>Error al cargar estadísticas</h3>
        <p>{error.message}</p>
        <button onClick={() => refetch()} className={styles.retryButton}>
          <FaSync />
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className={styles.dashboard}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h2 className={styles.title}>
            <FaChartLine className={styles.titleIcon} />
            Panel de Monitoreo WhatsApp
          </h2>
          <p className={styles.subtitle}>
            Métricas y análisis en tiempo real de conversaciones
          </p>
        </div>

        <div className={styles.controls}>
          <div className={styles.periodSelector}>
            {(['1h', '24h', '7d', '30d'] as const).map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`${styles.periodButton} ${
                  selectedPeriod === period ? styles.active : ''
                }`}
              >
                {getPeriodLabel(period)}
              </button>
            ))}
          </div>

          <button onClick={() => refetch()} className={styles.refreshButton}>
            <FaSync />
            Actualizar
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className={styles.loadingState}>
          <div className={styles.spinner}></div>
          <p>Cargando estadísticas...</p>
        </div>
      ) : statisticsData ? (
        <>
          {/* Key Metrics */}
          <div className={styles.metricsGrid}>
            <div className={styles.metricCard}>
              <div className={styles.metricHeader}>
                <FaComments className={styles.metricIcon} />
                <span className={styles.metricLabel}>Total de Mensajes</span>
              </div>
              <div className={styles.metricValue}>
                {(statisticsData.summary?.totalMessages || statisticsData.totalMessages || 0).toLocaleString()}
              </div>
              <div className={styles.metricBreakdown}>
                <span className={styles.incoming}>
                  ↓ {statisticsData.summary?.incomingMessages || statisticsData.incomingMessages || 0} entrantes
                </span>
                <span className={styles.outgoing}>
                  ↑ {statisticsData.summary?.outgoingMessages || statisticsData.outgoingMessages || 0} salientes
                </span>
              </div>
            </div>

            <div className={styles.metricCard}>
              <div className={styles.metricHeader}>
                <FaUsers className={styles.metricIcon} />
                <span className={styles.metricLabel}>Conversaciones Activas</span>
              </div>
              <div className={styles.metricValue}>
                {(statisticsData.summary?.activeConversations || statisticsData.activeConversations || 0).toLocaleString()}
              </div>
              <div className={styles.metricSubtext}>
                {statisticsData.summary?.uniqueUsers || statisticsData.uniqueUsers || 0} usuarios únicos
              </div>
            </div>

            <div className={styles.metricCard}>
              <div className={styles.metricHeader}>
                <FaShieldAlt className={styles.metricIcon} />
                <span className={styles.metricLabel}>Datos Sensibles</span>
              </div>
              <div className={styles.metricValue}>
                {statisticsData.summary?.sensitiveMessages || statisticsData.sensitiveMessages || 0}
              </div>
              <div className={styles.metricSubtext}>
                {insights?.sensitiveDataPercentage}% del total
              </div>
            </div>

            <div className={styles.metricCard}>
              <div className={styles.metricHeader}>
                <FaExclamationTriangle className={styles.metricIcon} />
                <span className={styles.metricLabel}>Mensajes Fallidos</span>
              </div>
              <div className={styles.metricValue}>
                {statisticsData.summary?.failedMessages || statisticsData.failedMessages || 0}
              </div>
              <div className={styles.metricSubtext}>
                {(statisticsData.summary?.failedMessages || statisticsData.failedMessages || 0) > 0 ? 'Requiere atención' : 'Todo funcionando'}
              </div>
            </div>
          </div>

          {/* Insights Cards */}
          <div className={styles.insightsGrid}>
            <div className={styles.insightCard}>
              <h4 className={styles.insightTitle}>Tasa de Respuesta</h4>
              <div className={styles.insightValue}>
                {insights?.responseRate}%
              </div>
              <p className={styles.insightDescription}>
                Promedio de respuestas del bot por mensaje recibido
              </p>
            </div>

            <div className={styles.insightCard}>
              <h4 className={styles.insightTitle}>Mensajes por Conversación</h4>
              <div className={styles.insightValue}>
                {insights?.avgMessagesPerConversation}
              </div>
              <p className={styles.insightDescription}>
                Promedio de mensajes por conversación activa
              </p>
            </div>

            <div className={styles.insightCard}>
              <h4 className={styles.insightTitle}>Longitud Promedio</h4>
              <div className={styles.insightValue}>
                {Math.round(statisticsData.summary.avgMessageLength)} chars
              </div>
              <p className={styles.insightDescription}>
                Longitud promedio de mensajes de texto
              </p>
            </div>

            <div className={styles.insightCard}>
              <h4 className={styles.insightTitle}>
                <FaClock className={styles.insightIcon} />
                Hora Pico
              </h4>
              <div className={styles.insightValue}>
                {insights?.peakHour}
              </div>
              <p className={styles.insightDescription}>
                Hora con mayor actividad de mensajes
              </p>
            </div>
          </div>

          {/* Hourly Activity Chart */}
          <div className={styles.chartSection}>
            <h3 className={styles.chartTitle}>Actividad por Hora</h3>
            <div className={styles.chartContainer}>
              <div className={styles.chart}>
                {statisticsData.hourlyBreakdown.map((hour, index) => {
                  const maxCount = Math.max(...statisticsData.hourlyBreakdown.map(h => h.message_count));
                  const height = maxCount > 0 ? (hour.message_count / maxCount) * 100 : 0;
                  
                  return (
                    <div key={index} className={styles.chartBar}>
                      <div className={styles.barContainer}>
                        <div 
                          className={styles.bar}
                          style={{ height: `${height}%` }}
                          title={`${hour.message_count} mensajes`}
                        >
                          <div className={styles.incomingBar}
                               style={{ height: `${hour.message_count > 0 ? ((hour.incoming_count || 0) / hour.message_count) * 100 : 0}%` }} />
                        </div>
                      </div>
                      <div className={styles.barLabel}>
                        {formatHourSafely(hour.hour)}
                      </div>
                      <div className={styles.barValue}>
                        {hour.message_count}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className={styles.chartLegend}>
                <div className={styles.legendItem}>
                  <div className={styles.legendColor} style={{ background: '#3b82f6' }}></div>
                  <span>Total de mensajes</span>
                </div>
                <div className={styles.legendItem}>
                  <div className={styles.legendColor} style={{ background: '#10b981' }}></div>
                  <span>Mensajes entrantes</span>
                </div>
              </div>
            </div>
          </div>

          {/* Top Intents */}
          <div className={styles.intentsSection}>
            <h3 className={styles.sectionTitle}>Intenciones Más Frecuentes</h3>
            <div className={styles.intentsList}>
              {statisticsData.topIntents.length > 0 ? (
                statisticsData.topIntents.map((intent, index) => (
                  <div key={index} className={styles.intentItem}>
                    <div className={styles.intentRank}>#{index + 1}</div>
                    <div className={styles.intentName}>{intent.intent}</div>
                    <div className={styles.intentCount}>{intent.count} mensajes</div>
                    <div className={styles.intentBar}>
                      <div 
                        className={styles.intentProgress}
                        style={{ 
                          width: `${(intent.count / statisticsData.topIntents[0].count) * 100}%` 
                        }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className={styles.noIntents}>
                  <p>No hay datos de intenciones disponibles</p>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className={styles.emptyState}>
          <FaChartLine className={styles.emptyIcon} />
          <h3>No hay datos disponibles</h3>
          <p>No se encontraron estadísticas para el período seleccionado.</p>
        </div>
      )}
    </div>
  );
};

export default MonitoringDashboard;
