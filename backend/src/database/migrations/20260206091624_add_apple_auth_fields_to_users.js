/**
 * Add Apple Sign In fields to users table
 */
exports.up = async function(knex) {
  // Check if columns already exist
  const hasAppleUserId = await knex.schema.hasColumn('users', 'apple_user_id');
  const hasAppleLastLogin = await knex.schema.hasColumn('users', 'apple_last_login_at');

  if (!hasAppleUserId || !hasAppleLastLogin) {
    await knex.schema.alterTable('users', (table) => {
      if (!hasAppleUserId) {
        table.string('apple_user_id', 255).nullable().unique();
        table.index('apple_user_id', 'idx_users_apple_user_id');
      }
      if (!hasAppleLastLogin) {
        table.timestamp('apple_last_login_at').nullable();
      }
    });
    console.log('Added Apple auth fields to users table');
  } else {
    console.log('Apple auth fields already exist in users table');
  }
};

exports.down = async function(knex) {
  const hasAppleUserId = await knex.schema.hasColumn('users', 'apple_user_id');
  const hasAppleLastLogin = await knex.schema.hasColumn('users', 'apple_last_login_at');

  if (hasAppleUserId || hasAppleLastLogin) {
    await knex.schema.alterTable('users', (table) => {
      if (hasAppleUserId) {
        table.dropIndex('apple_user_id', 'idx_users_apple_user_id');
        table.dropColumn('apple_user_id');
      }
      if (hasAppleLastLogin) {
        table.dropColumn('apple_last_login_at');
      }
    });
    console.log('Removed Apple auth fields from users table');
  }
};
