const EventService = require('../services/eventService');

class EventController {
    /**
     * Get active events for client (iOS/Web)
     * GET /api/events/active
     */
    async getActiveEvents(req, res) {
        try {
            const userId = req.user?.id;
            const events = await EventService.getActiveEvents();

            // 🚀 性能优化：批量查询参与状态，避免N+1问题
            // 从N个并行查询优化为2-3个批量查询
            let participationMap = new Map();
            if (userId && events.length > 0) {
                const eventIds = events.map(e => e.id);
                participationMap = await EventService.batchCheckUserParticipation(eventIds, userId);
            }

            // Format for client with participation status
            const formattedEvents = events.map(event => {
                return {
                    id: event.id,
                    title: event.title,
                    type: event.type,
                    boundary: typeof event.boundary === 'string' ? JSON.parse(event.boundary) : event.boundary,
                    startTime: event.start_time,
                    endTime: event.end_time,
                    bannerUrl: event.banner_url,
                    config: typeof event.config === 'string' ? JSON.parse(event.config) : event.config,
                    status: event.status,
                    isParticipant: participationMap.get(event.id) || false
                };
            });

            res.json({
                success: true,
                data: formattedEvents
            });
        } catch (error) {
            console.error('Error fetching active events:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch active events',
                error: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    }

    /**
     * Get real-time rankings for a specific event
     * GET /api/events/:id/rankings
     */
    async getEventRankings(req, res) {
        try {
            const { id } = req.params;
            const rankings = await EventService.processEventScores(id);

            if (!rankings) {
                return res.status(404).json({
                    success: false,
                    message: 'Event not found or has no boundary'
                });
            }

            res.json({
                success: true,
                data: rankings
            });
        } catch (error) {
            console.error('Error fetching event rankings:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch event rankings',
                error: error.message
            });
        }
    }

    /**
     * User signup for event
     * POST /api/events/:id/signup
     * Body: { type: 'user'|'alliance', id: string } (id optional if type is user, inferred from auth)
     */
    async signup(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id; // From authMiddleware
            let { type, participantId } = req.body;

            // Default to user signup if not specified
            if (!type) type = 'user';

            // If user signup, participantId is userId
            if (type === 'user') {
                participantId = userId;
            }
            // If alliance signup, verify user is leader?
            // For V1, let's assume simple validation or just trust the ID if authorized.
            // But ideally we should check if user is leader of that alliance. 
            // Allowing 'user' type for now as primary flow.

            if (type === 'alliance' && !participantId) {
                return res.status(400).json({ success: false, message: 'Alliance ID required' });
            }

            const result = await EventService.signupEvent(id, { type, id: participantId });

            res.json({
                success: true,
                data: result
            });
        } catch (error) {
            console.error('Error signing up for event:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Get user's status in event
     * GET /api/events/:id/my-status
     */
    async getMyStatus(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const status = await EventService.getUserEventStatus(id, userId);

            res.json({
                success: true,
                data: status
            });
        } catch (error) {
            console.error('Error fetching event status:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch status',
                error: error.message
            });
        }
    }

    /**
     * P2-5: Check if user meets event requirements
     * GET /api/events/:id/check-requirements
     */
    async checkRequirements(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;
            const { type, participantId } = req.query;

            let requirementsCheck;
            if (type === 'alliance' && participantId) {
                requirementsCheck = await EventService.checkAllianceRequirements(id, participantId);
            } else {
                requirementsCheck = await EventService.checkUserRequirements(id, userId);
            }

            res.json({
                success: true,
                data: requirementsCheck
            });
        } catch (error) {
            console.error('Error checking requirements:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to check requirements',
                error: error.message
            });
        }
    }

    /**
     * Get events that user has participated in
     * GET /api/events/my-events
     */
    async getMyEvents(req, res) {
        try {
            const userId = req.user.id;
            const { page, pageSize, status } = req.query;

            const result = await EventService.getUserEvents(userId, {
                page: parseInt(page) || 1,
                pageSize: parseInt(pageSize) || 20,
                status
            });

            // Format events for client
            const formattedList = result.list.map(event => ({
                id: event.id,
                title: event.title,
                type: event.type,
                status: event.status,
                startTime: event.start_time,
                endTime: event.end_time,
                bannerUrl: event.banner_url,
                joinedAt: event.joined_at,
                participantType: event.participant_type
            }));

            res.json({
                success: true,
                data: {
                    list: formattedList,
                    total: result.total,
                    page: result.page,
                    pageSize: result.pageSize
                }
            });
        } catch (error) {
            console.error('Error fetching user events:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch user events',
                error: error.message
            });
        }
    }

    /**
     * Get ended events for user
     * GET /api/events/ended
     */
    async getEndedEvents(req, res) {
        try {
            const userId = req.user.id;
            const { page, pageSize } = req.query;

            const result = await EventService.getEndedEvents(userId, {
                page: parseInt(page) || 1,
                pageSize: parseInt(pageSize) || 20
            });

            // Format events for client
            const formattedList = result.list.map(event => ({
                id: event.id,
                title: event.title,
                type: event.type,
                status: event.status,
                startTime: event.start_time,
                endTime: event.end_time,
                bannerUrl: event.banner_url,
                joinedAt: event.joined_at,
                participantType: event.participant_type
            }));

            res.json({
                success: true,
                data: {
                    list: formattedList,
                    total: result.total,
                    page: result.page,
                    pageSize: result.pageSize
                }
            });
        } catch (error) {
            console.error('Error fetching ended events:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch ended events',
                error: error.message
            });
        }
    }

    /**
     * Get event result (final rankings and rewards)
     * GET /api/events/:id/result
     */
    async getEventResult(req, res) {
        try {
            const { id } = req.params;
            const result = await EventService.getEventResult(id);

            res.json({
                success: true,
                data: result
            });
        } catch (error) {
            console.error('Error fetching event result:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch event result',
                error: error.message
            });
        }
    }

    /**
     * Get single event detail
     * GET /api/events/:id
     */
    async getEventDetail(req, res) {
        try {
            const { id } = req.params;
            const event = await EventService.getEvent(id);

            if (!event) {
                return res.status(404).json({
                    success: false,
                    message: 'Event not found'
                });
            }

            res.json({
                success: true,
                data: {
                    id: event.id,
                    title: event.title,
                    description: event.description,
                    type: event.type,
                    status: event.status,
                    boundary: typeof event.boundary === 'string' ? JSON.parse(event.boundary) : event.boundary,
                    startTime: event.start_time,
                    endTime: event.end_time,
                    publishTime: event.publish_time,
                    signupEndTime: event.signup_end_time,
                    bannerUrl: event.banner_url,
                    config: typeof event.config === 'string' ? JSON.parse(event.config) : event.config,
                    gameplay: typeof event.gameplay === 'string' ? JSON.parse(event.gameplay) : event.gameplay
                }
            });
        } catch (error) {
            console.error('Error fetching event detail:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch event detail',
                error: error.message
            });
        }
    }

    /**
     * P0-1: 获取活动报名统计信息
     * GET /api/events/:id/signup-stats
     */
    async getEventSignupStats(req, res) {
        try {
            const { id: eventId } = req.params;
            const knex = require('../database/knex');

            const event = await knex('events').where({ id: eventId }).first();
            if (!event) {
                return res.status(404).json({ success: false, message: 'Event not found' });
            }

            // 1. 统计报名数(按类型分组)
            const participantStats = await knex('event_participants')
                .where({ event_id: eventId })
                .select('participant_type')
                .count('* as count')
                .groupBy('participant_type');

            const allianceCount = parseInt(
                participantStats.find(s => s.participant_type === 'alliance')?.count || 0
            );
            const userCount = parseInt(
                participantStats.find(s => s.participant_type === 'user')?.count || 0
            );

            // 2. 获取已报名的Top 10联盟详情
            const topAlliances = await knex('event_participants as ep')
                .where({
                    'ep.event_id': eventId,
                    'ep.participant_type': 'alliance'
                })
                .join('alliances as a', 'ep.participant_id', 'a.id')
                .leftJoin('alliance_members as am', 'a.id', 'am.alliance_id')
                .leftJoin('users as u', 'am.user_id', 'u.id')
                .select(
                    'a.id',
                    'a.name',
                    'a.color',
                    'a.level',
                    knex.raw('COUNT(DISTINCT am.user_id) as member_count'),
                    knex.raw('COALESCE(SUM(u.total_pixels), 0) as total_power')
                )
                .groupBy('a.id', 'a.name', 'a.color', 'a.level')
                .orderBy('total_power', 'desc')
                .limit(10);

            // 3. 计算平均联盟规模
            const avgAllianceSize = topAlliances.length > 0
                ? Math.round(
                    topAlliances.reduce((sum, a) => sum + parseInt(a.member_count), 0) /
                    topAlliances.length
                )
                : 15; // 默认15人

            // 4. 估算总参与人数
            const estimatedParticipants = (allianceCount * avgAllianceSize) + userCount;

            // 5. 计算平均联盟战力
            const avgAlliancePower = topAlliances.length > 0
                ? Math.round(
                    topAlliances.reduce((sum, a) => sum + parseInt(a.total_power), 0) /
                    topAlliances.length
                )
                : 0;

            // 6. 检查是否满足最小参与人数
            const config = typeof event.config === 'string' ? JSON.parse(event.config) : event.config;
            const minParticipants = config?.rules?.minParticipants || 0;
            const meetsMinimum = estimatedParticipants >= minParticipants;
            const shortfall = meetsMinimum ? 0 : minParticipants - estimatedParticipants;

            res.json({
                success: true,
                data: {
                    allianceCount,
                    userCount,
                    estimatedParticipants,
                    avgAlliancePower,
                    avgAllianceSize,
                    topAlliances: topAlliances.map(a => ({
                        id: a.id,
                        name: a.name,
                        color: a.color,
                        level: a.level,
                        memberCount: parseInt(a.member_count),
                        totalPower: parseInt(a.total_power)
                    })),
                    requirements: {
                        minParticipants,
                        meetsMinimum,
                        shortfall
                    }
                }
            });
        } catch (error) {
            console.error('Error fetching signup stats:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch signup stats',
                error: error.message
            });
        }
    }

    /**
     * P0-3: 获取用户在活动中的贡献统计
     * GET /api/events/:id/my-contribution
     */
    async getMyContribution(req, res) {
        try {
            const { id: eventId } = req.params;
            const userId = req.user.id;
            const knex = require('../database/knex');

            // 1. 获取用户在此活动中画的像素数(去重)
            const myPixelsResult = await knex('event_pixel_logs')
                .where({
                    event_id: eventId,
                    user_id: userId
                })
                .countDistinct('pixel_id as count')
                .first();

            const myPixels = parseInt(myPixelsResult?.count || 0);

            // 2. 获取用户所在联盟
            const userAlliance = await knex('alliance_members as am')
                .where({ 'am.user_id': userId })
                .join('alliances as a', 'am.alliance_id', 'a.id')
                .select('a.id', 'a.name')
                .first();

            // 如果用户不在联盟中
            if (!userAlliance) {
                return res.json({
                    success: true,
                    data: {
                        myPixels,
                        allianceId: null,
                        allianceName: null,
                        allianceTotalPixels: 0,
                        contributionRate: 0,
                        rankInAlliance: null,
                        topContributors: [],
                        milestones: this.calculateMilestones(myPixels)
                    }
                });
            }

            // 3. 获取联盟总像素数
            const alliancePixelsResult = await knex('event_pixel_logs as epl')
                .where({ 'epl.event_id': eventId })
                .join('alliance_members as am', 'epl.user_id', 'am.user_id')
                .where({ 'am.alliance_id': userAlliance.id })
                .countDistinct('epl.pixel_id as count')
                .first();

            const allianceTotalPixels = parseInt(alliancePixelsResult?.count || 0);

            // 4. 计算贡献率
            const contributionRate = allianceTotalPixels > 0
                ? parseFloat((myPixels / allianceTotalPixels * 100).toFixed(2))
                : 0;

            // 5. 获取联盟内成员排名
            const allianceMembers = await knex('alliance_members as am')
                .where({ 'am.alliance_id': userAlliance.id })
                .leftJoin('event_pixel_logs as epl', function() {
                    this.on('epl.user_id', '=', 'am.user_id')
                        .andOn('epl.event_id', '=', knex.raw('?', [eventId]));
                })
                .leftJoin('users as u', 'am.user_id', 'u.id')
                .select(
                    'u.id',
                    'u.username',
                    'u.avatar_url',
                    knex.raw('COUNT(DISTINCT epl.pixel_id) as pixel_count')
                )
                .groupBy('u.id', 'u.username', 'u.avatar_url')
                .orderBy('pixel_count', 'desc');

            const rankInAlliance = allianceMembers.findIndex(m => m.id === userId) + 1;
            const topContributors = allianceMembers.slice(0, 10).map(m => ({
                userId: m.id,
                username: m.username,
                avatarUrl: m.avatar_url,
                pixelCount: parseInt(m.pixel_count)
            }));

            // 6. 计算里程碑进度
            const milestones = this.calculateMilestones(myPixels);

            res.json({
                success: true,
                data: {
                    myPixels,
                    allianceId: userAlliance.id,
                    allianceName: userAlliance.name,
                    allianceTotalPixels,
                    contributionRate,
                    rankInAlliance,
                    topContributors,
                    milestones
                }
            });
        } catch (error) {
            console.error('Error fetching contribution stats:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch contribution stats',
                error: error.message
            });
        }
    }

    /**
     * P1-4: 获取活动排名历史趋势
     * GET /api/events/:id/ranking-history
     */
    async getEventRankingHistory(req, res) {
        try {
            const { id: eventId } = req.params;
            const { hours = 24 } = req.query;
            const knex = require('../database/knex');

            const snapshots = await knex('event_ranking_snapshots')
                .where({ event_id: eventId })
                .where('created_at', '>=', knex.raw(`NOW() - INTERVAL '${parseInt(hours)} hours'`))
                .orderBy('created_at', 'asc')
                .select('*');

            res.json({
                success: true,
                data: {
                    snapshots: snapshots.map(s => ({
                        timestamp: s.created_at,
                        rankings: JSON.parse(s.rankings),
                        totalPixels: s.total_pixels
                    }))
                }
            });
        } catch (error) {
            console.error('Error fetching ranking history:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch ranking history',
                error: error.message
            });
        }
    }

    /**
     * 辅助方法: 计算里程碑进度
     */
    calculateMilestones(currentPixels) {
        const milestones = [10, 50, 100, 500, 1000, 5000];
        const lastMilestone = milestones.filter(m => m <= currentPixels).pop() || 0;
        const nextMilestone = milestones.find(m => m > currentPixels) || milestones[milestones.length - 1];

        const progress = lastMilestone === 0
            ? (currentPixels / nextMilestone * 100)
            : ((currentPixels - lastMilestone) / (nextMilestone - lastMilestone) * 100);

        return {
            current: lastMilestone,
            next: nextMilestone,
            progress: parseFloat(progress.toFixed(2))
        };
    }

    /**
     * P1-4: Get ranking history for trend analysis
     * GET /api/events/:id/ranking-history?hours=24
     */
    async getRankingHistory(req, res) {
        try {
            const { id } = req.params;
            const hours = parseInt(req.query.hours) || 24;

            // Validate hours parameter
            if (hours < 1 || hours > 168) { // Max 1 week
                return res.status(400).json({
                    success: false,
                    message: 'Hours must be between 1 and 168 (1 week)'
                });
            }

            const history = await eventService.getEventRankingHistory(id, hours);

            res.json({
                success: true,
                data: {
                    event_id: id,
                    hours: hours,
                    snapshots: history.length,
                    history: history
                }
            });
        } catch (error) {
            logger.error('❌ Get ranking history failed:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve ranking history',
                error: error.message
            });
        }
    }

    /**
     * P2-1: Generate invite link for event sharing
     * POST /api/events/:id/generate-invite
     */
    async generateInviteLink(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            // Generate unique invite code
            const inviteCode = `${id}-${userId}-${Date.now().toString(36)}`;

            // Create deep link URL
            const inviteLink = `funnypixels://event/${id}/join?inviter=${userId}&code=${inviteCode}`;

            // Store invite record (for tracking)
            await knex('event_invites').insert({
                event_id: id,
                inviter_id: userId,
                invite_code: inviteCode,
                created_at: knex.fn.now()
            });

            res.json({
                success: true,
                data: {
                    invite_link: inviteLink,
                    invite_code: inviteCode,
                    event_id: id
                }
            });

            logger.info(`✅ Generated invite link for event ${id} by user ${userId}`);
        } catch (error) {
            logger.error('❌ Generate invite link failed:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to generate invite link',
                error: error.message
            });
        }
    }

    /**
     * P2-1: Record share action
     * POST /api/events/:id/record-share
     */
    async recordShare(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;
            const { platform } = req.body; // 'wechat', 'twitter', 'copy', etc.

            // Record share
            await knex('event_shares').insert({
                event_id: id,
                user_id: userId,
                platform: platform || 'unknown',
                created_at: knex.fn.now()
            });

            res.json({
                success: true,
                message: 'Share recorded successfully'
            });

            logger.info(`✅ Recorded share for event ${id} by user ${userId} on ${platform}`);
        } catch (error) {
            logger.error('❌ Record share failed:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to record share',
                error: error.message
            });
        }
    }
}

module.exports = new EventController();
