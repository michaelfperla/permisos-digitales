const { TwitterApi } = require('twitter-api-v2');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

class XCampaignJob {
  constructor() {
    // Check if X credentials are available
    if (process.env.X_API_KEY && process.env.X_API_SECRET && process.env.X_ACCESS_TOKEN && process.env.X_ACCESS_SECRET) {
      try {
        this.client = new TwitterApi({
          appKey: process.env.X_API_KEY,
          appSecret: process.env.X_API_SECRET,
          accessToken: process.env.X_ACCESS_TOKEN,
          accessSecret: process.env.X_ACCESS_SECRET,
        });
        this.enabled = true;
      } catch (error) {
        logger.warn('X Campaign disabled due to invalid tokens:', error.message);
        this.enabled = false;
      }
    } else {
      logger.info('X Campaign disabled: Missing credentials');
      this.enabled = false;
    }

    this.campaignData = this.loadCampaignData();
    this.campaignStartDate = new Date('2025-08-18T19:00:00-06:00'); // Starting Monday August 18, 2025 7pm Mexico City time
    this.whatsappLink = 'wa.me/5216641633345';
    this.isRunning = false; // Prevent concurrent executions
  }

  loadCampaignData() {
    try {
      const campaignPath = path.join(__dirname, '../data/x-campaign-7day.json');
      const data = fs.readFileSync(campaignPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      logger.error('Error loading X campaign data:', error);
      throw error;
    }
  }

  getCurrentCampaignDay() {
    const now = new Date();
    const diffTime = now - this.campaignStartDate;
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
    
    // Day 0 starts at campaign start (Monday 7pm)
    // Day 1 starts 5 hours later (Tuesday 12am) 
    // Each subsequent day starts 24 hours later
    let day;
    if (diffHours < 5) {
      day = 0; // Monday night posts
    } else {
      day = Math.floor((diffHours - 5) / 24) + 1;
    }
    
    // Cycle through 7 days (0-6) - campaign repeats after 7 days
    return day > 6 ? (day % 7) : day;
  }

  getDayPosts(day) {
    return this.campaignData.find(dayData => dayData.day === day)?.posts || [];
  }

  async postTweet(content) {
    try {
      const tweet = await this.client.v2.tweet(content);
      logger.info(`X post published successfully: ${tweet.data.id}`, {
        tweetId: tweet.data.id,
        content: content.substring(0, 50) + '...'
      });
      
      return tweet;
    } catch (error) {
      logger.error('Error posting X tweet:', error);
      throw error;
    }
  }

  async postScheduledContent(time) {
    if (!this.enabled) {
      logger.debug(`X campaign disabled, skipping post for ${time}`);
      return;
    }

    if (this.isRunning) {
      logger.warn('X campaign job is already running, skipping execution');
      return;
    }

    this.isRunning = true;
    
    try {
      logger.info(`Starting X campaign post for ${time} Mexico City time`);
      
      const currentDay = this.getCurrentCampaignDay();
      const dayPosts = this.getDayPosts(currentDay);
      
      if (!dayPosts || dayPosts.length === 0) {
        logger.info(`No posts found for campaign day ${currentDay}`);
        return;
      }

      const post = dayPosts.find(p => p.time === time);
      
      if (!post) {
        logger.warn(`No post found for time ${time} on day ${currentDay}`);
        return;
      }

      logger.info(`Posting X content for day ${currentDay}, time ${time}`);
      await this.postTweet(post.content);
      
      logger.info('X campaign post completed successfully', {
        day: currentDay,
        time: time,
        contentPreview: post.content.substring(0, 50) + '...'
      });

    } catch (error) {
      logger.error('Error in X campaign job:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  // Fetch methods for reading X posts
  async fetchMyTimeline(options = {}) {
    if (!this.enabled) {
      throw new Error('X API not enabled - missing credentials');
    }

    try {
      const {
        count = 10,
        includeRetweets = true,
        includeReplies = false
      } = options;

      const timeline = await this.client.v2.userTimeline(await this.client.currentUser(), {
        max_results: Math.min(count, 100), // API limit is 100
        exclude: [
          ...(includeRetweets ? [] : ['retweets']),
          ...(includeReplies ? [] : ['replies'])
        ],
        'tweet.fields': ['created_at', 'public_metrics', 'context_annotations', 'author_id']
      });

      logger.info(`Fetched ${timeline.data?.length || 0} posts from timeline`);
      
      return {
        posts: timeline.data || [],
        meta: timeline.meta || {},
        includes: timeline.includes || {}
      };
    } catch (error) {
      logger.error('Error fetching timeline:', error);
      throw error;
    }
  }

  async fetchPostById(tweetId) {
    if (!this.enabled) {
      throw new Error('X API not enabled - missing credentials');
    }

    try {
      const tweet = await this.client.v2.singleTweet(tweetId, {
        'tweet.fields': ['created_at', 'public_metrics', 'context_annotations', 'author_id', 'conversation_id']
      });

      logger.info(`Fetched post ${tweetId}`);
      
      return {
        post: tweet.data,
        includes: tweet.includes || {}
      };
    } catch (error) {
      logger.error(`Error fetching post ${tweetId}:`, error);
      throw error;
    }
  }

  async searchMyPosts(query, options = {}) {
    if (!this.enabled) {
      throw new Error('X API not enabled - missing credentials');
    }

    try {
      const {
        count = 10,
        sortOrder = 'recency'
      } = options;

      // Get current user ID first
      const currentUser = await this.client.currentUser();
      
      // Search for tweets from current user with the query
      const searchQuery = `from:${currentUser.username} ${query}`;
      
      const searchResults = await this.client.v2.search(searchQuery, {
        max_results: Math.min(count, 100),
        sort_order: sortOrder,
        'tweet.fields': ['created_at', 'public_metrics', 'context_annotations', 'author_id']
      });

      logger.info(`Found ${searchResults.data?.length || 0} posts matching "${query}"`);
      
      return {
        posts: searchResults.data || [],
        meta: searchResults.meta || {},
        includes: searchResults.includes || {},
        query: searchQuery
      };
    } catch (error) {
      logger.error(`Error searching posts with query "${query}":`, error);
      throw error;
    }
  }

  async getUserProfile() {
    if (!this.enabled) {
      throw new Error('X API not enabled - missing credentials');
    }

    try {
      const user = await this.client.currentUser();
      logger.info(`Fetched profile for @${user.username}`);
      
      return user;
    } catch (error) {
      logger.error('Error fetching user profile:', error);
      throw error;
    }
  }

  // Delete operations
  async deletePost(tweetId, options = {}) {
    if (!this.enabled) {
      throw new Error('X API not enabled - missing credentials');
    }

    try {
      const { confirmDeletion = false } = options;
      
      if (!confirmDeletion) {
        throw new Error('Deletion must be confirmed with confirmDeletion: true');
      }

      const result = await this.client.v2.deleteTweet(tweetId);
      logger.info(`Successfully deleted post ${tweetId}`);
      
      return { success: true, tweetId, deleted: result.data.deleted };
    } catch (error) {
      logger.error(`Error deleting post ${tweetId}:`, error);
      throw error;
    }
  }

  async bulkDeletePosts(tweetIds, options = {}) {
    if (!this.enabled) {
      throw new Error('X API not enabled - missing credentials');
    }

    try {
      const { confirmDeletion = false, batchSize = 5 } = options;
      
      if (!confirmDeletion) {
        throw new Error('Bulk deletion must be confirmed with confirmDeletion: true');
      }

      const results = [];
      const errors = [];
      
      // Process in batches to avoid rate limits
      for (let i = 0; i < tweetIds.length; i += batchSize) {
        const batch = tweetIds.slice(i, i + batchSize);
        const batchPromises = batch.map(async (tweetId) => {
          try {
            const result = await this.deletePost(tweetId, { confirmDeletion: true });
            results.push(result);
            return result;
          } catch (error) {
            const errorResult = { success: false, tweetId, error: error.message };
            errors.push(errorResult);
            return errorResult;
          }
        });

        await Promise.all(batchPromises);
        
        // Rate limiting delay between batches
        if (i + batchSize < tweetIds.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      logger.info(`Bulk deletion completed: ${results.length} successful, ${errors.length} failed`);
      
      return {
        successful: results,
        failed: errors,
        total: tweetIds.length,
        successCount: results.length,
        errorCount: errors.length
      };
    } catch (error) {
      logger.error('Error in bulk deletion:', error);
      throw error;
    }
  }

  // Analytics and insights
  async getEngagementAnalytics(options = {}) {
    if (!this.enabled) {
      throw new Error('X API not enabled - missing credentials');
    }

    try {
      const { count = 50, includeRetweets = false } = options;
      
      const timeline = await this.fetchMyTimeline({ count, includeRetweets });
      
      if (!timeline.posts || timeline.posts.length === 0) {
        return { posts: [], analytics: null };
      }

      const analytics = {
        totalPosts: timeline.posts.length,
        totalLikes: 0,
        totalRetweets: 0,
        totalReplies: 0,
        totalQuotes: 0,
        avgLikes: 0,
        avgRetweets: 0,
        avgReplies: 0,
        avgQuotes: 0,
        bestPerforming: null,
        worstPerforming: null,
        engagementTrends: []
      };

      let bestEngagement = 0;
      let worstEngagement = Infinity;
      let bestPost = null;
      let worstPost = null;

      timeline.posts.forEach(post => {
        const metrics = post.public_metrics || {};
        const likes = metrics.like_count || 0;
        const retweets = metrics.retweet_count || 0;
        const replies = metrics.reply_count || 0;
        const quotes = metrics.quote_count || 0;
        
        analytics.totalLikes += likes;
        analytics.totalRetweets += retweets;
        analytics.totalReplies += replies;
        analytics.totalQuotes += quotes;

        const totalEngagement = likes + retweets + replies + quotes;
        
        if (totalEngagement > bestEngagement) {
          bestEngagement = totalEngagement;
          bestPost = { ...post, totalEngagement };
        }
        
        if (totalEngagement < worstEngagement) {
          worstEngagement = totalEngagement;
          worstPost = { ...post, totalEngagement };
        }

        analytics.engagementTrends.push({
          date: post.created_at,
          likes,
          retweets,
          replies,
          quotes,
          total: totalEngagement
        });
      });

      analytics.avgLikes = Math.round(analytics.totalLikes / timeline.posts.length);
      analytics.avgRetweets = Math.round(analytics.totalRetweets / timeline.posts.length);
      analytics.avgReplies = Math.round(analytics.totalReplies / timeline.posts.length);
      analytics.avgQuotes = Math.round(analytics.totalQuotes / timeline.posts.length);
      analytics.bestPerforming = bestPost;
      analytics.worstPerforming = worstPost;

      logger.info(`Generated analytics for ${timeline.posts.length} posts`);
      
      return { posts: timeline.posts, analytics };
    } catch (error) {
      logger.error('Error generating engagement analytics:', error);
      throw error;
    }
  }

  async analyzeContent(options = {}) {
    if (!this.enabled) {
      throw new Error('X API not enabled - missing credentials');
    }

    try {
      const { count = 100 } = options;
      
      const timeline = await this.fetchMyTimeline({ count, includeRetweets: false });
      
      if (!timeline.posts || timeline.posts.length === 0) {
        return { posts: [], analysis: null };
      }

      const analysis = {
        totalPosts: timeline.posts.length,
        hashtags: {},
        mentions: {},
        urls: {},
        keywords: {},
        postTypes: {
          withHashtags: 0,
          withMentions: 0,
          withUrls: 0,
          withMedia: 0
        },
        contentPatterns: {
          avgLength: 0,
          shortPosts: 0, // < 100 chars
          mediumPosts: 0, // 100-200 chars  
          longPosts: 0, // > 200 chars
        }
      };

      let totalLength = 0;

      timeline.posts.forEach(post => {
        const text = post.text || '';
        const length = text.length;
        totalLength += length;

        // Length categorization
        if (length < 100) analysis.contentPatterns.shortPosts++;
        else if (length < 200) analysis.contentPatterns.mediumPosts++;
        else analysis.contentPatterns.longPosts++;

        // Extract hashtags
        const hashtags = text.match(/#[\w]+/g) || [];
        if (hashtags.length > 0) {
          analysis.postTypes.withHashtags++;
          hashtags.forEach(tag => {
            const cleanTag = tag.toLowerCase();
            analysis.hashtags[cleanTag] = (analysis.hashtags[cleanTag] || 0) + 1;
          });
        }

        // Extract mentions
        const mentions = text.match(/@[\w]+/g) || [];
        if (mentions.length > 0) {
          analysis.postTypes.withMentions++;
          mentions.forEach(mention => {
            const cleanMention = mention.toLowerCase();
            analysis.mentions[cleanMention] = (analysis.mentions[cleanMention] || 0) + 1;
          });
        }

        // Extract URLs
        const urls = text.match(/https?:\/\/[^\s]+/g) || [];
        if (urls.length > 0) {
          analysis.postTypes.withUrls++;
          urls.forEach(url => {
            try {
              const domain = new URL(url).hostname;
              analysis.urls[domain] = (analysis.urls[domain] || 0) + 1;
            } catch (e) {
              // Invalid URL, skip
            }
          });
        }

        // Extract keywords (basic implementation)
        const words = text.toLowerCase()
          .replace(/[^\w\s]/g, '')
          .split(/\s+/)
          .filter(word => word.length > 3 && !word.startsWith('@') && !word.startsWith('#'));
        
        words.forEach(word => {
          analysis.keywords[word] = (analysis.keywords[word] || 0) + 1;
        });

        // Check for media
        if (post.attachments && post.attachments.media_keys) {
          analysis.postTypes.withMedia++;
        }
      });

      analysis.contentPatterns.avgLength = Math.round(totalLength / timeline.posts.length);

      // Sort and limit results
      const sortAndLimit = (obj, limit = 10) => {
        return Object.entries(obj)
          .sort(([,a], [,b]) => b - a)
          .slice(0, limit)
          .reduce((result, [key, value]) => {
            result[key] = value;
            return result;
          }, {});
      };

      analysis.hashtags = sortAndLimit(analysis.hashtags);
      analysis.mentions = sortAndLimit(analysis.mentions);
      analysis.urls = sortAndLimit(analysis.urls);
      analysis.keywords = sortAndLimit(analysis.keywords, 20);

      logger.info(`Content analysis completed for ${timeline.posts.length} posts`);
      
      return { posts: timeline.posts, analysis };
    } catch (error) {
      logger.error('Error analyzing content:', error);
      throw error;
    }
  }

  // Export functionality
  async exportPosts(options = {}) {
    if (!this.enabled) {
      throw new Error('X API not enabled - missing credentials');
    }

    try {
      const { 
        count = 100, 
        format = 'json',
        includeMetrics = true,
        includeAnalysis = false
      } = options;
      
      const timeline = await this.fetchMyTimeline({ count, includeRetweets: true });
      
      if (!timeline.posts || timeline.posts.length === 0) {
        return { posts: [], exportData: null };
      }

      let exportData = timeline.posts.map(post => {
        const baseData = {
          id: post.id,
          text: post.text,
          created_at: post.created_at,
          author_id: post.author_id
        };

        if (includeMetrics && post.public_metrics) {
          baseData.likes = post.public_metrics.like_count;
          baseData.retweets = post.public_metrics.retweet_count;
          baseData.replies = post.public_metrics.reply_count;
          baseData.quotes = post.public_metrics.quote_count;
          baseData.impressions = post.public_metrics.impression_count;
        }

        return baseData;
      });

      let analysisData = null;
      if (includeAnalysis) {
        const contentAnalysis = await this.analyzeContent({ count });
        analysisData = contentAnalysis.analysis;
      }

      if (format === 'csv') {
        // Convert to CSV format
        if (exportData.length === 0) return { posts: [], exportData: '' };
        
        const headers = Object.keys(exportData[0]).join(',');
        const rows = exportData.map(row => 
          Object.values(row).map(value => 
            typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value
          ).join(',')
        );
        
        exportData = [headers, ...rows].join('\n');
      }

      logger.info(`Exported ${timeline.posts.length} posts in ${format} format`);
      
      return { 
        posts: timeline.posts, 
        exportData, 
        analysis: analysisData,
        format,
        exportedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error exporting posts:', error);
      throw error;
    }
  }

  // Get campaign status for monitoring
  getStatus() {
    const currentDay = this.getCurrentCampaignDay();
    const totalPosts = this.campaignData.length * 12; // Each day has variable posts, but average 12
    const postsCompleted = Math.max(0, currentDay * 12); // Rough estimate
    
    return {
      enabled: this.enabled,
      campaignDay: currentDay,
      totalDays: 7,
      postsScheduled: totalPosts,
      postsCompleted: postsCompleted,
      progress: `${Math.round((postsCompleted / totalPosts) * 100)}%`,
      campaignActive: currentDay >= 0 && currentDay <= 6
    };
  }

  // Method to create campaign data table (future use)
  async ensureCampaignTable() {
    // This could be implemented later if we want to track posts in database
    logger.info('X campaign table management not implemented yet');
  }
}

module.exports = XCampaignJob;