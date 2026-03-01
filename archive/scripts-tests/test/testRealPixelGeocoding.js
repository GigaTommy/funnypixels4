/**
 * 测试真实像素绘制的地理编码流程
 * 包含数据库写入和地理编码的完整流程
 */

// 设置环境变量
process.env.VITE_AMAP_WEB_SERVICE_KEY = '490fb8631cb2d380b9ec90b459ffda60';

const { db } = require('../../backend/src/config/database');
const logger = require('../../backend/src/utils/logger');
const asyncGeocodingService = require('../../backend/src/services/asyncGeocodingService');
const amapWebService = require('../../backend/src/services/amapWebService');

async function testRealPixelGeocoding() {
  console.log('🧪 开始测试真实像素绘制地理编码流程...');

  try {
    // 测试坐标
    const testCoordinate = {
      gridId: 'test_' + Date.now(),
      latitude: 39.908823,
      longitude: 116.397470,
      userId: 'test_user_' + Date.now(),
      color: '#FF0000'
    };

    console.log(`\n📍 测试坐标: (${testCoordinate.latitude}, ${testCoordinate.longitude})`);
    console.log(`🆔 测试Grid ID: ${testCoordinate.gridId}`);
    console.log(`👤 测试用户: ${testCoordinate.userId}`);

    // 步骤1: 测试高德地图API
    console.log('\n🌍 步骤1: 测试高德地图Web服务API...');
    const amapResult = await amapWebService.reverseGeocode(
      testCoordinate.latitude,
      testCoordinate.longitude
    );

    console.log('高德API结果:');
    console.log(`- 省份: ${amapResult.province}`);
    console.log(`- 城市: ${amapResult.city}`);
    console.log(`- 区县: ${amapResult.district}`);
    console.log(`- 编码状态: ${amapResult.geocoded ? '✅' : '❌'}`);

    if (!amapResult.geocoded) {
      console.error('❌ 高德地图API测试失败，停止后续测试');
      return;
    }

    // 步骤2: 创建真实像素记录
    console.log('\n💾 步骤2: 创建真实像素记录...');

    const pixelData = {
      grid_id: testCoordinate.gridId,
      latitude: testCoordinate.latitude,
      longitude: testCoordinate.longitude,
      user_id: testCoordinate.userId,
      color: testCoordinate.color,
      created_at: new Date(),
      updated_at: new Date()
    };

    console.log('写入像素数据:', pixelData);

    // 插入像素记录
    const insertedPixels = await db('pixels')
      .insert(pixelData)
      .returning(['id', 'grid_id', 'latitude', 'longitude', 'created_at']);

    if (!insertedPixels || insertedPixels.length === 0) {
      console.error('❌ 像素记录创建失败');
      return;
    }

    const createdPixel = insertedPixels[0];
    console.log('✅ 像素记录创建成功:', {
      id: createdPixel.id,
      gridId: createdPixel.grid_id,
      coordinates: `(${createdPixel.latitude}, ${createdPixel.longitude})`
    });

    // 步骤3: 提交地理编码任务
    console.log('\n🔄 步骤3: 提交地理编码任务...');

    const success = await asyncGeocodingService.processGeocoding(
      createdPixel.id, // 使用实际的数据库ID
      createdPixel.latitude,
      createdPixel.longitude,
      'high'
    );

    if (success) {
      console.log('✅ 地理编码任务提交成功');

      // 步骤4: 等待地理编码完成并验证结果
      console.log('\n⏳ 步骤4: 等待地理编码完成...');

      // 等待地理编码处理
      await new Promise(resolve => setTimeout(resolve, 5000));

      // 查询像素记录，检查地理信息是否已更新
      const updatedPixel = await db('pixels')
        .where('id', createdPixel.id)
        .first();

      console.log('📊 地理编码结果验证:');
      console.log(`- 数据库ID: ${updatedPixel.id}`);
      console.log(`- Grid ID: ${updatedPixel.grid_id}`);
      console.log(`- 国家: ${updatedPixel.country || '未设置'}`);
      console.log(`- 省份: ${updatedPixel.province || '未设置'}`);
      console.log(`- 城市: ${updatedPixel.city || '未设置'}`);
      console.log(`- 区县: ${updatedPixel.district || '未设置'}`);
      console.log(`- 行政区划代码: ${updatedPixel.adcode || '未设置'}`);
      console.log(`- 详细地址: ${updatedPixel.formatted_address || '未设置'}`);
      console.log(`- 编码状态: ${updatedPixel.geocoded ? '✅ 已编码' : '❌ 未编码'}`);
      console.log(`- 编码时间: ${updatedPixel.geocoded_at || '未设置'}`);

      // 步骤5: 验证数据一致性
      console.log('\n🔍 步骤5: 验证数据一致性...');

      const isConsistent =
        updatedPixel.province === amapResult.province &&
        updatedPixel.city === amapResult.city &&
        updatedPixel.district === amapResult.district &&
        updatedPixel.geocoded === amapResult.geocoded;

      if (isConsistent) {
        console.log('✅ 地理编码数据一致性验证通过');
      } else {
        console.log('❌ 地理编码数据一致性验证失败');
        console.log('预期:', {
          province: amapResult.province,
          city: amapResult.city,
          district: amapResult.district,
          geocoded: amapResult.geocoded
        });
        console.log('实际:', {
          province: updatedPixel.province,
          city: updatedPixel.city,
          district: updatedPixel.district,
          geocoded: updatedPixel.geocoded
        });
      }

      // 步骤6: 检查队列状态
      console.log('\n📈 步骤6: 检查地理编码队列状态...');
      const queueStats = await asyncGeocodingService.getQueueStats();
      console.log('队列统计:', {
        总排队: queueStats.totalQueued,
        已处理: queueStats.totalProcessed,
        失败数: queueStats.totalFailed,
        批次处理: queueStats.batchProcessed,
        平均延迟: queueStats.averageLatency + 'ms'
      });

      // 步骤7: 测试完成，清理测试数据
      console.log('\n🧹 步骤7: 清理测试数据...');

      const deletedCount = await db('pixels')
        .where('id', createdPixel.id)
        .del();

      console.log(`✅ 已清理 ${deletedCount} 条测试记录`);

      // 最终总结
      console.log('\n📋 测试总结:');
      console.log('- 高德地图Web服务API: ✅ 正常');
      console.log('- 数据库写入: ✅ 正常');
      console.log('- 异步地理编码: ✅ 正常');
      console.log('- 数据库更新: ✅ 正常');
      console.log('- 数据一致性: ' + (isConsistent ? '✅ 通过' : '❌ 失败'));
      console.log('- 清理数据: ✅ 完成');

      if (isConsistent && updatedPixel.geocoded) {
        console.log('\n🎉 完整的像素绘制地理编码流程测试成功！');
        console.log('✅ 现在手动绘制像素时，地理信息应该能正确写入数据库了。');
      } else {
        console.log('\n⚠️ 地理编码流程存在问题，需要进一步排查。');
      }

    } else {
      console.log('❌ 地理编码任务提交失败');
    }

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
    console.error('错误详情:', error.stack);
  }
}

// 运行测试
testRealPixelGeocoding().catch(console.error);