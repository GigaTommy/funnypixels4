/**
 * 确保 user_achievements 表具有所有必需的统计字段
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    console.log('  📝 检查 user_achievements 表结构...');

    const hasTable = await knex.schema.hasTable('user_achievements');
    if (!hasTable) {
        console.log('  ⚠️ user_achievements 表不存在，跳过迁移');
        return;
    }

    await knex.schema.alterTable('user_achievements', function (table) {
        // 基础字段检查
        const columns = [
            { name: 'achievement_id', type: 'integer', default: 0 },
            { name: 'like_received_count', type: 'bigInteger', default: 0 },
            { name: 'like_given_count', type: 'bigInteger', default: 0 },
            { name: 'pixels_drawn_count', type: 'bigInteger', default: 0 },
            { name: 'days_active_count', type: 'integer', default: 0 },
            { name: 'progress', type: 'integer', default: 0 },
            { name: 'is_completed', type: 'boolean', default: false },
            { name: 'is_claimed', type: 'boolean', default: false },
            { name: 'completed_at', type: 'timestamp', nullable: true },
            { name: 'claimed_at', type: 'timestamp', nullable: true },
            { name: 'updated_at', type: 'timestamp', default: knex.fn.now() }
        ];

        // 我们会在下面逐个添加，因为 knex 不支持在 alterTable 中直接做条件判断
    });

    // 逐个检查并添加缺失的列
    const columnsToAdd = [
        { name: 'achievement_id', builder: (t) => t.integer('achievement_id').notNullable().defaultTo(0) },
        { name: 'like_received_count', builder: (t) => t.bigInteger('like_received_count').defaultTo(0) },
        { name: 'like_given_count', builder: (t) => t.bigInteger('like_given_count').defaultTo(0) },
        { name: 'pixels_drawn_count', builder: (t) => t.bigInteger('pixels_drawn_count').defaultTo(0) },
        { name: 'days_active_count', builder: (t) => t.integer('days_active_count').defaultTo(0) },
        { name: 'progress', builder: (t) => t.integer('progress').notNullable().defaultTo(0) },
        { name: 'is_completed', builder: (t) => t.boolean('is_completed').notNullable().defaultTo(false) },
        { name: 'is_claimed', builder: (t) => t.boolean('is_claimed').notNullable().defaultTo(false) },
        { name: 'completed_at', builder: (t) => t.timestamp('completed_at').nullable() },
        { name: 'claimed_at', builder: (t) => t.timestamp('claimed_at').nullable() },
        { name: 'updated_at', builder: (t) => t.timestamp('updated_at').defaultTo(knex.fn.now()) }
    ];

    for (const col of columnsToAdd) {
        const exists = await knex.schema.hasColumn('user_achievements', col.name);
        if (!exists) {
            console.log(`  ➕ 添加缺失列: ${col.name}`);
            await knex.schema.alterTable('user_achievements', col.builder);
        }
    }

    // 确保 user_id 和 achievement_id 的组合是唯一的
    const constraintName = 'user_achievements_user_id_achievement_id_unique';
    try {
        await knex.raw(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = '${constraintName}' 
          AND table_name = 'user_achievements'
        ) THEN
          ALTER TABLE user_achievements ADD CONSTRAINT ${constraintName} UNIQUE(user_id, achievement_id);
        END IF;
      END $$;
    `);
    } catch (error) {
        console.log('  ⚠️ 添加唯一约束时出错（可能已存在）:', error.message);
    }

    console.log('  ✅ user_achievements 表结构同步完成');
};

exports.down = function (knex) {
    // 回滚操作通常不建议删除这些列，因为可能会导致数据丢失
    // 这里可以为空，或者选择性回滚
};
