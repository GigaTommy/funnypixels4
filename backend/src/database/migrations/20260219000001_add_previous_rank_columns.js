/**
 * Migration: 排行榜添加 previous_rank 字段
 * 用于排名变动展示功能
 */

exports.up = function(knex) {
  return knex.raw(`
    ALTER TABLE leaderboard_personal ADD COLUMN IF NOT EXISTS previous_rank INT;
    ALTER TABLE leaderboard_alliance ADD COLUMN IF NOT EXISTS previous_rank INT;
  `);
};

exports.down = function(knex) {
  return knex.raw(`
    ALTER TABLE leaderboard_personal DROP COLUMN IF EXISTS previous_rank;
    ALTER TABLE leaderboard_alliance DROP COLUMN IF EXISTS previous_rank;
  `);
};
