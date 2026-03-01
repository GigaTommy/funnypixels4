#!/usr/bin/env node

/**
 * URL 配置测试脚本
 * 用于验证 URL 配置在不同环境下的行为
 */

// 加载环境变量
require('../src/config/env').loadEnvConfig();

const { urlConfig, getBaseURL, getCDNBaseURL, getUploadURL, getShareURL } = require('../src/config/urlConfig');

console.log('\n🧪 URL Configuration Test\n');
console.log('='.repeat(60));

// 1. 基础信息
console.log('\n📋 Environment Information:');
console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
console.log(`   PORT: ${process.env.PORT || 3001}`);
console.log(`   HOST: ${process.env.HOST || '0.0.0.0'}`);

// 2. 完整配置
console.log('\n🌐 URL Configuration:');
const config = urlConfig.getConfig();
Object.entries(config).forEach(([key, value]) => {
  console.log(`   ${key}: ${value}`);
});

// 3. 便捷访问器测试
console.log('\n🔗 Convenience Accessors:');
console.log(`   getBaseURL(): ${getBaseURL()}`);
console.log(`   getCDNBaseURL(): ${getCDNBaseURL()}`);

// 4. URL生成测试
console.log('\n🛠️ URL Generation Tests:');

const testCases = [
  {
    name: 'Avatar Image',
    input: '/materials/avatars/a7/9a/avatar_xxx_medium.png',
    fn: 'getUploadURL'
  },
  {
    name: 'Pattern Asset',
    input: '/materials/patterns/pattern_123.png',
    fn: 'getUploadURL'
  },
  {
    name: 'Share Link',
    input: '/pixels/abc123',
    fn: 'getShareURL'
  }
];

testCases.forEach(({ name, input, fn }) => {
  const result = fn === 'getUploadURL' ? getUploadURL(input) : getShareURL(input);
  console.log(`\n   ${name}:`);
  console.log(`      Input:  ${input}`);
  console.log(`      Output: ${result}`);
});

// 5. 验证结果
console.log('\n✅ Validation:');

const checks = [
  {
    name: 'Base URL is defined',
    pass: !!getBaseURL()
  },
  {
    name: 'Base URL is valid HTTP(S)',
    pass: getBaseURL().startsWith('http://') || getBaseURL().startsWith('https://')
  },
  {
    name: 'CDN URL is defined',
    pass: !!getCDNBaseURL()
  },
  {
    name: 'Upload URL generation works',
    pass: getUploadURL('/test.png').includes('/test.png')
  }
];

let allPassed = true;
checks.forEach(({ name, pass }) => {
  console.log(`   ${pass ? '✅' : '❌'} ${name}`);
  if (!pass) allPassed = false;
});

console.log('\n' + '='.repeat(60));

if (allPassed) {
  console.log('✅ All tests passed! URL configuration is working correctly.\n');
  process.exit(0);
} else {
  console.log('❌ Some tests failed. Please check the configuration.\n');
  process.exit(1);
}
