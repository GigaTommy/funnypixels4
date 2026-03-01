exports.up = function (knex) {
    return knex.schema.createTable('system_logs', table => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.enum('level', ['info', 'warn', 'error', 'debug']).defaultTo('info').index();
        table.string('module').nullable().index();
        table.text('message').notNullable();
        table.uuid('user_id').nullable().references('id').inTable('users').onDelete('SET NULL');
        table.string('ip_address').nullable();
        table.jsonb('metadata').nullable();
        table.timestamp('created_at').defaultTo(knex.fn.now()).index();
    });
};

exports.down = function (knex) {
    return knex.schema.dropTableIfExists('system_logs');
};
