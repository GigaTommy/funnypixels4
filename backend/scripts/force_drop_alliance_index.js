
const { db } = require('../src/config/database');

async function forceDropIndex() {
    try {
        console.log('🔌 Removing alliances_flag_payload_idx if exists...');
        await db.raw('DROP INDEX IF EXISTS alliances_flag_payload_idx');
        console.log('✅ Index dropped (or did not exist).');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error dropping index:', error);
        process.exit(1);
    }
}

forceDropIndex();
