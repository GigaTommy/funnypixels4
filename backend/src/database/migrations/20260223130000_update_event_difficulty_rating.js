/**
 * P2-2: 更新活动难度评级系统
 *
 * 背景：简单的difficulty字符串升级为详细的难度评级对象
 * 场景：帮助玩家更好地选择适合自己的活动
 * 解决方案：将difficulty从字符串改为包含level、factors、estimatedTimePerDay的对象
 */

exports.up = async function(knex) {
  console.log('⭐ 开始更新活动难度评级...');

  try {
    const GAMEPLAY_TEMPLATES = require('../../constants/eventGameplayTemplates');

    // 获取所有活动
    const events = await knex('events').select('id', 'type', 'gameplay');

    console.log(`📊 找到 ${events.length} 个活动需要更新...`);

    let updated = 0;
    for (const event of events) {
      if (event.gameplay) {
        // 检查是否已经是新格式
        const gameplay = typeof event.gameplay === 'string'
          ? JSON.parse(event.gameplay)
          : event.gameplay;

        // 如果difficulty是字符串，则需要更新
        if (typeof gameplay.difficulty === 'string') {
          const template = GAMEPLAY_TEMPLATES[event.type];
          if (template) {
            gameplay.difficulty = template.difficulty;

            await knex('events')
              .where('id', event.id)
              .update({ gameplay: JSON.stringify(gameplay) });

            updated++;
          }
        }
      }
    }

    console.log(`✅ 更新了 ${updated} 个活动的难度评级`);
    console.log('');
    console.log('📝 新的难度评级包含:');
    console.log('  - level: 1-5星难度');
    console.log('  - factors: {competition, timeCommitment, skillRequired}');
    console.log('  - estimatedTimePerDay: 预计每日投入时间(分钟)');
    console.log('  - recommendedFor: 推荐玩家类型');

  } catch (error) {
    console.error('❌ 更新难度评级失败:', error);
    throw error;
  }
};

exports.down = async function(knex) {
  console.log('🔄 开始回滚难度评级...');

  try {
    const events = await knex('events').select('id', 'type', 'gameplay');

    let reverted = 0;
    for (const event of events) {
      if (event.gameplay) {
        const gameplay = typeof event.gameplay === 'string'
          ? JSON.parse(event.gameplay)
          : event.gameplay;

        // 将difficulty对象转回字符串
        if (typeof gameplay.difficulty === 'object') {
          // 根据level转换回简单字符串
          const level = gameplay.difficulty.level;
          let difficultyStr = 'medium';
          if (level <= 2) difficultyStr = 'easy';
          else if (level >= 4) difficultyStr = 'hard';

          gameplay.difficulty = difficultyStr;
          gameplay.timeCommitment = `${Math.floor(gameplay.difficulty.estimatedTimePerDay / 60)}-${Math.ceil(gameplay.difficulty.estimatedTimePerDay / 60)} hours/day`;
          gameplay.recommendedFor = gameplay.difficulty.recommendedFor;

          await knex('events')
            .where('id', event.id)
            .update({ gameplay: JSON.stringify(gameplay) });

          reverted++;
        }
      }
    }

    console.log(`✅ 回滚了 ${reverted} 个活动的难度评级`);

  } catch (error) {
    console.error('❌ 回滚难度评级失败:', error);
    throw error;
  }
};
