#!/usr/bin/env node

/**
 * 创建广东工大（区庄校区）测试活动
 *
 * 执行命令: node scripts/create-test-event-gdut.js
 */

const knex = require('knex');
const knexConfig = require('../knexfile');

// 使用开发环境配置
const db = knex(knexConfig.development);

async function createTestEvent() {
  console.log('🎯 开始创建广东工大测试活动...\n');

  try {
    const eventData = {
      title: '广工区庄像素大战',
      description: '在广东工业大学东风路校区（区庄校区）展开激烈的像素争夺战！与你的联盟成员一起，用像素在校园地图上留下你们的印记。占领更多区域，赢取丰厚奖励！',
      status: 'published', // 已发布，可以报名
      start_time: new Date(), // 现在开始
      end_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7天后结束
      banner_url: null,
      config: {
        area: {
          type: 'circle',
          center: {
            lat: 23.1489,
            lng: 113.3376
          },
          radius: 800,
          name: '广东工业大学东风路校区'
        },
        requirements: {
          minLevel: 1,
          minAlliances: 2,
          minParticipants: 5
        },
        rules: {
          pixelScore: 10,
          bonusMultiplier: 2.0,
          allianceBonus: true
        },
        rewards: [
          {
            rank: 1,
            type: 'coins',
            amount: 1000,
            description: '冠军奖励'
          },
          {
            rank: 2,
            type: 'coins',
            amount: 500,
            description: '亚军奖励'
          },
          {
            rank: 3,
            type: 'coins',
            amount: 300,
            description: '季军奖励'
          }
        ]
      },
      gameplay: {
        objective: {
          en: 'Capture the most pixels in the campus area to claim victory! Work with your alliance to dominate key locations.',
          zh: '在校园范围内占领最多像素赢得胜利！与你的联盟协作占领关键位置。',
          ja: 'キャンパス内で最も多くのピクセルを獲得して勝利を収めましょう！同盟と協力して重要な場所を支配しましょう。'
        },
        scoringRules: {
          en: [
            'Each pixel drawn = 10 points',
            'Alliance pixels get 2x multiplier bonus',
            'Bonus points for capturing high-traffic areas',
            'Consecutive days drawing earns streak bonuses'
          ],
          zh: [
            '每个像素 = 10分',
            '联盟像素获得2倍加成',
            '占领热门区域获得额外积分',
            '连续绘画天数获得连击奖励'
          ],
          ja: [
            '各ピクセル = 10ポイント',
            '同盟ピクセルは2倍のボーナス',
            '人気エリアを占領すると追加ポイント',
            '連続描画日数でストリークボーナス'
          ]
        },
        tips: {
          en: [
            'Draw in popular spots during peak hours for maximum visibility',
            'Coordinate with alliance members to cover more area',
            'Check the leaderboard daily to track your progress',
            'Save your patterns for strategic locations'
          ],
          zh: [
            '在高峰时段的热门地点绘画以获得最大曝光',
            '与联盟成员协调覆盖更大区域',
            '每日查看排行榜追踪进度',
            '保存图案用于战略位置'
          ],
          ja: [
            'ピーク時間に人気スポットで描画して最大の露出を得る',
            '同盟メンバーと調整してより広いエリアをカバー',
            '毎日リーダーボードをチェックして進捗を追跡',
            '戦略的な場所のためにパターンを保存'
          ]
        },
        difficulty: 'medium',
        timeCommitment: '30-60分/天',
        recommendedFor: ['学生', '校园玩家', '联盟成员']
      },
      type: 'territory_control',
      created_at: new Date(),
      updated_at: new Date()
    };

    // 插入活动
    const [event] = await db('events')
      .insert(eventData)
      .returning('*');

    console.log('✅ 活动创建成功！\n');
    console.log('📋 活动详情:');
    console.log(`   ID: ${event.id}`);
    console.log(`   标题: ${event.title}`);
    console.log(`   状态: ${event.status}`);
    console.log(`   开始时间: ${event.start_time}`);
    console.log(`   结束时间: ${event.end_time}`);
    console.log(`   区域中心: 23.1489, 113.3376 (广东工大区庄校区)`);
    console.log(`   半径: 800米\n`);

    console.log('🎮 玩法信息:');
    console.log(`   难度: ${event.gameplay.difficulty}`);
    console.log(`   时间投入: ${event.gameplay.timeCommitment}`);
    console.log(`   推荐玩家: ${event.gameplay.recommendedFor.join(', ')}\n`);

    console.log('🏆 奖励设置:');
    event.config.rewards.forEach((reward, index) => {
      console.log(`   第${index + 1}名: ${reward.amount} ${reward.type} - ${reward.description}`);
    });

    console.log('\n📱 测试步骤:');
    console.log('1. 在iOS应用中前往活动中心');
    console.log(`2. 查看活动"${event.title}"`);
    console.log('3. 点击报名参加活动');
    console.log('4. 前往广东工大区庄校区（或使用模拟器）');
    console.log('5. 在活动区域内绘制像素');
    console.log('6. 查看报名统计、玩法说明和个人贡献卡片\n');

    console.log(`✨ 活动已就绪，可以开始真机测试了！\n`);

  } catch (error) {
    console.error('❌ 创建活动失败:', error);
    throw error;
  } finally {
    await db.destroy();
  }
}

// 执行
createTestEvent()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
