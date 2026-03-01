const { db } = require('../src/config/database');
const PatternConversionService = require('../src/services/patternConversionService');

/**
 * 转换 png_url 格式的图案为 png_base64 格式
 */
async function convertPngUrlPatterns() {
  try {
    console.log('🚀 开始转换 png_url 格式的图案...');
    
    // 1. 查找所有 png_url 格式的图案
    const pngUrlPatterns = await db('pattern_assets')
      .where('encoding', 'png_url')
      .select('*');
    
    console.log(`📊 找到 ${pngUrlPatterns.length} 个 png_url 格式的图案`);
    
    if (pngUrlPatterns.length === 0) {
      console.log('✅ 没有需要转换的图案');
      return;
    }
    
    // 2. 显示要转换的图案信息
    console.log('\n📋 要转换的图案:');
    pngUrlPatterns.forEach((pattern, index) => {
      console.log(`${index + 1}. ID: ${pattern.id}, Key: ${pattern.key}, Name: ${pattern.name}, Payload: ${pattern.payload}`);
    });
    
    // 3. 批量转换图案
    const conversionResult = await PatternConversionService.batchConvertPatterns(pngUrlPatterns, {
      width: 64,
      height: 64
    });
    
    console.log('\n📊 转换结果:');
    console.log(`✅ 成功: ${conversionResult.successful} 个`);
    console.log(`❌ 失败: ${conversionResult.failed} 个`);
    
    // 4. 更新数据库中的图案数据
    if (conversionResult.successful > 0) {
      console.log('\n💾 开始更新数据库...');
      
      for (const result of conversionResult.results) {
        const pattern = pngUrlPatterns.find(p => p.id === result.patternId);
        if (pattern) {
          try {
            await db('pattern_assets')
              .where('id', pattern.id)
              .update({
                encoding: 'png_base64',
                payload: result.result.payload,
                width: result.result.width,
                height: result.result.height,
                updated_at: new Date()
              });
            
            console.log(`✅ 已更新图案: ${pattern.name} (ID: ${pattern.id})`);
          } catch (error) {
            console.error(`❌ 更新图案失败: ${pattern.name}`, error);
          }
        }
      }
      
      console.log('🎉 数据库更新完成');
    }
    
    // 5. 显示错误信息
    if (conversionResult.failed > 0) {
      console.log('\n❌ 转换失败的图案:');
      conversionResult.errors.forEach(error => {
        console.log(`- ${error.patternName} (ID: ${error.patternId}): ${error.error}`);
      });
    }
    
    console.log('\n🎉 图案转换完成！');
    
  } catch (error) {
    console.error('💥 转换过程失败:', error);
    throw error;
  } finally {
    await db.destroy();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  convertPngUrlPatterns()
    .then(() => {
      console.log('✅ 脚本执行完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = { convertPngUrlPatterns };
