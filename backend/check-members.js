const { db } = require('./src/config/database');

async function checkMembers() {
    try {
        const members = await db('alliance_members')
            .join('users', 'alliance_members.user_id', 'users.id')
            .where('alliance_members.alliance_id', 4)
            .select('users.username', 'alliance_members.role', 'alliance_members.joined_at');

        console.log('--- Bcdtest2 Members ---');
        console.log(members);

    } catch (error) {
        console.error('Error checking members:', error);
    } finally {
        await db.destroy();
    }
}

checkMembers();
