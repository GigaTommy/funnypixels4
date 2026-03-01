const { db: knex } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const turf = require('@turf/turf');
const logger = require('../utils/logger');
const { getSocketManager } = require('./socketManagerInstance');
const UserInventory = require('../models/UserInventory');
const { validateEventBoundary } = require('../utils/geojsonValidator');
const NotificationController = require('../controllers/notificationController');

class EventService {
    constructor() {
        this.activeEventsCache = [];
        this.tileToEventIndex = new Map();
        this.lastRefresh = 0;
        this.REFRESH_INTERVAL = 30 * 1000; // 30 seconds (optimized from 1 minute)
        this.postgisReady = false;

        // Initialize PostGIS and verify configuration
        this.initializePostGIS().catch(err => {
            logger.error('PostGIS initialization failed:', err);
        });

        // Start settlement scheduler (every minute)
        this.startSettlementScheduler();
    }

    /**
     * 初始化并验证PostGIS配置
     */
    async initializePostGIS() {
        try {
            // 1. 验证PostGIS扩展
            const versionCheck = await knex.raw("SELECT PostGIS_version()");
            const version = versionCheck.rows[0].postgis_version;
            logger.info(`✅ PostGIS version: ${version}`);

            // 2. 验证空间索引存在
            const indexCheck = await knex.raw(`
                SELECT indexname, indexdef
                FROM pg_indexes
                WHERE tablename = 'events'
                  AND indexname IN ('events_boundary_geom_idx', 'events_spatial_search_idx')
            `);

            if (indexCheck.rows.length < 2) {
                logger.warn('⚠️ PostGIS spatial indexes incomplete:', indexCheck.rows);
                logger.warn('   Run migration: knex migrate:latest');
            } else {
                logger.info('✅ PostGIS spatial indexes verified');
            }

            // 3. 验证现有赛事的几何列
            const geomCheck = await knex.raw(`
                SELECT
                    COUNT(*) as total,
                    COUNT(boundary_geom) as with_geom
                FROM events
                WHERE boundary IS NOT NULL
            `);

            const { total, with_geom } = geomCheck.rows[0];
            if (parseInt(total) > 0 && parseInt(with_geom) === 0) {
                logger.warn(`⚠️ ${total} events have boundary but no boundary_geom`);
                logger.warn('   Run: node backend/scripts/fix-existing-events-geometry.js');
            } else if (parseInt(total) > parseInt(with_geom)) {
                logger.warn(`⚠️ ${parseInt(total) - parseInt(with_geom)} events missing boundary_geom`);
            } else {
                logger.info(`✅ All ${total} events have PostGIS geometry`);
            }

            // 4. 运行ANALYZE优化查询计划
            await knex.raw('ANALYZE events');
            logger.info('✅ Database statistics updated (ANALYZE)');

            this.postgisReady = true;

        } catch (err) {
            logger.error('❌ PostGIS initialization failed:', err.message);
            logger.warn('   Falling back to Turf.js for spatial queries');
            this.postgisReady = false;
        }
    }

    /**
     * 从boundary GeoJSON生成PostGIS几何列
     * @private
     * @param {Object} data - Event data containing boundary
     * @returns {Object} Data with PostGIS geometry expressions
     */
    _prepareGeometryColumns(data) {
        if (!data.boundary) {
            return data;
        }

        const boundaryJSON = typeof data.boundary === 'string'
            ? data.boundary
            : JSON.stringify(data.boundary);

        // 使用knex.raw构建SQL表达式
        return {
            ...data,
            boundary_geom: knex.raw('ST_GeomFromGeoJSON(?)', [boundaryJSON]),
            center_geom: knex.raw('ST_Centroid(ST_GeomFromGeoJSON(?))', [boundaryJSON]),
            bbox: knex.raw('ST_Envelope(ST_GeomFromGeoJSON(?))::box2d', [boundaryJSON])
        };
    }

    startSettlementScheduler() {
        setInterval(() => {
            this.checkAndSettleEvents().catch(err => {
                logger.error('❌ Automatic event settlement failed:', err);
            });
        }, 60 * 1000);
    }

    /**
     * Helper to calculate Tile ID (Zoom 14)
     */
    calculateTileId(lat, lng, zoom = 14) {
        const tileSize = 1 / Math.pow(2, zoom);
        const x = Math.floor((lng + 180) / tileSize);
        const y = Math.floor((90 - lat) / tileSize);
        return `z${zoom}/${x}/${y}`;
    }

    /**
     * Refresh the spatial index for active events
     */
    async refreshActiveEventsIndex() {
        const now = Date.now();
        if (now - this.lastRefresh < this.REFRESH_INTERVAL && this.activeEventsCache.length > 0) {
            return;
        }

        logger.info('🛰️ Refreshing Event Spatial Index...');
        const activeEvents = await this.getActiveEvents();
        const newTileIndex = new Map();
        const processedEvents = [];

        for (const event of activeEvents) {
            if (!event.boundary) continue;

            try {
                const boundary = typeof event.boundary === 'string'
                    ? JSON.parse(event.boundary)
                    : event.boundary;

                const bbox = turf.bbox(boundary); // [minX, minY, maxX, maxY]

                // Index Zoom 14 Tiles in BBox
                const minTileX = Math.floor((bbox[0] + 180) * Math.pow(2, 14));
                const maxTileX = Math.floor((bbox[2] + 180) * Math.pow(2, 14));
                const minTileY = Math.floor((90 - bbox[3]) * Math.pow(2, 14));
                const maxTileY = Math.floor((90 - bbox[1]) * Math.pow(2, 14));

                for (let x = minTileX; x <= maxTileX; x++) {
                    for (let y = minTileY; y <= maxTileY; y++) {
                        const tileId = `z14/${x}/${y}`;
                        if (!newTileIndex.has(tileId)) {
                            newTileIndex.set(tileId, []);
                        }
                        newTileIndex.get(tileId).push(event.id);
                    }
                }

                processedEvents.push({
                    ...event,
                    parsedBoundary: boundary,
                    bbox: {
                        minLng: bbox[0],
                        minLat: bbox[1],
                        maxLng: bbox[2],
                        maxLat: bbox[3]
                    }
                });
            } catch (err) {
                logger.error(`Failed to index event ${event.id}:`, err);
            }
        }

        this.activeEventsCache = processedEvents;
        this.tileToEventIndex = newTileIndex;
        this.lastRefresh = now;
        logger.info(`✅ Indexed ${processedEvents.length} active events across ${newTileIndex.size} tiles.`);
    }

