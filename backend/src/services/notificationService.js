const apn = require('apn');
const path = require('path');

class NotificationService {
    constructor() {
        this.provider = null;
        this.isConnected = false;
        this.initialize();
    }

    initialize() {
        try {
            // Check if APN credentials exist in env
            if (process.env.APN_KEY_ID && process.env.APN_TEAM_ID) {
                const options = {
                    token: {
                        key: process.env.APN_KEY_PATH || path.join(__dirname, '../../certs/AuthKey.p8'),
                        keyId: process.env.APN_KEY_ID,
                        teamId: process.env.APN_TEAM_ID
                    },
                    production: process.env.NODE_ENV === 'production'
                };

                this.provider = new apn.Provider(options);
                this.isConnected = true;
                console.log('✅ APN Provider initialized');
            } else {
                console.log('⚠️ APN credentials missing. NotificationService running in mock mode.');
            }
        } catch (error) {
            console.error('❌ Failed to initialize APN Provider:', error);
        }
    }

    /**
     * Send a push notification to a device
     * @param {string} deviceToken - The user's device token
     * @param {string} title - Notification title
     * @param {string} body - Notification body
     * @param {Object} data - Custom payload data
     */
    async sendPushNotification(deviceToken, title, body, data = {}) {
        if (!this.isConnected || !this.provider) {
            console.log(`[Mock Notification] To: ${deviceToken} | Title: ${title} | Body: ${body}`);
            return Promise.resolve({ success: true, mock: true });
        }

        const note = new apn.Notification();
        note.expiry = Math.floor(Date.now() / 1000) + 3600; // Expires 1 hour from now
        note.badge = 1;
        note.sound = "ping.aiff";
        note.alert = {
            title: title,
            body: body
        };
        note.payload = data;
        note.topic = process.env.APN_BUNDLE_ID || "com.funnypixels.app";

        try {
            const result = await this.provider.send(note, deviceToken);

            if (result.failed.length > 0) {
                console.error('❌ Notification failed for some devices:', result.failed);
                return { success: false, errors: result.failed };
            }

            return { success: true, sent: result.sent };
        } catch (error) {
            console.error('❌ Error sending notification:', error);
            return { success: false, error: error.message };
        }
    }

    shutdown() {
        if (this.provider) {
            this.provider.shutdown();
        }
    }
}

// Export a singleton instance
module.exports = new NotificationService();
