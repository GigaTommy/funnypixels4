const express = require('express');
const router = express.Router();
const EventController = require('../controllers/eventController');
const { authenticateToken } = require('../middleware/auth');

// GET /api/events/active - Get currently active events
router.get('/active', authenticateToken, EventController.getActiveEvents);

// GET /api/events/my-events - Get events user has participated in
router.get('/my-events', authenticateToken, EventController.getMyEvents);

// GET /api/events/ended - Get ended events user participated in
router.get('/ended', authenticateToken, EventController.getEndedEvents);

// GET /api/events/:id - Get single event detail
router.get('/:id', authenticateToken, EventController.getEventDetail);

// GET /api/events/:id/rankings - Get real-time rankings
router.get('/:id/rankings', authenticateToken, EventController.getEventRankings);

// GET /api/events/:id/result - Get event final result
router.get('/:id/result', authenticateToken, EventController.getEventResult);

// POST /api/events/:id/signup - Signup for event
router.post('/:id/signup', authenticateToken, EventController.signup);

// GET /api/events/:id/my-status - Get user's status in event
router.get('/:id/my-status', authenticateToken, EventController.getMyStatus);

// P0-1: GET /api/events/:id/signup-stats - Get event signup statistics
router.get('/:id/signup-stats', authenticateToken, EventController.getEventSignupStats);

// P0-3: GET /api/events/:id/my-contribution - Get user contribution in event
router.get('/:id/my-contribution', authenticateToken, EventController.getMyContribution);

// P1-4: GET /api/events/:id/ranking-history - Get ranking history/trend
router.get('/:id/ranking-history', authenticateToken, EventController.getRankingHistory);

// P2-1: POST /api/events/:id/generate-invite - Generate invite link
router.post('/:id/generate-invite', authenticateToken, EventController.generateInviteLink);

// P2-1: POST /api/events/:id/record-share - Record share action
router.post('/:id/record-share', authenticateToken, EventController.recordShare);

// P2-5: GET /api/events/:id/check-requirements - Check if user meets requirements
router.get('/:id/check-requirements', authenticateToken, EventController.checkRequirements);

module.exports = router;