    async listEvents({ current = 1, pageSize = 10, status }) {
        const offset = (current - 1) * pageSize;
        const query = knex('events');

        if (status) {
            query.where('status', status);
        }

        const [totalResult] = await query.clone().count('* as count');
        const events = await query
            .orderBy('created_at', 'desc')
            .limit(pageSize)
            .offset(offset);

        return {
            list: events,
            total: parseInt(totalResult.count),
            current: parseInt(current),
            pageSize: parseInt(pageSize)
        };
    }

    /**
     * Get currently active events
     * Returns events that are either:
     * - 'published': Available for signup (pre-event period)
     * - 'active': Currently running
     */
    async getActiveEvents() {
        const now = new Date();
        return await knex('events')
            .whereIn('status', ['published', 'active'])
            .andWhere('end_time', '>=', now)  // Not yet ended
            .select('*')
            .orderBy('start_time', 'asc');
    }

    /**
     * Check if a coordinate is within any active event boundary (PostGIS OPTIMIZED)
     *
     * 🚀 Performance: 10-50x faster using PostGIS spatial index
     *
     * @param {number} lat - 纬度 (Latitude, Y坐标, -90 to 90)
     *                       注意：GeoJSON使用[lng, lat]顺序，但此函数使用(lat, lng)顺序
     * @param {number} lng - 经度 (Longitude, X坐标, -180 to 180)
     * @returns {Promise<Object[]>} List of events containing this point
     *
     * @example
     * // 检查杭州西湖某点是否在赛事区域内
     * const events = await eventService.checkEventParticipation(30.2489, 120.1363);
     * // events = [{ id: '...', title: '西湖赛事', ... }]
     */
    async checkEventParticipation(lat, lng) {
        // 优先使用PostGIS
        if (this.postgisReady) {
            try {
                // 🚀 PostGIS优化：使用空间索引查询（GiST索引自动应用）
                const results = await knex.raw(`
                SELECT
                    id, title, type, status,
                    start_time, end_time,
                    boundary, config, banner_url,
                    created_at, updated_at
                FROM events
                WHERE
                    -- 状态和时间过滤（使用复合索引）
                    status IN ('published', 'active')
                    AND end_time >= NOW()

                    -- 空间查询（GiST索引自动使用，O(log n) 复杂度）
                    AND boundary_geom IS NOT NULL
                    AND ST_Contains(
                        boundary_geom,
                        ST_SetSRID(ST_MakePoint(?, ?), 4326)
                    )
            `, [lng, lat]);

            const matchingEvents = results.rows || [];

            if (matchingEvents.length > 0) {
                logger.info(`⚔️ Pixel [${lat}, ${lng}] MATCHED ${matchingEvents.length} event(s)`);
                matchingEvents.forEach(e => {
                    logger.info(`   - ${e.title} (${e.id})`);
                });
            }

                return matchingEvents;

            } catch (err) {
                logger.error('PostGIS query failed, falling back to Turf.js:', err);
                // 降级到原有逻辑
                return this.checkEventParticipationFallback(lat, lng);
            }
        } else {
            // 直接使用fallback
            return this.checkEventParticipationFallback(lat, lng);
        }
    }

    /**
     * 降级方案：PostGIS失败时使用Turf.js（保留向后兼容）
     * @param {number} lat
     * @param {number} lng
     * @returns {Promise<Object[]>}
     */
    async checkEventParticipationFallback(lat, lng) {
        logger.warn('⚠️ Using Turf.js fallback for Point-in-Polygon check');

        await this.refreshActiveEventsIndex();

        if (!this.activeEventsCache || this.activeEventsCache.length === 0) {
            return [];
        }

        const point = turf.point([lng, lat]);
        const matchingEvents = [];

        for (const event of this.activeEventsCache) {
            // BBox Check
            if (
                lng < event.bbox.minLng || lng > event.bbox.maxLng ||
                lat < event.bbox.minLat || lat > event.bbox.maxLat
            ) {
                continue;
            }

            // Point-in-Polygon Check
            try {
                if (turf.booleanPointInPolygon(point, event.parsedBoundary)) {
                    matchingEvents.push(event);
                    logger.info(`⚔️ Pixel [${lat}, ${lng}] MATCHED event: ${event.title} (${event.id})`);
                }
            } catch (err) {
                logger.error(`PIP check failed for event ${event.id}:`, err);
            }
        }

        return matchingEvents;
    }

