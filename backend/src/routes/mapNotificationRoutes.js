const express = require('express');
const router = express.Router();
const MapNotificationController = require('../controllers/mapNotificationController');
const { authenticateToken } = require('../middleware/auth');

/**
 * Map Notification Routes
 *
 * Endpoints for map activity/event notifications
 */

// Get active notifications (public or authenticated)
router.get('/',
  (req, res, next) => {
    // Optional authentication - works for both guest and logged-in users
    authenticateToken(req, res, (err) => {
      // Continue even if auth fails (for guest users)
      next();
    });
  },
  MapNotificationController.getNotifications
);

// Dismiss a notification (authenticated)
router.post('/:id/dismiss',
  authenticateToken,
  MapNotificationController.dismissNotification
);

// Create notification (admin only - TODO: add admin middleware)
router.post('/',
  authenticateToken,
  MapNotificationController.createNotification
);

module.exports = router;
