const https = require('https');
const { db: knex } = require('../config/database');
const logger = require('../utils/logger');

/**
 * 预设区域管理服务
 *
 * 功能：
 * 1. 搜索区域（调用高德POI搜索）
 * 2. 获取区域边界（调用高德行政区划API）
 * 3. 管理预设区域（CRUD）
 * 4. 支持用户自定义区域
 */
class PresetRegionService {
    constructor() {
        this.apiKey = process.env.AMAP_API_KEY || process.env.VITE_AMAP_WEB_SERVICE_KEY;

        // 高德API端点
        this.endpoints = {
            poi: 'https://restapi.amap.com/v3/place/text',           // POI搜索
            district: 'https://restapi.amap.com/v3/config/district', // 行政区划
            around: 'https://restapi.amap.com/v3/place/around'       // 周边搜索
        };

        // 区域分类映射（高德POI类型 -> 我们的分类）
        this.categoryMap = {
            '风景名胜': 'tourist',
            '公园广场': 'park',
            '购物服务': 'shopping',
            '商务住宅': 'business',
            '体育休闲服务': 'sports',
            '科教文化服务': 'education',
            '餐饮服务': 'food',
            '住宿服务': 'hotel'
        };

        // 缓存
        this.cache = new Map();
        this.cacheTTL = 30 * 60 * 1000; // 30分钟

        logger.info('🗺️ 预设区域服务初始化完成');
    }

    /**
     * 搜索区域（调用高德POI搜索）
     * @param {string} keyword - 搜索关键词
     * @param {string} city - 城市名称（可选）
     * @param {Object} options - 其他选项
     * @returns {Promise<Array>} 搜索结果
     */
    async searchRegions(keyword, city = '', options = {}) {
        if (!keyword || keyword.trim().length === 0) {
            return [];
        }

        const cacheKey = `search:${keyword}:${city}`;
        const cached = this.getFromCache(cacheKey);
        if (cached) {
            logger.debug(`📋 使用缓存的搜索结果: ${keyword}`);
            return cached;
        }

        try {
            const params = new URLSearchParams({
                key: this.apiKey,
                keywords: keyword,
                city: city,
                citylimit: city ? 'true' : 'false',
                offset: options.limit || 20,
                page: options.page || 1,
                extensions: 'all',  // 返回详细信息
                output: 'json'
            });

            const url = `${this.endpoints.poi}?${params.toString()}`;
            const response = await this.httpGet(url);

            if (response.status !== '1') {
                logger.warn(`⚠️ 高德POI搜索失败: ${response.info}`);
                return [];
            }

            const results = (response.pois || []).map(poi => this.formatPOIResult(poi));

            // 缓存结果
            this.setCache(cacheKey, results);

            logger.info(`🔍 搜索区域 "${keyword}" 返回 ${results.length} 个结果`);
            return results;

        } catch (error) {
            logger.error('❌ 搜索区域失败:', error);
            return [];
        }
    }

    /**
     * 获取行政区划边界
     * @param {string} adcode - 行政区划代码
     * @param {Object} options - 选项
     * @returns {Promise<Object|null>} 区域边界信息
     */
    async fetchDistrictBoundary(adcode, options = {}) {
        if (!adcode) {
            return null;
        }

        const cacheKey = `district:${adcode}`;
        const cached = this.getFromCache(cacheKey);
        if (cached) {
            logger.debug(`📋 使用缓存的行政区划边界: ${adcode}`);
            return cached;
        }

        try {
            const params = new URLSearchParams({
                key: this.apiKey,
                keywords: adcode,
                subdistrict: options.subdistrict || 0,  // 不返回下级
                extensions: 'all',  // 返回边界
                output: 'json'
            });

            const url = `${this.endpoints.district}?${params.toString()}`;
            const response = await this.httpGet(url);

            if (response.status !== '1' || !response.districts || response.districts.length === 0) {
                logger.warn(`⚠️ 获取行政区划边界失败: ${adcode}`);
                return null;
            }

            const district = response.districts[0];
            const result = this.formatDistrictResult(district);

            // 缓存结果
            this.setCache(cacheKey, result);

            logger.info(`✅ 获取行政区划边界成功: ${result.name} (${adcode})`);
            return result;

        } catch (error) {
            logger.error('❌ 获取行政区划边界失败:', error);
            return null;
        }
    }

