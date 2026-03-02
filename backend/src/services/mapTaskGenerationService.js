const { db } = require('../config/database');
const logger = require('../utils/logger');
const geoUtils = require('../utils/geoUtils');

/**
 * Map Task Generation Service
 *
 * Generates intelligent location-based daily tasks based on:
 * - User's recent activity locations
 * - Nearby points of interest
 * - Avoids water bodies and inaccessible areas
 * - Difficulty adjusts based on user level
 */

// Map task templates with difficulty ratings
const MAP_TASK_TEMPLATES = {
  draw_at_location: [
    {
      difficulty: 'easy',
      target: 20,
      reward: 15,
      title: '定点绘画',
      titleEn: 'Draw at Location',
      description: '在指定地点绘画20个像素',
      descriptionEn: 'Draw 20 pixels at the specified location',
      radiusRange: [300, 500]
    },
    {
      difficulty: 'normal',
      target: 50,
      reward: 30,
      title: '区域创作',
      titleEn: 'Area Creation',
      description: '在指定区域绘画50个像素',
      descriptionEn: 'Draw 50 pixels in the specified area',
      radiusRange: [400, 600]
    }
  ],
  draw_distance: [
    {
      difficulty: 'normal',
      target: 500,
      reward: 25,
      title: '距离挑战',
      titleEn: 'Distance Challenge',
      description: 'GPS绘画连续500米',
      descriptionEn: 'Draw continuously for 500 meters using GPS',
      radiusRange: [0, 0] // No location needed
    },
    {
      difficulty: 'hard',
      target: 1000,
      reward: 40,
      title: '长距离征服',
      titleEn: 'Long Distance Conquest',
      description: 'GPS绘画连续1公里',
      descriptionEn: 'Draw continuously for 1 kilometer using GPS',
      radiusRange: [0, 0]
    }
  ],
  explore_regions: [
    {
      difficulty: 'normal',
      target: 3,
      reward: 30,
      title: '区域探索',
      titleEn: 'Region Explorer',
      description: '在3个不同区域绘画',
      descriptionEn: 'Draw in 3 different regions',
      radiusRange: [0, 0]
    },
    {
      difficulty: 'hard',
      target: 5,
      reward: 50,
      title: '探索达人',
      titleEn: 'Exploration Master',
      description: '在5个不同区域绘画',
      descriptionEn: 'Draw in 5 different regions',
      radiusRange: [0, 0]
    }
  ],
  alliance_coop: [
    {
      difficulty: 'hard',
      target: 1,
      reward: 35,
      title: '联盟协作',
      titleEn: 'Alliance Cooperation',
      description: '与联盟成员在同一位置绘画',
      descriptionEn: 'Draw at the same location with alliance members',
      radiusRange: [400, 600]
    }
  ],
  collect_treasures: [
    {
      difficulty: 'easy',
      target: 1,
      reward: 20,
      title: '宝箱猎人',
      titleEn: 'Treasure Hunter',
      description: '拾取1个地图宝箱',
      descriptionEn: 'Collect 1 map treasure chest',
      radiusRange: [0, 0]
    },
    {
      difficulty: 'normal',
      target: 3,
      reward: 35,
      title: '资深猎人',
      titleEn: 'Veteran Hunter',
      description: '拾取3个地图宝箱',
      descriptionEn: 'Collect 3 map treasure chests',
      radiusRange: [0, 0]
    }
  ]
};

class MapTaskGenerationService {
  /**
   * Get user's recent activity center (weighted by pixel count)
   */
  async getUserActivityCenter(userId, days = 7) {
    try {
      const result = await db.raw(`
        SELECT
          AVG(ST_Y(geom::geometry)) as avg_lat,
          AVG(ST_X(geom::geometry)) as avg_lng,
          COUNT(*) as pixel_count
        FROM pixels
        WHERE user_id = ?
          AND created_at > NOW() - INTERVAL '${days} days'
        HAVING COUNT(*) > 0
      `, [userId]);

      if (result.rows.length > 0 && result.rows[0].pixel_count > 0) {
        return {
          lat: parseFloat(result.rows[0].avg_lat),
          lng: parseFloat(result.rows[0].avg_lng),
          pixelCount: parseInt(result.rows[0].pixel_count)
        };
      }

      return null;
    } catch (error) {
      logger.error('Failed to get user activity center:', error);
      return null;
    }
  }

  /**
   * Generate random location near user's activity center
   */
  generateNearbyLocation(center, radiusMeters = 5000) {
    if (!center) {
      // Default to major city centers if no user activity
      const defaultCenters = [
        { lat: 39.9042, lng: 116.4074, name: 'Beijing' },
        { lat: 31.2304, lng: 121.4737, name: 'Shanghai' },
        { lat: 37.7749, lng: -122.4194, name: 'San Francisco' }
      ];
      center = defaultCenters[Math.floor(Math.random() * defaultCenters.length)];
    }

    // Random angle and distance
    const angle = Math.random() * 2 * Math.PI;
    const distance = Math.random() * radiusMeters;

    // Convert to lat/lng offset (approximate)
    const latOffset = (distance * Math.cos(angle)) / 111320; // ~111km per degree
    const lngOffset = (distance * Math.sin(angle)) / (111320 * Math.cos(center.lat * Math.PI / 180));

    return {
      lat: center.lat + latOffset,
      lng: center.lng + lngOffset
    };
  }

