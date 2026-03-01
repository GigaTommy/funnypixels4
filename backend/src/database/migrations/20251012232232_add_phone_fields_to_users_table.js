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
  if (!hasColumn('phone')) columnsToAdd.push('phone');
  if (!hasColumn('phone_verified')) columnsToAdd.push('phone_verified');
  if (!hasColumn('phone_verified_at')) columnsToAdd.push('phone_verified_at');
  if (!hasColumn('login_method')) columnsToAdd.push('login_method');
  if (!hasColumn('phone_location')) columnsToAdd.push('phone_location');
  if (!hasColumn('phone_carrier')) columnsToAdd.push('phone_carrier');
  if (!hasColumn('last_phone_login_at')) columnsToAdd.push('last_phone_login_at');

  if (columnsToAdd.length === 0) {
    return; // 所有字段都已存在
  }

  return knex.schema.alterTable('users', function(table) {
    if (columnsToAdd.includes('phone')) {
      table.string('phone', 20).nullable().unique().index();
    }
    if (columnsToAdd.includes('phone_verified')) {
      table.boolean('phone_verified').defaultTo(false).index();
    }
    if (columnsToAdd.includes('phone_verified_at')) {
      table.timestamp('phone_verified_at').nullable();
    }
    if (columnsToAdd.includes('login_method')) {
      table.string('login_method', 20).defaultTo('email').index();
    }
    if (columnsToAdd.includes('phone_location')) {
      table.string('phone_location', 100).nullable();
    }
    if (columnsToAdd.includes('phone_carrier')) {
      table.string('phone_carrier', 50).nullable();
    }
    if (columnsToAdd.includes('last_phone_login_at')) {
      table.timestamp('last_phone_login_at').nullable();
    }
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('users', function(table) {
    // 删除添加的字段
    table.dropColumn('phone');
    table.dropColumn('phone_verified');
    table.dropColumn('phone_verified_at');
    table.dropColumn('login_method');
    table.dropColumn('phone_location');
    table.dropColumn('phone_carrier');
    table.dropColumn('last_phone_login_at');
  });
};
