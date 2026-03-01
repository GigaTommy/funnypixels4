
const express = require('express');
const router = express.Router();
const eventService = require('../../services/eventService');
const { authenticateToken, requireAdmin } = require('../../middleware/auth');

// All routes require admin authentication
router.use(authenticateToken, requireAdmin);

// Get event statistics for dashboard
router.get('/stats', async (req, res) => {
    try {
        const stats = await eventService.getEventStats();
        res.json({ success: true, data: stats });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// List events
router.get('/', async (req, res) => {
    try {
        const { current, pageSize, page, limit, status } = req.query;
        const result = await eventService.listEvents({
            current: parseInt(current || page) || 1,
            pageSize: parseInt(pageSize || limit) || 10,
            status
        });
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Create event
router.post('/', async (req, res) => {
    try {
        const event = await eventService.createEvent(req.body);
        res.json({ success: true, data: event });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get event
router.get('/:id', async (req, res) => {
    try {
        const event = await eventService.getEvent(req.params.id);
        if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
        res.json({ success: true, data: event });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Update event
router.put('/:id', async (req, res) => {
    try {
        const event = await eventService.updateEvent(req.params.id, req.body);
        res.json({ success: true, data: event });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Delete event
router.delete('/:id', async (req, res) => {
    try {
        await eventService.deleteEvent(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get event participants
router.get('/:id/participants', async (req, res) => {
    try {
        const { page, pageSize, type } = req.query;
        const result = await eventService.getParticipants(req.params.id, {
            page: parseInt(page) || 1,
            pageSize: parseInt(pageSize) || 20,
            type
        });
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get event rankings
router.get('/:id/rankings', async (req, res) => {
    try {
        const rankings = await eventService.getRankings(req.params.id);
        res.json({ success: true, data: rankings });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get event result (final rankings and settlement status)
router.get('/:id/result', async (req, res) => {
    try {
        const result = await eventService.getEventResult(req.params.id);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Manually trigger settlement
router.post('/:id/settle', async (req, res) => {
    try {
        const result = await eventService.manualSettle(req.params.id);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

module.exports = router;
