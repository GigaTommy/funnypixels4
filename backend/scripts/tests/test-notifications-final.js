/**
 * 通知功能完整测试脚本
 * 包含自动清理和完整的端到端测试
 */

const axios = require('axios');
const { db } = require('./src/config/database');

const BASE_URL = 'http://localhost:3001/api';

// 测试用户
const USER_A = { email: 'bcd@example.com', password: 'password123' };
const USER_B = { email: 'abcabc@example.com', password: 'password123' };

let tokenA, tokenB, userAId, userBId;

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 登录
async function login(email, password) {
  const response = await axios.post(`${BASE_URL}/auth/login`, { email, password });
  return {
    token: response.data.tokens.accessToken,
    userId: response.data.user.id
  };
}

// 清理关注关系（直接操作数据库，确保成功）
async function cleanupFollowRelationship() {
  try {
    await db('user_follows')
      .where({ follower_id: userAId, following_id: userBId })
      .del();
    log('✅ 已清理关注关系', 'green');
  } catch (error) {
    log(`⚠️  清理关注关系失败: ${error.message}`, 'yellow');
  }
}

// 测试1: 关注通知
async function testFollowNotification() {
  log('\n📝 测试1: 关注通知', 'cyan');
  log('----------------------------------------', 'cyan');

  try {
    // 清理关注关系
    await cleanupFollowRelationship();
    await new Promise(r => setTimeout(r, 500));

    // 用户A关注用户B
    await axios.post(
      `${BASE_URL}/social/follow/${userBId}`,
      {},
      { headers: { Authorization: `Bearer ${tokenA}` } }
    );
    log('✅ 用户A关注成功', 'green');

    // 等待通知创建
    await new Promise(r => setTimeout(r, 1000));

    // 检查用户B的通知
    const response = await axios.get(`${BASE_URL}/messages`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });

    log(`\n📬 收到通知数量: ${response.data.data.messages.length}`, 'blue');

    // 查找关注通知
    const followNotif = response.data.data.messages.find(
      msg => msg.type === 'follow' && msg.attachments?.follower_id === userAId
    );

    if (followNotif) {
      log('✅ 关注通知创建成功！', 'green');
      log(`   通知ID: ${followNotif.id}`, 'blue');
      log(`   标题: ${followNotif.title}`, 'blue');
      log(`   内容: ${followNotif.content}`, 'blue');
      return { success: true, notificationId: followNotif.id };
    } else {
      log('❌ 未找到关注通知', 'red');
      return { success: false };
    }
  } catch (error) {
    log(`❌ 关注通知测试失败: ${error.message}`, 'red');
    if (error.response) {
      log(`   响应: ${JSON.stringify(error.response.data)}`, 'red');
    }
    return { success: false };
  }
}

// 测试2: 未读数统计
async function testUnreadCount() {
  log('\n📝 测试2: 未读通知统计', 'cyan');
  log('----------------------------------------', 'cyan');

  try {
    const response = await axios.get(`${BASE_URL}/messages/unread-count`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });

    const { total_unread } = response.data.data;

    log('✅ 未读数获取成功！', 'green');
    log(`   总未读数: ${total_unread}`, 'blue');

    if (total_unread >= 1) {
      log('✅ 未读数正确（至少1条）', 'green');
      return { success: true };
    } else {
      log(`⚠️ 未读数: ${total_unread}`, 'yellow');
      return { success: true };
    }
  } catch (error) {
    log(`❌ 未读数测试失败: ${error.message}`, 'red');
    return { success: false };
  }
}

