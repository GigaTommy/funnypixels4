// 直接测试通知 API（绕过 HTTP，直接调用 Controller）
const NotificationController = require('./src/controllers/notificationController');

async function testNotificationAPI() {
    try {
        console.log('🧪 测试通知 API（直接调用）\n');

        // 模拟 request 对象
        const testUserId = 'fe89a000-5f45-4118-aa99-46e6985bc519'; // testuser ID

        // 1. 获取通知列表
        console.log('1️⃣ 测试获取通知列表...');
        const mockReq1 = {
            user: { id: testUserId },
            query: { page: 1, limit: 20 }
        };
        const mockRes1 = {
            json: (data) => {
                console.log('✅ 通知列表:', JSON.stringify(data, null, 2));
            },
            status: function(code) {
                this.statusCode = code;
                return this;
            }
        };
        await NotificationController.getUserNotifications(mockReq1, mockRes1);
        console.log('');

        // 2. 获取未读数量
        console.log('2️⃣ 测试获取未读数量...');
        const mockReq2 = {
            user: { id: testUserId },
            query: {}
        };
        const mockRes2 = {
            json: (data) => {
                console.log('✅ 未读数量:', JSON.stringify(data, null, 2));
            },
            status: function(code) {
                this.statusCode = code;
                return this;
            }
        };
        await NotificationController.getUnreadCount(mockReq2, mockRes2);
        console.log('');

        // 3. 标记已读
        console.log('3️⃣ 测试标记已读...');
        const mockReq3 = {
            user: { id: testUserId },
            params: { notificationId: '1' }
        };
        const mockRes3 = {
            json: (data) => {
                console.log('✅ 标记已读:', JSON.stringify(data, null, 2));
            },
            status: function(code) {
                this.statusCode = code;
                return this;
            }
        };
        await NotificationController.markAsRead(mockReq3, mockRes3);
        console.log('');

        // 4. 再次检查未读数量
        console.log('4️⃣ 再次检查未读数量...');
        await NotificationController.getUnreadCount(mockReq2, mockRes2);
        console.log('');

        console.log('✅ 所有 API 测试完成！');
        process.exit(0);

    } catch (error) {
        console.error('❌ 测试失败:', error);
        process.exit(1);
    }
}

testNotificationAPI();
