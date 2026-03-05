/**
 * Client Performance Controller
 * Handles performance data from iOS/Android clients
 * Supports MetricKit (Apple) and custom performance reports
 */

const { db } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Submit client performance data
 * POST /api/performance/client
 *
 * Body (MetricKit format):
 * {
 *   type: "metric" | "diagnostic",
 *   deviceModel: "iPhone14,2",
 *   osVersion: "17.0",
 *   appVersion: "1.0.0",
 *   buildNumber: "42",
 *   metrics: { ... },
 *   timestamp: "2024-01-01T00:00:00Z"
 * }
 *
 * Body (Custom format):
 * {
 *   report_type: "startup" | "network" | "view_render",
 *   device_model: "iPhone14,2",
 *   os_version: "17.0",
 *   app_version: "1.0.0",
 *   build_number: "42",
 *   total_duration: 0.5,
 *   milestones: { ... },
 *   custom_metrics: { ... },
 *   memory_usage: 120.5,
 *   timestamp: "2024-01-01T00:00:00Z"
 * }
 */
async function submitPerformanceData(req, res) {
  try {
    const data = req.body;

    // Normalize data format (support both snake_case and camelCase)
    const normalizedData = {
      report_type: data.type || data.report_type || 'unknown',
      device_model: data.deviceModel || data.device_model,
      os_version: data.osVersion || data.os_version,
      app_version: data.appVersion || data.app_version,
      build_number: data.buildNumber || data.build_number,
      client_timestamp: data.timestamp,
      metrics: {}
    };

    // Build metrics object based on format
    if (data.metrics) {
      // MetricKit format
      normalizedData.metrics = typeof data.metrics === 'string'
        ? JSON.parse(data.metrics)
        : data.metrics;
    } else {
      // Custom format
      normalizedData.metrics = {
        total_duration: data.total_duration,
        milestones: data.milestones,
        custom_metrics: data.custom_metrics || data.customMetrics,
        memory_usage: data.memory_usage || data.memoryUsage
      };
    }

    // Insert into database
    await db('client_performance_metrics').insert(normalizedData);

    logger.info(`📊 [Performance] Received ${normalizedData.report_type} report from ${normalizedData.device_model}`);

    res.status(201).json({
      success: true,
      message: 'Performance data received'
    });

  } catch (error) {
    logger.error('❌ [Performance] Failed to save performance data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save performance data',
      details: error.message
    });
  }
}

/**
 * Get aggregated performance metrics
 * GET /api/performance/metrics?days=7&type=startup
 */
async function getPerformanceMetrics(req, res) {
  try {
    const {
      days = 7,
      type = null,
      deviceModel = null,
      appVersion = null
    } = req.query;

    // Build query
    let query = db('client_performance_metrics')
      .select('*')
      .where('created_at', '>=', db.raw(`NOW() - INTERVAL '${parseInt(days)} days'`))
      .orderBy('created_at', 'desc');

    // Apply filters
    if (type) {
      query = query.where('report_type', type);
    }
    if (deviceModel) {
      query = query.where('device_model', deviceModel);
    }
    if (appVersion) {
      query = query.where('app_version', appVersion);
    }

    const metrics = await query.limit(1000);

    // Calculate aggregations
    const aggregations = calculateAggregations(metrics);

    res.json({
      success: true,
      data: {
        metrics,
        aggregations,
        count: metrics.length,
        period_days: parseInt(days)
      }
    });

  } catch (error) {
    logger.error('❌ [Performance] Failed to fetch metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch metrics',
      details: error.message
    });
  }
}

/**
 * Get performance statistics
 * GET /api/performance/stats?days=30
 */
