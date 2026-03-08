const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../../middleware/auth');
const { db } = require('../../config/database');

router.use(authenticateToken, requireAdmin);

// GET /api/admin/system-alerts — 获取系统告警列表
router.get('/', async (req, res) => {
  try {
    const { type, severity, is_resolved, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = db('system_alerts').orderBy('created_at', 'desc');
    let countQuery = db('system_alerts');

    if (type) {
      query = query.where('type', type);
      countQuery = countQuery.where('type', type);
    }
    if (severity) {
      query = query.where('severity', severity);
      countQuery = countQuery.where('severity', severity);
    }
    if (is_resolved !== undefined) {
      const resolved = is_resolved === 'true';
      query = query.where('is_resolved', resolved);
      countQuery = countQuery.where('is_resolved', resolved);
    }

    const [alerts, totalResult] = await Promise.all([
      query.limit(parseInt(limit)).offset(offset),
      countQuery.count('id as count').first()
    ]);

    // 解析 details JSON
    const parsed = alerts.map(a => ({
      ...a,
      details: typeof a.details === 'string' ? JSON.parse(a.details) : a.details
    }));

    res.json({
      success: true,
      data: {
        alerts: parsed,
        total: parseInt(totalResult.count),
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('获取系统告警失败:', error);
    res.status(500).json({ success: false, message: '获取系统告警失败' });
  }
});

// GET /api/admin/system-alerts/unresolved-count — 未处理告警数量（用于侧边栏徽标）
router.get('/unresolved-count', async (req, res) => {
  try {
    const result = await db('system_alerts')
      .where('is_resolved', false)
      .count('id as count')
      .first();

    res.json({ success: true, count: parseInt(result.count) });
  } catch (error) {
    res.json({ success: true, count: 0 });
  }
});

// PUT /api/admin/system-alerts/:id/resolve — 标记告警已处理
router.put('/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    const { resolution_note } = req.body;

    const [updated] = await db('system_alerts')
      .where('id', id)
      .update({
        is_resolved: true,
        resolved_by: req.user.username || req.user.id,
        resolution_note: resolution_note || '',
        resolved_at: new Date()
      })
      .returning('*');

    if (!updated) {
      return res.status(404).json({ success: false, message: '告警不存在' });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('处理告警失败:', error);
    res.status(500).json({ success: false, message: '处理告警失败' });
  }
});

module.exports = router;
