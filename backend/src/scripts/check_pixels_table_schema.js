process.env.LOCAL_VALIDATION = 'true';
const { db } = require('../config/database');

(async () => {
  try {
    const columns = await db.raw(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'pixels'
      ORDER BY ordinal_position
    `);

    console.log('\n========== Pixels Table Schema ==========');
    columns.rows.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type}`);
    });
    console.log('\n');

    await db.destroy();
  } catch (error) {
    console.error('Error:', error);
    await db.destroy();
  }
})();
