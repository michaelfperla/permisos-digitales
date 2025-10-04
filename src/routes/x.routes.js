// src/routes/x.routes.js
const express = require('express');
const router = express.Router();
const ApiResponse = require('../utils/api-response');
const { logger } = require('../utils/logger');
const XCampaignJob = require('../jobs/x-campaign.job');

// Initialize X campaign instance
const xCampaign = new XCampaignJob();

/**
 * GET /x/posts - Fetch timeline posts
 * Query parameters:
 * - count: number of posts to fetch (default: 10, max: 100)
 * - includeRetweets: include retweets (default: true)
 * - includeReplies: include replies (default: false)
 */
router.get('/posts', async (req, res) => {
  try {
    const options = {
      count: parseInt(req.query.count) || 10,
      includeRetweets: req.query.includeRetweets !== 'false',
      includeReplies: req.query.includeReplies === 'true'
    };

    const result = await xCampaign.fetchMyTimeline(options);
    
    ApiResponse.success(res, {
      timeline: result,
      fetched: result.posts?.length || 0,
      options: options
    });
  } catch (error) {
    logger.error('Error fetching X timeline:', error);
    ApiResponse.error(res, 'Failed to fetch X posts', 500);
  }
});

/**
 * GET /x/posts/:id - Fetch specific post by ID
 */
router.get('/posts/:id', async (req, res) => {
  try {
    const tweetId = req.params.id;
    
    if (!tweetId) {
      return ApiResponse.error(res, 'Tweet ID is required', 400);
    }

    const result = await xCampaign.fetchPostById(tweetId);
    
    ApiResponse.success(res, {
      post: result,
      tweetId: tweetId
    });
  } catch (error) {
    logger.error(`Error fetching X post ${req.params.id}:`, error);
    ApiResponse.error(res, 'Failed to fetch X post', 500);
  }
});

/**
 * GET /x/search - Search user's posts
 * Query parameters:
 * - q: search query (required)
 * - count: number of posts to return (default: 10, max: 100)
 * - sort: sort order (recency or relevancy, default: recency)
 */
router.get('/search', async (req, res) => {
  try {
    const query = req.query.q;
    
    if (!query) {
      return ApiResponse.error(res, 'Search query (q) is required', 400);
    }

    const options = {
      count: parseInt(req.query.count) || 10,
      sortOrder: req.query.sort === 'relevancy' ? 'relevancy' : 'recency'
    };

    const result = await xCampaign.searchMyPosts(query, options);
    
    ApiResponse.success(res, {
      searchResults: result,
      found: result.posts?.length || 0,
      query: query,
      options: options
    });
  } catch (error) {
    logger.error(`Error searching X posts with query "${req.query.q}":`, error);
    ApiResponse.error(res, 'Failed to search X posts', 500);
  }
});

/**
 * GET /x/profile - Get current user profile
 */
router.get('/profile', async (req, res) => {
  try {
    const profile = await xCampaign.getUserProfile();
    
    ApiResponse.success(res, {
      profile: profile
    });
  } catch (error) {
    logger.error('Error fetching X profile:', error);
    ApiResponse.error(res, 'Failed to fetch X profile', 500);
  }
});

/**
 * DELETE /x/posts/:id - Delete specific post by ID
 * Body: { confirmDeletion: true }
 */
router.delete('/posts/:id', async (req, res) => {
  try {
    const tweetId = req.params.id;
    const { confirmDeletion } = req.body;
    
    if (!tweetId) {
      return ApiResponse.error(res, 'Tweet ID is required', 400);
    }

    if (!confirmDeletion) {
      return ApiResponse.error(res, 'Deletion must be confirmed with confirmDeletion: true', 400);
    }

    const result = await xCampaign.deletePost(tweetId, { confirmDeletion });
    
    ApiResponse.success(res, {
      deletion: result,
      tweetId: tweetId
    });
  } catch (error) {
    logger.error(`Error deleting X post ${req.params.id}:`, error);
    ApiResponse.error(res, error.message || 'Failed to delete X post', 500);
  }
});

/**
 * POST /x/posts/bulk-delete - Delete multiple posts
 * Body: { tweetIds: string[], confirmDeletion: true, batchSize?: number }
 */
router.post('/posts/bulk-delete', async (req, res) => {
  try {
    const { tweetIds, confirmDeletion, batchSize } = req.body;
    
    if (!Array.isArray(tweetIds) || tweetIds.length === 0) {
      return ApiResponse.error(res, 'tweetIds array is required', 400);
    }

    if (!confirmDeletion) {
      return ApiResponse.error(res, 'Bulk deletion must be confirmed with confirmDeletion: true', 400);
    }

    const result = await xCampaign.bulkDeletePosts(tweetIds, { confirmDeletion, batchSize });
    
    ApiResponse.success(res, {
      bulkDeletion: result,
      requestedCount: tweetIds.length
    });
  } catch (error) {
    logger.error('Error in bulk deletion:', error);
    ApiResponse.error(res, error.message || 'Failed to bulk delete X posts', 500);
  }
});

