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

/**
 * 根据用户语言获取本地化地图任务文本
 * @param {Object} template - 任务模板（包含所有语言的title和description）
 * @param {string} lang - 语言代码（zh-Hans, en, es, ja, ko, pt-BR）
 * @returns {Object} - 包含本地化的title和description
 */
function getLocalizedMapTask(template, lang) {
  const langMap = {
    'zh-Hans': { titleKey: 'title', descKey: 'description' },
    'zh-CN': { titleKey: 'title', descKey: 'description' },
    'zh': { titleKey: 'title', descKey: 'description' },
    'en': { titleKey: 'titleEn', descKey: 'descriptionEn' },
    'en-US': { titleKey: 'titleEn', descKey: 'descriptionEn' },
    'es': { titleKey: 'titleEs', descKey: 'descriptionEs' },
    'es-ES': { titleKey: 'titleEs', descKey: 'descriptionEs' },
    'ja': { titleKey: 'titleJa', descKey: 'descriptionJa' },
    'ja-JP': { titleKey: 'titleJa', descKey: 'descriptionJa' },
    'ko': { titleKey: 'titleKo', descKey: 'descriptionKo' },
    'ko-KR': { titleKey: 'titleKo', descKey: 'descriptionKo' },
    'pt-BR': { titleKey: 'titlePt', descKey: 'descriptionPt' },
    'pt': { titleKey: 'titlePt', descKey: 'descriptionPt' }
  };

  const keys = langMap[lang] || langMap['en'];

  return {
    title: template[keys.titleKey] || template.title || template.titleEn,
    description: template[keys.descKey] || template.description || template.descriptionEn
  };
}

