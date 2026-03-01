/**
 * Migration: Fix auto-increment sequences out of sync with actual max IDs
 *
 * Problem: Seed files insert rows with hardcoded IDs but never reset the
 * corresponding PostgreSQL sequences. This causes "duplicate key" errors
 * when new rows are inserted via the application (the sequence generates
 * an ID that already exists).
 *
 * Affected tables: shop_skus (seq=1, max_id=999), achievements (seq=4, max_id=162)
 */
exports.up = async function (knex) {
  // Get all tables with serial/identity columns and fix any out-of-sync sequences
  const tables = [
    { table: 'shop_skus', seq: 'shop_skus_id_seq', col: 'id' },
    { table: 'achievements', seq: 'achievements_id_seq', col: 'id' },
    { table: 'store_items', seq: 'store_items_id_seq', col: 'id' },
    { table: 'ad_products', seq: 'ad_products_id_seq', col: 'id' },
    { table: 'user_pixel_states', seq: 'user_pixel_states_id_seq', col: 'id' },
    { table: 'chat_messages', seq: 'chat_messages_id_seq', col: 'id' },
    { table: 'notifications', seq: 'notifications_id_seq', col: 'id' },
    { table: 'recharge_orders', seq: 'recharge_orders_id_seq', col: 'id' },
  ];

  for (const { table, seq, col } of tables) {
    try {
      // Check if the sequence exists
      const seqExists = await knex.raw(`
        SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = ?
      `, [seq]);

      if (seqExists.rows.length > 0) {
        // Reset sequence to MAX(id) + 1 (or 1 if table is empty)
        await knex.raw(`
          SELECT setval(?, COALESCE((SELECT MAX(??) FROM ??), 0) + 1, false)
        `, [seq, col, table]);
        console.log(`  ✅ ${seq} synced`);
      }
    } catch (err) {
      // Sequence might not exist for this table, skip silently
      console.log(`  ⚠️ ${seq} skipped: ${err.message}`);
    }
  }
};

exports.down = async function () {
  // Sequences don't need to be reverted
};
