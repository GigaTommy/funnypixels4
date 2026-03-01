/**
 * 社交动态 Feed 系统数据表
 */

exports.up = async function(knex) {
  // 1. 动态条目表
  await knex.schema.createTableIfNotExists('feed_items', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().index();
    table.string('type', 30).notNullable(); // drawing_complete, achievement, checkin, alliance_join
    table.jsonb('content').notNullable().defaultTo('{}');
    table.uuid('drawing_session_id').nullable().index();
    table.integer('like_count').notNullable().defaultTo(0);
    table.integer('comment_count').notNullable().defaultTo(0);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.index(['user_id', 'created_at']);
    table.index(['type', 'created_at']);
    table.index('created_at');
  });

  // 2. 动态点赞表
  await knex.schema.createTableIfNotExists('feed_likes', function(table) {
    table.bigIncrements('id').primary();
    table.uuid('feed_item_id').notNullable().references('id').inTable('feed_items').onDelete('CASCADE');
    table.uuid('user_id').notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.unique(['feed_item_id', 'user_id']);
    table.index('user_id');
  });

  // 3. 动态评论表
  await knex.schema.createTableIfNotExists('feed_comments', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('feed_item_id').notNullable().references('id').inTable('feed_items').onDelete('CASCADE');
    table.uuid('user_id').notNullable();
    table.text('content').notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.index(['feed_item_id', 'created_at']);
    table.index('user_id');
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('feed_comments');
  await knex.schema.dropTableIfExists('feed_likes');
  await knex.schema.dropTableIfExists('feed_items');
};