    /**
     * 通过名称搜索并获取边界
     * @param {string} name - 区域名称
     * @param {string} city - 所在城市（可选）
     * @returns {Promise<Object|null>} 区域信息（含边界）
     */
    async searchAndGetBoundary(name, city = '') {
        try {
            // 1. 先搜索区域
            const searchResults = await this.searchRegions(name, city, { limit: 5 });

            if (searchResults.length === 0) {
                // 尝试作为行政区划搜索
                const districtResult = await this.fetchDistrictBoundary(name);
                if (districtResult) {
                    return districtResult;
                }
                return null;
            }

            const firstResult = searchResults[0];

            // 2. 如果有adcode，尝试获取精确边界
            if (firstResult.adcode) {
                const districtBoundary = await this.fetchDistrictBoundary(firstResult.adcode);
                if (districtBoundary && districtBoundary.boundary) {
                    return {
                        ...firstResult,
                        boundary: districtBoundary.boundary,
                        level: districtBoundary.level
                    };
                }
            }

            // 3. 如果没有边界，使用POI的位置生成一个默认区域
            if (!firstResult.boundary && firstResult.center_lat && firstResult.center_lng) {
                firstResult.boundary = this.generateDefaultBoundary(
                    firstResult.center_lat,
                    firstResult.center_lng,
                    500 // 默认500米半径
                );
            }

            return firstResult;

        } catch (error) {
            logger.error('❌ 搜索并获取边界失败:', error);
            return null;
        }
    }

    /**
     * 保存预设区域到数据库
     * @param {Object} regionData - 区域数据
     * @returns {Promise<Object>} 保存的区域
     */
    async savePresetRegion(regionData) {
        try {
            const data = {
                name: regionData.name,
                code: regionData.code || regionData.adcode,
                level: regionData.level || 'poi_area',
                category: regionData.category || 'other',
                boundary: regionData.boundary ? JSON.stringify(regionData.boundary) : null,
                center_lat: regionData.center_lat,
                center_lng: regionData.center_lng,
                area_km2: regionData.area_km2,
                source: regionData.source || 'amap',
                source_id: regionData.source_id,
                source_name: regionData.source_name,
                tags: regionData.tags ? JSON.stringify(regionData.tags) : '[]',
                description: regionData.description,
                address: regionData.address,
                city: regionData.city,
                province: regionData.province,
                color: regionData.color,
                icon_url: regionData.icon_url,
                cover_url: regionData.cover_url,
                is_active: true,
                is_featured: regionData.is_featured || false,
                sort_order: regionData.sort_order || 0,
                updated_at: new Date()
            };

            // 检查是否已存在相同code的区域
            if (data.code) {
                const existing = await knex('preset_regions').where('code', data.code).first();
                if (existing) {
                    // 更新现有记录
                    const [updated] = await knex('preset_regions')
                        .where('id', existing.id)
                        .update(data)
                        .returning('*');
                    logger.info(`📝 更新预设区域: ${data.name} (${data.code})`);
                    return this.formatDBRegion(updated);
                }
            }

            // 插入新记录
            const [inserted] = await knex('preset_regions')
                .insert(data)
                .returning('*');

            logger.info(`✅ 保存预设区域: ${data.name}`);
            return this.formatDBRegion(inserted);

        } catch (error) {
            logger.error('❌ 保存预设区域失败:', error);
            throw error;
        }
    }

    /**
     * 获取预设区域列表
     * @param {Object} params - 查询参数
     * @returns {Promise<Object>} { list, total }
     */
    async listPresetRegions(params = {}) {
        try {
            const {
                category,
                level,
                city,
                is_featured,
                is_active = true,
                keyword,
                page = 1,
                pageSize = 20
            } = params;

            let query = knex('preset_regions');

            // 过滤条件
            if (is_active !== undefined) {
                query = query.where('is_active', is_active);
            }
            if (category) {
                query = query.where('category', category);
            }
            if (level) {
                query = query.where('level', level);
            }
            if (city) {
                query = query.where('city', city);
            }
            if (is_featured !== undefined) {
                query = query.where('is_featured', is_featured);
            }
            if (keyword) {
                query = query.where(function () {
                    this.where('name', 'ilike', `%${keyword}%`)
                        .orWhere('address', 'ilike', `%${keyword}%`);
                });
            }

            // 计算总数
            const [{ count }] = await query.clone().count('* as count');

            // 分页查询
            const list = await query
                .orderBy('sort_order', 'desc')
                .orderBy('usage_count', 'desc')
                .orderBy('created_at', 'desc')
                .limit(pageSize)
                .offset((page - 1) * pageSize);

            return {
                list: list.map(r => this.formatDBRegion(r)),
                total: parseInt(count),
                page,
                pageSize
            };

        } catch (error) {
            logger.error('❌ 获取预设区域列表失败:', error);
            throw error;
        }
    }