    /**
     * Batch check multiple pixels against all active events
     *
     * 🚀 Performance: Single query replaces N queries
     *
     * @param {Array<{lat: number, lng: number}>} points - Array of coordinates
     *        Maximum 1000 points per batch
     * @returns {Promise<Map<number, Array>>} Map of point index -> matching events
     *
     * @example
     * const points = [
     *   { lat: 30.2489, lng: 120.1363 },
     *   { lat: 30.2501, lng: 120.1375 }
     * ];
     * const matches = await eventService.batchCheckEventParticipation(points);
     * // matches.get(0) = [event1, event2]
     * // matches.get(1) = []
     */
    async batchCheckEventParticipation(points) {
        if (!points || points.length === 0) {
            return new Map();
        }

        if (points.length > 1000) {
            logger.warn(`⚠️ Batch check limited to 1000 points, got ${points.length}`);
            points = points.slice(0, 1000);
        }

        try {
            // 构建批量查询（使用ST_Contains + UNNEST）
            const pointsWKT = points.map((p, idx) =>
                `(${idx}, ST_SetSRID(ST_MakePoint(${p.lng}, ${p.lat}), 4326))`
            ).join(',');

            const results = await knex.raw(`
                WITH input_points AS (
                    SELECT * FROM (VALUES ${pointsWKT}) AS t(point_id, geom)
                )
                SELECT
                    ip.point_id,
                    e.id, e.title, e.type, e.status,
                    e.start_time, e.end_time
                FROM input_points ip
                JOIN events e ON ST_Contains(e.boundary_geom, ip.geom)
                WHERE e.status IN ('published', 'active')
                  AND e.end_time >= NOW()
                  AND e.boundary_geom IS NOT NULL
            `);

            // 组织结果为Map
            const resultMap = new Map();
            for (const row of results.rows) {
                const pointId = row.point_id;
                if (!resultMap.has(pointId)) {
                    resultMap.set(pointId, []);
                }
                resultMap.get(pointId).push({
                    id: row.id,
                    title: row.title,
                    type: row.type,
                    status: row.status,
                    start_time: row.start_time,
                    end_time: row.end_time
                });
            }

            logger.info(`📊 Batch checked ${points.length} pixels, found ${results.rows.length} matches`);
            return resultMap;

        } catch (err) {
            logger.error('Batch PostGIS query failed:', err);
            // 降级：逐个检查
            const resultMap = new Map();
            for (let i = 0; i < points.length; i++) {
                const events = await this.checkEventParticipation(points[i].lat, points[i].lng);
                if (events.length > 0) {
                    resultMap.set(i, events);
                }
            }
            return resultMap;
        }
    }

    async getEvent(id) {
        return knex('events').where({ id }).first();
    }

    /**
     * Create a new event with automatic PostGIS geometry column generation
     * @param {Object} data - Event data
     * @returns {Promise<Object>} Created event
     */
    async createEvent(data) {
        // 验证boundary
        if (data.boundary) {
            const validation = validateEventBoundary(data.boundary);
            if (!validation.valid) {
                throw new Error(`Invalid event boundary: ${validation.error}`);
            }
            // 使用sanitized版本
            data.boundary = validation.sanitized;
        }

        // 验证并准备几何列
        const processedData = this._prepareGeometryColumns(data);

        const [event] = await knex('events').insert(processedData).returning('*');

        // 强制刷新缓存
        this.lastRefresh = 0;
        this.activeEventsCache = [];
        this.tileToEventIndex.clear();

        // 主动刷新（异步）
        this.refreshActiveEventsIndex().catch(err => {
            logger.error('Cache refresh failed:', err);
        });

        this.broadcastEventsUpdated();

        logger.info(`✅ Created event ${event.id} with PostGIS geometry`);
        return event;
    }

    /**
     * Update an event with automatic PostGIS geometry column regeneration
     * @param {string} id - Event ID
     * @param {Object} data - Event data to update
     * @returns {Promise<Object>} Updated event
     */
    async updateEvent(id, data) {
        // 验证boundary (如果有更新)
        if (data.boundary) {
            const validation = validateEventBoundary(data.boundary);
            if (!validation.valid) {
                throw new Error(`Invalid event boundary: ${validation.error}`);
            }
            // 使用sanitized版本
            data.boundary = validation.sanitized;
        }

        // 验证并准备几何列
        const processedData = this._prepareGeometryColumns(data);

        const [event] = await knex('events').where({ id }).update({
            ...processedData,
            updated_at: new Date()
        }).returning('*');

        // 强制刷新缓存
        this.lastRefresh = 0;
        this.activeEventsCache = [];
        this.tileToEventIndex.clear();

        // 主动刷新（异步）
        this.refreshActiveEventsIndex().catch(err => {
            logger.error('Cache refresh failed:', err);
        });

        this.broadcastEventsUpdated();

        logger.info(`✅ Updated event ${event.id} with PostGIS geometry`);
        return event;
    }

    async deleteEvent(id) {
        const result = await knex('events').where({ id }).del();

        // Invalidate cache and notify clients
        this.lastRefresh = 0;
        this.broadcastEventsUpdated();

        return result;
    }

    /**
     * Broadcast to all connected clients that the active event list has changed
     */
    broadcastEventsUpdated() {
        try {
            const socketManager = getSocketManager();
            if (socketManager && socketManager.io) {
                socketManager.io.emit('events_updated', {
                    timestamp: Date.now()
                });
                logger.info('📡 Broadcasted events_updated to all clients');
            }
        } catch (error) {
            logger.error('Failed to broadcast events update:', error);
        }
    }

