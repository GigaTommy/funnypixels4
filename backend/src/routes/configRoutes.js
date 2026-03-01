const express = require('express');
const router = express.Router();

/**
 * @route GET /api/config/client
 * @desc Get public client configuration
 * @access Public
 */
router.get('/client', (req, res) => {
    res.json({
        success: true,
        data: {
            shareDownloadUrl: process.env.SHARE_APP_DOWNLOAD_URL || 'https://funnypixels.app',
            // Add other dynamic public configs here
            supportEmail: 'support@funnypixels.app',
            version: '1.0.0'
        }
    });
});

module.exports = router;
