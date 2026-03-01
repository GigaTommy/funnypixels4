require('dotenv').config();
const knex = require('knex')(require('../knexfile').development);
const eventService = require('../src/services/eventService');
const { v4: uuidv4 } = require('uuid');

async function main() {
    console.log('🚀 Starting Event Scoring Verification...');

    const testEventId = uuidv4();
    let testAllianceAId, testAllianceBId, testUserAId, testUserBId;

    try {
        // 1. Setup Data
        console.log('🛠️ Setting up test data...');

        // Create Mock Users
        const [userA] = await knex('users').insert({ username: 'user_a_' + uuidv4().slice(0, 5), email: `a_${uuidv4().slice(0, 5)}@test.com`, password_hash: 'hash' }).returning('id');
        testUserAId = userA.id;

        const [userB] = await knex('users').insert({ username: 'user_b_' + uuidv4().slice(0, 5), email: `b_${uuidv4().slice(0, 5)}@test.com`, password_hash: 'hash' }).returning('id');
        testUserBId = userB.id;

        // Create Mock Alliances
        const [allianceA] = await knex('alliances').insert({ name: 'Team A ' + uuidv4().slice(0, 5), color: '#FF0000', leader_id: testUserAId }).returning('id');
        testAllianceAId = allianceA.id;

        const [allianceB] = await knex('alliances').insert({ name: 'Team B ' + uuidv4().slice(0, 5), color: '#0000FF', leader_id: testUserBId }).returning('id');
        testAllianceBId = allianceB.id;

        // Create Test Event
        await knex('events').insert({
            id: testEventId,
            title: 'Scoring Test Event',
            type: 'war',
            status: 'active',
            start_time: new Date(),
            end_time: new Date(Date.now() + 3600000),
            boundary: JSON.stringify({ type: 'Polygon', coordinates: [[[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]]] })
        });

        // 2. Simulate Pixel Logs (Scenario: Overwrite)
        console.log('📝 Simulating pixel logs...');

        // Grid 1: User A paints
        await knex('event_pixel_logs').insert({
            event_id: testEventId,
            pixel_id: 'grid_1',
            user_id: testUserAId,
            alliance_id: testAllianceAId,
            created_at: new Date(Date.now() - 3000)
        });

        // Grid 1: User B paints (Overwrites A for scoring)
        await knex('event_pixel_logs').insert({
            event_id: testEventId,
            pixel_id: 'grid_1',
            user_id: testUserBId,
            alliance_id: testAllianceBId,
            created_at: new Date(Date.now() - 2000)
        });

        // Grid 2: User A paints
        await knex('event_pixel_logs').insert({
            event_id: testEventId,
            pixel_id: 'grid_2',
            user_id: testUserAId,
            alliance_id: testAllianceAId,
            created_at: new Date(Date.now() - 1000)
        });

        // 3. Verify Scores
        console.log('🔍 Calculating scores...');
        const result = await eventService.processEventScores(testEventId);

        console.log('📊 Scoring Result:', JSON.stringify(result, null, 2));

        // 4. Assertions
        const teamB = result.alliances.find(a => String(a.id) === String(testAllianceBId));
        const teamA = result.alliances.find(a => String(a.id) === String(testAllianceAId));

        if (teamB && teamB.pixelCount === 1 && teamA && teamA.pixelCount === 1 && result.totalPixels === 2) {
            console.log('✅ Scoring Verification PASSED!');
        } else {
            console.error('❌ Scoring Verification FAILED!');
            console.log('Test IDs:', { testAllianceAId, testAllianceBId });
            console.log('Result Alliances:', result.alliances);
            console.error(`Expected: Team A: 1, Team B: 1, Total: 2`);
            console.error(`Actual: Team A: ${teamA?.pixelCount}, Team B: ${teamB?.pixelCount}, Total: ${result.totalPixels}`);
            process.exit(1);
        }

    } catch (err) {
        console.error('❌ Verification Error:', err);
    } finally {
        console.log('🧹 Cleaning up...');
        if (testEventId) await knex('event_pixel_logs').where({ event_id: testEventId }).del();
        if (testEventId) await knex('events').where({ id: testEventId }).del();
        if (testAllianceAId && testAllianceBId) await knex('alliances').whereIn('id', [testAllianceAId, testAllianceBId]).del();
        if (testUserAId && testUserBId) await knex('users').whereIn('id', [testUserAId, testUserBId]).del();
        process.exit(0);
    }
}

main();
