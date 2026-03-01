const express = require('express');
const router = express.Router();
const PushNotificationController = require('../controllers/pushNotificationController');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Register a device token for push notifications
router.post('/register', PushNotificationController.registerToken);

// Unregister (deactivate) a device token
router.delete('/unregister', PushNotificationController.removeToken);

module.exports = router;
