#!/usr/bin/env node

/**
 * Pattern to Material 迁移脚本
 * 将旧的pattern_assets (png_base64格式) 迁移到新的Material System
 *
 * 使用: node scripts/migratePatternToMaterial.js
 * 或: LOCAL_VALIDATION=true node scripts/migratePatternToMaterial.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { db } = require('../src/config/database');
const materialAssetService = require('../src/services/materialAssetService');
const logger = require('../src/utils/logger');

class PatternMigration {
  constructor() {
    this.stats = {
      total: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };
    this.startTime = Date.now();
  }

  /**
   * 检查是否存在旧的pattern_assets数据
   */
  async checkOldPatterns() {
    console.log('\n📋 检查旧的pattern_assets数据...');

    try {
      const oldPatterns = await db('pattern_assets')
        .where(builder => {
          builder.where('encoding', 'png_base64')
            .orWhere('encoding', 'image')
            .orWhereNull('material_id');
        })
        .andWhere('payload', 'not like', '')  // 确保有payload数据
        .count('* as count')
        .first();

      const count = parseInt(oldPatterns.count || 0);

      if (count === 0) {
        console.log('✅ 无旧数据，不需要迁移');
        return false;
      }

      console.log(`⚠️  发现 ${count} 个旧的pattern_assets记录需要迁移`);
      return true;
    } catch (error) {
      console.error('❌ 检查旧数据失败:', error);
      throw error;
    }
  }

  /**
   * 获取所有需要迁移的patterns
   */
  async getOldPatterns() {
    console.log('\n📥 获取旧的pattern_assets数据...');

    try {
      // 获取需要迁移的patterns：
      // 1. encoding为png_base64或image的 AND 有payload数据
      // 2. 或者encoding不是'material'但有payload的patterns
      const patterns = await db('pattern_assets')
        .where(builder => {
          builder.where('encoding', 'png_base64')
            .orWhere('encoding', 'image')
            .orWhere('encoding', 'png');
        })
        .andWhere(builder => {
          builder.whereNotNull('payload')
            .andWhere('payload', '!=', '');
        })
        .select('id', 'key', 'name', 'encoding', 'payload', 'material_id', 'width', 'height', 'created_by')
        .orderBy('created_at', 'asc');

      console.log(`✅ 获取了 ${patterns.length} 个patterns`);
      return patterns;
    } catch (error) {
      console.error('❌ 获取patterns失败:', error);
      throw error;
    }
  }

  /**
   * 将单个pattern迁移到Material System
   */
  async migratePattern(pattern) {
    try {
      console.log(`\n🔄 正在迁移: ${pattern.key} (ID: ${pattern.id})`);

      // 检查是否已经有对应的Material
      if (pattern.material_id) {
        console.log(`⏭️  已有material_id (${pattern.material_id})，跳过`);
        this.stats.skipped++;
        return true;
      }

      // 检查payload是否为空
      if (!pattern.payload || pattern.payload.length === 0) {
        console.log('⏭️  payload为空，跳过');
        this.stats.skipped++;
        return true;
      }

      // 将payload从base64转为Buffer
      console.log(`  - 转换base64为Buffer (${pattern.payload.length} 字符)...`);
      let buffer;
      try {
        buffer = Buffer.from(pattern.payload, 'base64');
        console.log(`  - Buffer大小: ${buffer.length} bytes`);
      } catch (error) {
        throw new Error(`Base64转换失败: ${error.message}`);
      }

      // 调用Material System创建Material
      console.log('  - 创建Material资源...');
      const materialResult = await materialAssetService.createCustomStickerMaterial({
        buffer,
        key: pattern.key,
        fileName: pattern.name || pattern.key,
        mimeType: 'image/png',
        uploadedBy: pattern.created_by
      });

      console.log(`  ✅ Material创建成功 (ID: ${materialResult.material.id}, Version: ${materialResult.material.version})`);

      // 更新pattern_assets记录
      console.log('  - 更新pattern_assets表...');
      await db('pattern_assets')
        .where({ id: pattern.id })
        .update({
          encoding: 'material',
          payload: null,  // 清空base64数据
          material_id: materialResult.material.id,
          material_version: materialResult.material.version,
          material_metadata: JSON.stringify({
            originalFormat: 'png_base64',
            migratedAt: new Date().toISOString(),
            originalEncoding: pattern.encoding,
            variantsInfo: {
              spriteSheet: {
                width: materialResult.variants.spriteSheet.width,
                height: materialResult.variants.spriteSheet.height,
                sizeBytes: materialResult.variants.spriteSheet.size_bytes
              },
              distanceField: {
                width: materialResult.variants.distanceField.width,
                height: materialResult.variants.distanceField.height
              },
              source: {
                width: materialResult.variants.source.width,
                height: materialResult.variants.source.height
              }
            }
          }),
          updated_at: db.fn.now()
        });

      console.log(`  ✅ Pattern更新成功`);
      this.stats.successful++;
      return true;
    } catch (error) {
      console.error(`  ❌ 迁移失败: ${error.message}`);
      this.stats.failed++;
      this.stats.errors.push({
        patternId: pattern.id,
        patternKey: pattern.key,
        error: error.message
      });
      return false;
    }
  }

  /**
   * 执行完整的迁移流程
   */
  async migrate() {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 开始 Pattern → Material 迁移');
    console.log('='.repeat(60));

    try {
      // 步骤1: 检查旧数据
      const hasOldData = await this.checkOldPatterns();
      if (!hasOldData) {
        console.log('\n✅ 迁移不需要执行');
        return { success: true, message: '无需迁移' };
      }

      // 步骤2: 获取所有旧patterns
      const patterns = await this.getOldPatterns();
      this.stats.total = patterns.length;

      // 步骤3: 逐个迁移
      console.log('\n' + '='.repeat(60));
      console.log('🔄 开始逐个迁移...');
      console.log('='.repeat(60));

      for (let i = 0; i < patterns.length; i++) {
        const pattern = patterns[i];
        console.log(`\n[${i + 1}/${patterns.length}]`);
        await this.migratePattern(pattern);
      }

      // 步骤4: 生成报告
      await this.printReport();

      // 验证迁移结果
      await this.verifyMigration();

      console.log('\n' + '='.repeat(60));
      console.log('✅ 迁移完成！');
      console.log('='.repeat(60));

      return {
        success: this.stats.failed === 0,
        stats: this.stats
      };
    } catch (error) {
      console.error('\n❌ 迁移过程出错:', error);
      throw error;
    }
  }

  /**
   * 打印迁移报告
   */
  async printReport() {
    const duration = ((Date.now() - this.startTime) / 1000).toFixed(2);

    console.log('\n' + '='.repeat(60));
    console.log('📊 迁移报告');
    console.log('='.repeat(60));
    console.table({
      '总数': this.stats.total,
      '成功': this.stats.successful,
      '失败': this.stats.failed,
      '跳过': this.stats.skipped,
      '耗时(秒)': duration
    });

    if (this.stats.errors.length > 0) {
      console.log('\n⚠️  失败的patterns:');
      console.table(this.stats.errors);
    }
  }

  /**
   * 验证迁移结果
   */
  async verifyMigration() {
    console.log('\n🔍 验证迁移结果...');

    try {
      // 检查是否还有旧的pattern_assets
      const remaining = await db('pattern_assets')
        .where(builder => {
          builder.where('encoding', 'png_base64')
            .orWhere('encoding', 'image')
            .orWhereNull('material_id');
        })
        .andWhere('payload', 'not like', '')
        .count('* as count')
        .first();

      const remainingCount = parseInt(remaining.count || 0);

      if (remainingCount === 0) {
        console.log('✅ 所有旧数据已迁移');
      } else {
        console.log(`⚠️  仍有 ${remainingCount} 个patterns未迁移`);
      }

      // 统计新的material使用情况
      const materialStats = await db('pattern_assets')
        .where('encoding', 'material')
        .count('* as count')
        .first();

      const materialCount = parseInt(materialStats.count || 0);
      console.log(`📊 现在有 ${materialCount} 个patterns使用Material System`);

    } catch (error) {
      console.error('❌ 验证失败:', error);
    }
  }
}

/**
 * 主函数
 */
async function main() {
  const migration = new PatternMigration();

  try {
    const result = await migration.migrate();

    if (!result.success) {
      console.error('\n❌ 迁移失败，请检查错误日志');
      process.exit(1);
    }

    console.log('\n✅ 迁移任务完成');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ 致命错误:', error.message);
    process.exit(1);
  }
}

// 捕获未处理的异常
process.on('uncaughtException', (error) => {
  console.error('❌ 未捕获的异常:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未处理的Promise拒绝:', reason);
  process.exit(1);
});

// 执行主函数
if (require.main === module) {
  main();
}

module.exports = PatternMigration;