    /**
     * 获取单个预设区域
     * @param {number} id - 区域ID
     * @returns {Promise<Object|null>}
     */
    async getPresetRegion(id) {
        try {
            const region = await knex('preset_regions').where('id', id).first();
            return region ? this.formatDBRegion(region) : null;
        } catch (error) {
            logger.error('❌ 获取预设区域失败:', error);
            throw error;
        }
    }

    /**
     * 更新预设区域
     * @param {number} id - 区域ID
     * @param {Object} updateData - 更新数据
     * @returns {Promise<Object|null>}
     */
    async updatePresetRegion(id, updateData) {
        try {
            const data = {};

            // 只更新提供的字段
            if (updateData.name !== undefined) data.name = updateData.name;
            if (updateData.code !== undefined) data.code = updateData.code;
            if (updateData.level !== undefined) data.level = updateData.level;
            if (updateData.category !== undefined) data.category = updateData.category;
            if (updateData.boundary !== undefined) {
                data.boundary = updateData.boundary ? JSON.stringify(updateData.boundary) : null;
            }
            if (updateData.center_lat !== undefined) data.center_lat = updateData.center_lat;
            if (updateData.center_lng !== undefined) data.center_lng = updateData.center_lng;
            if (updateData.area_km2 !== undefined) data.area_km2 = updateData.area_km2;
            if (updateData.source !== undefined) data.source = updateData.source;
            if (updateData.source_id !== undefined) data.source_id = updateData.source_id;
            if (updateData.source_name !== undefined) data.source_name = updateData.source_name;
            if (updateData.tags !== undefined) {
                data.tags = JSON.stringify(updateData.tags);
            }
            if (updateData.description !== undefined) data.description = updateData.description;
            if (updateData.address !== undefined) data.address = updateData.address;
            if (updateData.city !== undefined) data.city = updateData.city;
            if (updateData.province !== undefined) data.province = updateData.province;
            if (updateData.color !== undefined) data.color = updateData.color;
            if (updateData.icon_url !== undefined) data.icon_url = updateData.icon_url;
            if (updateData.cover_url !== undefined) data.cover_url = updateData.cover_url;
            if (updateData.is_active !== undefined) data.is_active = updateData.is_active;
            if (updateData.is_featured !== undefined) data.is_featured = updateData.is_featured;
            if (updateData.sort_order !== undefined) data.sort_order = updateData.sort_order;

            data.updated_at = new Date();

            const [updated] = await knex('preset_regions')
                .where('id', id)
                .update(data)
                .returning('*');

            if (!updated) {
                return null;
            }

            logger.info(`📝 更新预设区域: ${updated.name} (ID: ${id})`);
            return this.formatDBRegion(updated);

        } catch (error) {
            logger.error('❌ 更新预设区域失败:', error);
            throw error;
        }
    }

    /**
     * 删除预设区域
     * @param {number} id - 区域ID
     * @returns {Promise<boolean>}
     */
    async deletePresetRegion(id) {
        try {
            const deleted = await knex('preset_regions')
                .where('id', id)
                .del();
            logger.info(`🗑️ 删除预设区域: ${id}`);
            return deleted > 0;
        } catch (error) {
            logger.error('❌ 删除预设区域失败:', error);
            throw error;
        }
    }

    /**
     * 增加使用次数
     * @param {number} id - 区域ID
     */
    async incrementUsageCount(id) {
        try {
            await knex('preset_regions')
                .where('id', id)
                .increment('usage_count', 1);
        } catch (error) {
            logger.error('❌ 增加使用次数失败:', error);
        }
    }

    /**
     * 获取热门区域
     * @param {number} limit - 数量限制
     * @returns {Promise<Array>}
     */
    async getPopularRegions(limit = 10) {
        try {
            const regions = await knex('preset_regions')
                .where('is_active', true)
                .orderBy('usage_count', 'desc')
                .limit(limit);
            return regions.map(r => this.formatDBRegion(r));
        } catch (error) {
            logger.error('❌ 获取热门区域失败:', error);
            return [];
        }
    }

    /**
     * 获取推荐区域
     * @param {number} limit - 数量限制
     * @returns {Promise<Array>}
     */
    async getFeaturedRegions(limit = 10) {
        try {
            const regions = await knex('preset_regions')
                .where('is_active', true)
                .where('is_featured', true)
                .orderBy('sort_order', 'desc')
                .limit(limit);
            return regions.map(r => this.formatDBRegion(r));
        } catch (error) {
            logger.error('❌ 获取推荐区域失败:', error);
            return [];
        }
    }

    // ==================== 内部方法 ====================

