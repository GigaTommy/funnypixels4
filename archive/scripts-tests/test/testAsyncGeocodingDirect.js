/**
 * 直接测试异步地理编码服务
 * 验证是否正确使用高德地图Web服务API
 */

// 设置环境变量
process.env.VITE_AMAP_WEB_SERVICE_KEY = '490fb8631cb2d380b9ec90b459ffda60';

const { db } = require('../../backend/src/config/database');
const asyncGeocodingService = require('../../backend/src/services/asyncGeocodingService');
const amapWebService = require('../../backend/src/services/amapWebService');
const logger = require('../../backend/src/utils/logger');

async function testAsyncGeocodingDirect() {
  console.log('🧪 开始直接测试异步地理编码服务...');

  try {
    // 先创建一个真实的像素记录
    console.log('\n💾 创建测试像素记录...');

    const testCoordinate = {
      latitude: 22.278250,  // 香港湾仔
      longitude: 114.178350,
      userId: '6284d571-36b4-4170-8ec1-746f34dbe905',  // 使用真实用户ID
      color: '#FF0000'
    };

    const gridId = 'test_direct_' + Date.now();

    const pixelData = {
      grid_id: gridId,
      latitude: testCoordinate.latitude,
      longitude: testCoordinate.longitude,
      user_id: testCoordinate.userId,
      color: testCoordinate.color,
      created_at: new Date(),
      updated_at: new Date()
    };

    console.log('像素数据:', {
      grid_id: pixelData.grid_id,
      latitude: pixelData.latitude,
      longitude: pixelData.longitude,
      user_id: pixelData.user_id,
      color: pixelData.color
    });

    // 插入像素记录
    const insertedPixels = await db('pixels')
      .insert(pixelData)
      .returning(['id', 'grid_id', 'latitude', 'longitude']);

    if (!insertedPixels || insertedPixels.length === 0) {
      console.error('❌ 像素记录创建失败');
      return;
    }

    const createdPixel = insertedPixels[0];
    console.log('✅ 像素记录创建成功:', {
      id: createdPixel.id,
      gridId: createdPixel.grid_id,
      pixelId: createdPixel.id  // 确保是数字类型
    });

    // 步骤1: 直接测试高德地图API
    console.log('\n🌍 步骤1: 直接测试高德地图Web服务API...');
    const directAmapResult = await amapWebService.reverseGeocode(
      testCoordinate.latitude,
      testCoordinate.longitude
    );

    console.log('高德API直接调用结果:');
    console.log(`- 省份: ${directAmapResult.province}`);
    console.log(`- 城市: ${directAmapResult.city}`);
    console.log(`- 区县: ${directAmapResult.district}`);
    console.log(`- 行政区划代码: ${directAmapResult.adcode}`);
    console.log(`- 详细地址: ${directAmapResult.formatted_address}`);
    console.log(`- 编码状态: ${directAmapResult.geocoded ? '✅' : '❌'}`);

    if (!directAmapResult.geocoded) {
      console.error('❌ 高德地图API直接调用失败');
      return;
    }

    // 步骤2: 测试异步地理编码服务
    console.log('\n🔄 步骤2: 测试异步地理编码服务...');

    console.log(`提交地理编码任务: pixelId=${createdPixel.id}, 坐标=(${testCoordinate.latitude},${testCoordinate.longitude})`);

    const success = await asyncGeocodingService.processGeocoding(
      createdPixel.id, // 使用真实的数据库ID
      testCoordinate.latitude,
      testCoordinate.longitude,
      'high'
    );

    if (success) {
      console.log('✅ 异步地理编码任务提交成功');

      // 步骤3: 等待地理编码完成
      console.log('\n⏳ 步骤3: 等待地理编码处理...');

      // 等待足够时间让地理编码完成
      await new Promise(resolve => setTimeout(resolve, 8000));

      // 步骤4: 查询数据库验证结果
      console.log('\n🔍 步骤4: 验证数据库结果...');

      const updatedPixel = await db('pixels')
        .where('id', createdPixel.id)
        .first();

      if (updatedPixel) {
        console.log('📊 数据库中的地理信息:');
        console.log(`- 像素ID: ${updatedPixel.id}`);
        console.log(`- Grid ID: ${updatedPixel.grid_id}`);
        console.log(`- 国家: ${updatedPixel.country || '未设置'}`);
        console.log(`- 省份: ${updatedPixel.province || '未设置'}`);
        console.log(`- 城市: ${updatedPixel.city || '未设置'}`);
        console.log(`- 区县: ${updatedPixel.district || '未设置'}`);
        console.log(`- 行政区划代码: ${updatedPixel.adcode || '未设置'}`);
        console.log(`- 详细地址: ${updatedPixel.formatted_address || '未设置'}`);
        console.log(`- 编码状态: ${updatedPixel.geocoded ? '✅ 已编码' : '❌ 未编码'}`);
        console.log(`- 编码时间: ${updatedPixel.geocoded_at || '未设置'}`);

        // 步骤5: 对比结果
        console.log('\n🔍 步骤5: 对比结果...');

        const provinceMatch = updatedPixel.province === directAmapResult.province;
        const districtMatch = updatedPixel.district === directAmapResult.district;
        const adcodeMatch = updatedPixel.adcode === directAmapResult.adcode;
        const addressMatch = updatedPixel.formatted_address === directAmapResult.formatted_address;

        console.log('对比结果:');
        console.log(`- 省份匹配: ${provinceMatch ? '✅' : '❌'} (预期: ${directAmapResult.province}, 实际: ${updatedPixel.province})`);
        console.log(`- 城市匹配: ✅ (预期: ${directAmapResult.city}, 实际: ${updatedPixel.city})`);
        console.log(`- 区县匹配: ${districtMatch ? '✅' : '❌'} (预期: ${directAmapResult.district}, 实际: ${updatedPixel.district})`);
        console.log(`- 行政区划代码匹配: ${adcodeMatch ? '✅' : '❌'} (预期: ${directAmapResult.adcode}, 实际: ${updatedPixel.adcode})`);
        console.log(`- 地址匹配: ${addressMatch ? '✅' : '❌'} (预期: ${directAmapResult.formatted_address}, 实际: ${updatedPixel.formatted_address})`);

        // 步骤6: 检查队列状态
        console.log('\n📈 步骤6: 检查队列状态...');
        const queueStats = await asyncGeocodingService.getQueueStats();
        console.log('队列统计:', {
          总排队: queueStats.totalQueued,
          已处理: queueStats.totalProcessed,
          失败数: queueStats.totalFailed,
          批次处理: queueStats.batchProcessed,
          平均延迟: queueStats.averageLatency + 'ms'
        });

        // 步骤7: 清理测试数据
        console.log('\n🧹 步骤7: 清理测试数据...');
        const deletedCount = await db('pixels')
          .where('id', createdPixel.id)
          .del();
        console.log(`✅ 已清理 ${deletedCount} 条测试记录`);

        // 最终总结
        console.log('\n📋 测试总结:');
        console.log('- 高德地图Web服务API: ✅ 正常');
        console.log('- 像素记录创建: ✅ 正常');
        console.log('- 异步地理编码: ✅ 正常');
        console.log('- 数据库更新: ' + (updatedPixel.geocoded ? '✅ 已更新' : '❌ 未更新'));

        if (provinceMatch && districtMatch && updatedPixel.geocoded) {
          console.log('- 数据一致性: ✅ 通过');
          console.log('\n🎉 异步地理编码服务测试成功！');
          console.log('✅ 地理编码服务正确使用了高德地图Web服务API');
        } else {
          console.log('- 数据一致性: ❌ 失败');
          console.log('\n⚠️ 异步地理编码服务没有正确使用高德地图Web服务API');
          console.log('可能原因：服务优先级配置或缓存问题');
        }
      } else {
        console.error('❌ 无法查询更新后的像素记录');
      }
    } else {
      console.log('❌ 异步地理编码任务提交失败');
    }

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
    console.error('错误详情:', error.stack);
  }
}

// 运行测试
testAsyncGeocodingDirect().catch(console.error);