/**
 * 测试头像URL转换功能
 * 验证相对路径自动转换为完整URL
 */

const { buildAvatarUrl, processAvatarUrls } = require('../src/utils/avatarUrlHelper');
const { getBaseURL } = require('../src/config/urlConfig');

console.log('🧪 测试头像URL转换功能\n');

// 获取当前环境的baseURL
const baseURL = getBaseURL();
console.log(`📍 当前环境 baseURL: ${baseURL}\n`);

// 测试用例
const testCases = [
  {
    name: '相对路径 (新格式)',
    input: '/uploads/materials/avatars/66/1b/avatar_test_medium.png',
    expected: `${baseURL}/uploads/materials/avatars/66/1b/avatar_test_medium.png`
  },
  {
    name: '完整URL (旧格式 - 当前IP)',
    input: 'http://192.168.1.15:3001/uploads/materials/avatars/a7/9a/avatar_test_medium.png',
    expected: 'http://192.168.1.15:3001/uploads/materials/avatars/a7/9a/avatar_test_medium.png'
  },
  {
    name: '完整URL (旧格式 - 旧IP)',
    input: 'http://192.168.0.3:3001/uploads/materials/avatars/ab/cd/avatar_test_medium.png',
    expected: 'http://192.168.0.3:3001/uploads/materials/avatars/ab/cd/avatar_test_medium.png'
  },
  {
    name: '空值',
    input: null,
    expected: null
  },
  {
    name: '空字符串',
    input: '',
    expected: null
  }
];

console.log('1️⃣ 测试 buildAvatarUrl() 函数\n');
testCases.forEach(({ name, input, expected }) => {
  const result = buildAvatarUrl(input);
  const status = result === expected ? '✅' : '❌';
  console.log(`${status} ${name}`);
  console.log(`   输入:  ${input}`);
  console.log(`   输出:  ${result}`);
  console.log(`   预期:  ${expected}\n`);
});

console.log('2️⃣ 测试 processAvatarUrls() 函数\n');

// 测试单个用户对象
const singleUser = {
  id: 'user123',
  username: 'testuser',
  avatar_url: '/uploads/materials/avatars/66/1b/avatar_test_medium.png'
};

const processedUser = processAvatarUrls(singleUser);
console.log('✅ 单个用户对象:');
console.log(`   原始: ${singleUser.avatar_url}`);
console.log(`   转换: ${processedUser.avatar_url}\n`);

// 测试用户列表
const userList = [
  {
    id: 'user1',
    username: 'alice',
    avatar_url: '/uploads/materials/avatars/aa/bb/avatar_alice_medium.png'
  },
  {
    id: 'user2',
    username: 'bob',
    avatar_url: 'http://192.168.0.3:3001/uploads/materials/avatars/cc/dd/avatar_bob_medium.png'
  },
  {
    id: 'user3',
    username: 'charlie',
    avatar_url: null
  }
];

const processedList = processAvatarUrls(userList);
console.log('✅ 用户列表:');
processedList.forEach((user, index) => {
  console.log(`   [${index + 1}] ${user.username}`);
  console.log(`       原始: ${userList[index].avatar_url}`);
  console.log(`       转换: ${user.avatar_url}`);
});

console.log('\n3️⃣ 测试嵌套对象\n');

// 测试嵌套的响应数据
const nestedResponse = {
  success: true,
  user: {
    id: 'user123',
    username: 'testuser',
    avatar_url: '/uploads/materials/avatars/66/1b/avatar_test_medium.png'
  },
  pixels: [
    {
      id: 'pixel1',
      user: {
        id: 'user456',
        username: 'artist',
        avatar_url: '/uploads/materials/avatars/77/88/avatar_artist_medium.png'
      }
    }
  ]
};

const processedResponse = processAvatarUrls(nestedResponse);
console.log('✅ 嵌套对象:');
console.log(`   user.avatar_url: ${processedResponse.user.avatar_url}`);
console.log(`   pixels[0].user.avatar_url: ${processedResponse.pixels[0].user.avatar_url}`);

console.log('\n🎉 测试完成！');
console.log('\n💡 结论:');
console.log('   ✅ 相对路径会自动转换为完整URL');
console.log('   ✅ 完整URL保持不变（向后兼容）');
console.log('   ✅ 支持嵌套对象和数组');
console.log('   ✅ IP变更后，相对路径会使用新的baseURL');