async function getPerformanceStats(req, res) {
  try {
    const { days = 30 } = req.query;

    // Get counts by report type
    const typeCounts = await db('client_performance_metrics')
      .select('report_type')
      .count('* as count')
      .where('created_at', '>=', db.raw(`NOW() - INTERVAL '${parseInt(days)} days'`))
      .groupBy('report_type')
      .orderBy('count', 'desc');

    // Get counts by device model
    const deviceCounts = await db('client_performance_metrics')
      .select('device_model')
      .count('* as count')
      .where('created_at', '>=', db.raw(`NOW() - INTERVAL '${parseInt(days)} days'`))
      .whereNotNull('device_model')
      .groupBy('device_model')
      .orderBy('count', 'desc')
      .limit(20);

    // Get counts by app version
    const versionCounts = await db('client_performance_metrics')
      .select('app_version')
      .count('* as count')
      .where('created_at', '>=', db.raw(`NOW() - INTERVAL '${parseInt(days)} days'`))
      .whereNotNull('app_version')
      .groupBy('app_version')
      .orderBy('count', 'desc');

    // Get daily trend
    const dailyTrend = await db('client_performance_metrics')
      .select(db.raw('DATE(created_at) as date'))
      .count('* as count')
      .where('created_at', '>=', db.raw(`NOW() - INTERVAL '${parseInt(days)} days'`))
      .groupBy(db.raw('DATE(created_at)'))
      .orderBy('date', 'desc');

    res.json({
      success: true,
      data: {
        by_type: typeCounts,
        by_device: deviceCounts,
        by_version: versionCounts,
        daily_trend: dailyTrend,
        period_days: parseInt(days)
      }
    });

  } catch (error) {
    logger.error('❌ [Performance] Failed to fetch stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stats',
      details: error.message
    });
  }
}

/**
 * Get startup performance metrics
 * GET /api/performance/startup?days=7
 */
async function getStartupMetrics(req, res) {
  try {
    const { days = 7 } = req.query;

    const startupData = await db('client_performance_metrics')
      .select('*')
      .where('report_type', 'startup')
      .where('created_at', '>=', db.raw(`NOW() - INTERVAL '${parseInt(days)} days'`))
      .orderBy('created_at', 'desc')
      .limit(1000);

    // Extract startup times
    const startupTimes = startupData
      .map(row => {
        const metrics = row.metrics;
        return {
          total: metrics.total_duration,
          device: row.device_model,
          version: row.app_version,
          milestones: metrics.milestones,
          timestamp: row.created_at
        };
      })
      .filter(row => row.total !== undefined && row.total !== null);

    // Calculate statistics
    if (startupTimes.length > 0) {
      const times = startupTimes.map(row => row.total);
      const stats = {
        count: times.length,
        avg: times.reduce((a, b) => a + b, 0) / times.length,
        min: Math.min(...times),
        max: Math.max(...times),
        p50: percentile(times, 50),
        p90: percentile(times, 90),
        p95: percentile(times, 95),
        p99: percentile(times, 99)
      };

      res.json({
        success: true,
        data: {
          stats,
          records: startupTimes,
          period_days: parseInt(days)
        }
      });
    } else {
      res.json({
        success: true,
        data: {
          stats: null,
          records: [],
          period_days: parseInt(days),
          message: 'No startup data available for the selected period'
        }
      });
    }

  } catch (error) {
    logger.error('❌ [Performance] Failed to fetch startup metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch startup metrics',
      details: error.message
    });
  }
}

// MARK: - Helper Functions

/**
 * Calculate aggregations from raw metrics
 */
function calculateAggregations(metrics) {
  if (metrics.length === 0) return null;

  const startupMetrics = metrics.filter(m => m.report_type === 'startup');
  const diagnosticMetrics = metrics.filter(m => m.report_type === 'diagnostic');

  return {
    total_reports: metrics.length,
    startup_reports: startupMetrics.length,
    diagnostic_reports: diagnosticMetrics.length,
    unique_devices: new Set(metrics.map(m => m.device_model).filter(Boolean)).size,
    unique_versions: new Set(metrics.map(m => m.app_version).filter(Boolean)).size
  };
}

/**
 * Calculate percentile
 */
function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = arr.slice().sort((a, b) => a - b);
  const index = Math.ceil((sorted.length * p) / 100) - 1;
  return sorted[Math.max(0, index)];
}

module.exports = {
  submitPerformanceData,
  getPerformanceMetrics,
  getPerformanceStats,
  getStartupMetrics
};
