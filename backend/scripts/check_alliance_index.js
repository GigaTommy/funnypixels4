
const { db } = require('../src/config/database');

async function checkIndex() {
    try {
        const result = await db.raw("SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'alliances'");
        console.log('Indexes on alliances table:');
        result.rows.forEach(row => {
            console.log(`- ${row.indexname}`);
        });
        process.exit(0);
    } catch (error) {
        console.error('Error checking indexes:', error);
        process.exit(1);
    }
}

checkIndex();
