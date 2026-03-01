/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // 检查哪些字段已存在
  const existingColumns = await knex.raw(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'users' AND table_schema = 'public'
  `);
  const hasColumn = (name) => existingColumns.rows.some(row => row.column_name === name);

  // 只添加不存在的字段
  const columnsToAdd = [];
  if (!hasColumn('wechat_openid')) columnsToAdd.push('wechat_openid');
  if (!hasColumn('wechat_unionid')) columnsToAdd.push('wechat_unionid');
  if (!hasColumn('wechat_nickname')) columnsToAdd.push('wechat_nickname');
  if (!hasColumn('wechat_avatar_url')) columnsToAdd.push('wechat_avatar_url');
  if (!hasColumn('wechat_sex')) columnsToAdd.push('wechat_sex');
  if (!hasColumn('wechat_province')) columnsToAdd.push('wechat_province');
  if (!hasColumn('wechat_city')) columnsToAdd.push('wechat_city');
  if (!hasColumn('wechat_country')) columnsToAdd.push('wechat_country');
  if (!hasColumn('login_method')) columnsToAdd.push('login_method');
  if (!hasColumn('wechat_last_login_at')) columnsToAdd.push('wechat_last_login_at');

  if (columnsToAdd.length === 0) {
    return; // 所有字段都已存在
  }

  return knex.schema.alterTable('users', function(table) {
    if (columnsToAdd.includes('wechat_openid')) {
      table.string('wechat_openid', 100).unique().nullable();
    }
    if (columnsToAdd.includes('wechat_unionid')) {
      table.string('wechat_unionid', 100).unique().nullable();
    }
    if (columnsToAdd.includes('wechat_nickname')) {
      table.string('wechat_nickname', 100).nullable();
    }
    if (columnsToAdd.includes('wechat_avatar_url')) {
      table.string('wechat_avatar_url', 500).nullable();
    }
    if (columnsToAdd.includes('wechat_sex')) {
      table.smallint('wechat_sex').defaultTo(0).nullable();
    }
    if (columnsToAdd.includes('wechat_province')) {
      table.string('wechat_province', 50).nullable();
    }
    if (columnsToAdd.includes('wechat_city')) {
      table.string('wechat_city', 50).nullable();
    }
    if (columnsToAdd.includes('wechat_country')) {
      table.string('wechat_country', 50).nullable();
    }
    if (columnsToAdd.includes('login_method')) {
      table.string('login_method', 20).defaultTo('password').nullable();
    }
    if (columnsToAdd.includes('wechat_last_login_at')) {
      table.timestamp('wechat_last_login_at').nullable();
    }
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.table('users', function(table) {
    table.dropColumn('wechat_openid');
    table.dropColumn('wechat_unionid');
    table.dropColumn('wechat_nickname');
    table.dropColumn('wechat_avatar_url');
    table.dropColumn('wechat_sex');
    table.dropColumn('wechat_province');
    table.dropColumn('wechat_city');
    table.dropColumn('wechat_country');
    table.dropColumn('login_method');
    table.dropColumn('wechat_last_login_at');
  });
};
