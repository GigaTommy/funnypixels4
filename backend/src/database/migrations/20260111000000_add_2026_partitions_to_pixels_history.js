/**
 * 添加 2026 年 pixels_history 分区
 *
 * 解决问题：
 * - 2026-01-11 之后的手动绘制无法写入 pixels_history 表
 * - 原因：原迁移只创建了 2025 年的分区（202501-202512）
 * - 本次迁移添加 2026 年的 12 个月分区
 */

exports.up = function(knex) {
  return knex.raw(`
    -- 创建 2026 年 1 月的分区
    CREATE TABLE IF NOT EXISTS pixels_history_202601 PARTITION OF pixels_history
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

    -- 创建 2026 年 2 月的分区
    CREATE TABLE IF NOT EXISTS pixels_history_202602 PARTITION OF pixels_history
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

    -- 创建 2026 年 3 月的分区
    CREATE TABLE IF NOT EXISTS pixels_history_202603 PARTITION OF pixels_history
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

    -- 创建 2026 年 4 月的分区
    CREATE TABLE IF NOT EXISTS pixels_history_202604 PARTITION OF pixels_history
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

    -- 创建 2026 年 5 月的分区
    CREATE TABLE IF NOT EXISTS pixels_history_202605 PARTITION OF pixels_history
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

    -- 创建 2026 年 6 月的分区
    CREATE TABLE IF NOT EXISTS pixels_history_202606 PARTITION OF pixels_history
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

    -- 创建 2026 年 7 月的分区
    CREATE TABLE IF NOT EXISTS pixels_history_202607 PARTITION OF pixels_history
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

    -- 创建 2026 年 8 月的分区
    CREATE TABLE IF NOT EXISTS pixels_history_202608 PARTITION OF pixels_history
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

    -- 创建 2026 年 9 月的分区
    CREATE TABLE IF NOT EXISTS pixels_history_202609 PARTITION OF pixels_history
    FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');

    -- 创建 2026 年 10 月的分区
    CREATE TABLE IF NOT EXISTS pixels_history_202610 PARTITION OF pixels_history
    FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');

    -- 创建 2026 年 11 月的分区
    CREATE TABLE IF NOT EXISTS pixels_history_202611 PARTITION OF pixels_history
    FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');

    -- 创建 2026 年 12 月的分区
    CREATE TABLE IF NOT EXISTS pixels_history_202612 PARTITION OF pixels_history
    FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');
  `);
};

exports.down = function(knex) {
  return knex.raw(`
    -- 删除 2026 年的所有分区（按反序）
    DROP TABLE IF EXISTS pixels_history_202612;
    DROP TABLE IF EXISTS pixels_history_202611;
    DROP TABLE IF EXISTS pixels_history_202610;
    DROP TABLE IF EXISTS pixels_history_202609;
    DROP TABLE IF EXISTS pixels_history_202608;
    DROP TABLE IF EXISTS pixels_history_202607;
    DROP TABLE IF EXISTS pixels_history_202606;
    DROP TABLE IF EXISTS pixels_history_202605;
    DROP TABLE IF EXISTS pixels_history_202604;
    DROP TABLE IF EXISTS pixels_history_202603;
    DROP TABLE IF EXISTS pixels_history_202602;
    DROP TABLE IF EXISTS pixels_history_202601;
  `);
};
