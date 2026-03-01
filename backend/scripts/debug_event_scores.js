
const Knex = require('knex');
const knexConfig = require('../knexfile');
const eventService = require('../src/services/eventService');
const turf = require('@turf/turf');

// Initialize Knex
const knex = Knex(knexConfig.development);

// Mock the knex instance in eventService if it's not globally available or injected
// However, eventService usually requires 'knex' from a module. 
// Let's assume eventService functions work if the process has db access.
// We might need to monkey-patch or ensure eventService uses OUR knex instance if it imports it directly.
// Checking eventService.js imports... it usually does `const knex = require('../config/database')`.
// So running this script from root/backend should work if env vars are set or default config is valid.

async function debugScores() {
    console.log("🚀 Starting Debug Script...");

    try {
        // 1. Get Active Events
        console.log("🔍 Fetching active events...");
        const events = await knex('events')
            .where('status', 'active')
            .select('*');

        if (events.length === 0) {
            console.log("❌ No active events found.");
            process.exit(0);
        }

        const event = events[0];
        console.log(`✅ Found Event: ${event.title} (${event.id})`);

        // Parse boundary
        let boundary;
        if (typeof event.boundary === 'string') {
            boundary = JSON.parse(event.boundary);
        } else {
            boundary = event.boundary;
        }

        const bbox = turf.bbox(boundary);
        console.log(`📦 BBox: [${bbox.join(', ')}]`);

        // 2. Count Pixels in DB directly (Raw Count)
        const rawCount = await knex('pixels')
            .where('latitude', '>=', bbox[1])
            .andWhere('latitude', '<=', bbox[3])
            .andWhere('longitude', '>=', bbox[0])
            .andWhere('longitude', '<=', bbox[2])
            .count('* as count');

        console.log(`📊 Raw Pixels in BBox (Direct Query): ${rawCount[0].count}`);

        // 3. Run EventService Logic
        console.log("⚙️  Running eventService.processEventScores...");

        // We need to verify if eventService uses the singleton knex or needs injection. 
        // Usually it requires the file.

        const result = await eventService.processEventScores(event.id);

        console.log("\n📈 Result from processEventScores:");
        console.log(`   Total Pixels: ${result.totalPixels}`);
        console.log(`   Alliances:`);
        result.alliances.forEach(a => {
            console.log(`     - ${a.name}: ${a.pixelCount} (${(a.score * 100).toFixed(1)}%)`);
        });

        // 4. Compare
        if (parseInt(rawCount[0].count) !== result.totalPixels) {
            console.log("\n⚠️  MISMATCH DETECTED!");
            console.log(`   BBox Count: ${rawCount[0].count} vs PIP Count: ${result.totalPixels}`);
            console.log("   (This is normal if some pixels are in BBox but outside Polygon)");
        } else {
            console.log("\n✅ Counts match (or close enough for BBox/PIP).");
        }

    } catch (error) {
        console.error("❌ Error:", error);
    } finally {
        await knex.destroy();
        process.exit();
    }
}

debugScores();
