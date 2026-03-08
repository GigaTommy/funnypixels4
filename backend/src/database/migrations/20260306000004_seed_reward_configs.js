/**
 * Seed reward / rate-limit / reconciliation config values into system_configs.
 * Uses INSERT ... ON CONFLICT DO NOTHING so it is safe to re-run.
 */

exports.up = async function (knex) {
  const configs = [
    {
      config_key: 'reward_config.share_points',
      config_value: '5',
      config_type: 'text',
      description: 'Points awarded per share action',
    },
    {
      config_key: 'reward_config.share_daily_cap',
      config_value: '10',
      config_type: 'text',
      description: 'Max share reward claims per user per day',
    },
    {
      config_key: 'reward_config.daily_bonus_points',
      config_value: '50',
      config_type: 'text',
      description: 'Bonus points for completing all daily tasks',
    },
    {
      config_key: 'rate_limit.reward_claim_max',
      config_value: '30',
      config_type: 'text',
      description: 'Max reward claim requests per user per minute',
    },
    {
      config_key: 'reconciliation.drift_critical_threshold',
      config_value: '1000',
      config_type: 'text',
      description: 'Total drift above which reconciliation alert is critical',
    },
    {
      config_key: 'reconciliation.users_warning_threshold',
      config_value: '10',
      config_type: 'text',
      description: 'Number of mismatched users above which alert is warning',
    },
  ];

  for (const cfg of configs) {
    // Check if key already exists to avoid duplicates
    const existing = await knex('system_configs')
      .where('config_key', cfg.config_key)
      .first();

    if (!existing) {
      await knex('system_configs').insert({
        ...cfg,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now(),
      });
    }
  }
};

exports.down = async function (knex) {
  await knex('system_configs')
    .whereIn('config_key', [
      'reward_config.share_points',
      'reward_config.share_daily_cap',
      'reward_config.daily_bonus_points',
      'rate_limit.reward_claim_max',
      'reconciliation.drift_critical_threshold',
      'reconciliation.users_warning_threshold',
    ])
    .del();
};
