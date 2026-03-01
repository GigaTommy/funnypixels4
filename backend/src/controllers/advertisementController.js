const { db } = require('../config/database');

class AdvertisementController {
  // 创建广告投放
  static async createAdvertisement(req, res) {
    try {
      const userId = req.user.id;
      const {
        title,
        description,
        icon_url,
        lat,
        lng,
        width = 1,
        height = 1,
        start_time,
        end_time,
        repeat_count = 1
      } = req.body;

      // 验证必需字段
      if (!title || !lat || !lng || !start_time || !end_time) {
        return res.status(400).json({ error: '标题、位置、开始时间和结束时间为必填项' });
      }

      // 验证时间
      const startDate = new Date(start_time);
      const endDate = new Date(end_time);
      const now = new Date();

      if (startDate <= now) {
        return res.status(400).json({ error: '开始时间必须晚于当前时间' });
      }

      if (endDate <= startDate) {
        return res.status(400).json({ error: '结束时间必须晚于开始时间' });
      }

      // 验证尺寸
      if (width < 1 || width > 10 || height < 1 || height > 10) {
        return res.status(400).json({ error: '广告尺寸必须在1x1到10x10之间' });
      }

      // 检查用户是否有足够的广告额度
      const userCredits = await db('user_ad_credits')
        .where('user_id', userId)
        .first();

      if (!userCredits || userCredits.credits <= 0) {
        return res.status(400).json({ error: '广告额度不足，请先购买广告道具' });
      }

      // 计算网格ID
      const gridX = Math.floor((parseFloat(lng) + 180) / 0.0001);
      const gridY = Math.floor((parseFloat(lat) + 90) / 0.0001);
      const gridId = `grid_${gridX}_${gridY}`;

      // 检查该位置是否已有广告
      const existingAd = await db('advertisements')
        .where('grid_id', gridId)
        .where('status', 'active')
        .first();

      if (existingAd) {
        return res.status(400).json({ error: '该位置已有广告投放' });
      }

      // 开始事务
      const result = await db.transaction(async (trx) => {
        // 创建广告
        const [advertisement] = await trx('advertisements').insert({
          user_id: userId,
          title,
          description,
          icon_url,
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          grid_id: gridId,
          width: parseInt(width),
          height: parseInt(height),
          start_time: startDate,
          end_time: endDate,
          repeat_count: parseInt(repeat_count),
          status: 'pending'
        }).returning('*');

        // 扣除广告额度
        await trx('user_ad_credits')
          .where('user_id', userId)
          .decrement('credits', 1);

        return advertisement;
      });

      const advertisement = result;

      res.status(201).json({
        success: true,
        message: '广告创建成功，等待审核',
        advertisement: {
          id: advertisement.id,
          title: advertisement.title,
          status: advertisement.status
        }
      });

    } catch (error) {
      console.error('创建广告失败:', error);
      res.status(500).json({
        success: false,
        error: '创建广告失败'
      });
    }
  }

  // 获取用户广告列表
  static async getUserAdvertisements(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 10 } = req.query;

      const offset = (page - 1) * limit;

      const advertisements = await db('advertisements')
        .where('user_id', userId)
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset);

      const total = await db('advertisements')
        .where('user_id', userId)
        .count('* as count')
        .first();

      res.json({
        success: true,
        data: advertisements,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total.count,
          totalPages: Math.ceil(total.count / limit)
        }
      });

    } catch (error) {
      console.error('获取用户广告列表失败:', error);
      res.status(500).json({
        success: false,
        error: '获取广告列表失败'
      });
    }
  }

  // 获取用户广告额度
  static async getUserAdCredits(req, res) {
    try {
      const userId = req.user.id;

      const userCredits = await db('user_ad_credits')
        .where('user_id', userId)
        .first();

      const usedCredits = await db('advertisements')
        .where('user_id', userId)
        .count('* as count')
        .first();

      const credits = userCredits ? userCredits.credits : 0;
      const used = parseInt(usedCredits.count);
      const available = Math.max(0, credits - used);

      res.json({
        success: true,
        data: {
          total: credits,
          used: used,
          available: available
        }
      });

    } catch (error) {
      console.error('获取用户广告额度失败:', error);
      res.status(500).json({
        success: false,
        error: '获取广告额度失败'
      });
    }
  }

  // 更新广告状态
  static async updateAdvertisementStatus(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const { status } = req.body;

      if (!['pending', 'active', 'paused', 'completed', 'rejected'].includes(status)) {
        return res.status(400).json({ error: '无效的状态值' });
      }

      const advertisement = await db('advertisements')
        .where('id', id)
        .where('user_id', userId)
        .first();

      if (!advertisement) {
        return res.status(404).json({ error: '广告不存在' });
      }

      await db('advertisements')
        .where('id', id)
        .update({
          status: status,
          updated_at: new Date()
        });

      res.json({
        success: true,
        message: '广告状态更新成功'
      });

    } catch (error) {
      console.error('更新广告状态失败:', error);
      res.status(500).json({
        success: false,
        error: '更新广告状态失败'
      });
    }
  }

  // 删除广告
  static async deleteAdvertisement(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const advertisement = await db('advertisements')
        .where('id', id)
        .where('user_id', userId)
        .first();

      if (!advertisement) {
        return res.status(404).json({ error: '广告不存在' });
      }

      if (advertisement.status === 'active') {
        return res.status(400).json({ error: '无法删除正在投放的广告' });
      }

      await db('advertisements')
        .where('id', id)
        .del();

      res.json({
        success: true,
        message: '广告删除成功'
      });

    } catch (error) {
      console.error('删除广告失败:', error);
      res.status(500).json({
        success: false,
        error: '删除广告失败'
      });
    }
  }

  // 获取活跃广告列表（公开接口）
  static async getActiveAdvertisements(req, res) {
    try {
      const { lat, lng, radius = 1000 } = req.query;

      if (!lat || !lng) {
        return res.status(400).json({ error: '缺少位置参数' });
      }

      const advertisements = await db('advertisements')
        .where('status', 'active')
        .where('start_time', '<=', new Date())
        .where('end_time', '>=', new Date())
        .select('*');

      // 这里可以添加地理位置过滤逻辑
      // 暂时返回所有活跃广告

      res.json({
        success: true,
        data: advertisements
      });

    } catch (error) {
      console.error('获取活跃广告失败:', error);
      res.status(500).json({
        success: false,
        error: '获取活跃广告失败'
      });
    }
  }
}

module.exports = AdvertisementController;