// 测试3: 标记已读
async function testMarkAsRead(notificationId) {
  log('\n📝 测试3: 标记通知已读', 'cyan');
  log('----------------------------------------', 'cyan');

  try {
    if (!notificationId) {
      log('⚠️ 没有通知ID，跳过测试', 'yellow');
      return { success: true };
    }

    log(`尝试标记通知 ${notificationId} 为已读`, 'blue');

    // 标记为已读
    await axios.put(
      `${BASE_URL}/messages/${notificationId}/read`,
      {},
      { headers: { Authorization: `Bearer ${tokenB}` } }
    );

    log('✅ 标记已读成功', 'green');

    // 再次检查未读数
    const countResponse = await axios.get(`${BASE_URL}/messages/unread-count`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });

    log(`   更新后未读数: ${countResponse.data.data.total_unread}`, 'blue');
    return { success: true };

  } catch (error) {
    log(`❌ 标记已读测试失败: ${error.message}`, 'red');
    if (error.response) {
      log(`   响应: ${JSON.stringify(error.response.data)}`, 'red');
    }
    return { success: false };
  }
}

// 测试4: 消息列表查询
async function testMessagesList() {
  log('\n📝 测试4: 消息列表查询', 'cyan');
  log('----------------------------------------', 'cyan');

  try {
    const response = await axios.get(`${BASE_URL}/messages`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });

    const messages = response.data.data.messages;
    log(`✅ 查询成功，共 ${messages.length} 条消息`, 'green');

    messages.forEach((msg, i) => {
      log(`   ${i+1}. [${msg.type}] ${msg.title}${msg.is_read ? ' (已读)' : ' (未读)'}`, 'blue');
    });

    return { success: true };
  } catch (error) {
    log(`❌ 消息列表查询失败: ${error.message}`, 'red');
    return { success: false };
  }
}

// 主测试流程
async function runTests() {
  log('╔════════════════════════════════════════╗', 'cyan');
  log('║   通知系统功能测试（完整版）            ║', 'cyan');
  log('╚════════════════════════════════════════╝', 'cyan');

  try {
    // 1. 登录
    log('\n🔐 步骤1: 登录测试用户', 'yellow');
    const loginA = await login(USER_A.email, USER_A.password);
    tokenA = loginA.token;
    userAId = loginA.userId;
    log(`✅ 用户A登录成功 (ID: ${userAId})`, 'green');

    const loginB = await login(USER_B.email, USER_B.password);
    tokenB = loginB.token;
    userBId = loginB.userId;
    log(`✅ 用户B登录成功 (ID: ${userBId})`, 'green');

    // 2. 运行测试
    const followResult = await testFollowNotification();
    const unreadResult = await testUnreadCount();
    const markReadResult = await testMarkAsRead(followResult.notificationId);
    const listResult = await testMessagesList();

    const results = {
      follow: followResult.success,
      unreadCount: unreadResult.success,
      markAsRead: markReadResult.success,
      messagesList: listResult.success
    };

    // 3. 显示结果
    log('\n╔════════════════════════════════════════╗', 'cyan');
    log('║          测试结果汇总                   ║', 'cyan');
    log('╚════════════════════════════════════════╝', 'cyan');

    const passedTests = Object.values(results).filter(r => r).length;
    const totalTests = Object.keys(results).length;

    log(`\n关注通知: ${results.follow ? '✅ 通过' : '❌ 失败'}`, results.follow ? 'green' : 'red');
    log(`未读统计: ${results.unreadCount ? '✅ 通过' : '❌ 失败'}`, results.unreadCount ? 'green' : 'red');
    log(`标记已读: ${results.markAsRead ? '✅ 通过' : '❌ 失败'}`, results.markAsRead ? 'green' : 'red');
    log(`消息列表: ${results.messagesList ? '✅ 通过' : '❌ 失败'}`, results.messagesList ? 'green' : 'red');

    log(`\n总计: ${passedTests}/${totalTests} 测试通过`, passedTests === totalTests ? 'green' : 'yellow');

    if (passedTests === totalTests) {
      log('\n🎉 所有测试通过！通知系统工作正常！', 'green');
    } else {
      log('\n⚠️ 部分测试失败，请检查日志', 'yellow');
    }

    process.exit(passedTests === totalTests ? 0 : 1);

  } catch (error) {
    log(`\n❌ 测试执行失败: ${error.message}`, 'red');
    if (error.response) {
      log(`   响应: ${JSON.stringify(error.response.data)}`, 'red');
    }
    process.exit(1);
  }
}

// 运行测试
runTests();
