const { db } = require('./src/config/database');

async function checkUser() {
    try {
        const user = await db('users').where('username', 'testuser').first();
        if (!user) {
            console.log('User testuser not found');
            return;
        }
        console.log(`User testuser ID: ${user.id}`);

        const allianceMember = await db('alliance_members')
            .join('alliances', 'alliance_members.alliance_id', 'alliances.id')
            .where('alliance_members.user_id', user.id)
            .select('alliances.name')
            .first();

        if (allianceMember) {
            console.log(`testuser is already in alliance: ${allianceMember.name}`);
        } else {
            console.log('testuser is NOT in any alliance');
        }

        const apps = await db('alliance_applications')
            .join('alliances', 'alliance_applications.alliance_id', 'alliances.id')
            .where('alliance_applications.user_id', user.id)
            .select('alliances.name', 'alliance_applications.status');

        console.log('testuser applications:');
        console.log(apps);

    } catch (error) {
        console.error('Error checking user:', error);
    } finally {
        await db.destroy();
    }
}

checkUser();
