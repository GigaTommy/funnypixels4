const { db } = require('../config/database');

class PatternUpload {
  constructor(data) {
    this.id = data.id;
    this.user_id = data.user_id;
    this.name = data.name;
    this.description = data.description;
    this.image_data = data.image_data;
    this.width = data.width;
    this.height = data.height;
    this.color_count = data.color_count;
    this.service_type = data.service_type;
    this.review_status = data.review_status;
    this.risk_level = data.risk_level;
    this.ai_detection_results = data.ai_detection_results;
    this.ai_confidence = data.ai_confidence;
    this.reviewer_id = data.reviewer_id;
    this.reviewed_at = data.reviewed_at;
    this.review_notes = data.review_notes;
    this.copyright_evidence_id = data.copyright_evidence_id;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  // 创建图案上传
  static async create(uploadData) {
    const {
      user_id,
      name,
      description,
      image_data,
      width,
      height,
      color_count,
      service_type = 'free'
    } = uploadData;

    try {
      const [upload] = await db('pattern_uploads')
        .insert({
          user_id,
          name,
          description,
          image_data,
          width,
          height,
          color_count,
          service_type
        })
        .returning('*');

      return new PatternUpload(upload);
    } catch (error) {
      console.error('创建图案上传失败:', error);
      throw error;
    }
  }

  // 根据ID获取图案上传
  static async getById(id) {
    try {
      const upload = await db('pattern_uploads')
        .where('id', id)
        .first();

      return upload ? new PatternUpload(upload) : null;
    } catch (error) {
      console.error('获取图案上传失败:', error);
      throw error;
    }
  }

  // 获取用户的图案上传列表
  static async getByUserId(userId, options = {}) {
    const { limit = 20, offset = 0, status } = options;

    try {
      let query = db('pattern_uploads')
        .where('user_id', userId)
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset);

      if (status) {
        query = query.where('review_status', status);
      }

      const uploads = await query;
      return uploads.map(upload => new PatternUpload(upload));
    } catch (error) {
      console.error('获取用户图案上传列表失败:', error);
      throw error;
    }
  }

  // 获取待审核的图案列表
  static async getPendingReviews(options = {}) {
    const { limit = 20, offset = 0, risk_level } = options;

    try {
      let query = db('pattern_uploads')
        .whereIn('review_status', ['pending', 'human_review'])
        .orderBy('created_at', 'asc')
        .limit(limit)
        .offset(offset);

      if (risk_level) {
        query = query.where('risk_level', risk_level);
      }

      const uploads = await query;
      return uploads.map(upload => new PatternUpload(upload));
    } catch (error) {
      console.error('获取待审核图案列表失败:', error);
      throw error;
    }
  }

  // 更新审核状态
  static async updateReviewStatus(id, reviewData) {
    const {
      review_status,
      risk_level,
      ai_detection_results,
      ai_confidence,
      reviewer_id,
      review_notes
    } = reviewData;

    try {
      const [upload] = await db('pattern_uploads')
        .where('id', id)
        .update({
          review_status,
          risk_level,
          ai_detection_results,
          ai_confidence,
          reviewer_id,
          reviewed_at: db.fn.now(),
          review_notes,
          updated_at: db.fn.now()
        })
        .returning('*');

      return upload ? new PatternUpload(upload) : null;
    } catch (error) {
      console.error('更新审核状态失败:', error);
      throw error;
    }
  }

  // 更新服务类型
  static async updateServiceType(id, serviceType) {
    try {
      const [upload] = await db('pattern_uploads')
        .where('id', id)
        .update({
          service_type: serviceType,
          updated_at: db.fn.now()
        })
        .returning('*');

      return upload ? new PatternUpload(upload) : null;
    } catch (error) {
      console.error('更新服务类型失败:', error);
      throw error;
    }
  }

  // 删除图案上传
  static async delete(id) {
    try {
      const deleted = await db('pattern_uploads')
        .where('id', id)
        .del();

      return deleted > 0;
    } catch (error) {
      console.error('删除图案上传失败:', error);
      throw error;
    }
  }

  // 获取统计信息
  static async getStats() {
    try {
      const stats = await db('pattern_uploads')
        .select(
          db.raw('COUNT(*) as total'),
          db.raw('COUNT(CASE WHEN review_status = \'pending\' THEN 1 END) as pending'),
          db.raw('COUNT(CASE WHEN review_status = \'approved\' THEN 1 END) as approved'),
          db.raw('COUNT(CASE WHEN review_status = \'rejected\' THEN 1 END) as rejected'),
          db.raw('COUNT(CASE WHEN service_type = \'free\' THEN 1 END) as free'),
          db.raw('COUNT(CASE WHEN service_type = \'certified\' THEN 1 END) as certified'),
          db.raw('COUNT(CASE WHEN service_type = \'commercial\' THEN 1 END) as commercial')
        )
        .first();

      return stats;
    } catch (error) {
      console.error('获取统计信息失败:', error);
      throw error;
    }
  }
}

module.exports = PatternUpload;
