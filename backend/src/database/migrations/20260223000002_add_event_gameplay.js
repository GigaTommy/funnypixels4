/**
 * P0-2: 添加活动玩法模板字段
 *
 * 背景：活动需要展示玩法说明、计分规则和技巧提示
 * 场景：用户查看活动详情时显示完整的玩法指南
 * 解决方案：添加gameplay JSONB字段存储多语言玩法模板
 */

exports.up = async function(knex) {
  console.log('🎮 开始添加活动玩法字段...');

  try {
    // 1. 添加gameplay字段（如果不存在）
    const hasGameplayColumn = await knex.schema.hasColumn('events', 'gameplay');

    if (!hasGameplayColumn) {
      console.log('📊 添加gameplay列到events表...');
      await knex.schema.table('events', (table) => {
        table.jsonb('gameplay').nullable();
      });
      console.log('✅ gameplay列添加成功');
    } else {
      console.log('⚠️  gameplay列已存在，跳过创建');
    }

    // 2. 为现有活动初始化默认玩法（基于event_type）
    console.log('📊 初始化现有活动的gameplay数据...');

    const GAMEPLAY_TEMPLATES = require('../../constants/eventGameplayTemplates');

    // 获取所有没有gameplay的活动
    const events = await knex('events')
      .whereNull('gameplay')
      .select('id', 'type');

    for (const event of events) {
      const template = GAMEPLAY_TEMPLATES[event.type];
      if (template) {
        await knex('events')
          .where('id', event.id)
          .update({ gameplay: JSON.stringify(template) });
      }
    }

    console.log(`✅ 更新了 ${events.length} 个活动的gameplay数据`);

    // 3. 添加索引优化gameplay查询（使用GIN索引）
    console.log('📊 添加gameplay GIN索引...');
    await knex.raw(`
      CREATE INDEX IF NOT EXISTS idx_events_gameplay
      ON events USING GIN (gameplay)
    `);
    console.log('✅ gameplay索引创建成功');

    console.log('');
    console.log('✅ 活动玩法字段添加完成！');
    console.log('📝 使用说明:');
    console.log('  - gameplay字段存储JSON格式的玩法模板');
    console.log('  - 包含objective, scoringRules, tips等多语言内容');
    console.log('  - 支持territory_control, leaderboard, war, cooperation四种类型');

  } catch (error) {
    console.error('❌ 添加gameplay字段失败:', error);
    throw error;
  }
};

exports.down = async function(knex) {
  console.log('🔄 开始回滚gameplay字段...');

  try {
    // 删除索引
    await knex.raw('DROP INDEX IF EXISTS idx_events_gameplay');
    console.log('✅ 删除索引: idx_events_gameplay');

    // 删除列
    const hasGameplayColumn = await knex.schema.hasColumn('events', 'gameplay');
    if (hasGameplayColumn) {
      await knex.schema.table('events', (table) => {
        table.dropColumn('gameplay');
      });
      console.log('✅ 删除gameplay列');
    }

    console.log('✅ gameplay字段回滚完成');

  } catch (error) {
    console.error('❌ 回滚gameplay字段失败:', error);
    throw error;
  }
};