    /**
     * Calculate real-time alliance scores for an event using event_pixel_logs
     * Source of Truth: event_pixel_logs (Deduplicated by pixel_id)
     * @param {string} eventId 
     */
    async processEventScores(eventId) {
        const event = await this.getEvent(eventId);
        if (!event) return null;

        // 1. Fetch Aggregated Scores from event_pixel_logs
        // Logic: For each pixel_id, take the latest log (highest id). Then Group By alliance_id.

        /* 
           Native SQL equivalent:
           SELECT alliance_id, COUNT(*) as pixel_count 
           FROM (
             SELECT DISTINCT ON (pixel_id) pixel_id, alliance_id
             FROM event_pixel_logs
             WHERE event_id = ?
             ORDER BY pixel_id, id DESC
           ) as latest_pixels
           GROUP BY alliance_id
        */

        const results = await knex.raw(`
            SELECT 
                COALESCE(alliance_id, 'others') as alliance_group_id,
                COUNT(*) as pixel_count
            FROM (
                SELECT DISTINCT ON (pixel_id) pixel_id, alliance_id
                FROM event_pixel_logs
                WHERE event_id = ?
                ORDER BY pixel_id, id DESC
            ) as latest_pixels
            GROUP BY alliance_id
        `, [eventId]);

        const rows = results.rows || [];
        let totalPixels = 0;
        const scoresMap = new Map();

        // 2. Fetch Alliance Details for the result groups
        // We need alliance names and colors.
        const allianceIds = rows
            .map(r => r.alliance_group_id)
            .filter(id => id !== 'others');

        let alliancesInfo = [];
        if (allianceIds.length > 0) {
            alliancesInfo = await knex('alliances')
                .whereIn('id', allianceIds)
                .select('id', 'name', 'color');
        }

        const allianceLookup = new Map(alliancesInfo.map(a => [a.id, a]));

        // 3. Construct Score Objects
        for (const row of rows) {
            const count = parseInt(row.pixel_count);
            totalPixels += count;
            const aid = row.alliance_group_id;

            if (aid === 'others') {
                scoresMap.set('others', {
                    id: 'others',
                    name: '其他', // Or 'Individual/No Alliance'
                    color: '#888888',
                    pixelCount: count
                });
            } else {
                const info = allianceLookup.get(aid);
                scoresMap.set(aid, {
                    id: aid,
                    name: info ? info.name : '未知联盟',
                    color: info ? info.color : '#CCCCCC',
                    pixelCount: count
                });
            }
        }

        // 4. Sort and format
        const alliances = Array.from(scoresMap.values())
            .map(a => ({
                ...a,
                score: totalPixels > 0 ? a.pixelCount / totalPixels : 0
            }))
            .sort((a, b) => b.pixelCount - a.pixelCount);

        logger.info(`⚔️ Processed event scores (Log-based) for ${eventId}: ${totalPixels} pixels`);

        return {
            eventId,
            alliances,
            totalPixels,
            updatedAt: new Date()
        };
    }

    /**
     * Check for ended events and distribute rewards
     */
    async checkAndSettleEvents() {
        // 1. Mark expired events as 'ended'
        const now = new Date();
        const expiredEvents = await knex('events')
            .where('status', 'active')
            .andWhere('end_time', '<', now)
            .update({ status: 'ended' })
            .returning('*');

        if (expiredEvents.length > 0) {
            logger.info(`🏁 Automatically ended ${expiredEvents.length} events: ${expiredEvents.map(e => e.id).join(', ')}`);
            this.broadcastEventsUpdated();

            // ✅ 通知所有参与者活动已结束
            for (const event of expiredEvents) {
                this.notifyEventEnded(event).catch(err => {
                    logger.error(`Failed to notify event ended for ${event.id}:`, err);
                });
            }
        }

        // 2. Find ended events that haven't been settled
        // We check config->rewards->settled flag
        const eventsToSettle = await knex('events')
            .where('status', 'ended')
            .whereRaw("config->'rewards'->>'settled' IS NULL");

        for (const event of eventsToSettle) {
            await this.processRewards(event);
        }
    }

    /**
     * 通知所有参与者活动已结束
     */
    async notifyEventEnded(event) {
        try {
            // 获取所有参与者（通过 event_pixel_logs）
            const participants = await knex('event_pixel_logs')
                .where('event_id', event.id)
                .distinct('user_id')
                .pluck('user_id');

            logger.info(`📢 Notifying ${participants.length} participants that event "${event.title}" has ended`);

            // 批量发送通知
            for (const userId of participants) {
                await NotificationController.createNotification(
                    userId,
                    'event_ended',
                    '🏁 活动结束',
                    `「${event.title}」活动已结束，正在结算排名和奖励...`,
                    {
                        event_id: event.id,
                        event_title: event.title,
                        ended_at: event.end_time
                    }
                );
            }

            logger.info(`✅ Event ended notifications sent to ${participants.length} users`);
        } catch (error) {
            logger.error('Failed to notify event ended:', error);
        }
    }

    async processRewards(event) {
        logger.info(`🎁 Starting reward distribution for event: ${event.title} (${event.id})`);

        try {
            const config = typeof event.config === 'string' ? JSON.parse(event.config) : event.config;
            const rewardsConfig = config?.rewards;

            if (!rewardsConfig || !rewardsConfig.rankingRewards) {
                logger.info(`⚠️ No rewards configured for event ${event.id}, marking as settled.`);
                await this.markEventAsSettled(event, config);
                return;
            }

            // Calculate final rankings
            const rankingData = await this.processEventScores(event.id);
            if (!rankingData) return;

            // Distribute rewards
            for (const tier of rewardsConfig.rankingRewards) {
                await this.distributeTierRewards(tier, rankingData, event);
            }

            await this.markEventAsSettled(event, config);
            logger.info(`✅ Rewards distributed for event ${event.id}`);

        } catch (error) {
            logger.error(`❌ Failed to distribute rewards for event ${event.id}:`, error);
        }
    }

    async distributeTierRewards(tier, rankingData, event) {
        const { rank_min, rank_max, target, rewards } = tier;

        // Find eligible entities (Alliances or Users)
        // rankingData.alliances is sorted desc
        const eligibleAlliances = rankingData.alliances.slice(rank_min - 1, rank_max);

        for (const alliance of eligibleAlliances) {
            // "alliance_members" -> Distribute to all members of this alliance
            if (target === 'alliance_members') {
                const members = await knex('alliance_members')
                    .where('alliance_id', alliance.id)
                    .where('status', 'active')
                    .select('user_id');

                const userIds = members.map(m => m.user_id);
                logger.info(`🎁 Distributing Rank ${rank_min}-${rank_max} rewards to Alliance ${alliance.name} (${userIds.length} members)`);

                for (const userId of userIds) {
                    await this.giveUserReward(userId, rewards, event, alliance.rank || rank_min);
                }
            }
            // "alliance_leader" -> Distribute to leader only
            else if (target === 'alliance_leader') {
                const leader = await knex('alliance_members')
                    .where('alliance_id', alliance.id)
                    .where('role', 'leader')
                    .first();

                if (leader) {
                    await this.giveUserReward(leader.user_id, rewards, event, alliance.rank || rank_min);
                }
            }
        }
    }

