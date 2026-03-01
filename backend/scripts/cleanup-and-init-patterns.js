#!/usr/bin/env node

/**
 * 清理并重新初始化 pattern_assets 数据
 * 包含基础色板和 Emoji 默认集
 */

const knex = require('knex');
const { loadEnvConfig } = require('../src/config/env');
loadEnvConfig();

const config = require('../knexfile.js');

/**
 * 基础色板数据（8-16色）
 */
const basicColorPalette = [
  // 基础颜色
  { name: '黑色', key: 'black', color: '#000000', unicode_char: '⬛', render_type: 'color' },
  { name: '白色', key: 'white', color: '#FFFFFF', unicode_char: '⬜', render_type: 'color' },
  { name: '亮灰色', key: 'light_gray', color: '#CCCCCC', unicode_char: '🔲', render_type: 'color' },
  { name: '暗灰色', key: 'dark_gray', color: '#666666', unicode_char: '🔳', render_type: 'color' },
  
  // 三原色
  { name: '红色', key: 'red', color: '#FF0000', unicode_char: '🔴', render_type: 'color' },
  { name: '绿色', key: 'green', color: '#00FF00', unicode_char: '🟢', render_type: 'color' },
  { name: '蓝色', key: 'blue', color: '#0000FF', unicode_char: '🔵', render_type: 'color' },
  
  // 混合色
  { name: '黄色', key: 'yellow', color: '#FFFF00', unicode_char: '🟡', render_type: 'color' },
  { name: '紫色', key: 'purple', color: '#FF00FF', unicode_char: '🟣', render_type: 'color' },
  { name: '青色', key: 'cyan', color: '#00FFFF', unicode_char: '🔵', render_type: 'color' },
  
  // 扩展色板
  { name: '橙色', key: 'orange', color: '#FFA500', unicode_char: '🟠', render_type: 'color' },
  { name: '粉色', key: 'pink', color: '#FFC0CB', unicode_char: '🩷', render_type: 'color' },
  { name: '棕色', key: 'brown', color: '#8B4513', unicode_char: '🤎', render_type: 'color' },
  { name: '深绿色', key: 'dark_green', color: '#006400', unicode_char: '🟫', render_type: 'color' },
  { name: '深蓝色', key: 'dark_blue', color: '#000080', unicode_char: '🔷', render_type: 'color' },
  { name: '深红色', key: 'dark_red', color: '#8B0000', unicode_char: '🔺', render_type: 'color' }
];

/**
 * Emoji 默认集数据
 */
