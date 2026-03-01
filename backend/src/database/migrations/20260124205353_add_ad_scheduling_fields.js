const { Knex } = require('knex');

/**
 * @param {Knex} knex
 */
exports.up = function (knex) {
    return knex.schema.alterTable('ad_orders', function (table) {
        table.jsonb('target_location'); // 存储位置信息 {lat, lng, address}
        table.timestamp('scheduled_time'); // 预计投放时间
    });
};

/**
 * @param {Knex} knex
 */
exports.down = function (knex) {
    return knex.schema.alterTable('ad_orders', function (table) {
        table.dropColumn('target_location');
        table.dropColumn('scheduled_time');
    });
};
