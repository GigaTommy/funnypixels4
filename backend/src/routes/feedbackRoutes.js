const express = require('express');
const router = express.Router();
const FeedbackController = require('../controllers/feedbackController');
const { authenticateToken } = require('../middleware/auth');

// User-facing feedback routes
router.post('/', authenticateToken, FeedbackController.submitFeedback);
router.get('/my', authenticateToken, FeedbackController.getUserFeedback);

module.exports = router;
