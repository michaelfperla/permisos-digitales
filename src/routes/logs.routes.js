/**
 * Log Analysis API Routes
 * 
 * Provides AI-friendly endpoints for log querying and system health monitoring
 */

const express = require('express');
const { logger, analyzer } = require('../utils/logger');
const { isAuthenticated, isAdminPortal } = require('../middleware/auth.middleware');
const router = express.Router();

/**
 * Search logs with AI-friendly queries
 * POST /logs/search
 */
router.post('/search', isAuthenticated, isAdminPortal, async (req, res) => {
  try {
    const query = {
      timeRange: req.body.timeRange || '1h',
      eventTypes: req.body.eventTypes || [],
      categories: req.body.categories || [],
      severity: req.body.severity || [],
      keywords: req.body.keywords || [],
      limit: Math.min(req.body.limit || 100, 1000) // Max 1000 results
    };

    const results = await analyzer.searchLogs(query);
    
    logger.userAction('Log search performed', {
      userId: req.user.id,
      searchQuery: query,
      resultsCount: results.total
    });

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    logger.errorWithContext('Log search failed', error, {
      userId: req.user.id,
      errorCode: 'LOG_SEARCH_FAILED'
    });
    
    res.status(500).json({
      success: false,
      error: 'Error searching logs'
    });
  }
});

/**
 * Get system health report
 * GET /logs/health
 */
router.get('/health', isAuthenticated, isAdminPortal, async (req, res) => {
  try {
    const healthReport = await analyzer.generateHealthReport();
    
    logger.performance('Health report generated', {
      userId: req.user.id,
      systemHealth: healthReport.summary.systemHealth,
      errorRate: healthReport.summary.errorRate,
      responseTime: healthReport.summary.averageResponseTime
    });

    res.json({
      success: true,
      data: healthReport
    });
  } catch (error) {
    logger.errorWithContext('Health report generation failed', error, {
      userId: req.user.id,
      errorCode: 'HEALTH_REPORT_FAILED'
    });
    
    res.status(500).json({
      success: false,
      error: 'Error generating health report'
    });
  }
});

/**
 * Get real-time log events (last N events from buffer)
 * GET /logs/recent
 */
router.get('/recent', isAuthenticated, isAdminPortal, (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const recentEvents = analyzer.eventBuffer.slice(-limit);
    
    logger.userAction('Recent logs accessed', {
      userId: req.user.id,
      eventsCount: recentEvents.length
    });

    res.json({
      success: true,
      data: {
        events: recentEvents,
        total: recentEvents.length,
        bufferSize: analyzer.eventBuffer.length
      }
    });
  } catch (error) {
    logger.errorWithContext('Recent logs access failed', error, {
      userId: req.user.id,
      errorCode: 'RECENT_LOGS_FAILED'
    });
    
    res.status(500).json({
      success: false,
      error: 'Error accessing recent logs'
    });
  }
});

/**
 * Get performance baselines
 * GET /logs/performance
 */
router.get('/performance', isAuthenticated, isAdminPortal, (req, res) => {
  try {
    const baselines = {};
    for (const [endpoint, data] of analyzer.performanceBaselines) {
      baselines[endpoint] = {
        average: Math.round(data.average),
        min: data.min,
        max: data.max,
        samples: data.samples,
        lastUpdated: data.lastUpdated
      };
    }
    
    logger.performance('Performance baselines accessed', {
      userId: req.user.id,
      endpointsCount: Object.keys(baselines).length
    });

    res.json({
      success: true,
      data: baselines
    });
  } catch (error) {
    logger.errorWithContext('Performance baselines access failed', error, {
      userId: req.user.id,
      errorCode: 'PERFORMANCE_ACCESS_FAILED'
    });
    
    res.status(500).json({
      success: false,
      error: 'Error accessing performance data'
    });
  }
});

/**
 * Get current alert rules
 * GET /logs/alerts/rules
 */
router.get('/alerts/rules', isAuthenticated, isAdminPortal, (req, res) => {
  try {
    const rules = {};
    for (const [name, rule] of analyzer.alertRules) {
      rules[name] = {
        condition: rule.condition,
        action: rule.action,
        threshold: rule.threshold,
        timeWindow: rule.timeWindow,
        enabled: rule.enabled,
        lastTriggered: rule.lastTriggered
      };
    }
    
    logger.userAction('Alert rules accessed', {
      userId: req.user.id,
      rulesCount: Object.keys(rules).length
    });

    res.json({
      success: true,
      data: rules
    });
  } catch (error) {
    logger.errorWithContext('Alert rules access failed', error, {
      userId: req.user.id,
      errorCode: 'ALERT_RULES_FAILED'
    });
    
    res.status(500).json({
      success: false,
      error: 'Error accessing alert rules'
    });
  }
});

/**
 * Add or update alert rule (admin only)
 * POST /logs/alerts/rules
 */
router.post('/alerts/rules', isAuthenticated, isAdminPortal, (req, res) => {
  try {
    // Check if user is admin (you may need to implement this check)
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    const { name, condition, action, threshold, timeWindow, enabled } = req.body;
    
    if (!name || !condition || !action) {
      return res.status(400).json({
        success: false,
        error: 'Name, condition, and action are required'
      });
    }

    analyzer.addAlertRule(name, {
      condition,
      action,
      threshold,
      timeWindow,
      enabled
    });
    
    logger.security('Alert rule modified', {
      userId: req.user.id,
      ruleName: name,
      action: 'create_or_update'
    });

    res.json({
      success: true,
      message: `Alert rule '${name}' created/updated successfully`
    });
  } catch (error) {
    logger.errorWithContext('Alert rule creation failed', error, {
      userId: req.user.id,
      errorCode: 'ALERT_RULE_CREATE_FAILED'
    });
    
    res.status(500).json({
      success: false,
      error: 'Error creating/updating alert rule'
    });
  }
});

module.exports = router;