    async giveUserReward(userId, rewards, event, rank) {
        // 1. Points
        if (rewards.points) {
            await knex('users').where('id', userId).increment('points', rewards.points);
        }

        // 2. Pixels
        if (rewards.pixels) {
            await knex('users').where('id', userId).increment('total_pixels', rewards.pixels);
        }

        // 3. Flag / Item
        if (rewards.exclusiveFlag) {
            try {
                await UserInventory.addQuantity(userId, rewards.exclusiveFlag, 1);
            } catch (e) {
                logger.error(`Failed to give flag ${rewards.exclusiveFlag} to user ${userId}:`, e);
            }
        }

        // ✅ 发送活动奖励通知
        try {
            const rewardText = [];
            if (rewards.points) rewardText.push(`${rewards.points}积分`);
            if (rewards.pixels) rewardText.push(`${rewards.pixels}像素点`);
            if (rewards.exclusiveFlag) rewardText.push('专属旗帜');

            const rankText = rank ? `第${rank}名` : '优秀表现';

            await NotificationController.createNotification(
                userId,
                'event_reward',
                '🎉 活动奖励',
                `恭喜！你在「${event.title}」活动中获得${rankText}，奖励：${rewardText.join('、')}`,
                {
                    event_id: event.id,
                    event_title: event.title,
                    rank,
                    rewards
                }
            );

            logger.info(`✅ 活动奖励通知已发送: userId=${userId}, event=${event.title}, rank=${rank}`);
        } catch (notificationError) {
            // 通知失败不应影响奖励发放
            logger.error('发送活动奖励通知失败:', notificationError);
        }
    }

    async markEventAsSettled(event, config) {
        const newConfig = {
            ...config,
            rewards: {
                ...config.rewards,
                settled: true,
                settledAt: new Date().toISOString()
            }
        };

        await knex('events')
            .where('id', event.id)
            .update({ config: JSON.stringify(newConfig) });
    }

    /**
     * Record a pixel in the event log (Immutable Audit)
     * ⚠️ IMPORTANT: Only records if user is a registered participant!
     * @param {string} eventId
     * @param {object} pixelData { pixelId, userId, allianceId, x, y }
     * @returns {Promise<boolean>} true if recorded, false if user not registered
     */
    async recordPixelLog(eventId, pixelData) {
        try {
            // 🔒 SECURITY: Verify user is a registered participant before recording
            const isParticipant = await this.isUserParticipant(eventId, pixelData.userId);

            if (!isParticipant) {
                // User is not registered for this event - do NOT record
                logger.debug(`⚠️ Pixel not counted: User ${pixelData.userId} is not registered for event ${eventId}`);
                return false;
            }

            await knex('event_pixel_logs').insert({
                event_id: eventId,
                pixel_id: pixelData.pixelId, // gridId (string)
                user_id: pixelData.userId,
                alliance_id: pixelData.allianceId,
                x: pixelData.x,
                y: pixelData.y
            });

            logger.debug(`📝 Event pixel logged: User ${pixelData.userId} in event ${eventId}`);
            return true;
        } catch (err) {
            logger.error(`Failed to log pixel for event ${eventId}:`, err);
            return false;
        }
    }

    /**
     * Check if a user is a registered participant in an event
     * (either as individual or through their alliance)
     * @param {string} eventId
     * @param {string} userId
     * @returns {Promise<boolean>}
     */
    async isUserParticipant(eventId, userId) {
        // 1. Check if user signed up individually
        const individualSignup = await knex('event_participants')
            .where({
                event_id: eventId,
                participant_type: 'user',
                participant_id: userId
            })
            .first();

        if (individualSignup) {
            return true;
        }

        // 2. Check if user's alliance signed up
        const userAlliance = await knex('alliance_members')
            .where('user_id', userId)
            .where('status', 'active')
            .first();

        if (userAlliance) {
            const allianceSignup = await knex('event_participants')
                .where({
                    event_id: eventId,
                    participant_type: 'alliance',
                    participant_id: userAlliance.alliance_id
                })
                .first();

            if (allianceSignup) {
                return true;
            }
        }

        return false;
    }

    /**
     * 🚀 性能优化：批量检查用户在多个事件中的参与状态
     * 一次查询替代N个独立查询，避免N+1问题
     * @param {Array<string>} eventIds - 事件ID列表
     * @param {string} userId - 用户ID
     * @returns {Promise<Map<string, boolean>>} eventId -> isParticipant的映射
     */
    async batchCheckUserParticipation(eventIds, userId) {
        if (!userId || eventIds.length === 0) {
            return new Map();
        }

        // 1. 批量查询用户的个人报名记录
        const individualSignups = await knex('event_participants')
            .whereIn('event_id', eventIds)
            .where({
                participant_type: 'user',
                participant_id: userId
            })
            .select('event_id');

        // 创建结果Map，默认都是false
        const resultMap = new Map();
        eventIds.forEach(eventId => resultMap.set(eventId, false));

        // 标记个人报名的事件
        individualSignups.forEach(row => {
            resultMap.set(row.event_id, true);
        });

        // 2. 查询用户的联盟
        const userAlliance = await knex('alliance_members')
            .where('user_id', userId)
            .where('status', 'active')
            .first();

        // 3. 如果用户属于联盟，批量查询联盟报名记录
        if (userAlliance) {
            const allianceSignups = await knex('event_participants')
                .whereIn('event_id', eventIds)
                .where({
                    participant_type: 'alliance',
                    participant_id: userAlliance.alliance_id
                })
                .select('event_id');

            // 更新结果Map（联盟报名也算参与）
            allianceSignups.forEach(row => {
                resultMap.set(row.event_id, true);
            });
        }

        return resultMap;
    }

