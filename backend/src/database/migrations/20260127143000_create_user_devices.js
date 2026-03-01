
exports.up = function (knex) {
    return knex.schema.createTable('user_devices', table => {
        table.increments('id').primary();
        table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
        table.string('device_key_id').notNullable().unique();
        table.text('attestation_object'); // Base64 encoded
        table.boolean('is_verified').defaultTo(false);
        table.timestamp('verified_at');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());

        table.index(['user_id']);
        table.index(['device_key_id']);
    });
};

exports.down = function (knex) {
    return knex.schema.dropTable('user_devices');
};
