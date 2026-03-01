const express = require('express');
const router = express.Router();
const SystemMessageController = require('../controllers/systemMessageController');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Get aggregate unread count (system messages + notifications)
router.get('/unread-count', SystemMessageController.getUnreadCount);

// Get user system messages
router.get('/', SystemMessageController.getUserMessages);

// Mark message as read
router.put('/:messageId/read', SystemMessageController.markAsRead);

// Batch operations
router.put('/batch/read', SystemMessageController.batchMarkAsRead);
router.delete('/batch', SystemMessageController.batchDeleteMessages);

module.exports = router;
