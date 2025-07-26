const BaseRepository = require('./base.repository');
const { logger } = require('../utils/logger');

class MonitoringRepository extends BaseRepository {
  constructor() {
    super('queue_metrics', 'id');
  }

  /**
   * Get queue metrics for a specific time range
   * @param {string} timeRange - Time range (e.g., '1 hour', '24 hours', '7 days')
   * @returns {Promise<Array>} Queue metrics data
   */
  async getQueueMetrics(timeRange = '1 hour') {
    const query = `
      SELECT 
        id,
        queue_length,
        active_jobs,
        average_wait_time_ms,
        average_processing_time_ms,
        total_completed,
        total_failed,
        created_at
      FROM queue_metrics
      WHERE created_at > NOW() - INTERVAL $1
      ORDER BY created_at DESC
    `;

    try {
      const { rows } = await this.executeQuery(query, [timeRange]);
      return rows;
    } catch (error) {
      logger.error('Error getting queue metrics:', error);
      throw error;
    }
  }

  /**
   * Get applications that appear to be stuck in processing
   * @param {number} thresholdHours - Hours after which an application is considered stuck
   * @returns {Promise<Array>} List of stuck applications
   */
  async getStuckApplications(thresholdHours = 1) {
    const query = `
      SELECT 
        id,
        status,
        created_at,
        updated_at,
        queue_entered_at,
        queue_started_at,
        queue_status,
        EXTRACT(EPOCH FROM (NOW() - updated_at)) / 3600 as hours_since_update
      FROM permit_applications
      WHERE status IN ('PAYMENT_RECEIVED', 'GENERATING_PERMIT')
        AND updated_at < NOW() - INTERVAL $1 || ' hours'
      ORDER BY created_at DESC
      LIMIT 50
    `;

    try {
      const { rows } = await this.executeQuery(query, [thresholdHours]);
      return rows;
    } catch (error) {
      logger.error('Error getting stuck applications:', error);
      throw error;
    }
  }

  /**
   * Get current queue health metrics
   * @returns {Promise<Object>} Queue health data including failure rates and processing stats
   */
  async getQueueHealth() {
    const query = `
      SELECT 
        COUNT(CASE WHEN queue_status = 'completed' THEN 1 END) as completed_count,
        COUNT(CASE WHEN queue_status = 'failed' THEN 1 END) as failed_count,
        COUNT(*) as total_processed,
        ROUND(
          COUNT(CASE WHEN queue_status = 'failed' THEN 1 END)::numeric / 
          NULLIF(COUNT(*), 0) * 100, 2
        ) as failure_rate_percent,
        AVG(queue_duration_ms) as avg_processing_time_ms,
        AVG(EXTRACT(EPOCH FROM (queue_started_at - queue_entered_at)) * 1000) as avg_wait_time_ms,
        COUNT(CASE WHEN queue_status = 'processing' THEN 1 END) as currently_processing,
        COUNT(CASE WHEN queue_status = 'queued' THEN 1 END) as currently_queued
      FROM permit_applications
      WHERE queue_completed_at > NOW() - INTERVAL '1 hour'
        OR queue_status IN ('processing', 'queued')
    `;

    try {
      const { rows } = await this.executeQuery(query);
      return rows[0] || {
        completed_count: 0,
        failed_count: 0,
        total_processed: 0,
        failure_rate_percent: 0,
        avg_processing_time_ms: 0,
        avg_wait_time_ms: 0,
        currently_processing: 0,
        currently_queued: 0
      };
    } catch (error) {
      logger.error('Error getting queue health:', error);
      throw error;
    }
  }

