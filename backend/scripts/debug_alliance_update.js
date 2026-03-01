
const { db } = require('../src/config/database');
const Alliance = require('../src/models/Alliance');

async function debugUpdate() {
    try {
        console.log('🔍 Starting debug update...');

        // 1. Find Alliance
        const allianceName = 'Bcdtest2';
        const alliance = await Alliance.findByName(allianceName);
        if (!alliance) {
            console.error(`❌ Alliance '${allianceName}' not found`);
            process.exit(1);
        }
        console.log(`✅ Found alliance: ${alliance.name} (ID: ${alliance.id})`);

        // 2. Define update data
        const flagPatternId = 'custom_flag_e139af0b-bc06-4024-94cf-94ace1619ac3';
        console.log(`🔍 Attempting to update flag to: ${flagPatternId}`);

        // 3. Call update
        try {
            const updated = await alliance.update({
                flag_pattern_id: flagPatternId
            });
            console.log('✅ Update SUCCESS!');

            // Check property names in JSON
            const json = JSON.parse(JSON.stringify(updated));
            console.log('Check flag_payload property:', json.flag_payload ? '✅ EXISTS' : '❌ MISSING');
            console.log('Check flag property:', json.flag ? '⚠️ EXISTS (Deprecated)' : '✅ REMOVED');

            if (json.flag_payload) {
                console.log('Payload starts with:', json.flag_payload.substring(0, 50));
            }
        } catch (err) {
            console.error('❌ Update FAILED with error:');
            console.error(err);
        }

        process.exit(0);
    } catch (error) {
        console.error('Global error:', error);
        process.exit(1);
    }
}

debugUpdate();
