/**
 * Remove unused avatar_color column from users table
 */
exports.up = async function(knex) {
  const exists = await knex.schema.hasColumn('users', 'avatar_color');
  if (exists) {
    await knex.schema.alterTable('users', table => {
      table.dropColumn('avatar_color');
    });
  }
};

exports.down = async function(knex) {
  const exists = await knex.schema.hasColumn('users', 'avatar_color');
  if (!exists) {
    await knex.schema.alterTable('users', table => {
      table.string('avatar_color', 20).nullable();
    });
  }
};
