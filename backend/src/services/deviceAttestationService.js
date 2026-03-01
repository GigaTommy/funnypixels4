const crypto = require('crypto');
const { db, redis } = require('../config/database');

class DeviceAttestationService {
    constructor() {
        this.CHALLENGE_TTL = 300; // 5 minutes
    }

    /**
     * 生成并存储认证 Challenge
     * @param {string} userId - 用户 ID
     * @returns {Promise<string>} Challenge 字符串
     */
    async generateChallenge(userId) {
        const challenge = crypto.randomBytes(32).toString('hex');
        const key = `attestation_challenge:${userId}`;

        // 存储 Challenge 到 Redis
        await redis.set(key, challenge, 'EX', this.CHALLENGE_TTL);

        return challenge;
    }

    /**
     * 验证 Challenge 是否有效
     * @param {string} userId 
     * @param {string} challenge 
     * @returns {Promise<boolean>}
     */
    async validateChallenge(userId, challenge) {
        const key = `attestation_challenge:${userId}`;
        const storedChallenge = await redis.get(key);

        if (!storedChallenge || storedChallenge !== challenge) {
            return false;
        }

        // 验证成功后删除 Challenge，防止重放
        await redis.del(key);
        return true;
    }

    /**
     * 验证 Attestation 并注册设备
     * @param {string} userId 
     * @param {string} keyId 
     * @param {string} attestationBase64 
     * @param {string} challenge 
     */
    async verifyAndRegisterDevice(userId, keyId, attestationBase64, challenge) {
        // 1. 验证 Challenge
        const isValidChallenge = await this.validateChallenge(userId, challenge);
        if (!isValidChallenge) {
            throw new Error('Invalid or expired challenge');
        }

        // 2. 验证 Attestation Object (Simplified for MVP)
        // TODO: Implement full Apple App Attest verification
        // 1. Decode CBOR
        // 2. Verify certificate chain (Apple Root CA)
        // 3. Verify signature
        // 4. Verify nonce (hash of challenge)
        // 5. Verify App ID hash

        if (!attestationBase64) {
            throw new Error('Missing attestation object');
        }

        // 假设验证通过，存储设备信息
        await db('user_devices').insert({
            user_id: userId,
            device_key_id: keyId,
            attestation_object: attestationBase64,
            is_verified: true,
            verified_at: new Date(),
        }).onConflict('device_key_id').merge();

        return { success: true };
    }
}

module.exports = new DeviceAttestationService();
