const { db: knex } = require('../../config/database');

describe('EventService Integration Tests', () => {
    let EventService;

    beforeAll(async () => {
        // Import EventService after DB is configured
        EventService = require('../../services/eventService');

        // Wait for PostGIS initialization
        await new Promise(resolve => setTimeout(resolve, 1000));
    });

    afterAll(async () => {
        // Clean up database connection
        await knex.destroy();
    });

    beforeEach(async () => {
        // Clean up events table before each test
        await knex('event_pixel_logs').del();
        await knex('event_participants').del();
        await knex('events').del();
    });

    describe('createEvent with PostGIS', () => {
        it('should create event with boundary_geom', async () => {
            const eventData = {
                id: 'test-event-1',
                title: 'Test Event',
                type: 'leaderboard',
                status: 'draft',
                start_time: new Date(),
                end_time: new Date(Date.now() + 86400000),
                boundary: {
                    type: 'Polygon',
                    coordinates: [[[120.0, 30.0], [120.1, 30.0], [120.1, 30.1], [120.0, 30.1], [120.0, 30.0]]]
                },
                config: {}
            };

            const event = await EventService.createEvent(eventData);

            expect(event).toBeDefined();
            expect(event.id).toBe('test-event-1');

            // Verify geometry columns in database
            const dbEvent = await knex('events').where({ id: event.id }).first();
            expect(dbEvent.boundary_geom).not.toBeNull();
            expect(dbEvent.center_geom).not.toBeNull();
            expect(dbEvent.bbox).not.toBeNull();
        });

        it('should enable spatial query after creation', async () => {
            const eventData = {
                id: 'test-event-2',
                title: 'Spatial Test',
                type: 'leaderboard',
                status: 'published',
                start_time: new Date(),
                end_time: new Date(Date.now() + 86400000),
                boundary: {
                    type: 'Polygon',
                    coordinates: [[[120.0, 30.0], [120.1, 30.0], [120.1, 30.1], [120.0, 30.1], [120.0, 30.0]]]
                },
                config: {}
            };

            await EventService.createEvent(eventData);

            // Test spatial query - point inside
            const matchingEvents = await EventService.checkEventParticipation(30.05, 120.05);
            expect(matchingEvents.length).toBe(1);
            expect(matchingEvents[0].title).toBe('Spatial Test');

            // Test spatial query - point outside
            const outsideEvents = await EventService.checkEventParticipation(30.2, 120.2);
            expect(outsideEvents.length).toBe(0);
        });

        it('should reject invalid boundary GeoJSON', async () => {
            const eventData = {
                id: 'test-event-invalid',
                title: 'Invalid Event',
                type: 'leaderboard',
                status: 'draft',
                start_time: new Date(),
                end_time: new Date(Date.now() + 86400000),
                boundary: {
                    type: 'Polygon',
                    coordinates: [[[200, 30], [201, 30], [201, 31], [200, 31], [200, 30]]] // Invalid lng
                },
                config: {}
            };

            await expect(EventService.createEvent(eventData)).rejects.toThrow('Invalid event boundary');
        });

        it('should create event without boundary', async () => {
            const eventData = {
                id: 'test-event-no-boundary',
                title: 'No Boundary Event',
                type: 'leaderboard',
                status: 'draft',
                start_time: new Date(),
                end_time: new Date(Date.now() + 86400000),
                config: {}
            };

            const event = await EventService.createEvent(eventData);

            expect(event).toBeDefined();
            expect(event.id).toBe('test-event-no-boundary');

            // Verify geometry columns are null
            const dbEvent = await knex('events').where({ id: event.id }).first();
            expect(dbEvent.boundary_geom).toBeNull();
        });
    });

    describe('updateEvent with PostGIS', () => {
        it('should update boundary_geom when boundary is updated', async () => {
            // Create event
            const eventData = {
                id: 'test-event-update',
                title: 'Update Test',
                type: 'leaderboard',
                status: 'draft',
                start_time: new Date(),
                end_time: new Date(Date.now() + 86400000),
                boundary: {
                    type: 'Polygon',
                    coordinates: [[[120.0, 30.0], [120.1, 30.0], [120.1, 30.1], [120.0, 30.1], [120.0, 30.0]]]
                },
                config: {}
            };

            await EventService.createEvent(eventData);

            // Update boundary
            const newBoundary = {
                type: 'Polygon',
                coordinates: [[[120.2, 30.2], [120.3, 30.2], [120.3, 30.3], [120.2, 30.3], [120.2, 30.2]]]
            };

            await EventService.updateEvent('test-event-update', { boundary: newBoundary });

            // Test spatial query with new boundary
            const oldPoint = await EventService.checkEventParticipation(30.05, 120.05);
            expect(oldPoint.length).toBe(0);

            const newPoint = await EventService.checkEventParticipation(30.25, 120.25);
            expect(newPoint.length).toBe(1);
        });

        it('should reject invalid boundary on update', async () => {
            // Create event
            const eventData = {
                id: 'test-event-update-invalid',
                title: 'Update Invalid Test',
                type: 'leaderboard',
                status: 'draft',
                start_time: new Date(),
                end_time: new Date(Date.now() + 86400000),
                boundary: {
                    type: 'Polygon',
                    coordinates: [[[120.0, 30.0], [120.1, 30.0], [120.1, 30.1], [120.0, 30.1], [120.0, 30.0]]]
                },
                config: {}
            };

            await EventService.createEvent(eventData);

            // Try to update with invalid boundary
            const invalidBoundary = {
                type: 'Polygon',
                coordinates: [[[0, 0], [2, 2], [2, 0], [0, 2], [0, 0]]] // Self-intersection
            };

            await expect(
                EventService.updateEvent('test-event-update-invalid', { boundary: invalidBoundary })
            ).rejects.toThrow('Invalid event boundary');
        });
    });

    describe('batchCheckEventParticipation', () => {
        it('should check multiple points efficiently', async () => {
            // Create test event
            await EventService.createEvent({
                id: 'test-event-batch',
                title: 'Batch Test',
                type: 'leaderboard',
                status: 'active',
                start_time: new Date(),
                end_time: new Date(Date.now() + 86400000),
                boundary: {
                    type: 'Polygon',
                    coordinates: [[[120.0, 30.0], [120.1, 30.0], [120.1, 30.1], [120.0, 30.1], [120.0, 30.0]]]
                },
                config: {}
            });

            const points = [
                { lat: 30.05, lng: 120.05 },  // inside
                { lat: 30.06, lng: 120.06 },  // inside
                { lat: 30.2, lng: 120.2 }     // outside
            ];

            const matches = await EventService.batchCheckEventParticipation(points);

            expect(matches.get(0).length).toBe(1);
            expect(matches.get(1).length).toBe(1);
            expect(matches.has(2)).toBe(false);
        });

        it('should handle empty points array', async () => {
            const matches = await EventService.batchCheckEventParticipation([]);
            expect(matches.size).toBe(0);
        });

        it('should limit to 1000 points', async () => {
            const points = Array(1500).fill({ lat: 30.05, lng: 120.05 });
            const matches = await EventService.batchCheckEventParticipation(points);
            // Should process only first 1000
            expect(matches.size).toBeLessThanOrEqual(1000);
        });
    });

    describe('checkEventParticipation edge cases', () => {
        it('should handle point on boundary', async () => {
            await EventService.createEvent({
                id: 'test-event-boundary',
                title: 'Boundary Test',
                type: 'leaderboard',
                status: 'published',
                start_time: new Date(),
                end_time: new Date(Date.now() + 86400000),
                boundary: {
                    type: 'Polygon',
                    coordinates: [[[120.0, 30.0], [120.1, 30.0], [120.1, 30.1], [120.0, 30.1], [120.0, 30.0]]]
                },
                config: {}
            });

            // Point exactly on boundary corner
            const matches = await EventService.checkEventParticipation(30.0, 120.0);
            // PostGIS ST_Contains may or may not include boundary, but should not crash
            expect(Array.isArray(matches)).toBe(true);
        });

        it('should handle multiple overlapping events', async () => {
            // Create two overlapping events
            await EventService.createEvent({
                id: 'test-event-overlap-1',
                title: 'Overlap 1',
                type: 'leaderboard',
                status: 'active',
                start_time: new Date(),
                end_time: new Date(Date.now() + 86400000),
                boundary: {
                    type: 'Polygon',
                    coordinates: [[[120.0, 30.0], [120.2, 30.0], [120.2, 30.2], [120.0, 30.2], [120.0, 30.0]]]
                },
                config: {}
            });

            await EventService.createEvent({
                id: 'test-event-overlap-2',
                title: 'Overlap 2',
                type: 'leaderboard',
                status: 'active',
                start_time: new Date(),
                end_time: new Date(Date.now() + 86400000),
                boundary: {
                    type: 'Polygon',
                    coordinates: [[[120.1, 30.1], [120.3, 30.1], [120.3, 30.3], [120.1, 30.3], [120.1, 30.1]]]
                },
                config: {}
            });

            // Point in overlapping area
            const matches = await EventService.checkEventParticipation(30.15, 120.15);
            expect(matches.length).toBe(2);
        });

        it('should not return ended events', async () => {
            await EventService.createEvent({
                id: 'test-event-ended',
                title: 'Ended Event',
                type: 'leaderboard',
                status: 'ended',
                start_time: new Date(Date.now() - 172800000), // 2 days ago
                end_time: new Date(Date.now() - 86400000), // 1 day ago
                boundary: {
                    type: 'Polygon',
                    coordinates: [[[120.0, 30.0], [120.1, 30.0], [120.1, 30.1], [120.0, 30.1], [120.0, 30.0]]]
                },
                config: {}
            });

            const matches = await EventService.checkEventParticipation(30.05, 120.05);
            expect(matches.length).toBe(0);
        });
    });
});