    /**
     * Signup for an event
     * @param {string} eventId
     * @param {object} participant { type: 'user'|'alliance', id: string }
     */
    async signupEvent(eventId, participant) {
        const { type, id } = participant;

        // 1. Check Event Status & Time
        const event = await this.getEvent(eventId);
        if (!event) throw new Error('Event not found');

        const now = new Date();
        if (event.status !== 'active' && event.status !== 'published') {
            throw new Error('Event is not open for signup');
        }

        if (event.signup_end_time && new Date(event.signup_end_time) < now) {
            throw new Error('Signup period has ended');
        }

        // 2. Check if already signed up
        const existing = await knex('event_participants')
            .where({
                event_id: eventId,
                participant_type: type,
                participant_id: id
            })
            .first();

        if (existing) {
            return { alreadyJoined: true, participant: existing };
        }

        // P2-5: Validate entry requirements
        if (type === 'user') {
            const requirementsCheck = await this.checkUserRequirements(eventId, id);
            if (!requirementsCheck.passed) {
                const error = new Error('User does not meet event requirements');
                error.unmetRequirements = requirementsCheck.unmetRequirements;
                error.requirements = requirementsCheck.requirements;
                throw error;
            }
        } else if (type === 'alliance') {
            const requirementsCheck = await this.checkAllianceRequirements(eventId, id);
            if (!requirementsCheck.passed) {
                const error = new Error('Alliance does not meet event requirements');
                error.unmetRequirements = requirementsCheck.unmetRequirements;
                error.requirements = requirementsCheck.requirements;
                throw error;
            }
        }

        // 3. Create participant record
        // Snapshot logic: if alliance, maybe store member count? For now empty metadata is fine.
        const [newParticipant] = await knex('event_participants').insert({
            event_id: eventId,
            participant_type: type,
            participant_id: id,
            metadata: JSON.stringify({})
        }).returning('*');

        logger.info(`📝 Participant signed up for event ${eventId}: ${type} ${id}`);
        return newParticipant;
    }

