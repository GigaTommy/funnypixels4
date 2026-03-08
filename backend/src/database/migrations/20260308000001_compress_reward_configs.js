/**
 * Compress reward configs to reduce point inflation.
 *
 * share_points:      5 → 3
 * share_daily_cap:  10 → 5
 * daily_bonus_points: 50 → 30
 */

exports.up = async function (knex) {
  const updates = [
    { config_key: 'reward_config.share_points', config_value: '3' },
    { config_key: 'reward_config.share_daily_cap', config_value: '5' },
    { config_key: 'reward_config.daily_bonus_points', config_value: '30' },
  ];

  for (const { config_key, config_value } of updates) {
    await knex('system_configs')
      .where('config_key', config_key)
      .update({ config_value, updated_at: knex.fn.now() });
  }
};

exports.down = async function (knex) {
  const rollback = [
    { config_key: 'reward_config.share_points', config_value: '5' },
    { config_key: 'reward_config.share_daily_cap', config_value: '10' },
    { config_key: 'reward_config.daily_bonus_points', config_value: '50' },
  ];

  for (const { config_key, config_value } of rollback) {
    await knex('system_configs')
      .where('config_key', config_key)
      .update({ config_value, updated_at: knex.fn.now() });
  }
};
