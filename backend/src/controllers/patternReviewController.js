const PatternUpload = require('../models/PatternUpload');
const { logReview } = require('./patternUploadController');

class PatternReviewController {
  // 获取待审核的图案列表
  static async getPendingReviews(req, res) {
    try {
      const { page = 1, limit = 20, risk_level, service_type } = req.query;
      const offset = (page - 1) * limit;

      const options = {
        limit: parseInt(limit),
        offset: parseInt(offset)
      };

      if (risk_level) {
        options.risk_level = risk_level;
      }

      const uploads = await PatternUpload.getPendingReviews(options);
      
      // 按服务类型过滤
      let filteredUploads = uploads;
      if (service_type) {
        filteredUploads = uploads.filter(upload => upload.service_type === service_type);
      }

      res.json({
        success: true,
        uploads: filteredUploads,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: filteredUploads.length
        }
      });

    } catch (error) {
      console.error('获取待审核列表失败:', error);
      res.status(500).json({ error: '服务器内部错误' });
    }
  }

  // 审核图案
  static async reviewPattern(req, res) {
    try {
      const { uploadId } = req.params;
      const { action, review_notes, risk_level } = req.body;
      const reviewerId = req.user.id;

      // 验证参数
      if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({ error: '无效的审核操作' });
      }

      if (!review_notes || review_notes.trim().length === 0) {
        return res.status(400).json({ error: '审核意见不能为空' });
      }

      // 获取图案上传记录
      const upload = await PatternUpload.getById(uploadId);
      if (!upload) {
        return res.status(404).json({ error: '图案不存在' });
      }

      // 检查是否已经审核过
      if (upload.review_status === 'approved' || upload.review_status === 'rejected') {
        return res.status(400).json({ error: '该图案已经审核过了' });
      }

      // 确定新的审核状态
      let newReviewStatus;
      if (action === 'approve') {
        newReviewStatus = 'approved';
      } else {
        newReviewStatus = 'rejected';
      }

      // 更新审核状态
      const reviewData = {
        review_status: newReviewStatus,
        reviewer_id: reviewerId,
        review_notes: review_notes.trim(),
        risk_level: risk_level || upload.risk_level
      };

      const updatedUpload = await PatternUpload.updateReviewStatus(uploadId, reviewData);

      if (!updatedUpload) {
        return res.status(500).json({ error: '更新审核状态失败' });
      }

      // 记录审核日志
      await logReview({
        upload_id: uploadId,
        reviewer_id: reviewerId,
        review_type: 'manual',
        action: action,
        notes: review_notes.trim(),
        metadata: {
          previous_status: upload.review_status,
          new_status: newReviewStatus,
          risk_level: risk_level
        }
      });

      res.json({
        success: true,
        upload: {
          id: updatedUpload.id,
          name: updatedUpload.name,
          review_status: updatedUpload.review_status,
          risk_level: updatedUpload.risk_level,
          review_notes: updatedUpload.review_notes,
          reviewed_at: updatedUpload.reviewed_at
        },
        message: action === 'approve' ? '审核通过' : '审核拒绝'
      });

    } catch (error) {
      console.error('审核图案失败:', error);
      res.status(500).json({ error: '服务器内部错误' });
    }
  }

  // 批量审核
  static async batchReview(req, res) {
    try {
      const { uploadIds, action, review_notes, risk_level } = req.body;
      const reviewerId = req.user.id;

      // 验证参数
      if (!Array.isArray(uploadIds) || uploadIds.length === 0) {
        return res.status(400).json({ error: '请选择要审核的图案' });
      }

      if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({ error: '无效的审核操作' });
      }

      if (!review_notes || review_notes.trim().length === 0) {
        return res.status(400).json({ error: '审核意见不能为空' });
      }

      const results = [];
      const errors = [];

      // 批量处理
      for (const uploadId of uploadIds) {
        try {
          // 获取图案上传记录
          const upload = await PatternUpload.getById(uploadId);
          if (!upload) {
            errors.push({ uploadId, error: '图案不存在' });
            continue;
          }

          // 检查是否已经审核过
          if (upload.review_status === 'approved' || upload.review_status === 'rejected') {
            errors.push({ uploadId, error: '该图案已经审核过了' });
            continue;
          }

          // 确定新的审核状态
          const newReviewStatus = action === 'approve' ? 'approved' : 'rejected';

          // 更新审核状态
          const reviewData = {
            review_status: newReviewStatus,
            reviewer_id: reviewerId,
            review_notes: review_notes.trim(),
            risk_level: risk_level || upload.risk_level
          };

          const updatedUpload = await PatternUpload.updateReviewStatus(uploadId, reviewData);

          if (updatedUpload) {
            results.push({
              uploadId,
              success: true,
              name: updatedUpload.name,
              review_status: updatedUpload.review_status
            });

            // 记录审核日志
            await logReview({
              upload_id: uploadId,
              reviewer_id: reviewerId,
              review_type: 'manual',
              action: action,
              notes: review_notes.trim(),
              metadata: {
                previous_status: upload.review_status,
                new_status: newReviewStatus,
                risk_level: risk_level,
                batch_review: true
              }
            });
          } else {
            errors.push({ uploadId, error: '更新审核状态失败' });
          }

        } catch (error) {
          console.error(`审核图案 ${uploadId} 失败:`, error);
          errors.push({ uploadId, error: '审核失败' });
        }
      }

      res.json({
        success: true,
        results,
        errors,
        summary: {
          total: uploadIds.length,
          success: results.length,
          failed: errors.length
        }
      });

    } catch (error) {
      console.error('批量审核失败:', error);
      res.status(500).json({ error: '服务器内部错误' });
    }
  }

  // 获取审核统计信息
  static async getReviewStats(req, res) {
    try {
      const stats = await PatternUpload.getStats();
      
      // 计算审核效率指标
      const total = parseInt(stats.total);
      const pending = parseInt(stats.pending);
      const approved = parseInt(stats.approved);
      const rejected = parseInt(stats.rejected);
      
      const reviewStats = {
        ...stats,
        review_efficiency: total > 0 ? ((approved + rejected) / total * 100).toFixed(1) : '0',
        approval_rate: (approved + rejected) > 0 ? (approved / (approved + rejected) * 100).toFixed(1) : '0',
        pending_ratio: total > 0 ? (pending / total * 100).toFixed(1) : '0'
      };

      res.json({
        success: true,
        stats: reviewStats
      });

    } catch (error) {
      console.error('获取审核统计失败:', error);
      res.status(500).json({ error: '服务器内部错误' });
    }
  }

  // 获取审核历史
  static async getReviewHistory(req, res) {
    try {
      const { page = 1, limit = 20, reviewer_id, action } = req.query;
      const offset = (page - 1) * limit;

      // 这里需要实现从 review_logs 表获取审核历史
      // 暂时返回空数组，等 review_logs 模型实现后再完善
      const history = [];

      res.json({
        success: true,
        history,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: 0
        }
      });

    } catch (error) {
      console.error('获取审核历史失败:', error);
      res.status(500).json({ error: '服务器内部错误' });
    }
  }
}

module.exports = PatternReviewController;
