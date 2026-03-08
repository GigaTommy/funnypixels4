const Region = require('../models/Region');
const { db } = require('../config/database');
const logger = require('../utils/logger');
const { normalizeUsersForDisplay } = require('../utils/userDisplayHelper');

class RegionController {
  // 获取所有地区列表
  static async getAllRegions(req, res) {
    try {
      const regions = await db('regions')
        .select('*')
        .where('is_active', true)
        .orderBy('name');

      res.json({
        success: true,
        regions: regions
      });
    } catch (error) {
      logger.error('获取地区列表失败', { error: error.message });
      res.status(500).json({
        success: false,
        message: '获取地区列表失败',
        error: error.message
      });
    }
  }

  // 获取地区详情
  static async getRegionDetails(req, res) {
    try {
      const { id } = req.params;
      
      const region = await db('regions')
        .select('*')
        .where('id', id)
        .where('is_active', true)
        .first();

      if (!region) {
        return res.status(404).json({
          success: false,
          message: '地区不存在'
        });
      }

      res.json({
        success: true,
        region: region
      });
    } catch (error) {
      logger.error('获取地区详情失败', { error: error.message, regionId: req.params.id });
      res.status(500).json({
        success: false,
        message: '获取地区详情失败',
        error: error.message
      });
    }
  }

  // 获取地区排行榜
  static async getRegionLeaderboard(req, res) {
    try {
      const { period = 'all' } = req.query;
      
      // 构建时间过滤条件
      let timeFilter = '';
      let timeParams = [];
      
      switch (period) {
      case 'daily':
        timeFilter = 'AND pixels.created_at >= NOW() - INTERVAL \'1 day\'';
        break;
      case 'weekly':
        timeFilter = 'AND pixels.created_at >= NOW() - INTERVAL \'7 days\'';
        break;
      case 'monthly':
        timeFilter = 'AND pixels.created_at >= NOW() - INTERVAL \'30 days\'';
        break;
      case 'all':
      default:
        timeFilter = '';
        break;
      }
      
      // 获取所有地区
      const regions = await db('regions')
        .select('*')
        .where('is_active', true)
        .orderBy('name');
      
      // 为每个地区计算统计数据
      const regionStats = await Promise.all(regions.map(async (region) => {
        // 计算该地区范围内的像素数量（基于像素流水）
        const pixelsInRegion = await db('pixels')
          .count('* as pixel_count')
          .whereRaw(`
            ST_DWithin(
              ST_MakePoint(lng, lat)::geography,
              ST_MakePoint(?, ?)::geography,
              ? * 1000
            ) ${timeFilter}
          `, [region.center_lng, region.center_lat, parseFloat(region.radius), ...timeParams])
          .first();
        
        // 计算该地区范围内的不重复用户数量（基于像素流水）
        const usersInRegion = await db('pixels')
          .countDistinct('user_id as user_count')
          .whereRaw(`
            ST_DWithin(
              ST_MakePoint(lng, lat)::geography,
              ST_MakePoint(?, ?)::geography,
              ? * 1000
            ) ${timeFilter}
          `, [region.center_lng, region.center_lat, parseFloat(region.radius), ...timeParams])
          .first();
        
        // 计算该地区范围内的不重复联盟数量（基于像素流水）
        const alliancesInRegion = await db('pixels')
          .join('users', 'pixels.user_id', 'users.id')
          .join('alliance_members', 'users.id', 'alliance_members.user_id')
          .join('alliances', 'alliance_members.alliance_id', 'alliances.id')
          .countDistinct('alliances.id as alliance_count')
          .whereRaw(`
            ST_DWithin(
              ST_MakePoint(pixels.lng, pixels.lat)::geography,
              ST_MakePoint(?, ?)::geography,
              ? * 1000
            ) ${timeFilter}
          `, [region.center_lng, region.center_lat, parseFloat(region.radius), ...timeParams])
          .first();
        
        return {
          id: region.id,
          name: region.name,
          code: region.code,
          flag: region.flag,
          color: region.color,
          center_lat: region.center_lat,
          center_lng: region.center_lng,
          radius: region.radius,
          description: region.description,
          user_count: parseInt(usersInRegion?.user_count || 0),
          pixel_count: parseInt(pixelsInRegion?.pixel_count || 0),
          alliance_count: parseInt(alliancesInRegion?.alliance_count || 0),
          score: parseInt(pixelsInRegion?.pixel_count || 0) + parseInt(usersInRegion?.user_count || 0) * 100
        };
      }));
      
      // 按分数排序
      regionStats.sort((a, b) => b.score - a.score);
      
      // 添加排名
      const rankedRegions = regionStats.map((region, index) => ({
        ...region,
        rank: index + 1
      }));
      
      res.json({
        success: true,
        regions: rankedRegions,
        period: period
      });
      
    } catch (error) {
      logger.error('获取地区排行榜失败', { error: error.message, regionId: req.params.id });
      res.status(500).json({
        success: false,
        message: '获取地区排行榜失败',
        error: error.message
      });
    }
  }