const emojiDefaultSet = [
  // 基础表情（人脸类，表达情绪）
  { name: '微笑', key: 'smile', unicode_char: '🙂', render_type: 'emoji', category: 'emotion' },
  { name: '大笑', key: 'grinning', unicode_char: '😃', render_type: 'emoji', category: 'emotion' },
  { name: '笑哭', key: 'laughing', unicode_char: '😂', render_type: 'emoji', category: 'emotion' },
  { name: '墨镜', key: 'sunglasses', unicode_char: '😎', render_type: 'emoji', category: 'emotion' },
  { name: '愤怒', key: 'angry', unicode_char: '😡', render_type: 'emoji', category: 'emotion' },
  { name: '哭泣', key: 'crying', unicode_char: '😢', render_type: 'emoji', category: 'emotion' },
  { name: '红心', key: 'heart', unicode_char: '❤️', render_type: 'emoji', category: 'emotion' },
  
  // 自然元素（好看又常见）
  { name: '太阳', key: 'sun', unicode_char: '☀️', render_type: 'emoji', category: 'nature' },
  { name: '月亮', key: 'moon', unicode_char: '🌙', render_type: 'emoji', category: 'nature' },
  { name: '星星', key: 'star', unicode_char: '⭐️', render_type: 'emoji', category: 'nature' },
  { name: '彩虹', key: 'rainbow', unicode_char: '🌈', render_type: 'emoji', category: 'nature' },
  { name: '雪花', key: 'snowflake', unicode_char: '❄️', render_type: 'emoji', category: 'nature' },
  { name: '海浪', key: 'wave', unicode_char: '🌊', render_type: 'emoji', category: 'nature' },
  { name: '树木', key: 'tree', unicode_char: '🌳', render_type: 'emoji', category: 'nature' },
  { name: '樱花', key: 'cherry_blossom', unicode_char: '🌸', render_type: 'emoji', category: 'nature' },
  
  // 动物类
  { name: '猫咪', key: 'cat', unicode_char: '🐱', render_type: 'emoji', category: 'animal' },
  { name: '狗狗', key: 'dog', unicode_char: '🐶', render_type: 'emoji', category: 'animal' },
  { name: '熊猫', key: 'panda', unicode_char: '🐼', render_type: 'emoji', category: 'animal' },
  { name: '企鹅', key: 'penguin', unicode_char: '🐧', render_type: 'emoji', category: 'animal' },
  { name: '小鸡', key: 'chick', unicode_char: '🐤', render_type: 'emoji', category: 'animal' },
  { name: '鱼', key: 'fish', unicode_char: '🐟', render_type: 'emoji', category: 'animal' },
  { name: '蜗牛', key: 'snail', unicode_char: '🐌', render_type: 'emoji', category: 'animal' },
  { name: '蝴蝶', key: 'butterfly', unicode_char: '🦋', render_type: 'emoji', category: 'animal' },
  { name: '独角兽', key: 'unicorn', unicode_char: '🦄', render_type: 'emoji', category: 'animal' },
  
  // 物品/符号
  { name: '足球', key: 'soccer', unicode_char: '⚽️', render_type: 'emoji', category: 'object' },
  { name: '篮球', key: 'basketball', unicode_char: '🏀', render_type: 'emoji', category: 'object' },
  { name: '音符', key: 'musical_note', unicode_char: '🎵', render_type: 'emoji', category: 'object' },
  { name: '游戏手柄', key: 'gamepad', unicode_char: '🎮', render_type: 'emoji', category: 'object' },
  { name: '汽车', key: 'car', unicode_char: '🚗', render_type: 'emoji', category: 'object' },
  { name: '飞机', key: 'airplane', unicode_char: '✈️', render_type: 'emoji', category: 'object' },
  { name: '火焰', key: 'fire', unicode_char: '🔥', render_type: 'emoji', category: 'object' },
  { name: '鸽子', key: 'dove', unicode_char: '🕊️', render_type: 'emoji', category: 'object' },
  
  // 旗帜类
  { name: '白旗', key: 'white_flag', unicode_char: '🏳️', render_type: 'emoji', category: 'flag' },
  { name: '黑旗', key: 'black_flag', unicode_char: '🏴', render_type: 'emoji', category: 'flag' },
  { name: '格子旗', key: 'checkered_flag', unicode_char: '🏁', render_type: 'emoji', category: 'flag' },
  { name: '彩虹旗', key: 'rainbow_flag', unicode_char: '🏳️‍🌈', render_type: 'emoji', category: 'flag' }
];

/**
 * 清理现有数据
 */
async function cleanupPatternAssets(db) {
  try {
    console.log('🧹 开始清理 pattern_assets 表...');
    
    // 删除所有现有数据
    const deletedCount = await db('pattern_assets').del();
    console.log(`✅ 已删除 ${deletedCount} 条现有记录`);
    
    return true;
  } catch (error) {
    console.error('❌ 清理数据失败:', error.message);
    throw error;
  }
}

/**
 * 插入基础色板数据
 */