  /**
   * Get system-wide statistics
   * @returns {Promise<Object>} System statistics including application counts and statuses
   */
  async getSystemStats() {
    const query = `
      SELECT 
        COUNT(*) as total_applications,
        COUNT(CASE WHEN status = 'DRAFT' THEN 1 END) as draft_count,
        COUNT(CASE WHEN status = 'SUBMITTED' THEN 1 END) as submitted_count,
        COUNT(CASE WHEN status = 'PAYMENT_PENDING' THEN 1 END) as payment_pending_count,
        COUNT(CASE WHEN status = 'PAYMENT_RECEIVED' THEN 1 END) as payment_received_count,
        COUNT(CASE WHEN status = 'GENERATING_PERMIT' THEN 1 END) as generating_permit_count,
        COUNT(CASE WHEN status = 'PERMIT_READY' THEN 1 END) as permit_ready_count,
        COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed_count,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as created_last_24h,
        COUNT(CASE WHEN updated_at > NOW() - INTERVAL '1 hour' THEN 1 END) as updated_last_hour
      FROM permit_applications
    `;

    try {
      const { rows } = await this.executeQuery(query);
      return rows[0] || {};
    } catch (error) {
      logger.error('Error getting system stats:', error);
      throw error;
    }
  }

  /**
   * Get recent processing times for performance analysis
   * @param {number} limit - Number of recent records to fetch
   * @returns {Promise<Array>} Processing time data
   */
  async getProcessingTimes(limit = 100) {
    const query = `
      SELECT 
        id,
        status,
        queue_duration_ms,
        EXTRACT(EPOCH FROM (queue_started_at - queue_entered_at)) * 1000 as wait_time_ms,
        queue_entered_at,
        queue_started_at,
        queue_completed_at,
        queue_status
      FROM permit_applications
      WHERE queue_completed_at IS NOT NULL
        AND queue_duration_ms IS NOT NULL
      ORDER BY queue_completed_at DESC
      LIMIT $1
    `;

    try {
      const { rows } = await this.executeQuery(query, [limit]);
      return rows;
    } catch (error) {
      logger.error('Error getting processing times:', error);
      throw error;
    }
  }

  /**
   * Store queue metrics in the database
   * @param {Object} metrics - Metrics data to store
   * @returns {Promise<Object>} Created metrics record
   */
  async storeQueueMetrics(metrics) {
    const {
      queueLength,
      activeJobs,
      averageWaitTimeMs,
      averageProcessingTimeMs,
      totalCompleted,
      totalFailed
    } = metrics;

    const data = {
      queue_length: queueLength || 0,
      active_jobs: activeJobs || 0,
      average_wait_time_ms: Math.round(averageWaitTimeMs || 0),
      average_processing_time_ms: Math.round(averageProcessingTimeMs || 0),
      total_completed: parseInt(totalCompleted || 0),
      total_failed: parseInt(totalFailed || 0)
    };

    try {
      return await this.create(data);
    } catch (error) {
      logger.error('Error storing queue metrics:', error);
      throw error;
    }
  }

  /**
   * Get queue metrics summary for the last specified time period
   * @param {string} timeRange - Time range (e.g., '1 hour', '24 hours')
   * @returns {Promise<Object>} Aggregated metrics summary
   */
  async getMetricsSummary(timeRange = '24 hours') {
    const query = `
      SELECT 
        AVG(queue_length) as avg_queue_length,
        MAX(queue_length) as max_queue_length,
        AVG(active_jobs) as avg_active_jobs,
        MAX(active_jobs) as max_active_jobs,
        AVG(average_wait_time_ms) as avg_wait_time_ms,
        AVG(average_processing_time_ms) as avg_processing_time_ms,
        SUM(total_completed) as total_completed,
        SUM(total_failed) as total_failed,
        COUNT(*) as metrics_count,
        MIN(created_at) as period_start,
        MAX(created_at) as period_end
      FROM queue_metrics
      WHERE created_at > NOW() - INTERVAL $1
    `;

    try {
      const { rows } = await this.executeQuery(query, [timeRange]);
      return rows[0] || {};
    } catch (error) {
      logger.error('Error getting metrics summary:', error);
      throw error;
    }
  }
}

module.exports = new MonitoringRepository();