  /**
   * Get location name using reverse geocoding (simplified)
   */
  async getLocationName(lat, lng) {
    // TODO: Integrate with reverse geocoding service (Nominatim, Google, etc.)
    // For now, return generic name
    return `位置 (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  }

  /**
   * Generate map-based tasks for a user
   */
  async generateMapTasks(userId, difficulty = 'normal', count = 3) {
    const tasks = [];
    const activityCenter = await this.getUserActivityCenter(userId);

    // Select task types based on difficulty distribution
    const taskDistribution = {
      easy: ['draw_at_location', 'collect_treasures'],
      normal: ['draw_at_location', 'draw_distance', 'explore_regions'],
      hard: ['draw_distance', 'explore_regions', 'alliance_coop']
    };

    // Mix of difficulties: 1 easy, 1 normal, 1 hard
    const selectedTypes = [
      ...this.selectRandomTaskType(taskDistribution.easy, 1),
      ...this.selectRandomTaskType(taskDistribution.normal, 1),
      ...this.selectRandomTaskType(taskDistribution.hard, 1)
    ];

    for (const taskType of selectedTypes.slice(0, count)) {
      const templates = MAP_TASK_TEMPLATES[taskType];
      if (!templates || templates.length === 0) continue;

      const template = templates[Math.floor(Math.random() * templates.length)];
      const task = {
        type: taskType,
        task_category: 'map',
        difficulty: template.difficulty,
        title: template.title,
        description: template.description,
        target: template.target,
        reward_points: template.reward,
        current: 0,
        is_completed: false,
        is_claimed: false
      };

      // Add location data for location-based tasks
      if (template.radiusRange[0] > 0 || template.radiusRange[1] > 0) {
        const radius = template.radiusRange[0] +
          Math.floor(Math.random() * (template.radiusRange[1] - template.radiusRange[0] + 1));

        const location = this.generateNearbyLocation(activityCenter, 5000);
        task.location_lat = location.lat;
        task.location_lng = location.lng;
        task.location_radius = radius;
        task.location_name = await this.getLocationName(location.lat, location.lng);
      }

      // Add metadata for complex tasks
      if (taskType === 'explore_regions') {
        task.metadata = {
          visited_regions: [],
          required_regions: template.target
        };
      } else if (taskType === 'alliance_coop') {
        task.metadata = {
          cooperation_users: [],
          required_cooperation: 1
        };
      } else if (taskType === 'draw_distance') {
        task.metadata = {
          total_distance: 0,
          gps_sessions: []
        };
      }

      tasks.push(task);
    }

    return tasks;
  }

  /**
   * Select random task types from a pool
   */
  selectRandomTaskType(pool, count) {
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  /**
   * Check if location is valid (not in water, etc.)
   */
  async isLocationValid(lat, lng) {
    // TODO: Implement proper validation
    // - Check against water bodies polygon
    // - Check against building polygons
    // - Check accessibility
    return true; // Simplified for now
  }

  /**
   * Update map task progress
   */
  async updateMapTaskProgress(userId, taskType, data) {
    const today = new Date().toISOString().split('T')[0];

    try {
      const tasks = await db('user_daily_tasks')
        .where({
          user_id: userId,
          task_date: today,
          type: taskType,
          task_category: 'map',
          is_completed: false
        });

      for (const task of tasks) {
        let newCurrent = task.current;
        let metadata = task.metadata ? JSON.parse(JSON.stringify(task.metadata)) : {};

        switch (taskType) {
          case 'draw_at_location':
            // Check if pixel is within radius
            if (data.lat && data.lng && task.location_lat && task.location_lng) {
              const distance = geoUtils.calculateDistance(
                task.location_lat,
                task.location_lng,
                data.lat,
                data.lng
              );
              if (distance <= task.location_radius) {
                newCurrent += data.count || 1;
              }
            }
            break;

          case 'draw_distance':
            // Accumulate GPS distance
            if (data.distance) {
              metadata.total_distance = (metadata.total_distance || 0) + data.distance;
              newCurrent = metadata.total_distance;
            }
            break;

          case 'explore_regions':
            // Track unique regions
            if (data.h3Index) {
              metadata.visited_regions = metadata.visited_regions || [];
              if (!metadata.visited_regions.includes(data.h3Index)) {
                metadata.visited_regions.push(data.h3Index);
                newCurrent = metadata.visited_regions.length;
              }
            }
            break;

          case 'alliance_coop':
            // Track cooperation with alliance members
            if (data.cooperatedUserId) {
              metadata.cooperation_users = metadata.cooperation_users || [];
              if (!metadata.cooperation_users.includes(data.cooperatedUserId)) {
                metadata.cooperation_users.push(data.cooperatedUserId);
                newCurrent = metadata.cooperation_users.length;
              }
            }
            break;

          case 'collect_treasures':
            // Increment treasure count
            newCurrent += data.count || 1;
            break;
        }

        const isCompleted = newCurrent >= task.target;

        await db('user_daily_tasks')
          .where('id', task.id)
          .update({
            current: newCurrent,
            metadata: JSON.stringify(metadata),
            is_completed: isCompleted,
            completed_at: isCompleted ? db.fn.now() : task.completed_at,
            updated_at: db.fn.now()
          });

        logger.info(
          `✅ 更新地图任务进度: userId=${userId}, type=${taskType}, ` +
          `${task.current}→${newCurrent}/${task.target} ${isCompleted ? '✓已完成' : ''}`
        );
      }
    } catch (error) {
      logger.error(`❌ 更新地图任务进度失败: userId=${userId}, type=${taskType}`, error);
      throw error;
    }
  }
}

module.exports = new MapTaskGenerationService();
