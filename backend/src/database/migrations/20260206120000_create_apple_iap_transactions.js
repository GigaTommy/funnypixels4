/**
 * Create Apple IAP transactions table
 * Stores Apple In-App Purchase transaction records for verification and audit
 */
exports.up = async function(knex) {
  const hasTable = await knex.schema.hasTable('apple_iap_transactions');

  if (!hasTable) {
    await knex.schema.createTable('apple_iap_transactions', (table) => {
      table.increments('id').primary();
      table.string('user_id').notNullable();
      table.string('transaction_id').notNullable().unique();
      table.string('product_id').notNullable();
      table.integer('points').notNullable();
      table.text('receipt'); // Partial receipt data for records
      table.string('environment', 50).defaultTo('production'); // sandbox or production
      table.string('status', 50).defaultTo('completed'); // pending, completed, refunded
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      // Indexes
      table.index('user_id', 'idx_apple_iap_user_id');
      table.index('transaction_id', 'idx_apple_iap_transaction_id');
      table.index('created_at', 'idx_apple_iap_created_at');
    });

    console.log('Created apple_iap_transactions table');
  } else {
    console.log('apple_iap_transactions table already exists');
  }
};

exports.down = async function(knex) {
  const hasTable = await knex.schema.hasTable('apple_iap_transactions');

  if (hasTable) {
    await knex.schema.dropTable('apple_iap_transactions');
    console.log('Dropped apple_iap_transactions table');
  }
};