// Map task templates with difficulty ratings
const MAP_TASK_TEMPLATES = {
  draw_at_location: [
    {
      difficulty: 'easy',
      target: 20,
      reward: 15,
      title: '定点绘画',
      titleEn: 'Draw at Location',
      titleEs: 'Dibujar en Ubicación',
      titleJa: '地点描画',
      titleKo: '위치 그리기',
      titlePt: 'Desenhar em Local',
      description: '在指定地点绘画20个像素',
      descriptionEn: 'Draw 20 pixels at the specified location',
      descriptionEs: 'Dibuja 20 píxeles en la ubicación especificada',
      descriptionJa: '指定された場所で20ピクセルを描画',
      descriptionKo: '지정된 위치에서 20픽셀 그리기',
      descriptionPt: 'Desenhe 20 pixels no local especificado',
      radiusRange: [300, 500]
    },
    {
      difficulty: 'normal',
      target: 50,
      reward: 30,
      title: '区域创作',
      titleEn: 'Area Creation',
      titleEs: 'Creación de Área',
      titleJa: 'エリア制作',
      titleKo: '영역 창작',
      titlePt: 'Criação de Área',
      description: '在指定区域绘画50个像素',
      descriptionEn: 'Draw 50 pixels in the specified area',
      descriptionEs: 'Dibuja 50 píxeles en el área especificada',
      descriptionJa: '指定されたエリアで50ピクセルを描画',
      descriptionKo: '지정된 영역에서 50픽셀 그리기',
      descriptionPt: 'Desenhe 50 pixels na área especificada',
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
      titleEs: 'Desafío de Distancia',
      titleJa: '距離チャレンジ',
      titleKo: '거리 도전',
      titlePt: 'Desafio de Distância',
      description: 'GPS绘画连续500米',
      descriptionEn: 'Draw continuously for 500 meters using GPS',
      descriptionEs: 'Dibuja continuamente durante 500 metros usando GPS',
      descriptionJa: 'GPSで500メートル連続して描画',
      descriptionKo: 'GPS로 500미터 연속 그리기',
      descriptionPt: 'Desenhe continuamente por 500 metros usando GPS',
      radiusRange: [0, 0] // No location needed
    },
    {
      difficulty: 'hard',
      target: 1000,
      reward: 40,
      title: '长距离征服',
      titleEn: 'Long Distance Conquest',
      titleEs: 'Conquista de Larga Distancia',
      titleJa: '長距離征服',
      titleKo: '장거리 정복',
      titlePt: 'Conquista de Longa Distância',
      description: 'GPS绘画连续1公里',
      descriptionEn: 'Draw continuously for 1 kilometer using GPS',
      descriptionEs: 'Dibuja continuamente durante 1 kilómetro usando GPS',
      descriptionJa: 'GPSで1キロメートル連続して描画',
      descriptionKo: 'GPS로 1킬로미터 연속 그리기',
      descriptionPt: 'Desenhe continuamente por 1 quilômetro usando GPS',
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
      titleEs: 'Explorador de Regiones',
      titleJa: 'エリア探索',
      titleKo: '지역 탐험',
      titlePt: 'Explorador de Regiões',
      description: '在3个不同区域绘画（建议相距500米以上）',
      descriptionEn: 'Draw in 3 different regions (500m+ apart recommended)',
      descriptionEs: 'Dibuja en 3 regiones diferentes (recomendado 500m+ de distancia)',
      descriptionJa: '3つの異なるエリアで描画（500m以上離れることを推奨）',
      descriptionKo: '3개의 다른 지역에서 그리기 (500m 이상 떨어진 곳 권장)',
      descriptionPt: 'Desenhe em 3 regiões diferentes (recomendado 500m+ de distância)',
      radiusRange: [0, 0]
    },
    {
      difficulty: 'hard',
      target: 5,
      reward: 50,
      title: '探索达人',
      titleEn: 'Exploration Master',
      titleEs: 'Maestro de Exploración',
      titleJa: '探索マスター',
      titleKo: '탐험 달인',
      titlePt: 'Mestre da Exploração',
      description: '在5个不同区域绘画（建议相距500米以上）',
      descriptionEn: 'Draw in 5 different regions (500m+ apart recommended)',
      descriptionEs: 'Dibuja en 5 regiones diferentes (recomendado 500m+ de distancia)',
      descriptionJa: '5つの異なるエリアで描画（500m以上離れることを推奨）',
      descriptionKo: '5개의 다른 지역에서 그리기 (500m 이상 떨어진 곳 권장)',
      descriptionPt: 'Desenhe em 5 regiões diferentes (recomendado 500m+ de distância)',
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
      titleEs: 'Cooperación de Alianza',
      titleJa: '同盟協力',
      titleKo: '동맹 협력',
      titlePt: 'Cooperação de Aliança',
      description: '与联盟成员在同一位置绘画',
      descriptionEn: 'Draw at the same location with alliance members',
      descriptionEs: 'Dibuja en la misma ubicación con miembros de la alianza',
      descriptionJa: '同盟メンバーと同じ場所で描画',
      descriptionKo: '동맹 회원과 같은 위치에서 그리기',
      descriptionPt: 'Desenhe no mesmo local com membros da aliança',
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
      titleEs: 'Cazador de Tesoros',
      titleJa: '宝箱ハンター',
      titleKo: '보물 사냥꾼',
      titlePt: 'Caçador de Tesouros',
      description: '拾取1个地图宝箱',
      descriptionEn: 'Collect 1 map treasure chest',
      descriptionEs: 'Recoge 1 cofre del tesoro del mapa',
      descriptionJa: 'マップの宝箱を1つ回収',
      descriptionKo: '지도 보물 상자 1개 수집',
      descriptionPt: 'Colete 1 baú de tesouro do mapa',
      radiusRange: [0, 0]
    },
    {
      difficulty: 'normal',
      target: 3,
      reward: 35,
      title: '资深猎人',
      titleEn: 'Veteran Hunter',
      titleEs: 'Cazador Veterano',
      titleJa: 'ベテランハンター',
      titleKo: '베테랑 사냥꾼',
      titlePt: 'Caçador Veterano',
      description: '拾取3个地图宝箱',
      descriptionEn: 'Collect 3 map treasure chests',
      descriptionEs: 'Recoge 3 cofres del tesoro del mapa',
      descriptionJa: 'マップの宝箱を3つ回収',
      descriptionKo: '지도 보물 상자 3개 수집',
      descriptionPt: 'Colete 3 baús de tesouro do mapa',
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

  /**
   * 获取地图任务模板（用于多语言处理）
   */
  getTaskTemplates() {
    return MAP_TASK_TEMPLATES;
  }

  /**
   * 获取本地化的地图任务文本
   */
  getLocalizedTask(template, lang) {
    return getLocalizedMapTask(template, lang);
  }
}

module.exports = new MapTaskGenerationService();
