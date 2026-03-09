/**
 * APNs 推送通知测试脚本
 *
 * 使用方法：
 * node test-push.js <device_token>
 *
 * 示例：
 * node test-push.js a1b2c3d4e5f6...
 */

require('dotenv').config();
const notificationService = require('./src/services/notificationService');

const deviceToken = process.argv[2];

if (!deviceToken) {
  console.error('❌ Error: Please provide a device token');
  console.log('\nUsage: node test-push.js <device_token>');
  console.log('Example: node test-push.js a1b2c3d4e5f6789...\n');
  process.exit(1);
}

console.log('📱 Sending test push notification...');
console.log('Device Token:', deviceToken.substring(0, 16) + '...');
console.log('APNs Connected:', notificationService.isConnected);
console.log('Environment:', process.env.APN_PRODUCTION === 'true' ? 'Production' : 'Development');
console.log('Bundle ID:', process.env.APN_BUNDLE_ID);
console.log('---');

notificationService.sendPushNotification(
  deviceToken,
  'Test Notification',
  'APNs configuration is working! 🎉',
  { type: 'test', timestamp: new Date().toISOString() }
)
  .then(result => {
    console.log('\n✅ Push notification sent successfully!');
    console.log('Result:', JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Failed to send push notification:', error);
    process.exit(1);
  });
