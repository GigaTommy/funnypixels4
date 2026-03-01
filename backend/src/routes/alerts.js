/**
 * 告警路由
 * 接收Prometheus Alertmanager的webhook告警
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

/**
 * Alertmanager Webhook端点
 * 接收告警通知
 *
 * POST /api/alerts/webhook
 *
 * Alertmanager发送的数据格式：
 * {
 *   "version": "4",
 *   "groupKey": "...",
 *   "status": "firing" | "resolved",
 *   "receiver": "default",
 *   "alerts": [
 *     {
 *       "status": "firing",
 *       "labels": {
 *         "alertname": "HighErrorRate",
 *         "severity": "critical",
 *         "app": "funnypixels"
 *       },
 *       "annotations": {
 *         "summary": "API错误率过高",
 *         "description": "5xx错误率超过5%"
 *       },
 *       "startsAt": "2024-01-01T00:00:00Z",
 *       "endsAt": "0001-01-01T00:00:00Z"
 *     }
 *   ]
 * }
 */
router.post('/webhook', async (req, res) => {
  try {
    const { status, alerts } = req.body;

    if (!alerts || !Array.isArray(alerts)) {
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }

    // 记录告警到日志
    for (const alert of alerts) {
      const logLevel = alert.labels.severity === 'critical' ? 'error' : 'warn';

      logger[logLevel]('Prometheus Alert', {
        status: alert.status,
        alertname: alert.labels.alertname,
        severity: alert.labels.severity,
        summary: alert.annotations.summary,
        description: alert.annotations.description,
        startsAt: alert.startsAt,
        endsAt: alert.endsAt
      });

      // TODO: 这里可以添加更多告警处理逻辑：
      // - 发送邮件通知
      // - 发送Slack/钉钉/企业微信通知
      // - 存储到数据库以便在管理后台查看
      // - 触发自动恢复流程
    }

    // 返回成功响应
    res.status(200).json({
      success: true,
      received: alerts.length,
      status
    });

  } catch (error) {
    logger.error('Alert webhook error', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * 获取告警历史（TODO）
 * GET /api/alerts/history
 */
router.get('/history', async (req, res) => {
  // TODO: 实现告警历史查询
  // 需要先在数据库中存储告警记录
  res.status(501).json({
    message: 'Not implemented yet',
    todo: 'Implement alert history storage and retrieval'
  });
});

module.exports = router;
