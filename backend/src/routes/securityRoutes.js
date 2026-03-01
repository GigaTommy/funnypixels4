const express = require('express');
const router = express.Router();
const deviceAttestationService = require('../services/deviceAttestationService');
const { authenticateToken } = require('../middleware/auth'); // Assuming auth middleware exists

// 生成认证 Challenge
router.get('/challenge', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const challenge = await deviceAttestationService.generateChallenge(userId);
        res.json({ challenge });
    } catch (error) {
        console.error('Error generating challenge:', error);
        res.status(500).json({ error: 'Failed to generate challenge' });
    }
});

// 验证设备 Attestation
router.post('/attest', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { keyId, attestation, challenge } = req.body;

        if (!keyId || !attestation || !challenge) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        await deviceAttestationService.verifyAndRegisterDevice(
            userId,
            keyId,
            attestation,
            challenge
        );

        res.json({ success: true, message: 'Device verified successfully' });
    } catch (error) {
        console.error('Error verifying device:', error);
        res.status(400).json({ error: error.message || 'Verification failed' });
    }
});

module.exports = router;
