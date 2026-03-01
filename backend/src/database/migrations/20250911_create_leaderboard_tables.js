/**
 * 创建排行榜基础数据表
 * 用于缓存排行榜结果，减轻数据库压力
 */

exports.up = async function(knex) {
  // 1. 创建个人排行榜缓存表
  const personalTableExists = await knex.raw(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'leaderboard_personal'
    );
  `);

  if (!personalTableExists.rows[0].exists) {
    await knex.schema.createTable('leaderboard_personal', function(table) {
      table.bigIncrements('id').primary();
      table.uuid('user_id').notNullable();
      table.string('username', 50).notNullable();
      table.string('display_name', 100);
      table.string('avatar_url', 500);
      table.text('avatar'); // 用户头像数据（像素艺术颜色数据）
      table.bigInteger('pixel_count').notNullable().defaultTo(0);
      table.integer('rank').notNullable();
      table.string('period', 20).notNullable(); // daily, weekly, monthly, yearly
      table.timestamp('period_start').notNullable();
      table.timestamp('period_end').notNullable();
      table.timestamp('last_updated').notNullable().defaultTo(knex.fn.now());
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

      // 索引
      table.index(['period', 'rank']);
      table.index(['user_id', 'period']);
      table.index(['period_start', 'period_end']);
      table.index('last_updated');

      // 唯一约束
      table.unique(['user_id', 'period', 'period_start']);
    });
    console.log('✅ 成功创建 leaderboard_personal 表');
  } else {
    console.log('ℹ️  leaderboard_personal 表已存在，跳过迁移');
  }

  // 2. 创建联盟排行榜缓存表
  const allianceTableExists = await knex.raw(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'leaderboard_alliance'
    );
  `);

  if (!allianceTableExists.rows[0].exists) {
    await knex.schema.createTable('leaderboard_alliance', function(table) {
      table.bigIncrements('id').primary();
      table.integer('alliance_id').notNullable();
      table.string('alliance_name', 100).notNullable();
      table.string('alliance_flag', 50);
      table.string('pattern_id', 100);
      table.string('color', 20);
      table.integer('member_count').notNullable().defaultTo(0);
      table.bigInteger('total_pixels').notNullable().defaultTo(0);
      table.integer('rank').notNullable();
      table.string('period', 20).notNullable(); // daily, weekly, monthly, yearly
      table.timestamp('period_start').notNullable();
      table.timestamp('period_end').notNullable();
      table.timestamp('last_updated').notNullable().defaultTo(knex.fn.now());
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

      // 索引
      table.index(['period', 'rank']);
      table.index(['alliance_id', 'period']);
      table.index(['period_start', 'period_end']);
      table.index('last_updated');

      // 唯一约束
      table.unique(['alliance_id', 'period', 'period_start']);
    });
    console.log('✅ 成功创建 leaderboard_alliance 表');
  } else {
    console.log('ℹ️  leaderboard_alliance 表已存在，跳过迁移');
  }

  // 3. 创建地区排行榜缓存表
  const regionTableExists = await knex.raw(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'leaderboard_region'
    );
  `);

  if (!regionTableExists.rows[0].exists) {
    await knex.schema.createTable('leaderboard_region', function(table) {
      table.bigIncrements('id').primary();
      table.integer('region_id').notNullable();
      table.string('region_name', 100).notNullable();
      table.string('region_flag', 50);
      table.string('color', 20);
      table.integer('user_count').notNullable().defaultTo(0);
      table.integer('alliance_count').notNullable().defaultTo(0);
      table.bigInteger('total_pixels').notNullable().defaultTo(0);
      table.integer('rank').notNullable();
      table.string('period', 20).notNullable(); // daily, weekly, monthly, yearly
      table.timestamp('period_start').notNullable();
      table.timestamp('period_end').notNullable();
      table.timestamp('last_updated').notNullable().defaultTo(knex.fn.now());
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

      // 索引
      table.index(['period', 'rank']);
      table.index(['region_id', 'period']);
      table.index(['period_start', 'period_end']);
      table.index('last_updated');

      // 唯一约束
      table.unique(['region_id', 'period', 'period_start']);
    });
    console.log('✅ 成功创建 leaderboard_region 表');
  } else {
    console.log('ℹ️  leaderboard_region 表已存在，跳过迁移');
  }

  // 4. 创建排行榜点赞表
  const likesTableExists = await knex.raw(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'leaderboard_likes'
    );
  `);

  if (!likesTableExists.rows[0].exists) {
    await knex.schema.createTable('leaderboard_likes', function(table) {
      table.bigIncrements('id').primary();
      table.uuid('user_id').notNullable();
      table.string('item_type', 20).notNullable(); // personal, alliance, region
      table.uuid('item_id').notNullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

      // 索引
      table.index(['user_id', 'item_type', 'item_id']);
      table.index(['item_type', 'item_id']);
      table.index('created_at');

      // 唯一约束
      table.unique(['user_id', 'item_type', 'item_id']);
    });
    console.log('✅ 成功创建 leaderboard_likes 表');
  } else {
    console.log('ℹ️  leaderboard_likes 表已存在，跳过迁移');
  }

  // 5. 创建排行榜统计表
  const statsTableExists = await knex.raw(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'leaderboard_stats'
    );
  `);

  if (!statsTableExists.rows[0].exists) {
    await knex.schema.createTable('leaderboard_stats', function(table) {
      table.bigIncrements('id').primary();
      table.string('leaderboard_type', 20).notNullable(); // personal, alliance, region
      table.string('period', 20).notNullable(); // daily, weekly, monthly, yearly
      table.timestamp('period_start').notNullable();
      table.timestamp('period_end').notNullable();
      table.integer('total_entries').notNullable().defaultTo(0);
      table.bigInteger('total_pixels').notNullable().defaultTo(0);
      table.timestamp('last_calculated').notNullable().defaultTo(knex.fn.now());
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

      // 索引
      table.index(['leaderboard_type', 'period']);
      table.index(['period_start', 'period_end']);
      table.index('last_calculated');

      // 唯一约束
      table.unique(['leaderboard_type', 'period', 'period_start']);
    });
    console.log('✅ 成功创建 leaderboard_stats 表');
  } else {
    console.log('ℹ️  leaderboard_stats 表已存在，跳过迁移');
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('leaderboard_stats');
  await knex.schema.dropTableIfExists('leaderboard_likes');
  await knex.schema.dropTableIfExists('leaderboard_region');
  await knex.schema.dropTableIfExists('leaderboard_alliance');
  await knex.schema.dropTableIfExists('leaderboard_personal');
  console.log('✅ 已删除所有排行榜表');
};
