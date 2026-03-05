/**
 * 生成World State Feed测试数据
 * 用于测试和演示世界状态流功能
 *
 * 运行：node backend/scripts/generate_world_state_test_data.js
 */

const { db } = require('../src/config/database');

async function generateTestData() {
  console.log('🚀 开始生成World State Feed测试数据...\n');

  try {
    // 1. 生成里程碑用户数据
    console.log('📊 生成里程碑用户数据...');
    await generateMilestoneUsers();

    // 2. 生成高质量绘画会话
    console.log('🎨 生成优秀作品数据...');
    await generateQualityDrawingSessions();

    // 3. 生成领地控制历史
    console.log('🗺️  生成领地变化数据...');
    await generateTerritoryHistory();

    // 4. 生成活动数据
    console.log('🎮 生成活动进度数据...');
    await generateEventProgress().catch(err => {
      console.log('  ⚠️  跳过活动数据生成（表结构不匹配）');
    });

    // 5. 生成官方公告
    console.log('📢 生成官方公告数据...');
    await generateOfficialAnnouncements();

    console.log('\n✅ 所有测试数据生成完成！');
    process.exit(0);
  } catch (error) {
    console.error('❌ 生成测试数据失败:', error);
    process.exit(1);
  }
}

// 生成里程碑用户（达到100, 1K, 5K, 10K, 50K, 100K像素的用户）
async function generateMilestoneUsers() {
  const milestones = [100, 1000, 5000, 10000, 50000, 100000];
  const users = [];

  for (let i = 0; i < 10; i++) {
    const milestone = milestones[i % milestones.length];
    // 检查是否已有足够像素的用户
    const existing = await db('users')
      .where('total_pixels', '>=', milestone)
      .first();

    if (!existing) {
      // 找一个测试用户并更新其像素数
      const testUser = await db('users')
        .where('username', 'like', 'test%')
        .orWhere('display_name', 'like', 'Test%')
        .orderByRaw('RANDOM()')
        .first();

      if (testUser) {
        await db('users')
          .where('id', testUser.id)
          .update({
            total_pixels: milestone + Math.floor(Math.random() * 100),
            updated_at: db.fn.now()
          });
        users.push({ ...testUser, milestone });
        console.log(`  ✓ 用户 ${testUser.username} 达成 ${milestone} 像素里程碑`);
      }
    }
  }

  console.log(`  生成了 ${users.length} 个里程碑用户`);
  return users;
}

// 生成高质量绘画会话（通过metadata存储）
async function generateQualityDrawingSessions() {
  const sessions = [];

  // 查找近期会话并添加高质量元数据
  const recentSessions = await db('drawing_sessions')
    .whereNotNull('end_time')
    .orderBy('end_time', 'desc')
    .limit(15);

  for (const session of recentSessions) {
    const pixelCount = 150 + Math.floor(Math.random() * 350); // 150-500像素
    const durationSeconds = 400 + Math.floor(Math.random() * 600); // 400-1000秒

    // 更新metadata来存储这些信息
    await db('drawing_sessions')
      .where('id', session.id)
      .update({
        metadata: db.raw('jsonb_set(COALESCE(metadata, \'{}\'), \'{pixel_count}\', ?)', [JSON.stringify(pixelCount)]),
        updated_at: db.fn.now()
      });

    await db('drawing_sessions')
      .where('id', session.id)
      .update({
        metadata: db.raw('jsonb_set(metadata, \'{duration_seconds}\', ?)', [JSON.stringify(durationSeconds)])
      });

    sessions.push({ ...session, pixel_count: pixelCount, duration_seconds: durationSeconds });
    console.log(`  ✓ 会话 ${session.id.substring(0, 8)} - ${pixelCount}像素, ${Math.floor(durationSeconds/60)}分钟`);
  }

  console.log(`  生成了 ${sessions.length} 个优秀作品会话`);
  return sessions;
}

// 生成领地控制历史
async function generateTerritoryHistory() {
  const territories = [
    '北京市中心',
    '上海外滩',
    '深圳南山',
    '广州天河',
    '杭州西湖',
    '成都春熙路',
    '纽约时代广场',
    '东京涩谷',
    '伦敦大本钟',
    '巴黎埃菲尔铁塔'
  ];

  // 获取所有联盟
  const alliances = await db('alliances')
    .select('id', 'name')
    .limit(10);

  if (alliances.length === 0) {
    console.log('  ⚠️  没有联盟数据，跳过领地历史生成');
    return [];
  }

  const history = [];

  for (let i = 0; i < 20; i++) {
    const territory = territories[Math.floor(Math.random() * territories.length)];
    const alliance = alliances[Math.floor(Math.random() * alliances.length)];
    const previousAlliance = Math.random() > 0.5 ? alliances[Math.floor(Math.random() * alliances.length)] : null;

    const record = {
      territory_name: territory,
      alliance_id: alliance.id,
      previous_alliance_id: previousAlliance?.id || null,
      changed_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // 过去7天内随机时间
      metadata: JSON.stringify({
        battle_duration_seconds: Math.floor(Math.random() * 3600),
        participants: Math.floor(Math.random() * 100) + 10
      })
    };

    await db('territory_control_history').insert(record);
    history.push(record);
    console.log(`  ✓ ${territory} 被 ${alliance.name} 占领`);
  }

  console.log(`  生成了 ${history.length} 条领地变化记录`);
  return history;
}

