const { db } = require('./src/config/database');

async function debugStoreData() {
    try {
        console.log('--- Debugging store_items (Item Products) ---');
        const storeItems = await db('store_items').select('id', 'name', 'item_type', 'active', 'is_available');
        console.table(storeItems);

        console.log('\n--- Debugging shop_skus (Flag Products) ---');
        const shopSkus = await db('shop_skus').select('id', 'name', 'item_type', 'active', 'is_available');
        console.table(shopSkus);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

debugStoreData();
