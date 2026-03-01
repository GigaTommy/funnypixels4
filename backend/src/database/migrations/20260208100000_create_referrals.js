/**
 * Create referral system tables
 */
exports.up = async function(knex) {
  // Add referral_code column to users table
  const hasReferralCode = await knex.schema.hasColumn('users', 'referral_code');
  if (!hasReferralCode) {
    await knex.schema.alterTable('users', (table) => {
      table.string('referral_code', 8).nullable().unique();
      table.uuid('referred_by').nullable().references('id').inTable('users');
    });
  }

  // Create referrals tracking table
  const hasReferrals = await knex.schema.hasTable('referrals');
  if (!hasReferrals) {
    await knex.schema.createTable('referrals', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('inviter_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.uuid('invitee_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.string('referral_code', 8).notNullable();
      table.integer('inviter_reward').notNullable().defaultTo(0);
      table.integer('invitee_reward').notNullable().defaultTo(0);
      table.boolean('reward_claimed').notNullable().defaultTo(false);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.unique(['invitee_id']); // Each user can only be invited once
      table.index(['inviter_id']);
      table.index(['referral_code']);
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('referrals');

  const hasReferralCode = await knex.schema.hasColumn('users', 'referral_code');
  if (hasReferralCode) {
    await knex.schema.alterTable('users', (table) => {
      table.dropColumn('referral_code');
      table.dropColumn('referred_by');
    });
  }
};
