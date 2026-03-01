/**
 * P1-4: 创建活动排名快照表
 *
 * 背景：需要追踪玩家排名历史趋势
 * 场景：显示玩家在活动期间的排名变化图表
 * 解决方案：定时保存排名快照（每小时一次）
 */

exports.up = async function(knex) {
  console.log('📊 开始创建活动排名快照表...');

  try {
    const tableExists = await knex.schema.hasTable('event_ranking_snapshots');

    if (!tableExists) {
      console.log('📊 创建event_ranking_snapshots表...');

      await knex.schema.createTable('event_ranking_snapshots', (table) => {
        // 主键
        table.increments('id').primary();

        // 活动ID (UUID类型)
        table.uuid('event_id')
          .notNullable()
          .references('id')
          .inTable('events')
          .onDelete('CASCADE');

        // 用户ID (UUID类型)
        table.uuid('user_id')
          .notNullable()
          .references('id')
          .inTable('users')
          .onDelete('CASCADE');

        // 快照时间
        table.timestamp('snapshot_time').notNullable();

        // 排名数据
        table.integer('rank').notNullable();
        table.integer('pixel_count').defaultTo(0);
        table.uuid('alliance_id').nullable();

        // 时间戳
        table.timestamps(true, true);

        // 索引
        table.index(['event_id', 'snapshot_time'], 'idx_snapshots_event_time');
        table.index(['event_id', 'user_id', 'snapshot_time'], 'idx_snapshots_lookup');
        table.index(['snapshot_time'], 'idx_snapshots_time');
      });

      console.log('✅ event_ranking_snapshots表创建成功');

      // 创建自动更新updated_at的触发器
      await knex.raw(`
        CREATE OR REPLACE FUNCTION update_event_ranking_snapshots_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS event_ranking_snapshots_updated_at ON event_ranking_snapshots;

        CREATE TRIGGER event_ranking_snapshots_updated_at
        BEFORE UPDATE ON event_ranking_snapshots
        FOR EACH ROW
        EXECUTE FUNCTION update_event_ranking_snapshots_updated_at();
      `);

      console.log('✅ 自动更新时间戳触发器创建成功');

    } else {
      console.log('⚠️  event_ranking_snapshots表已存在，跳过创建');
    }

    console.log('');
    console.log('✅ 活动排名快照表创建完成！');
    console.log('📝 使用说明:');
    console.log('  - 每小时自动保存一次排名快照');
    console.log('  - 支持查询用户排名历史趋势');
    console.log('  - 活动结束后数据保留用于分析');
    console.log('  - 需要创建定时任务来生成快照');

  } catch (error) {
    console.error('❌ 创建排名快照表失败:', error);
    throw error;
  }
};

exports.down = async function(knex) {
  console.log('🔄 开始回滚排名快照表...');

  try {
    // 删除触发器
    await knex.raw('DROP TRIGGER IF EXISTS event_ranking_snapshots_updated_at ON event_ranking_snapshots');
    await knex.raw('DROP FUNCTION IF EXISTS update_event_ranking_snapshots_updated_at()');
    console.log('✅ 删除触发器');

    // 删除表
    await knex.schema.dropTableIfExists('event_ranking_snapshots');
    console.log('✅ 删除event_ranking_snapshots表');

    console.log('✅ 排名快照表回滚完成');

  } catch (error) {
    console.error('❌ 回滚排名快照表失败:', error);
    throw error;
  }
};
