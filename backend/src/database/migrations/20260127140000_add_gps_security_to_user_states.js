
exports.up = function (knex) {
    return knex.schema.table('user_pixel_states', table => {
        table.decimal('last_latitude', 10, 8).nullable();
        table.decimal('last_longitude', 11, 8).nullable();
    });
};

exports.down = function (knex) {
    return knex.schema.table('user_pixel_states', table => {
        table.dropColumn('last_latitude');
        table.dropColumn('last_longitude');
    });
};
