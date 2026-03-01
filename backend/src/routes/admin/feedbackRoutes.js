const express = require('express');
const router = express.Router();
const FeedbackController = require('../../controllers/feedbackController');
const { authenticateToken, requireAdmin } = require('../../middleware/auth');

router.use(authenticateToken, requireAdmin);

router.get('/', FeedbackController.listFeedback);
router.get('/stats', FeedbackController.getFeedbackStats);
router.get('/:id', FeedbackController.getFeedbackById);
router.post('/:id/reply', FeedbackController.replyToFeedback);
router.put('/:id/status', FeedbackController.updateFeedbackStatus);
router.delete('/:id', FeedbackController.deleteFeedback);

module.exports = router;
