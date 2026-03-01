const { db } = require('../config/database');

class Region {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.code = data.code;
    this.center_lat = data.center_lat;
    this.center_lng = data.center_lng;
    this.radius = data.radius;
    this.description = data.description;
    this.flag = data.flag;
    this.color = data.color;
    this.is_active = data.is_active;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  // 创建地区
  static async create(data) {
    const [region] = await db('regions').insert(data).returning('*');
    return new Region(region);
  }

  // 根据ID查找地区
  static async findById(id) {
    const region = await db('regions').where('id', id).first();
    return region ? new Region(region) : null;
  }

  // 根据代码查找地区
  static async findByCode(code) {
    const region = await db('regions').where('code', code).first();
    return region ? new Region(region) : null;
  }

  // 获取所有地区
  static async getAllRegions() {
    const regions = await db('regions')
      .orderBy('name', 'asc');
    return regions.map(region => new Region(region));
  }

  // 获取所有活跃地区
  static async getAllActive() {
    const regions = await db('regions')
      .where('is_active', true)
      .orderBy('name', 'asc');
    return regions.map(region => new Region(region));
  }

  // 根据坐标查找地区
  static async findByCoordinates(lat, lng) {
    const regions = await db('regions')
      .where('is_active', true)
      .select('*');
    
    // 计算距离并找到最近的地区
    let closestRegion = null;
    let minDistance = Infinity;
    
    for (const region of regions) {
      const distance = this.calculateDistance(lat, lng, region.center_lat, region.center_lng);
      if (distance <= region.radius && distance < minDistance) {
        minDistance = distance;
        closestRegion = region;
      }
    }
    
    return closestRegion ? new Region(closestRegion) : null;
  }

  // 计算两点间距离（公里）
  static calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // 地球半径（公里）
    const dLat = this.deg2rad(lat2 - lat1);
    const dLng = this.deg2rad(lng2 - lng1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // 角度转弧度
  static deg2rad(deg) {
    return deg * (Math.PI/180);
  }

  // 更新地区信息
  async update(data) {
    const allowedFields = ['name', 'description', 'flag', 'color', 'is_active'];
    const updateData = {};
    
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }
    
    updateData.updated_at = new Date();
    
    const [updated] = await db('regions')
      .where('id', this.id)
      .update(updateData)
      .returning('*');
    
    Object.assign(this, updated);
    return this;
  }

  // 删除地区
  async delete() {
    await db('regions').where('id', this.id).del();
  }

  // 获取地区排行榜
  async getLeaderboard(period = 'daily', date = new Date()) {
    const dateStr = date.toISOString().split('T')[0];
    
    let leaderboard = await db('region_leaderboards')
      .where({
        region_id: this.id,
        period: period,
        date: dateStr
      })
      .first();
    
    if (!leaderboard) {
      // 如果不存在，创建新的排行榜
      leaderboard = await this.generateLeaderboard(period, date);
    }
    
    return leaderboard;
  }

  // 生成地区排行榜
  async generateLeaderboard(period = 'daily', date = new Date()) {
    const dateStr = date.toISOString().split('T')[0];
    
    // 计算时间范围
    const { startDate, endDate } = this.getDateRange(period, date);
    
    // 获取地区内的像素数据
    const pixels = await this.getRegionPixels(startDate, endDate);
    
    // 统计用户数据
    const userStats = await this.getUserStats(pixels);
    
    // 统计联盟数据
    const allianceStats = await this.getAllianceStats(pixels);
    
    // 计算总数据
    const totalPixels = pixels.length;
    const totalUsers = userStats.length;
    const totalAlliances = allianceStats.length;
    
    // 获取前10名用户
    const topUsers = userStats
      .sort((a, b) => b.pixel_count - a.pixel_count)
      .slice(0, 10)
      .map(user => ({
        user_id: user.user_id,
        username: user.username,
        avatar_url: user.avatar_url,
        pixel_count: user.pixel_count,
        alliance_name: user.alliance_name,
        alliance_flag: user.alliance_flag
      }));
    
    // 获取前10名联盟
    const topAlliances = allianceStats
      .sort((a, b) => b.pixel_count - a.pixel_count)
      .slice(0, 10)
      .map(alliance => ({
        alliance_id: alliance.alliance_id,
        name: alliance.name,
        flag: alliance.flag,
        color: alliance.color,
        pixel_count: alliance.pixel_count,
        member_count: alliance.member_count
      }));
    
    // 保存或更新排行榜
    const leaderboardData = {
      region_id: this.id,
      period: period,
      date: dateStr,
      total_pixels: totalPixels,
      total_users: totalUsers,
      total_alliances: totalAlliances,
      top_users: JSON.stringify(topUsers),
      top_alliances: JSON.stringify(topAlliances),
      updated_at: new Date()
    };
    
    const [leaderboard] = await db('region_leaderboards')
      .insert(leaderboardData)
      .onConflict(['region_id', 'period', 'date'])
      .merge()
      .returning('*');
    
    return leaderboard;
  }

