const { db } = require('./src/config/database');

async function migrate() {
    try {
        console.log('🔄 Running manual migration...');
        const hasTargetLocation = await db.schema.hasColumn('ad_orders', 'target_location');

        if (!hasTargetLocation) {
            await db.schema.alterTable('ad_orders', function (table) {
                table.jsonb('target_location');
                table.timestamp('scheduled_time');
            });
            console.log('✅ Added target_location and scheduled_time columns');
        } else {
            console.log('⚠️ Columns already exist');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrate();
