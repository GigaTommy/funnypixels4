const pushNotificationService = require('../services/pushNotificationService');

class PushNotificationController {
  /**
   * POST /register
   * Register a device token for the authenticated user.
   * Body: { deviceToken: string, platform?: 'ios' | 'android' }
   */
  static async registerToken(req, res) {
    try {
      const userId = req.user.id;
      const { deviceToken, platform } = req.body;

      if (!deviceToken) {
        return res.status(400).json({
          success: false,
          message: 'deviceToken is required'
        });
      }

      await pushNotificationService.registerDeviceToken(userId, deviceToken, platform || 'ios');

      res.json({
        success: true,
        message: 'Device token registered successfully'
      });
    } catch (error) {
      console.error('Failed to register device token:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to register device token'
      });
    }
  }

  /**
   * DELETE /unregister
   * Deactivate a device token (e.g. on logout).
   * Body: { deviceToken: string }
   */
  static async removeToken(req, res) {
    try {
      const { deviceToken } = req.body;

      if (!deviceToken) {
        return res.status(400).json({
          success: false,
          message: 'deviceToken is required'
        });
      }

      await pushNotificationService.removeDeviceToken(deviceToken);

      res.json({
        success: true,
        message: 'Device token unregistered successfully'
      });
    } catch (error) {
      console.error('Failed to remove device token:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to remove device token'
      });
    }
  }
}

module.exports = PushNotificationController;
