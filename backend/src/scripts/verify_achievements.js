const { db } = require('../config/database');
const Achievement = require('../models/Achievement');
const User = require('../models/User');

async function verifyAchievements() {
    console.log('🚀 Starting Achievement System Verification...');

    // 1. Get a test user
    const testUser = await db('users').first();
    if (!testUser) {
        console.error('❌ No user found in database to test with.');
        process.exit(1);
    }
    const userId = testUser.id;
    console.log(`👤 Using test user: ${testUser.username} (${userId})`);

    // 2. Ensure stats row exists and get initial stats
    await Achievement.ensureUserAchievementExists(userId);
    const initialStats = await Achievement.getUserAchievementStats(userId);
    console.log('📊 Initial Stats:', initialStats);

    // 3. Test Achievement: Social (PM)
    console.log('\n--- Testing Social Achievement (PM) ---');
    await Achievement.updateUserStats(userId, { pm_sent_count: 1, total_messages_count: 1 });
    const pmStats = await Achievement.getUserAchievementStats(userId);
    console.log(`✅ PM Sent Count: ${pmStats.pm_sent_count} (was ${initialStats.pm_sent_count})`);
    console.log(`✅ Total Messages: ${pmStats.total_messages_count} (was ${initialStats.total_messages_count})`);

    // 4. Test Achievement: Shop
    console.log('\n--- Testing Shop Achievement ---');
    await Achievement.updateUserStats(userId, { shop_purchases_count: 1, total_spent_gold: 100 });
    const shopStats = await Achievement.getUserAchievementStats(userId);
    console.log(`✅ Shop Purchases: ${shopStats.shop_purchases_count} (was ${initialStats.shop_purchases_count})`);
    console.log(`✅ Total Spent Gold: ${shopStats.total_spent_gold} (was ${initialStats.total_spent_gold})`);

    // 5. Test Achievement: Alliance
    console.log('\n--- Testing Alliance Achievement ---');
    await Achievement.updateUserStats(userId, { creations_count: 1, alliance_join_count: 1 });
    const allianceStats = await Achievement.getUserAchievementStats(userId);
    console.log(`✅ Alliance Creations: ${allianceStats.creations_count} (was ${initialStats.creations_count})`);
    console.log(`✅ Alliance Joined: ${allianceStats.alliance_join_count} (was ${initialStats.alliance_join_count})`);

    // 6. Test Achievement: Activity
    console.log('\n--- Testing Activity Achievement ---');
    await Achievement.updateUserStats(userId, { days_active_count: 5 });
    const activityStats = await Achievement.getUserAchievementStats(userId);
    console.log(`✅ Days Active: ${activityStats.days_active_count} (set to 5, was ${initialStats.days_active_count})`);

    // 7. Verify Unlocking Logic
    console.log('\n--- Verifying Unlocking Logic ---');
    // Mock a low-requirement achievement if needed, but let's just check if any unlocked
    const newlyUnlocked = await Achievement.checkAndUnlockAchievements(userId);
    if (newlyUnlocked.length > 0) {
        console.log(`🎉 Newly Unlocked Achievements (${newlyUnlocked.length}):`);
        newlyUnlocked.forEach(acc => console.log(`   - ${acc.name} (${acc.category}: ${acc.requirement})`));
    } else {
        console.log('ℹ️ No new achievements unlocked with current stats.');

        // Find an achievement we can easily reach
        const reachable = await db('achievements')
            .where('is_active', true)
            .where('requirement', '<=', 10)
            .first();

        if (reachable) {
            console.log(`💡 Trying to unlock: ${reachable.name} (Requirement: ${reachable.requirement} ${reachable.category})`);
            const update = {};
            const cat = reachable.category.toLowerCase();
            if (cat === 'pixel' || cat === 'pixels') update.pixels_drawn_count = reachable.requirement;
            else if (cat === 'likes' || cat === 'social') update.like_given_count = reachable.requirement;
            else if (cat === 'activity') update.days_active_count = reachable.requirement;
            else if (cat === 'shop') update.shop_purchases_count = reachable.requirement;

            if (Object.keys(update).length > 0) {
                await Achievement.updateUserStats(userId, update);
                const retryUnlocked = await Achievement.checkAndUnlockAchievements(userId);
                console.log(`🎉 After update, newly unlocked: ${retryUnlocked.map(a => a.name).join(', ')}`);
            }
        }
    }

    console.log('\n🏁 Verification Completed!');
    process.exit(0);
}

verifyAchievements().catch(err => {
    console.error('❌ Verification failed:', err);
    process.exit(1);
});
