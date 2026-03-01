const PatternAsset = require('../models/PatternAsset');
const { db } = require('../config/database');

class PatternManager {
  // 批量导入图案
  static async importPatterns(patterns) {
    const results = [];
    
    for (const pattern of patterns) {
      try {
        const result = await PatternAsset.create(pattern);
        results.push({
          success: true,
          key: result.key,
          id: result.id
        });
        console.log(`✅ 图案导入成功: ${result.key}`);
      } catch (error) {
        results.push({
          success: false,
          key: pattern.key,
          error: error.message
        });
        console.error(`❌ 图案导入失败: ${pattern.key} - ${error.message}`);
      }
    }
    
    return results;
  }

  // 从JSON文件导入图案
  static async importFromJSON(filePath) {
    try {
      const fs = require('fs');
      const patterns = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return await this.importPatterns(patterns);
    } catch (error) {
      console.error('从JSON文件导入图案失败:', error);
      throw error;
    }
  }

  // 生成emoji图案数据
  static generateEmojiPatterns() {
    const colors = [
      '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FFA500',
      '#800080', '#FFC0CB', '#00FFFF', '#FFD700', '#FF4500',
      '#32CD32', '#4169E1', '#FF69B4', '#00CED1', '#FF6347'
    ];

    return colors.map((color, index) => ({
      key: `emoji_flag_${index + 1}`,
      width: 1,
      height: 1,
      encoding: 'rle',
      payload: JSON.stringify([{ count: 1, color }]),
      verified: true,
      created_by: null
    }));
  }

  // 生成国旗图案数据
  static generateFlagPatterns() {
    return [
      {
        key: 'flag_china',
        width: 3,
        height: 2,
        encoding: 'rle',
        payload: JSON.stringify([
          { count: 2, color: '#FF0000' }, { count: 1, color: '#FFD700' },
          { count: 2, color: '#FF0000' }, { count: 1, color: '#FFD700' }
        ]),
        verified: true,
        created_by: null
      },
      {
        key: 'flag_usa',
        width: 3,
        height: 2,
        encoding: 'rle',
        payload: JSON.stringify([
          { count: 1, color: '#FFFFFF' }, { count: 1, color: '#FF0000' }, { count: 1, color: '#0000FF' },
          { count: 1, color: '#FFFFFF' }, { count: 1, color: '#FF0000' }, { count: 1, color: '#0000FF' }
        ]),
        verified: true,
        created_by: null
      },
      {
        key: 'flag_japan',
        width: 3,
        height: 2,
        encoding: 'rle',
        payload: JSON.stringify([
          { count: 1, color: '#FFFFFF' }, { count: 1, color: '#FF0000' }, { count: 1, color: '#FFFFFF' },
          { count: 1, color: '#FFFFFF' }, { count: 1, color: '#FF0000' }, { count: 1, color: '#FFFFFF' }
        ]),
        verified: true,
        created_by: null
      },
      {
        key: 'flag_uk',
        width: 3,
        height: 2,
        encoding: 'rle',
        payload: JSON.stringify([
          { count: 1, color: '#0000FF' }, { count: 1, color: '#FFFFFF' }, { count: 1, color: '#FF0000' },
          { count: 1, color: '#0000FF' }, { count: 1, color: '#FFFFFF' }, { count: 1, color: '#FF0000' }
        ]),
        verified: true,
        created_by: null
      }
    ];
  }

  // 生成校徽图案数据
  static generateSchoolPatterns() {
    return [
      {
        key: 'school_tsinghua',
        width: 4,
        height: 4,
        encoding: 'rle',
        payload: JSON.stringify([
          { count: 2, color: '#000000' }, { count: 2, color: '#FFD700' },
          { count: 2, color: '#000000' }, { count: 2, color: '#FFD700' },
          { count: 2, color: '#FFD700' }, { count: 2, color: '#000000' },
          { count: 2, color: '#FFD700' }, { count: 2, color: '#000000' }
        ]),
        verified: true,
        created_by: null
      },
      {
        key: 'school_pku',
        width: 4,
        height: 4,
        encoding: 'rle',
        payload: JSON.stringify([
          { count: 1, color: '#FF0000' }, { count: 2, color: '#FFFFFF' }, { count: 1, color: '#FF0000' },
          { count: 1, color: '#FF0000' }, { count: 2, color: '#FFFFFF' }, { count: 1, color: '#FF0000' },
          { count: 1, color: '#FF0000' }, { count: 2, color: '#FFFFFF' }, { count: 1, color: '#FF0000' },
          { count: 1, color: '#FF0000' }, { count: 2, color: '#FFFFFF' }, { count: 1, color: '#FF0000' }
        ]),
        verified: true,
        created_by: null
      }
    ];
  }

  // 初始化所有基础图案
  static async initializeAllPatterns() {
    console.log('🚀 开始初始化所有基础图案...');
    
    const allPatterns = [
      ...this.generateEmojiPatterns(),
      ...this.generateFlagPatterns(),
      ...this.generateSchoolPatterns()
    ];
    
    const results = await this.importPatterns(allPatterns);
    
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    
    console.log(`✅ 图案初始化完成: 成功 ${successCount} 个, 失败 ${failCount} 个`);
    
    return results;
  }

  // 验证图案数据
  static validatePattern(pattern) {
    const errors = [];
    
    if (!pattern.key) {
      errors.push('缺少key字段');
    }
    
    if (!pattern.width || !pattern.height) {
      errors.push('缺少width或height字段');
    }
    
    if (pattern.width > 32 || pattern.height > 32) {
      errors.push('图案尺寸不能超过32x32');
    }
    
    if (!pattern.encoding || !['rle', 'png_base64'].includes(pattern.encoding)) {
      errors.push('编码格式必须是rle或png_base64');
    }
    
    if (!pattern.payload) {
      errors.push('缺少payload字段');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // 导出图案数据到JSON文件
  static async exportToJSON(filePath) {
    try {
      const patterns = await PatternAsset.getVerifiedPatterns();
      const fs = require('fs');
      
      const exportData = patterns.map(pattern => ({
        key: pattern.key,
        width: pattern.width,
        height: pattern.height,
        encoding: pattern.encoding,
        payload: pattern.payload,
        verified: pattern.verified
      }));
      
      fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2));
      console.log(`✅ 图案数据已导出到: ${filePath}`);
      
      return exportData;
    } catch (error) {
      console.error('导出图案数据失败:', error);
      throw error;
    }
  }

  // 清理重复图案
  static async cleanDuplicatePatterns() {
    try {
      const duplicates = await db.raw(`
        DELETE FROM pattern_assets 
        WHERE id NOT IN (
          SELECT MIN(id) 
          FROM pattern_assets 
          GROUP BY key
        )
      `);
      
      console.log('✅ 清理重复图案完成');
      return duplicates;
    } catch (error) {
      console.error('清理重复图案失败:', error);
      throw error;
    }
  }
}

module.exports = PatternManager;