// 生成活动进度数据
async function generateEventProgress() {
  // 查找现有活动并更新参与者数量
  const activeEvents = await db('events')
    .where('status', 'active')
    .where('end_time', '>', db.fn.now())
    .limit(10);

  if (activeEvents.length === 0) {
    // 创建一些测试活动
    const testEvents = [
      {
        title: '像素绘画挑战赛',
        description: '绘制最多像素的玩家将获得丰厚奖励',
        type: 'challenge',
        status: 'active',
        start_time: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        end_time: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        participants_count: Math.floor(Math.random() * 500) + 100
      },
      {
        title: '全球联盟争霸',
        description: '联盟之间的史诗对决',
        type: 'alliance_battle',
        status: 'active',
        start_time: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        end_time: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        participants_count: Math.floor(Math.random() * 1000) + 200
      },
      {
        title: '创意绘画大赛',
        description: '展示你的艺术才华',
        type: 'creative',
        status: 'active',
        start_time: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        end_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        participants_count: Math.floor(Math.random() * 300) + 50
      }
    ];

    for (const event of testEvents) {
      await db('events').insert(event);
      console.log(`  ✓ 创建活动: ${event.title} (${event.participants_count}人参与)`);
    }

    return testEvents;
  } else {
    // 更新现有活动的参与者数量
    for (const event of activeEvents) {
      const newCount = Math.floor(Math.random() * 500) + 100;
      await db('events')
        .where('id', event.id)
        .update({ participants_count: newCount });
      console.log(`  ✓ 更新活动: ${event.title} (${newCount}人参与)`);
    }

    return activeEvents;
  }
}

// 生成官方公告
async function generateOfficialAnnouncements() {
  // 获取一个系统用户作为作者
  const systemUser = await db('users')
    .where('username', 'like', 'admin%')
    .orWhere('username', 'like', 'system%')
    .first();

  if (!systemUser) {
    console.log('  ⚠️  未找到系统用户，跳过公告生成');
    return [];
  }

  const announcements = [
    {
      title: '🎉 World State Feed正式上线',
      content: '全新的世界状态流功能已经上线！现在您可以实时查看全球玩家的精彩时刻、联盟领地变化、热门活动进度等系统事件。快来体验吧！',
      type: 'system',  // 功能上线属于系统通知，显示在消息中心
      priority: 1, // 1=high, 2=medium, 3=low
      is_active: true
    },
    {
      title: '🔧 系统维护通知',
      content: '我们计划在本周五凌晨2:00-4:00进行系统维护，届时服务将短暂中断。感谢您的理解与支持！',
      type: 'system',  // 修正：系统维护使用system类型
      priority: 2, // medium
      is_active: true
    },
    {
      title: '🎁 新手福利活动',
      content: '新注册用户前7天每日签到可获得额外奖励！包括绘画点数、限定头像框等丰富奖品。',
      type: 'global',  // 修正：全局活动使用global类型
      priority: 2, // medium
      is_active: true
    },
    {
      title: '🏆 联盟赛季开启',
      content: '新一轮的联盟赛季已经开始！加入联盟，与队友一起争夺领地控制权，赢取赛季专属奖励。',
      type: 'global',  // 修正：全局公告使用global类型
      priority: 1, // high
      is_active: true
    },
    {
      title: '📊 数据统计功能上线',
      content: '现在您可以在个人中心查看详细的绘画数据统计，包括每日活跃、城市足迹、成就进度等。',
      type: 'system',  // 功能上线属于系统通知，显示在消息中心
      priority: 3, // low
      is_active: true
    }
  ];

  for (const announcement of announcements) {
    await db('announcements').insert({
      ...announcement,
      author_id: systemUser.id
    });
    console.log(`  ✓ 创建公告: ${announcement.title}`);
  }

  console.log(`  生成了 ${announcements.length} 条官方公告`);
  return announcements;
}

// 运行脚本
generateTestData();
