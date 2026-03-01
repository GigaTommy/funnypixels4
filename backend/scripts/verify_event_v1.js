require('dotenv').config();
const knex = require('knex')(require('../knexfile').development);
const eventService = require('../src/services/eventService');
const { v4: uuidv4 } = require('uuid');

async function main() {
    console.log('🚀 Starting Event System V1 Verification...');

    const testEventId = uuidv4();
    const testUserId = uuidv4();
    const testPixelId = '15/12345/67890'; // gridId

    try {
        // 1. Create Test User
        console.log('👤 Creating test user...');
        await knex('users').insert({
            id: testUserId,
            username: 'test_event_user',
            email: 'test_event@example.com',
            password_hash: 'hash',
            role: 'user'
        }).onConflict('id').ignore();

        // 2. Create Test Event
        console.log('📅 Creating test event...');
        const now = new Date();
        const endTime = new Date(now.getTime() + 3600000); // 1 hour later

        // Ensure eventService instance is available

        await knex('events').insert({
            id: testEventId,
            title: 'Test Event V1',
            type: 'territory_control',
            status: 'active',
            start_time: now,
            end_time: endTime,
            signup_end_time: endTime,
            boundary: JSON.stringify({
                type: 'Polygon',
                coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]]
            }),
            config: JSON.stringify({})
        });

        // 3. Test Signup
        console.log('📝 Testing Signup...');
        await eventService.signupEvent(testEventId, { type: 'user', id: testUserId });

        const participant = await knex('event_participants')
            .where({ event_id: testEventId, participant_id: testUserId, participant_type: 'user' })
            .first();

        if (participant) {
            console.log('✅ Signup successful!');
        } else {
            throw new Error('Signup failed: Participant record not found');
        }

        // 4. Test Get Status
        console.log('🔍 Testing Get Status...');
        const status = await eventService.getUserEventStatus(testEventId, testUserId);
        if (status.signedUp) {
            console.log('✅ Get Status successful!');
        } else {
            throw new Error('Get Status failed: signedUp is false');
        }

        // 5. Test Pixel Logging
        console.log('🎨 Testing Pixel Logging...');
        const pixelData = {
            pixelId: testPixelId,
            userId: testUserId,
            x: 12345,
            y: 67890
        };
        await eventService.recordPixelLog(testEventId, pixelData);

        const log = await knex('event_pixel_logs')
            .where({ event_id: testEventId, pixel_id: testPixelId })
            .first();

        if (log) {
            console.log('✅ Pixel Logging successful!');
        } else {
            throw new Error('Pixel Logging failed: Log record not found');
        }

        console.log('🎉 Verification PASSED!');

    } catch (error) {
        console.error('❌ Verification FAILED:', error);
    } finally {
        // Cleanup
        console.log('🧹 Cleaning up...');
        await knex('event_pixel_logs').where('event_id', testEventId).del();
        await knex('event_participants').where('event_id', testEventId).del();
        await knex('events').where('id', testEventId).del();
        await knex('users').where('id', testUserId).del();

        await knex.destroy();
    }
}

main();