    /**
     * 格式化POI搜索结果
     */
    formatPOIResult(poi) {
        const location = poi.location ? poi.location.split(',') : [0, 0];

        return {
            name: poi.name,
            source_id: poi.id,
            source_name: poi.name,
            source: 'amap',
            address: poi.address || '',
            city: poi.cityname || '',
            province: poi.pname || '',
            adcode: poi.adcode || '',
            category: this.mapCategory(poi.type || ''),
            center_lng: parseFloat(location[0]),
            center_lat: parseFloat(location[1]),
            level: 'poi_area',
            tags: poi.type ? poi.type.split(';') : [],
            // POI通常没有边界，需要后续通过行政区划API获取或生成默认边界
            boundary: null
        };
    }

    /**
     * 格式化行政区划结果
     */
    formatDistrictResult(district) {
        const center = district.center ? district.center.split(',') : [0, 0];

        // 解析边界多边形
        let boundary = null;
        if (district.polyline) {
            boundary = this.parsePolyline(district.polyline);
        }

        return {
            name: district.name,
            code: district.adcode,
            source_id: district.adcode,
            source_name: district.name,
            source: 'amap',
            city: district.citycode || '',
            adcode: district.adcode,
            level: district.level || 'district',
            center_lng: parseFloat(center[0]),
            center_lat: parseFloat(center[1]),
            boundary: boundary,
            category: 'administrative'
        };
    }

    /**
     * 解析高德polyline为GeoJSON
     */
    parsePolyline(polyline) {
        if (!polyline) return null;

        try {
            // 高德返回的polyline格式：用 | 分隔多个多边形，用 ; 分隔点，用 , 分隔经纬度
            const polygons = polyline.split('|').map(polygon => {
                const ring = polygon.split(';').map(point => {
                    const [lng, lat] = point.split(',').map(Number);
                    return [lng, lat];
                });
                // 确保多边形闭合
                if (ring.length > 0 && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])) {
                    ring.push([...ring[0]]);
                }
                return ring;
            });

            if (polygons.length === 1) {
                return {
                    type: 'Polygon',
                    coordinates: [polygons[0]]
                };
            } else {
                return {
                    type: 'MultiPolygon',
                    coordinates: polygons.map(p => [p])
                };
            }
        } catch (error) {
            logger.error('❌ 解析polyline失败:', error);
            return null;
        }
    }

    /**
     * 生成默认圆形边界
     */
    generateDefaultBoundary(lat, lng, radiusMeters) {
        const points = [];
        const segments = 32;
        const earthRadius = 6371000; // 地球半径（米）

        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * 2 * Math.PI;
            const dLat = (radiusMeters / earthRadius) * Math.cos(angle) * (180 / Math.PI);
            const dLng = (radiusMeters / earthRadius) * Math.sin(angle) * (180 / Math.PI) / Math.cos(lat * Math.PI / 180);
            points.push([lng + dLng, lat + dLat]);
        }

        return {
            type: 'Polygon',
            coordinates: [points]
        };
    }

    /**
     * 映射POI类型到我们的分类
     */
    mapCategory(poiType) {
        for (const [key, value] of Object.entries(this.categoryMap)) {
            if (poiType.includes(key)) {
                return value;
            }
        }
        return 'other';
    }

    /**
     * 格式化数据库记录
     */
    formatDBRegion(record) {
        return {
            id: record.id,
            name: record.name,
            code: record.code,
            level: record.level,
            category: record.category,
            boundary: typeof record.boundary === 'string' ? JSON.parse(record.boundary) : record.boundary,
            center_lat: parseFloat(record.center_lat),
            center_lng: parseFloat(record.center_lng),
            area_km2: record.area_km2 ? parseFloat(record.area_km2) : null,
            source: record.source,
            source_id: record.source_id,
            source_name: record.source_name,
            tags: typeof record.tags === 'string' ? JSON.parse(record.tags) : record.tags,
            description: record.description,
            address: record.address,
            city: record.city,
            province: record.province,
            color: record.color,
            icon_url: record.icon_url,
            cover_url: record.cover_url,
            usage_count: record.usage_count,
            pixel_count: record.pixel_count,
            is_active: record.is_active,
            is_featured: record.is_featured,
            sort_order: record.sort_order,
            created_at: record.created_at,
            updated_at: record.updated_at
        };
    }

    /**
     * HTTP GET请求
     */
    httpGet(url) {
        return new Promise((resolve, reject) => {
            https.get(url, { timeout: 10000 }, (response) => {
                let data = '';
                response.on('data', chunk => data += chunk);
                response.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(new Error('JSON解析失败'));
                    }
                });
            }).on('error', reject);
        });
    }

    /**
     * 缓存操作
     */
    getFromCache(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
            return cached.data;
        }
        this.cache.delete(key);
        return null;
    }

    setCache(key, data) {
        if (this.cache.size > 1000) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(key, { data, timestamp: Date.now() });
    }
}

module.exports = new PresetRegionService();
