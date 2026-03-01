/**
 * 迁移: 将 notifications.id 从 INTEGER 转换为 UUID
 *
 * 目的: 统一 notifications 和 system_messages 的ID类型，简化API设计
 *
 * 影响:
 * - notifications 表有 ~6000 条记录
 * - 无外键引用此表的id列（已验证）
 *
 * 步骤:
 * 1. 添加临时UUID列
 * 2. 为所有现有记录生成UUID
 * 3. 删除旧的integer id列（含主键约束）
 * 4. 将UUID列重命名为id
 * 5. 重建主键和序列
 */

exports.up = async function(knex) {
  console.log('🔄 开始迁移: notifications.id INTEGER → UUID');

  await knex.transaction(async (trx) => {
    // 1. 添加临时 UUID 列
    console.log('  步骤1: 添加临时 uuid_id 列...');
    await trx.schema.alterTable('notifications', (table) => {
      table.uuid('uuid_id');
    });

    // 2. 为所有现有记录生成 UUID
    console.log('  步骤2: 为现有记录生成 UUID...');
    await trx.raw(`
      UPDATE notifications
      SET uuid_id = gen_random_uuid()
      WHERE uuid_id IS NULL
    `);

    // 验证所有记录都有UUID
    const nullCount = await trx('notifications')
      .whereNull('uuid_id')
      .count('* as count')
      .first();

    if (parseInt(nullCount.count) > 0) {
      throw new Error(`还有 ${nullCount.count} 条记录的 uuid_id 为 NULL`);
    }

    console.log('  步骤3: 设置 uuid_id 为 NOT NULL...');
    await trx.raw(`
      ALTER TABLE notifications
      ALTER COLUMN uuid_id SET NOT NULL
    `);

    // 3. 删除旧的 id 列（会自动删除主键约束）
    console.log('  步骤4: 删除旧的 integer id 列...');
    await trx.schema.alterTable('notifications', (table) => {
      table.dropColumn('id');
    });

    // 4. 将 uuid_id 重命名为 id
    console.log('  步骤5: 重命名 uuid_id → id...');
    await trx.raw(`
      ALTER TABLE notifications
      RENAME COLUMN uuid_id TO id
    `);

    // 5. 重建主键约束
    console.log('  步骤6: 重建主键约束...');
    await trx.raw(`
      ALTER TABLE notifications
      ADD PRIMARY KEY (id)
    `);

    // 6. 添加索引（优化查询性能）
    console.log('  步骤7: 添加索引...');
    await trx.schema.alterTable('notifications', (table) => {
      table.index('user_id', 'idx_notifications_user_id');
      table.index('created_at', 'idx_notifications_created_at');
      table.index(['user_id', 'is_read'], 'idx_notifications_user_read');
    });

    // 验证最终结构
    const finalColumns = await trx('notifications').columnInfo();
    console.log('  ✅ 迁移完成！新结构:');
    console.log(`     - id: ${finalColumns.id.type}`);
    console.log(`     - user_id: ${finalColumns.user_id.type}`);

    const recordCount = await trx('notifications').count('* as count').first();
    console.log(`     - 记录数: ${recordCount.count}`);
  });

  console.log('✅ notifications.id 已成功转换为 UUID 类型');
};

exports.down = async function(knex) {
  console.log('⚠️  警告: 回滚此迁移会丢失所有 notification 数据！');
  console.log('🔄 开始回滚: notifications.id UUID → INTEGER');

  await knex.transaction(async (trx) => {
    // 回滚策略: 重建表（因为UUID无法转回有意义的integer）
    console.log('  步骤1: 删除索引...');
    await trx.raw(`
      DROP INDEX IF EXISTS idx_notifications_user_id;
      DROP INDEX IF EXISTS idx_notifications_created_at;
      DROP INDEX IF EXISTS idx_notifications_user_read;
    `);

    console.log('  步骤2: 添加临时 integer_id 列...');
    await trx.schema.alterTable('notifications', (table) => {
      table.increments('integer_id');
    });

    console.log('  步骤3: 删除 UUID id 列...');
    await trx.schema.alterTable('notifications', (table) => {
      table.dropColumn('id');
    });

    console.log('  步骤4: 重命名 integer_id → id...');
    await trx.raw(`
      ALTER TABLE notifications
      RENAME COLUMN integer_id TO id
    `);

    console.log('  步骤5: 重建主键...');
    await trx.raw(`
      ALTER TABLE notifications
      ADD PRIMARY KEY (id)
    `);

    // 重建序列
    await trx.raw(`
      CREATE SEQUENCE IF NOT EXISTS notifications_id_seq;
      ALTER TABLE notifications
      ALTER COLUMN id SET DEFAULT nextval('notifications_id_seq');
      SELECT setval('notifications_id_seq', COALESCE(MAX(id), 1)) FROM notifications;
    `);

    console.log('⚠️  回滚完成，但原有UUID数据已丢失');
  });
};

exports.config = {
  transaction: true
};
