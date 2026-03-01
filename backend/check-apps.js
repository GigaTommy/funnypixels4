const { db } = require('./src/config/database');

async function checkApplications() {
    try {
        console.log('--- Current Alliances ---');
        const alliances = await db('alliances').select('id', 'name');
        console.log(alliances);

        console.log('\n--- Recent Applications ---');
        const apps = await db('alliance_applications')
            .join('users', 'alliance_applications.user_id', 'users.id')
            .join('alliances', 'alliance_applications.alliance_id', 'alliances.id')
            .select(
                'alliance_applications.id',
                'users.username',
                'alliances.name as alliance_name',
                'alliance_applications.status',
                'alliance_applications.created_at'
            )
            .orderBy('alliance_applications.created_at', 'desc')
            .limit(10);
        console.log(apps);

        console.log('\n--- Bcdtest2 Alliance ID ---');
        const bcdtest2 = alliances.find(a => a.name === 'Bcdtest2');
        if (bcdtest2) {
            console.log(`Bcdtest2 ID: ${bcdtest2.id}`);
            const specificApps = await db('alliance_applications')
                .where('alliance_id', bcdtest2.id);
            console.log(`Applications for Bcdtest2: ${specificApps.length}`);
            console.log(specificApps);
        } else {
            console.log('Bcdtest2 alliance not found by name.');
        }

    } catch (error) {
        console.error('Error checking applications:', error);
    } finally {
        await db.destroy();
    }
}

checkApplications();
