const knex = require('knex')(require('./knexfile')['development']);

(async () => {
    try {
        const hasBoundary = await knex.schema.hasColumn('events', 'boundary');
        console.log(`Events table has 'boundary' column: ${hasBoundary}`);

        // Also check if we can insert a dummy event with boundary
        if (hasBoundary) {
            console.log('Column exists. Verification successful.');
        } else {
            console.error('Column DOES NOT EXIST.');
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await knex.destroy();
    }
})();