  // 获取地区详情（包含统计数据）
  static async getRegionDetailsWithStats(req, res) {
    try {
      const { id } = req.params;
      
      // 获取地区基本信息
      const region = await db('regions')
        .select('*')
        .where('id', id)
        .where('is_active', true)
        .first();
      
      if (!region) {
        return res.status(404).json({
          success: false,
          message: '地区不存在'
        });
      }
      
      // 计算地区统计数据（基于像素流水）
      const pixelCount = await db('pixels')
        .count('* as count')
        .whereRaw(`
          ST_DWithin(
            ST_MakePoint(lng, lat)::geography,
            ST_MakePoint(?, ?)::geography,
            ? * 1000
          )
        `, [region.center_lng, region.center_lat, parseFloat(region.radius)])
        .first();
      
      const userCount = await db('pixels')
        .countDistinct('user_id as count')
        .whereRaw(`
          ST_DWithin(
            ST_MakePoint(lng, lat)::geography,
            ST_MakePoint(?, ?)::geography,
            ? * 1000
          )
        `, [region.center_lng, region.center_lat, parseFloat(region.radius)])
        .first();
      
      const allianceCount = await db('pixels')
        .join('users', 'pixels.user_id', 'users.id')
        .join('alliance_members', 'users.id', 'alliance_members.user_id')
        .join('alliances', 'alliance_members.alliance_id', 'alliances.id')
        .countDistinct('alliances.id as count')
        .whereRaw(`
          ST_DWithin(
            ST_MakePoint(pixels.lng, pixels.lat)::geography,
            ST_MakePoint(?, ?)::geography,
            ? * 1000
          )
        `, [region.center_lng, region.center_lat, parseFloat(region.radius)])
        .first();
      
      // 获取该地区活跃用户（最近7天在该地区绘制过像素的用户）
      const activeUsersRaw = await db('pixels')
        .join('users', 'pixels.user_id', 'users.id')
        .select('users.id', 'users.username', 'users.display_name', 'users.avatar_url', 'users.avatar', 'users.account_status', 'users.total_pixels')
        .whereRaw(`
           ST_DWithin(
             ST_MakePoint(pixels.lng, pixels.lat)::geography,
             ST_MakePoint(?, ?)::geography,
             ? * 1000
           )
         `, [region.center_lng, region.center_lat, parseFloat(region.radius)])
        .where('pixels.created_at', '>=', db.raw('NOW() - INTERVAL \'7 days\''))
        .groupBy('users.id', 'users.username', 'users.display_name', 'users.avatar_url', 'users.account_status', 'users.total_pixels')
        .orderBy('users.total_pixels', 'desc')
        .limit(10);

      // Normalize user data to handle deleted accounts
      const activeUsers = normalizeUsersForDisplay(activeUsersRaw, { includeStats: true }).map(user => ({
        id: user.id,
        username: user.display_name,
        avatar_url: user.avatar_url,
        avatar: null, // Exclude raw pixel data for performance
        total_pixels: user.total_pixels || 0,
        is_deleted: user.is_deleted,
        clickable: user.clickable
      }));
      
      // 获取该地区活跃联盟（最近7天有成员在该地区绘制过像素的联盟）
      const activeAlliances = await db('pixels')
        .join('users', 'pixels.user_id', 'users.id')
        .join('alliance_members', 'users.id', 'alliance_members.user_id')
        .join('alliances', 'alliance_members.alliance_id', 'alliances.id')
        .select('alliances.id', 'alliances.name', 'alliances.flag', 'alliances.color', 'alliances.member_count', 'alliances.total_pixels')
        .whereRaw(`
           ST_DWithin(
             ST_MakePoint(pixels.lng, pixels.lat)::geography,
             ST_MakePoint(?, ?)::geography,
             ? * 1000
           )
         `, [region.center_lng, region.center_lat, parseFloat(region.radius)])
        .where('pixels.created_at', '>=', db.raw('NOW() - INTERVAL \'7 days\''))
        .where('alliances.is_active', true)
        .groupBy('alliances.id', 'alliances.name', 'alliances.flag', 'alliances.color', 'alliances.member_count', 'alliances.total_pixels')
        .orderBy('alliances.total_pixels', 'desc')
        .limit(10);
      
      const regionWithStats = {
        ...region,
        stats: {
          user_count: parseInt(userCount?.count || 0),
          pixel_count: parseInt(pixelCount?.count || 0),
          alliance_count: parseInt(allianceCount?.count || 0),
          active_users: activeUsers,
          active_alliances: activeAlliances
        }
      };
      
      res.json({
        success: true,
        region: regionWithStats
      });
      
    } catch (error) {
      logger.error('获取地区详情失败', { error: error.message, regionId: req.params.id });
      res.status(500).json({
        success: false,
        message: '获取地区详情失败',
        error: error.message
      });
    }
  }
}

module.exports = RegionController;
