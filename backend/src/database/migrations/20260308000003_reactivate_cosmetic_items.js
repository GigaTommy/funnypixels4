/**
 * Reactivate cosmetic store items now that iOS rendering is implemented.
 * Items 30 (golden avatar frame), 31 (rainbow chat bubble), 32 (pixel master badge).
 * Only reactivate 30 and 32 — chat bubble (31) is deferred to Phase 2.
 */
exports.up = async function (knex) {
  await knex('store_items')
    .whereIn('id', [30, 32])
    .update({ active: true, is_available: true });
};

exports.down = async function (knex) {
  await knex('store_items')
    .whereIn('id', [30, 32])
    .update({ active: false, is_available: false });
};
