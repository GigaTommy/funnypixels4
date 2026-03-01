/**
 * 为emoji创建material_variants记录 - 修正版（使用正确的表结构）
 */

const { db } = require('../backend/src/config/database');
const fs = require('fs');
const path = require('path');

// Emoji列表 - 使用已有的material_id
const EMOJIS = [
  { key: 'emoji_crown', material_id: 'cec06613-e2c0-4543-b03a-56fd3ba10dd5' },
  { key: 'emoji_star', material_id: '59c61f33-3133-4939-9da7-2d3c8dbb1097' },
  { key: 'emoji_heart', material_id: '55ee262c-8078-401f-a9aa-8d569480f572' },
  { key: 'emoji_fire', material_id: '57f71649-14fe-4ccf-9c49-6ca526669931' }, // 🔥 最重要
  { key: 'emoji_water', material_id: 'a49edeab-ee33-4752-8ba7-88dbc2542413' },
  { key: 'emoji_leaf', material_id: '6e3a0d94-6e52-459d-a3df-864581a14b5e' },
  { key: 'emoji_sun', material_id: 'af72c6cf-7486-4f19-88b1-04897fa1b7e7' },
  { key: 'emoji_moon', material_id: '450ef9fc-2913-4900-88df-4f8d855da945' },
  { key: 'emoji_cloud', material_id: '35efdbb0-1df8-4620-8d5f-2720881ad374' },
  { key: 'emoji_rainbow', material_id: '4bcd844d-7f3c-482b-99e3-91bcfba7fdb6' },
  { key: 'emoji_anchor', material_id: 'd528491e-b78f-446c-8bf8-1149d4e750c0' },
  { key: 'emoji_compass', material_id: 'd4db3393-3203-4096-92fc-1040d8d923c0' }
];

/**
 * 生成UUID
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * 读取图片文件并转换为base64
 */
function getImageAsBase64(emoji) {
  const filePath = path.join(__dirname, '../public/patterns', `${emoji.key}.png`);

  try {
    const buffer = fs.readFileSync(filePath);
    return buffer.toString('base64');
  } catch (error) {
    console.warn(`⚠️ 无法读取图片文件: ${filePath}`);
    return null;
  }
}

/**
 * 获取图片文件大小
 */
function getImageFileSize(emoji) {
  const filePath = path.join(__dirname, '../public/patterns', `${emoji.key}.png`);

  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch (error) {
    console.warn(`⚠️ 无法获取文件大小: ${filePath}`);
    return 0;
  }
}

/**
 * 创建variant记录
 */
async function createEmojiVariants() {
  console.log('🔧 为emoji创建material_variants记录（修正版）...\n');

  try {
    for (const emoji of EMOJIS) {
      console.log(`📋 处理: ${emoji.key}`);

      // 1. 检查是否已有variant记录
      const existingVariant = await db('material_variants')
        .where({
          material_id: emoji.material_id,
          variant_type: 'sprite_sheet'
        })
        .first();

      if (existingVariant) {
        console.log(`✅ 已有variant记录`);
        continue;
      }

      // 2. 读取图片文件
      const base64Payload = getImageAsBase64(emoji);
      const fileSize = getImageFileSize(emoji);

      if (!base64Payload) {
        console.log(`⚠️ 跳过（无图片文件）`);
        continue;
      }

      // 3. 创建variant记录（使用正确的表结构）
      const variantId = generateUUID();

      await db('material_variants').insert({
        id: variantId,
        material_id: emoji.material_id,
        variant_type: 'sprite_sheet',
        format: 'png',
        width: 72,
        height: 72,
        size_bytes: fileSize,
        payload: base64Payload,
        checksum: Buffer.from(base64Payload.slice(0, 32)).toString('hex'),
        metadata: {
          source: 'twemoji',
          key: emoji.key,
          image_url: `/patterns/${emoji.key}.png`
        },
        version: 1,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
        cdn_url: `/patterns/${emoji.key}.png`,
        storage_path: `patterns/${emoji.key}.png`,
        file_hash: Buffer.from(base64Payload.slice(0, 32)).toString('hex')
      });

      console.log(`✅ 创建variant记录: ${variantId}`);
    }

    console.log('\n🎉 所有emoji variant创建完成！');

    // 验证创建结果
    console.log('\n🔍 验证variant创建结果...');
    const variants = await db('material_variants')
      .join('material_assets', 'material_variants.material_id', '=', 'material_assets.id')
      .where('material_assets.key', 'like', 'emoji_%')
      .select(
        'material_assets.key',
        'material_variants.material_id',
        'material_variants.variant_type',
        'material_variants.format',
        'material_variants.is_active'
      );

    console.log('\n📊 创建的variant记录:');
    console.table(variants);

  } catch (error) {
    console.error('❌ 创建variant失败:', error);
    throw error;
  } finally {
    await db.destroy();
  }
}

// 运行创建
createEmojiVariants().catch(error => {
  console.error('💥 脚本执行失败:', error);
  process.exit(1);
});