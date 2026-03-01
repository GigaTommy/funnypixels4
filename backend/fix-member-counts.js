const { db } = require('./src/config/database');

async function fixMemberCounts() {
    try {
        const alliances = await db('alliances').select('id', 'name');

        for (const alliance of alliances) {
            const actualCount = await db('alliance_members')
                .where('alliance_id', alliance.id)
                .count('* as count')
                .first()
                .then(res => parseInt(res.count));

            console.log(`Alliance: ${alliance.name} (ID: ${alliance.id}) - Actual Members: ${actualCount}`);

            await db('alliances')
                .where('id', alliance.id)
                .update({ member_count: actualCount });

            console.log(`Updated member_count to ${actualCount}`);
        }

        console.log('--- Alliances after fix ---');
        const updatedAlliances = await db('alliances').select('id', 'name', 'member_count');
        console.log(updatedAlliances);

    } catch (error) {
        console.error('Error fixing member counts:', error);
    } finally {
        await db.destroy();
    }
}

fixMemberCounts();