  // 获取时间范围
  getDateRange(period, date) {
    const startDate = new Date(date);
    const endDate = new Date(date);
    
    switch (period) {
    case 'daily':
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'weekly':
      const day = startDate.getDay();
      const diff = startDate.getDate() - day + (day === 0 ? -6 : 1);
      startDate.setDate(diff);
      startDate.setHours(0, 0, 0, 0);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'monthly':
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
      endDate.setMonth(endDate.getMonth() + 1, 0);
      endDate.setHours(23, 59, 59, 999);
      break;
    }
    
    return { startDate, endDate };
  }

  // 获取地区内的像素数据
  async getRegionPixels(startDate, endDate) {
    // 计算地区边界
    const bounds = this.getRegionBounds();
    
    return await db('pixels')
      .join('users', 'pixels.user_id', 'users.id')
      .whereBetween('pixels.lat', [bounds.minLat, bounds.maxLat])
      .whereBetween('pixels.lng', [bounds.minLng, bounds.maxLng])
      .whereBetween('pixels.created_at', [startDate, endDate])
      .select(
        'pixels.id',
        'pixels.user_id',
        'pixels.lat',
        'pixels.lng',
        'pixels.created_at',
        'users.username',
        'users.avatar_url'
      );
  }

  // 获取地区边界
  getRegionBounds() {
    const latDelta = this.radius / 111; // 1度纬度约等于111公里
    const lngDelta = this.radius / (111 * Math.cos(this.deg2rad(this.center_lat)));
    
    return {
      minLat: this.center_lat - latDelta,
      maxLat: this.center_lat + latDelta,
      minLng: this.center_lng - lngDelta,
      maxLng: this.center_lng + lngDelta
    };
  }

  // 获取用户统计
  async getUserStats(pixels) {
    const userStats = {};
    
    for (const pixel of pixels) {
      if (!userStats[pixel.user_id]) {
        userStats[pixel.user_id] = {
          user_id: pixel.user_id,
          username: pixel.username,
          avatar_url: pixel.avatar_url,
          pixel_count: 0,
          alliance_name: null,
          alliance_flag: null
        };
      }
      userStats[pixel.user_id].pixel_count++;
    }
    
    // 获取用户联盟信息
    const userIds = Object.keys(userStats);
    if (userIds.length > 0) {
      const allianceInfo = await db('alliance_members')
        .join('alliances', 'alliance_members.alliance_id', 'alliances.id')
        .whereIn('alliance_members.user_id', userIds)
        .select(
          'alliance_members.user_id',
          'alliances.name as alliance_name',
          'alliances.flag as alliance_flag'
        );
      
      for (const info of allianceInfo) {
        if (userStats[info.user_id]) {
          userStats[info.user_id].alliance_name = info.alliance_name;
          userStats[info.user_id].alliance_flag = info.alliance_flag;
        }
      }
    }
    
    return Object.values(userStats);
  }

  // 获取联盟统计
  async getAllianceStats(pixels) {
    const allianceStats = {};
    
    // 获取像素用户的联盟信息
    const userIds = pixels.map(p => p.user_id);
    const userAlliances = await db('alliance_members')
      .join('alliances', 'alliance_members.alliance_id', 'alliances.id')
      .whereIn('alliance_members.user_id', userIds)
      .select(
        'alliance_members.user_id',
        'alliance_members.alliance_id',
        'alliances.name',
        'alliances.flag',
        'alliances.color'
      );
    
    // 统计联盟数据
    for (const userAlliance of userAlliances) {
      if (!allianceStats[userAlliance.alliance_id]) {
        allianceStats[userAlliance.alliance_id] = {
          alliance_id: userAlliance.alliance_id,
          name: userAlliance.name,
          flag: userAlliance.flag,
          color: userAlliance.color,
          pixel_count: 0,
          member_count: 0
        };
      }
      allianceStats[userAlliance.alliance_id].pixel_count++;
    }
    
    // 计算成员数
    for (const allianceId of Object.keys(allianceStats)) {
      const memberCount = await db('alliance_members')
        .where('alliance_id', allianceId)
        .count('* as count')
        .first();
      allianceStats[allianceId].member_count = parseInt(memberCount.count);
    }
    
    return Object.values(allianceStats);
  }
}

module.exports = Region;
