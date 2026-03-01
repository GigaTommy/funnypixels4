const { db } = require('./src/config/database');

async function checkTable() {
    try {
        const exists = await db.schema.hasTable('alliance_invites');
        console.log(`Table 'alliance_invites' exists: ${exists}`);

        if (exists) {
            const columns = await db('alliance_invites').columnInfo();
            console.log('Columns:', Object.keys(columns));
        }
    } catch (error) {
        console.error('Error checking table:', error);
    } finally {
        await db.destroy();
    }
}

checkTable();