    /**
     * P2-5: Check if user meets event requirements
     * @param {string} eventId
     * @param {string} userId
     */
    async checkUserRequirements(eventId, userId) {
        const event = await this.getEvent(eventId);
        const config = event.config || {};
        const requirements = config.requirements || {};

        const unmetRequirements = [];
        const allRequirements = [];

        // Get user data
        const user = await knex('users').where('id', userId).first();
        if (!user) throw new Error('User not found');

        // Check minimum level
        if (requirements.minLevel) {
            allRequirements.push({ type: 'minLevel', value: requirements.minLevel });
            const userLevel = user.level || 1;
            if (userLevel < requirements.minLevel) {
                unmetRequirements.push({ type: 'minLevel', required: requirements.minLevel, current: userLevel });
            }
        }

        // Check minimum pixels drawn
        if (requirements.minPixelsDrawn) {
            allRequirements.push({ type: 'minPixelsDrawn', value: requirements.minPixelsDrawn });
            const userPixels = user.total_pixels || 0;
            if (userPixels < requirements.minPixelsDrawn) {
                unmetRequirements.push({ type: 'minPixelsDrawn', required: requirements.minPixelsDrawn, current: userPixels });
            }
        }

        // Check account age (in days)
        if (requirements.accountAge) {
            allRequirements.push({ type: 'accountAge', value: requirements.accountAge });
            const accountAgeDays = Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24));
            if (accountAgeDays < requirements.accountAge) {
                unmetRequirements.push({ type: 'accountAge', required: requirements.accountAge, current: accountAgeDays });
            }
        }

        // Check minimum alliances
        if (requirements.minAlliances) {
            allRequirements.push({ type: 'minAlliances', value: requirements.minAlliances });
            const allianceCount = await knex('alliance_members')
                .where('user_id', userId)
                .where('status', 'active')
                .count('* as count')
                .first();
            const count = parseInt(allianceCount.count);
            if (count < requirements.minAlliances) {
                unmetRequirements.push({ type: 'minAlliances', required: requirements.minAlliances, current: count });
            }
        }

        return {
            passed: unmetRequirements.length === 0,
            requirements: allRequirements,
            unmetRequirements
        };
    }

    /**
     * P2-5: Check if alliance meets event requirements
     * @param {string} eventId
     * @param {string} allianceId
     */
    async checkAllianceRequirements(eventId, allianceId) {
        const event = await this.getEvent(eventId);
        const config = event.config || {};
        const requirements = config.requirements || {};

        const unmetRequirements = [];
        const allRequirements = [];

        // Get alliance data
        const alliance = await knex('alliances').where('id', allianceId).first();
        if (!alliance) throw new Error('Alliance not found');

        // Check minimum alliance level
        if (requirements.allianceLevel) {
            allRequirements.push({ type: 'allianceLevel', value: requirements.allianceLevel });
            const allianceLevel = alliance.level || 1;
            if (allianceLevel < requirements.allianceLevel) {
                unmetRequirements.push({ type: 'allianceLevel', required: requirements.allianceLevel, current: allianceLevel });
            }
        }

        return {
            passed: unmetRequirements.length === 0,
            requirements: allRequirements,
            unmetRequirements
        };
    }

    /**
     * Check if user (or their alliance) is signed up
     * @param {string} eventId
     * @param {string} userId
     */
    async getUserEventStatus(eventId, userId) {
        // Check individual signup
        const individual = await knex('event_participants')
            .where({
                event_id: eventId,
                participant_type: 'user',
                participant_id: userId
            })
            .first();

        if (individual) return { signedUp: true, type: 'user', joinedAt: individual.joined_at };

        // Check alliance signup
        // First find user's active alliance
        const allianceMember = await knex('alliance_members')
            .where('user_id', userId)
            .where('status', 'active')
            .first();

        if (allianceMember) {
            const allianceSignup = await knex('event_participants')
                .where({
                    event_id: eventId,
                    participant_type: 'alliance',
                    participant_id: allianceMember.alliance_id
                })
                .first();

            if (allianceSignup) {
                return {
                    signedUp: true,
                    type: 'alliance',
                    allianceId: allianceMember.alliance_id,
                    joinedAt: allianceSignup.joined_at
                };
            }
        }

        return { signedUp: false };
    }

    /**
     * Get event statistics for admin dashboard
     * @returns {Promise<Object>} Event statistics
     */
    async getEventStats() {
        try {
            const now = new Date();

            // Total events count
            const [totalResult] = await knex('events').count('* as count');

            // Active events count
            const [activeResult] = await knex('events')
                .where('status', 'active')
                .count('* as count');

            // Published (pre-heat) events count
            const [publishedResult] = await knex('events')
                .where('status', 'published')
                .count('* as count');

            // Ended events count
            const [endedResult] = await knex('events')
                .where('status', 'ended')
                .count('* as count');

            // Total participants today
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const [todaySignupsResult] = await knex('event_participants')
                .where('joined_at', '>=', todayStart)
                .count('* as count');

            // Total participants all time
            const [totalParticipantsResult] = await knex('event_participants')
                .count('* as count');

            // Total pixels in event logs today
            const [todayPixelsResult] = await knex('event_pixel_logs')
                .where('created_at', '>=', todayStart)
                .count('* as count');

            // Events pending settlement (ended but not settled)
            const [pendingSettlementResult] = await knex('events')
                .where('status', 'ended')
                .whereRaw("config->'rewards'->>'settled' IS NULL")
                .count('* as count');

            return {
                totalEvents: parseInt(totalResult.count),
                activeEvents: parseInt(activeResult.count),
                publishedEvents: parseInt(publishedResult.count),
                endedEvents: parseInt(endedResult.count),
                todaySignups: parseInt(todaySignupsResult.count),
                totalParticipants: parseInt(totalParticipantsResult.count),
                todayPixels: parseInt(todayPixelsResult.count),
                pendingSettlement: parseInt(pendingSettlementResult.count)
            };
        } catch (error) {
            logger.error('❌ Failed to get event stats:', error);
            throw error;
        }
    }

    /**
     * Get events that a user has participated in
     * @param {string} userId
     * @param {Object} options - Filter options
     * @returns {Promise<Array>} List of events
     */
    async getUserEvents(userId, options = {}) {
        try {
            const { status, page = 1, pageSize = 20 } = options;

            // First find user's alliance
            const allianceMember = await knex('alliance_members')
                .where('user_id', userId)
                .where('status', 'active')
                .first();

            // Build query for events where user or their alliance is a participant
            let query = knex('events as e')
                .join('event_participants as ep', 'e.id', 'ep.event_id')
                .where(function() {
                    this.where(function() {
                        this.where('ep.participant_type', 'user')
                            .andWhere('ep.participant_id', userId);
                    });
                    if (allianceMember) {
                        this.orWhere(function() {
                            this.where('ep.participant_type', 'alliance')
                                .andWhere('ep.participant_id', allianceMember.alliance_id);
                        });
                    }
                })
                .select('e.*', 'ep.joined_at', 'ep.participant_type');

            if (status) {
                query = query.where('e.status', status);
            }

            const [countResult] = await query.clone().clearSelect().countDistinct('e.id as count');

            const events = await query
                .orderBy('e.created_at', 'desc')
                .limit(pageSize)
                .offset((page - 1) * pageSize);

            return {
                list: events,
                total: parseInt(countResult.count),
                page,
                pageSize
            };
        } catch (error) {
            logger.error('❌ Failed to get user events:', error);
            throw error;
        }
    }

    /**
     * Get ended events for a user (with results)
     * @param {string} userId
     * @param {Object} options
     * @returns {Promise<Object>}
     */
    async getEndedEvents(userId, options = {}) {
        return this.getUserEvents(userId, { ...options, status: 'ended' });
    }

    /**
     * Get participants list for an event
     * @param {string} eventId
     * @param {Object} options - Pagination options
     * @returns {Promise<Object>}
     */
    async getParticipants(eventId, options = {}) {
        try {
            const { page = 1, pageSize = 20, type } = options;

            let query = knex('event_participants as ep')
                .where('ep.event_id', eventId);

            if (type) {
                query = query.where('ep.participant_type', type);
            }

            const [countResult] = await query.clone().count('* as count');

            // Get participants with details
            const participants = await query
                .select('ep.*')
                .orderBy('ep.joined_at', 'asc')
                .limit(pageSize)
                .offset((page - 1) * pageSize);

            // Enrich with user/alliance details
            const enrichedParticipants = await Promise.all(
                participants.map(async (p) => {
                    if (p.participant_type === 'user') {
                        const user = await knex('users')
                            .where('id', p.participant_id)
                            .select('id', 'username', 'avatar', 'level')
                            .first();
                        return { ...p, details: user };
                    } else if (p.participant_type === 'alliance') {
                        const alliance = await knex('alliances')
                            .where('id', p.participant_id)
                            .select('id', 'name', 'flag_url', 'color', 'member_count')
                            .first();
                        return { ...p, details: alliance };
                    }
                    return p;
                })
            );

            return {
                list: enrichedParticipants,
                total: parseInt(countResult.count),
                page,
                pageSize
            };
        } catch (error) {
            logger.error('❌ Failed to get participants:', error);
            throw error;
        }
    }

    /**
     * Get event final result (rankings and rewards)
     * @param {string} eventId
     * @returns {Promise<Object>}
     */
    async getEventResult(eventId) {
        try {
            const event = await this.getEvent(eventId);
            if (!event) {
                throw new Error('Event not found');
            }

            // Get rankings
            const rankings = await this.processEventScores(eventId);

            // Get config for settlement status
            const config = typeof event.config === 'string'
                ? JSON.parse(event.config)
                : event.config;

            const settled = config?.rewards?.settled || false;
            const settledAt = config?.rewards?.settledAt || null;

            // Get participant count
            const [participantCount] = await knex('event_participants')
                .where('event_id', eventId)
                .count('* as count');

            // Get total pixel logs count
            const [pixelLogCount] = await knex('event_pixel_logs')
                .where('event_id', eventId)
                .count('* as count');

            return {
                event: {
                    id: event.id,
                    title: event.title,
                    type: event.type,
                    status: event.status,
                    start_time: event.start_time,
                    end_time: event.end_time
                },
                rankings: rankings ? rankings.alliances : [],
                totalPixels: rankings ? rankings.totalPixels : 0,
                participantCount: parseInt(participantCount.count),
                pixelLogCount: parseInt(pixelLogCount.count),
                settled,
                settledAt,
                rewardsConfig: config?.rewards?.rankingRewards || []
            };
        } catch (error) {
            logger.error('❌ Failed to get event result:', error);
            throw error;
        }
    }

    /**
     * Manually trigger settlement for an event
     * @param {string} eventId
     * @returns {Promise<Object>}
     */
    async manualSettle(eventId) {
        try {
            const event = await this.getEvent(eventId);
            if (!event) {
                throw new Error('Event not found');
            }

            if (event.status !== 'ended') {
                throw new Error('Can only settle ended events');
            }

            const config = typeof event.config === 'string'
                ? JSON.parse(event.config)
                : event.config;

            if (config?.rewards?.settled) {
                throw new Error('Event has already been settled');
            }

            // Process rewards
            await this.processRewards(event);

            logger.info(`✅ Manual settlement completed for event ${eventId}`);

            return {
                success: true,
                message: 'Event settled successfully',
                settledAt: new Date().toISOString()
            };
        } catch (error) {
            logger.error('❌ Manual settlement failed:', error);
            throw error;
        }
    }

    /**
     * Get real-time rankings for an active event
     * @param {string} eventId
     * @returns {Promise<Object>}
     */
    async getRankings(eventId) {
        const event = await this.getEvent(eventId);
        if (!event) {
            throw new Error('Event not found');
        }

        return this.processEventScores(eventId);
    }

    /**
     * P1-4: Save ranking snapshot for historical trend analysis
     * @param {string} eventId
     * @returns {Promise<void>}
     */
    async saveRankingSnapshot(eventId) {
        try {
            // Get current rankings
            const rankingsData = await this.processEventScores(eventId);

            // Extract top 100 rankings for snapshot
            const rankings = rankingsData.rankings.slice(0, 100).map(entry => ({
                user_id: entry.user_id,
                username: entry.username,
                pixels: entry.pixels,
                rank: entry.rank
            }));

            const totalPixels = rankingsData.total_pixels || 0;

            // Save to database
            await knex('event_ranking_snapshots').insert({
                event_id: eventId,
                rankings: JSON.stringify(rankings),
                total_pixels: totalPixels
            });

            logger.info(`✅ Saved ranking snapshot for event ${eventId} (${rankings.length} users, ${totalPixels} total pixels)`);
        } catch (error) {
            logger.error(`❌ Failed to save ranking snapshot for event ${eventId}:`, error);
            throw error;
        }
    }

    /**
     * P1-4: Get ranking history for trend analysis
     * @param {string} eventId
     * @param {number} hours - Time range in hours (default: 24)
     * @returns {Promise<Array>}
     */
    async getEventRankingHistory(eventId, hours = 24) {
        try {
            const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);

            const snapshots = await knex('event_ranking_snapshots')
                .where('event_id', eventId)
                .where('created_at', '>=', startTime)
                .orderBy('created_at', 'asc')
                .select('*');

            // Parse JSONB rankings
            const history = snapshots.map(snapshot => ({
                timestamp: snapshot.created_at,
                total_pixels: snapshot.total_pixels,
                rankings: typeof snapshot.rankings === 'string'
                    ? JSON.parse(snapshot.rankings)
                    : snapshot.rankings
            }));

            logger.info(`✅ Retrieved ${history.length} ranking snapshots for event ${eventId} (last ${hours}h)`);
            return history;
        } catch (error) {
            logger.error(`❌ Failed to get ranking history for event ${eventId}:`, error);
            throw error;
        }
    }

    /**
     * P1-4: Clean up old ranking snapshots (keep last 7 days)
     * @returns {Promise<number>} Number of deleted snapshots
     */
    async cleanupOldSnapshots() {
        try {
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

            const deleted = await knex('event_ranking_snapshots')
                .where('created_at', '<', sevenDaysAgo)
                .del();

            if (deleted > 0) {
                logger.info(`🗑️ Cleaned up ${deleted} old ranking snapshots (>7 days)`);
            }

            return deleted;
        } catch (error) {
            logger.error('❌ Failed to cleanup old snapshots:', error);
            throw error;
        }
    }

    /**
     * P1-4: Save snapshots for all active events (scheduled task)
     * @returns {Promise<void>}
     */
    async saveAllActiveEventSnapshots() {
        try {
            const activeEvents = await knex('events')
                .where('status', 'active')
                .where('end_time', '>', knex.fn.now())
                .select('id', 'title');

            logger.info(`📸 Saving ranking snapshots for ${activeEvents.length} active events...`);

            for (const event of activeEvents) {
                try {
                    await this.saveRankingSnapshot(event.id);
                } catch (error) {
                    logger.error(`❌ Failed to save snapshot for event ${event.title}:`, error.message);
                    // Continue with next event
                }
            }

            logger.info(`✅ Completed snapshot save for ${activeEvents.length} active events`);
        } catch (error) {
            logger.error('❌ Failed to save active event snapshots:', error);
            throw error;
        }
    }
}

module.exports = new EventService();
