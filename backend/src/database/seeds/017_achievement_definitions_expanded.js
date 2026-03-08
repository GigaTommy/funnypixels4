/**
 * 成就定义种子数据 - 扩展版
 * 添加像素绘制、GPS会话、活跃度等成就
 */
exports.seed = async function (knex) {
    // 不删除现有数据，只插入新的成就定义
    const achievements = [
        // ========== 像素绘制成就 ==========
        {
            key: 'first_pixel',
            name: '第一个像素',
            description: '绘制你的第一个像素',
            icon_url: '/achievements/first_pixel.png',
            category: 'pixels',
            rarity: 'common',
            criteria: JSON.stringify({ type: 'pixels_drawn_count', target: 1 }),
            rewards: JSON.stringify({ points: 5, title: '像素新手' })
        },
        {
            key: 'pixel_artist_10',
            name: '像素艺术家',
            description: '绘制10个像素',
            icon_url: '/achievements/pixel_artist.png',
            category: 'pixels',
            rarity: 'common',
            criteria: JSON.stringify({ type: 'pixels_drawn_count', target: 10 }),
            rewards: JSON.stringify({ points: 20, badge: 'artist' })
        },
        {
            key: 'pixel_master_50',
            name: '像素大师',
            description: '绘制50个像素',
            icon_url: '/achievements/pixel_master.png',
            category: 'pixels',
            rarity: 'uncommon',
            criteria: JSON.stringify({ type: 'pixels_drawn_count', target: 50 }),
            rewards: JSON.stringify({ points: 40, special_color: '#4CAF50' })
        },
        {
            key: 'pixel_expert_100',
            name: '像素专家',
            description: '绘制100个像素',
            icon_url: '/achievements/pixel_expert.png',
            category: 'pixels',
            rarity: 'rare',
            criteria: JSON.stringify({ type: 'pixels_drawn_count', target: 100 }),
            rewards: JSON.stringify({ points: 80, brush_effect: 'sparkle' })
        },
        {
            key: 'pixel_legend_500',
            name: '像素传奇',
            description: '绘制500个像素',
            icon_url: '/achievements/pixel_legend.png',
            category: 'pixels',
            rarity: 'epic',
            criteria: JSON.stringify({ type: 'pixels_drawn_count', target: 500 }),
            rewards: JSON.stringify({ points: 200, special_palette: 'legendary' })
        },
        {
            key: 'pixel_god_1000',
            name: '像素之神',
            description: '绘制1000个像素',
            icon_url: '/achievements/pixel_god.png',
            category: 'pixels',
            rarity: 'legendary',
            criteria: JSON.stringify({ type: 'pixels_drawn_count', target: 1000 }),
            rewards: JSON.stringify({ points: 400, title: '像素之神', announcement: true })
        },

        // ========== GPS会话成就 ==========
        {
            key: 'gps_explorer',
            name: 'GPS探险家',
            description: '完成第一次GPS绘制会话',
            icon_url: '/achievements/gps_explorer.png',
            category: 'activity',
            rarity: 'common',
            criteria: JSON.stringify({ type: 'gps_sessions_count', target: 1 }),
            rewards: JSON.stringify({ points: 10, badge: 'explorer' })
        },
        {
            key: 'route_master',
            name: '路线大师',
            description: '完成10次GPS绘制会话',
            icon_url: '/achievements/route_master.png',
            category: 'activity',
            rarity: 'rare',
            criteria: JSON.stringify({ type: 'gps_sessions_count', target: 10 }),
            rewards: JSON.stringify({ points: 60, special_trail: 'golden' })
        },

        // ========== 活跃度成就 ==========
        {
            key: 'daily_visitor_7',
            name: '每日访客',
            description: '连续活跃7天',
            icon_url: '/achievements/daily_visitor.png',
            category: 'activity',
            rarity: 'common',
            criteria: JSON.stringify({ type: 'days_active_count', target: 7 }),
            rewards: JSON.stringify({ points: 20, daily_bonus: 1.1 })
        },
        {
            key: 'dedicated_user_30',
            name: '忠实用户',
            description: '连续活跃30天',
            icon_url: '/achievements/dedicated_user.png',
            category: 'activity',
            rarity: 'rare',
            criteria: JSON.stringify({ type: 'days_active_count', target: 30 }),
            rewards: JSON.stringify({ points: 120, vip_status: true })
        },
        {
            key: 'veteran_100',
            name: '资深玩家',
            description: '连续活跃100天',
            icon_url: '/achievements/veteran.png',
            category: 'activity',
            rarity: 'epic',
            criteria: JSON.stringify({ type: 'days_active_count', target: 100 }),
            rewards: JSON.stringify({ points: 400, title: '资深玩家', special_badge: 'veteran' })
        },

        // ========== 联盟成就 (category='social' 因 CHECK 约束不含 alliance) ==========
        {
            key: 'team_player',
            name: '团队协作者',
            description: '为联盟贡献10次',
            icon_url: '/achievements/team_player.png',
            category: 'social',
            rarity: 'uncommon',
            criteria: JSON.stringify({ type: 'alliance_contributions', target: 10 }),
            rewards: JSON.stringify({ points: 30, alliance_badge: 'contributor' })
        },
        {
            key: 'alliance_hero',
            name: '联盟英雄',
            description: '为联盟贡献50次',
            icon_url: '/achievements/alliance_hero.png',
            category: 'social',
            rarity: 'epic',
            criteria: JSON.stringify({ type: 'alliance_contributions', target: 50 }),
            rewards: JSON.stringify({ points: 160, title: '联盟英雄', special_flag: true })
        },

        // ========== 商店成就 (category='special' 因 CHECK 约束不含 shop) ==========
        {
            key: 'first_purchase',
            name: '首次购买',
            description: '在商店完成第一次购买',
            icon_url: '/achievements/first_purchase.png',
            category: 'special',
            rarity: 'common',
            criteria: JSON.stringify({ type: 'shop_purchases_count', target: 1 }),
            rewards: JSON.stringify({ points: 5, discount_coupon: '5%' })
        },
        {
            key: 'shopaholic',
            name: '购物狂',
            description: '在商店完成20次购买',
            icon_url: '/achievements/shopaholic.png',
            category: 'special',
            rarity: 'rare',
            criteria: JSON.stringify({ type: 'shop_purchases_count', target: 20 }),
            rewards: JSON.stringify({ points: 95, vip_discount: '10%' })
        }
    ];

    // 使用 ON CONFLICT 避免重复插入
    for (const achievement of achievements) {
        await knex.raw(`
      INSERT INTO achievement_definitions (key, name, description, icon_url, category, rarity, criteria, rewards, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, true, NOW())
      ON CONFLICT (key) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        icon_url = EXCLUDED.icon_url,
        category = EXCLUDED.category,
        rarity = EXCLUDED.rarity,
        criteria = EXCLUDED.criteria,
        rewards = EXCLUDED.rewards
    `, [
            achievement.key,
            achievement.name,
            achievement.description,
            achievement.icon_url,
            achievement.category,
            achievement.rarity,
            achievement.criteria,
            achievement.rewards
        ]);
    }

    console.log(`✅ achievement_definitions: 插入/更新了 ${achievements.length} 条记录`);
};