async function insertBasicColorPalette(db) {
  try {
    console.log('🎨 开始插入基础色板数据...');
    
    const colorData = basicColorPalette.map(item => ({
      key: item.key,
      name: item.name,
      description: `基础色板 - ${item.name}`,
      image_url: '', // 基础色板不需要图片URL
      category: 'color_palette',
      tags: ['基础色板', '颜色', '调色板'],
      is_public: true,
      created_by: null, // 系统创建
      width: 32,
      height: 32,
      encoding: 'color',
      payload: null, // 基础色板使用颜色值
      verified: true,
      unicode_char: item.unicode_char,
      render_type: item.render_type,
      color: item.color
    }));
    
    await db('pattern_assets').insert(colorData);
    console.log(`✅ 已插入 ${colorData.length} 个基础色板`);
    
    return colorData.length;
  } catch (error) {
    console.error('❌ 插入基础色板失败:', error.message);
    throw error;
  }
}

/**
 * 插入 Emoji 默认集数据
 */
async function insertEmojiDefaultSet(db) {
  try {
    console.log('😀 开始插入 Emoji 默认集数据...');
    
    const emojiData = emojiDefaultSet.map(item => ({
      key: item.key,
      name: item.name,
      description: `Emoji 默认集 - ${item.name}`,
      image_url: '', // Emoji 不需要图片URL
      category: item.category,
      tags: ['emoji', '表情', '默认集', item.category],
      is_public: true,
      created_by: null, // 系统创建
      width: 32,
      height: 32,
      encoding: 'emoji',
      payload: null, // Emoji 使用 unicode 字符
      verified: true,
      unicode_char: item.unicode_char,
      render_type: item.render_type,
      color: null // Emoji 不需要颜色值
    }));
    
    await db('pattern_assets').insert(emojiData);
    console.log(`✅ 已插入 ${emojiData.length} 个 Emoji 默认集`);
    
    return emojiData.length;
  } catch (error) {
    console.error('❌ 插入 Emoji 默认集失败:', error.message);
    throw error;
  }
}

/**
 * 验证数据
 */
async function verifyData(db) {
  try {
    console.log('🔍 验证数据...');
    
    const totalCount = await db('pattern_assets').count('* as count').first();
    const colorCount = await db('pattern_assets').where('category', 'color_palette').count('* as count').first();
    const emojiCount = await db('pattern_assets').where('render_type', 'emoji').count('* as count').first();
    
    console.log(`📊 数据统计:`);
    console.log(`  - 总记录数: ${totalCount.count}`);
    console.log(`  - 基础色板: ${colorCount.count}`);
    console.log(`  - Emoji 集: ${emojiCount.count}`);
    
    // 显示一些示例数据
    const samples = await db('pattern_assets').select('key', 'name', 'category', 'render_type', 'unicode_char', 'color').limit(10);
    console.log('\n📋 示例数据:');
    samples.forEach(item => {
      console.log(`  - ${item.key}: ${item.name} (${item.category}) ${item.unicode_char || item.color || ''}`);
    });
    
    return true;
  } catch (error) {
    console.error('❌ 验证数据失败:', error.message);
    throw error;
  }
}

/**
 * 主函数
 */
async function cleanupAndInitPatterns() {
  const db = knex(config.development);
  
  try {
    console.log('🚀 开始清理并重新初始化 pattern_assets 数据...');
    console.log('📅 时间:', new Date().toISOString());
    
    // 1. 清理现有数据
    await cleanupPatternAssets(db);
    
    // 2. 插入基础色板数据
    const colorCount = await insertBasicColorPalette(db);
    
    // 3. 插入 Emoji 默认集数据
    const emojiCount = await insertEmojiDefaultSet(db);
    
    // 4. 验证数据
    await verifyData(db);
    
    console.log('\n✅ 数据初始化完成！');
    console.log(`🎨 基础色板: ${colorCount} 个`);
    console.log(`😀 Emoji 集: ${emojiCount} 个`);
    console.log(`📊 总计: ${colorCount + emojiCount} 个图案`);
    
  } catch (error) {
    console.error('💥 初始化失败:', error);
    throw error;
  } finally {
    await db.destroy();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  cleanupAndInitPatterns()
    .then(() => {
      console.log('🎉 脚本执行完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = { cleanupAndInitPatterns };
