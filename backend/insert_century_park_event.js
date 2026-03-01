const { db: knex } = require('./src/config/database');
const { v4: uuidv4 } = require('uuid');

async function seed() {
    try {
        console.log('Seeding Century Park Flash War Event...');

        const eventId = "33333333-3333-3333-3333-333333333333"; // Valid UUID for testing

        // 1. Check if exists
        const existing = await knex('events').where('id', eventId).first();
        if (existing) {
            console.log('Event already exists. Deleting to re-seed...');
            await knex('events').where('id', eventId).del();
        }

        // 2. Prepare Data
        // IMPORTANT: In a real app, strict GeoJSON Polygon validation is needed.
        // Here we trust the input as per case study.
        const boundary = {
            "type": "Polygon",
            "coordinates": [[
                [121.4801, 31.2142],
                [121.4828, 31.2142],
                [121.4828, 31.2165],
                [121.4801, 31.2165],
                [121.4801, 31.2142]
            ]]
        };

        const config = {
            "areaSize": 8500,
            "rules": {
                "pixelScore": 1,
                "overrideRule": "last_write_wins",
                "countStrategy": "net_pixel",
                "maxAlliances": 6,
                "minParticipants": 10,
                "joinRule": "auto_on_draw"
            },
            "rewards": {
                "allianceRewards": {
                    "1": { "points": 1000, "chest": "gold" },
                    "2": { "points": 500, "chest": "silver" },
                    "3": { "points": 300, "chest": "bronze" }
                },
                "mvpRewards": {
                    "topN": 3,
                    "reward": { "points": 300, "title": "闪击先锋" }
                }
            }
        };

        // NOTE: Start time set to NOW-1h and End time to NOW+24h to ensure it's ACTIVE for testing
        const now = new Date();
        const startTime = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
        const endTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

        await knex('events').insert({
            id: eventId,
            title: "城市闪击战 · 世纪公园争夺战",
            description: "24h 后：世纪公园将爆发联盟闪击战。进入区域并绘制即可参战！",
            type: "flash_war",
            start_time: startTime,
            end_time: endTime,
            status: "active",
            config: JSON.stringify(config),
            boundary: JSON.stringify(boundary), // knex handles json automatically usually, but let's stringify to be safe if column type varies
            banner_url: "https://funnypixels.com/assets/events/century_park_war.jpg"
        });

        console.log('✅ Event inserted successfully!');

        // 3. Verify
        const inserted = await knex('events').where('id', eventId).first();
        console.log('Verified inserted event:', inserted.title);

    } catch (err) {
        console.error('Seeding failed:', err);
    } finally {
        await knex.destroy();
    }
}

seed();