/**
 * GET /x/analytics - Get engagement analytics
 * Query parameters:
 * - count: number of posts to analyze (default: 50, max: 100)
 * - includeRetweets: include retweets in analysis (default: false)
 */
router.get('/analytics', async (req, res) => {
  try {
    const options = {
      count: Math.min(parseInt(req.query.count) || 50, 100),
      includeRetweets: req.query.includeRetweets === 'true'
    };

    const result = await xCampaign.getEngagementAnalytics(options);
    
    ApiResponse.success(res, {
      analytics: result.analytics,
      postsAnalyzed: result.posts?.length || 0,
      options: options
    });
  } catch (error) {
    logger.error('Error getting engagement analytics:', error);
    ApiResponse.error(res, 'Failed to get engagement analytics', 500);
  }
});

/**
 * GET /x/content-analysis - Analyze post content patterns
 * Query parameters:
 * - count: number of posts to analyze (default: 100, max: 200)
 */
router.get('/content-analysis', async (req, res) => {
  try {
    const options = {
      count: Math.min(parseInt(req.query.count) || 100, 200)
    };

    const result = await xCampaign.analyzeContent(options);
    
    ApiResponse.success(res, {
      contentAnalysis: result.analysis,
      postsAnalyzed: result.posts?.length || 0,
      options: options
    });
  } catch (error) {
    logger.error('Error analyzing content:', error);
    ApiResponse.error(res, 'Failed to analyze content', 500);
  }
});

/**
 * GET /x/export - Export posts data
 * Query parameters:
 * - count: number of posts to export (default: 100, max: 500)
 * - format: export format (json or csv, default: json)
 * - includeMetrics: include engagement metrics (default: true)
 * - includeAnalysis: include content analysis (default: false)
 */
router.get('/export', async (req, res) => {
  try {
    const options = {
      count: Math.min(parseInt(req.query.count) || 100, 500),
      format: req.query.format === 'csv' ? 'csv' : 'json',
      includeMetrics: req.query.includeMetrics !== 'false',
      includeAnalysis: req.query.includeAnalysis === 'true'
    };

    const result = await xCampaign.exportPosts(options);
    
    // Set appropriate headers for download
    const filename = `x-posts-export-${new Date().toISOString().split('T')[0]}.${options.format}`;
    
    if (options.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(result.exportData);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      ApiResponse.success(res, {
        export: result,
        filename: filename
      });
    }
  } catch (error) {
    logger.error('Error exporting posts:', error);
    ApiResponse.error(res, 'Failed to export posts', 500);
  }
});

/**
 * GET /x/status - Get X campaign status and API health
 */
router.get('/status', async (req, res) => {
  try {
    const status = xCampaign.getStatus();
    
    // Test API connection
    let apiHealth = 'unknown';
    try {
      if (xCampaign.enabled) {
        await xCampaign.getUserProfile();
        apiHealth = 'connected';
      } else {
        apiHealth = 'disabled';
      }
    } catch (error) {
      apiHealth = 'error';
      logger.warn('X API connection test failed:', error.message);
    }
    
    ApiResponse.success(res, {
      campaignStatus: status,
      apiHealth: apiHealth,
      enabled: xCampaign.enabled,
      availableEndpoints: {
        'GET /x/posts': 'Fetch timeline posts (count, includeRetweets, includeReplies)',
        'GET /x/posts/:id': 'Get specific post by ID', 
        'DELETE /x/posts/:id': 'Delete specific post (requires confirmDeletion: true)',
        'POST /x/posts/bulk-delete': 'Delete multiple posts (requires confirmDeletion: true)',
        'GET /x/search': 'Search your posts (q, count, sort)',
        'GET /x/profile': 'Get your X profile information',
        'GET /x/analytics': 'Get engagement analytics (count, includeRetweets)',
        'GET /x/content-analysis': 'Analyze post content patterns (count)',
        'GET /x/export': 'Export posts data in JSON/CSV (count, format, includeMetrics, includeAnalysis)',
        'GET /x/status': 'This endpoint - get status and available endpoints'
      }
    });
  } catch (error) {
    logger.error('Error getting X status:', error);
    ApiResponse.error(res, 'Failed to get X status', 500);
  }
});

module.exports = router;