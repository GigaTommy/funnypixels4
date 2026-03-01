const { db } = require('./src/config/database');
const StorePayment = require('./src/models/StorePayment');
const { v4: uuidv4 } = require('uuid');

async function test() {
    try {
        console.log('🧪 Starting Verification...');

        // 1. Get or Create a User
        let user = await db('users').first();
        if (!user) {
            console.log('⚠️ No users found, creating a test user...');
            const userId = uuidv4();
            await db('users').insert({
                id: userId,
                username: 'test_user',
                email: 'test@example.com',
                password_hash: 'hash',
                created_at: new Date(),
                updated_at: new Date()
            });
            user = { id: userId };
        }
        console.log(`👤 Using user: ${user.id}`);

        // 2. Create Dummy Data
        // - Purchase (Negative points)
        await StorePayment.addUserPoints(user.id, -50, 'Test Purchase', '1'); // Assuming 1 is a valid Store Item ID, or it will be null join (safe)

        // - Recharge (Positive points)
        await StorePayment.addUserPoints(user.id, 100, '用户充值', 'RefRecharge');

        // 3. Verify Transactions (Unfiltered)
        const transactions = await StorePayment.getUserTransactions(user.id, 10);
        console.log(`🔍 Total Transactions: ${transactions.pagination.total}`);

        // 4. Verify Consumption Filter (Purchase)
        const purchases = await StorePayment.getUserTransactions(user.id, 10, 0, { type: 'purchase' });
        console.log(`🔍 Purchase Transactions: ${purchases.pagination.total}`);

        const allPurchasesAreNegative = purchases.items.every(t => t.total_price > 0 && t.type === 'purchase');

        if (purchases.items.length > 0 && allPurchasesAreNegative) {
            console.log('✅ Purchase Filter Verification PASSED: Only purchases found');
            // Double check reason
            const hasRecharge = purchases.items.some(t => t.id.includes('充值'));
            if (hasRecharge) console.error("❌ Purchase Filter FAILED: Found recharge in purchases");
        } else {
            console.warn('⚠️ Purchase Filter: No purchases found or check logic issue');
        }

        // 5. Verify Recharge Filter
        const rechargetx = await StorePayment.getUserTransactions(user.id, 10, 0, { type: 'recharge' });
        console.log(`🔍 Recharge Transactions in Ledger: ${rechargetx.pagination.total}`);

        const allRechargesArePositive = rechargetx.items.every(t => t.type === 'recharge' || t.type === 'refund'); // Logic says recharge or refund (positive)
        if (rechargetx.items.length > 0 && allRechargesArePositive) {
            console.log('✅ Recharge Filter Verification PASSED');
        } else {
            console.warn('⚠️ Recharge Filter: No recharges found');
        }

        // 6. Verify Date Filter
        // Create query for a date range that should cover everything created today
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        const dateFiltered = await StorePayment.getUserTransactions(user.id, 10, 0, {
            startDate: yesterday.toISOString(),
            endDate: tomorrow.toISOString()
        });
        console.log(`🔍 Date Range Transactions: ${dateFiltered.pagination.total}`);
        if (dateFiltered.pagination.total >= (transactions.pagination.total)) { // Should find all recent ones
            console.log('✅ Date Filter Verification PASSED (Wide Range)');
        } else {
            console.warn('⚠️ Date Filter: Found fewer transactions than expected (check timezone?)');
        }

        // Narrow range (should find 0)
        const futureFiltered = await StorePayment.getUserTransactions(user.id, 10, 0, {
            startDate: tomorrow.toISOString(),
        });
        console.log(`🔍 Future Transactions: ${futureFiltered.pagination.total}`);
        if (parseInt(futureFiltered.pagination.total) === 0) {
            console.log('✅ Date Filter Verification PASSED (No Future Items)');
        } else {
            console.error('❌ Date Filter Verification FAILED: Found future items');
        }

        // 7. Verify Use Item Logic (Pixel Recovery)
        console.log('\n🧪 Testing Use Item Logic...');

        // Create "Super Recovery Agent" item if not exists
        let superItem = await db('store_items').where('name', '超级恢复剂').first();
        let superItemId;
        if (!superItem) {
            const ids = await db('store_items').insert({
                name: '超级恢复剂',
                description: 'Restore 32 pixels',
                price_points: 100,
                item_type: 'consumable',
                active: true,
                metadata: { boost_amount: 32 } // Explicit metadata test
            }).returning('id');
            superItemId = ids[0].id;
        } else {
            superItemId = superItem.id;
        }

        // Create "Infinite Recovery Agent" item (Testing missing logic)
        let infiniteItem = await db('store_items').where('name', '无限恢复剂').first();
        let infiniteItemId;
        if (!infiniteItem) {
            const ids = await db('store_items').insert({
                name: '无限恢复剂',
                description: 'Restore 64 pixels',
                price_points: 200,
                item_type: 'consumable',
                active: true
                // No metadata, relying on name check
            }).returning('id');
            infiniteItemId = ids[0].id;
        } else {
            infiniteItemId = infiniteItem.id;
        }

        // Add items to inventory
        await db('user_inventory').insert([
            { user_id: user.id, item_id: superItemId, quantity: 5, consumed: false },
            { user_id: user.id, item_id: infiniteItemId, quantity: 5, consumed: false }
        ]).onConflict(['user_id', 'item_id']).merge(); // Update if exists

        const Store = require('./src/models/Store');

        // Check Initial State
        const initialState = await db('user_pixel_states').where('user_id', user.id).first();
        const initialPoints = initialState ? (initialState.item_pixel_points || 0) : 0;
        console.log(`Initial Item Pixel Points: ${initialPoints}`);

        // Use Super Recovery Agent
        console.log('Using Super Recovery Agent...');
        await Store.useItem(user.id, superItemId, 1);

        const midState = await db('user_pixel_states').where('user_id', user.id).first();
        const midPoints = midState.item_pixel_points;
        console.log(`After Super(+32): ${midPoints} (Expected: ${initialPoints + 32})`);

        if (midPoints === initialPoints + 32) console.log('✅ Super Recovery Agent Verified');
        else console.error('❌ Super Recovery Agent Failed');

        // Use Infinite Recovery Agent
        console.log('Using Infinite Recovery Agent...');
        await Store.useItem(user.id, infiniteItemId, 1);

        const finalState = await db('user_pixel_states').where('user_id', user.id).first();
        const finalPoints = finalState.item_pixel_points;
        console.log(`After Infinite(+64): ${finalPoints} (Expected: ${midPoints + 64})`);

        // If logic is missing, it likely defaulted to 16
        if (finalPoints === midPoints + 64) console.log('✅ Infinite Recovery Agent Verified');
        else if (finalPoints === midPoints + 16) console.warn('⚠️ Infinite Recovery Agent used default +16 (Logic Missing)');
        else console.error(`❌ Infinite Recovery Agent Failed with unexpected value: ${finalPoints - midPoints}`);

    } catch (error) {
        console.error('❌ Test Failed:', error);
    } finally {
        process.exit();
    }
}

test();
