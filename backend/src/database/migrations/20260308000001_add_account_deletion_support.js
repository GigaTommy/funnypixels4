/**
 * Migration: 添加账户删除功能支持
 *
 * 功能：
 * 1. users 表新增删除状态字段
 * 2. 创建 account_recovery_tokens 表
 * 3. pixels/drawing_sessions/pixel_comments 表新增匿名化字段
 * 4. 创建必要索引
 *
 * Date: 2026-03-08
 */

exports.up = async function(knex) {
  // Check if pixel_comments table exists
  const hasPixelComments = await knex.schema.hasTable('pixel_comments');

  const migrations = [
    // 1. users 表 - 添加删除相关字段
    knex.schema.table('users', table => {
      // 账户状态
      table.enum('account_status', [
        'active',           // 正常
        'pending_deletion', // 待删除（30天内可恢复）
        'anonymized',       // 已匿名化（不可恢复）
        'purged',          // 已清除
        'suspended'        // 已封禁
      ]).defaultTo('active').notNullable();

      // 删除时间戳
      table.timestamp('deleted_at').nullable();
      table.timestamp('deletion_scheduled_for').nullable();  // 计划删除时间（deleted_at + 30天）
      table.timestamp('anonymized_at').nullable();
      table.timestamp('purged_at').nullable();

      // 加密存储的恢复数据（用于30天内恢复）
      table.binary('recovery_email').nullable();
      table.binary('recovery_username').nullable();

      // 索引
      table.index('account_status');
      table.index('deleted_at');
      table.index('deletion_scheduled_for');
    }),

    // 2. 创建 account_recovery_tokens 表
    knex.schema.createTable('account_recovery_tokens', table => {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.uuid('user_id').notNullable()
        .references('id').inTable('users').onDelete('CASCADE');
      table.string('token', 64).notNullable().unique();
      table.timestamp('expires_at').notNullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());

      // 索引
      table.index('token');
      table.index('expires_at');
      table.index('user_id');
    }),

    // 3. pixels 表 - 添加匿名化标记
    knex.schema.table('pixels', table => {
      table.boolean('is_anonymous').defaultTo(false).notNullable();
      table.timestamp('anonymized_at').nullable();

      // 索引
      table.index('is_anonymous');
    }),

    // 4. drawing_sessions 表 - 添加匿名化标记
    knex.schema.table('drawing_sessions', table => {
      table.boolean('is_anonymous').defaultTo(false).notNullable();
      table.timestamp('anonymized_at').nullable();

      // 索引
      table.index('is_anonymous');
    })
  ];

  // 5. pixel_comments 表 - 添加匿名化标记和作者名称缓存（仅当表存在时）
  if (hasPixelComments) {
    migrations.push(
      knex.schema.table('pixel_comments', table => {
        table.boolean('is_anonymous').defaultTo(false).notNullable();
        table.string('author_name').nullable();  // 缓存作者名称，用于显示"已删除用户"
      })
    );
  }

  return Promise.all(migrations).then(() => {
    // 创建部分唯一索引（PostgreSQL 特性）
    // 只对 active 状态的用户强制邮箱/用户名唯一
    return Promise.all([
      knex.raw(`
        CREATE UNIQUE INDEX users_email_active_unique
        ON users(email)
        WHERE account_status = 'active'
      `),
      knex.raw(`
        CREATE UNIQUE INDEX users_username_active_unique
        ON users(username)
        WHERE account_status = 'active'
      `)
    ]);
  });
};

exports.down = async function(knex) {
  const hasPixelComments = await knex.schema.hasTable('pixel_comments');

  const rollbacks = [
    // 删除部分唯一索引
    knex.raw('DROP INDEX IF EXISTS users_email_active_unique'),
    knex.raw('DROP INDEX IF EXISTS users_username_active_unique'),

    // 删除表
    knex.schema.dropTableIfExists('account_recovery_tokens'),

    // 删除 users 表字段
    knex.schema.table('users', table => {
      table.dropColumn('account_status');
      table.dropColumn('deleted_at');
      table.dropColumn('deletion_scheduled_for');
      table.dropColumn('anonymized_at');
      table.dropColumn('purged_at');
      table.dropColumn('recovery_email');
      table.dropColumn('recovery_username');
    }),

    // 删除 pixels 表字段
    knex.schema.table('pixels', table => {
      table.dropColumn('is_anonymous');
      table.dropColumn('anonymized_at');
    }),

    // 删除 drawing_sessions 表字段
    knex.schema.table('drawing_sessions', table => {
      table.dropColumn('is_anonymous');
      table.dropColumn('anonymized_at');
    })
  ];

  // 删除 pixel_comments 表字段（仅当表存在时）
  if (hasPixelComments) {
    rollbacks.push(
      knex.schema.table('pixel_comments', table => {
        table.dropColumn('is_anonymous');
        table.dropColumn('author_name');
      })
    );
  }

  return Promise.all(rollbacks);
};
