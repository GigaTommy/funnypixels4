
require('dotenv').config({ path: '../.env' }); // Load from parent dir
const knex = require('knex');
const { v4: uuidv4 } = require('uuid');

const dbConfig = {
    client: 'postgresql',
    connection: {
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'funnypixels_postgres',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD,
    }
};

const db = knex(dbConfig);

async function seed() {
    try {
        console.log('🔌 Connecting to database...');

        // Tiananmen Square Coordinates (Approx)
        // TL: 116.390, 39.907
        // BR: 116.405, 39.903
        const boundary = {
            type: "Polygon",
            coordinates: [[
                [116.390, 39.908], // TL
                [116.405, 39.908], // TR
                [116.405, 39.902], // BR
                [116.390, 39.902], // BL
                [116.390, 39.908]  // Close loop
            ]]
        };

        const eventId = uuidv4();
        const event = {
            id: eventId,
            title: "北京天安门测试赛",
            description: "用于验证像素统计逻辑的纯净测试区域",
            type: "flash_war",
            status: "active",
            start_time: new Date(), // Starts now
            end_time: new Date(Date.now() + 24 * 60 * 60 * 1000), // Ends in 24h
            boundary: JSON.stringify(boundary),
            config: JSON.stringify({
                areaSize: 200000,
                rules: { pixelScore: 1, maxAlliances: 3 },
                rewards: { mvp: "Gold Medal" }
            }),
            banner_url: "https://example.com/tiananmen.jpg",
            created_at: new Date(),
            updated_at: new Date()
        };

        console.log('📝 Inserting event...');
        await db('events').insert(event);

        console.log(`✅ Event created successfully!`);
        console.log(`ID: ${eventId}`);
        console.log(`Title: ${event.title}`);
        console.log(`Status: ${event.status}`);

    } catch (error) {
        console.error('❌ Error seeding event:', error);
    } finally {
        await db.destroy();
    }
}

seed();
