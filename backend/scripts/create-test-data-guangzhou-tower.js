/**
 * 广州塔附近测试数据创建脚本
 *
 * 创建广州塔附近的QR宝藏和漂流瓶测试数据
 * 广州塔坐标：23.1097, 113.3245
 */

const { db } = require('../src/config/database');
const logger = require('../src/utils/logger');
const crypto = require('crypto');

// 广州塔中心坐标
const GUANGZHOU_TOWER = {
  lat: 23.1097,
  lng: 113.3245
};

// 生成随机偏移（约1-3公里范围内）
function randomOffset() {
  // 1度纬度约等于111公里，1度经度在这个纬度约等于102公里
  const latOffset = (Math.random() - 0.5) * 0.027; // ±1.5公里
  const lngOffset = (Math.random() - 0.5) * 0.029; // ±1.5公里
  return {
    lat: GUANGZHOU_TOWER.lat + latOffset,
    lng: GUANGZHOU_TOWER.lng + lngOffset
  };
}

// 生成随机QR内容
function generateQRContent(type) {
  const patterns = {
    mobile: [
      'meituan://bike/scan?bike_id=MB' + Math.random().toString(36).substr(2, 9),
      'hellobike://scan?code=HB' + Math.random().toString(36).substr(2, 9),
      'https://mobike.com/ride/bike/' + Math.random().toString(36).substr(2, 12)
    ],
    fixed: [
      'https://mp.weixin.qq.com/s/' + Math.random().toString(36).substr(2, 22),
      'https://www.amap.com/detail/' + Math.random().toString(36).substr(2, 15),
      'product://ean/690' + Math.random().toString().substr(2, 10)
    ]
  };

  const contents = patterns[type] || patterns.fixed;
  return contents[Math.floor(Math.random() * contents.length)];
}

// 哈希QR内容
function hashQRContent(qrContent) {
  return crypto.createHash('sha256').update(qrContent).digest('hex');
}

// 获取测试用户ID（从现有用户中选择）
async function getRandomUserId() {
  const users = await db('users').select('id').limit(10);
  if (users.length === 0) {
    throw new Error('没有找到用户，请先创建用户');
  }
  return users[Math.floor(Math.random() * users.length)].id;
}

// 创建QR宝藏数据
async function createQRTreasures() {
  console.log('🏗️ 开始创建QR宝藏测试数据...');

  const treasureTemplates = [
    {
      title: '广州塔观光券',
      description: '价值100元的广州塔观光体验券，可登塔欣赏广州全景',
      hint: '寻找游客服务中心附近的二维码标识',
      reward: 150,
      type: 'fixed'
    },
    {
      title: '珠江夜游船票',
      description: '珠江夜游船票一张，体验广州母亲河的璀璨夜景',
      hint: '在珠江边寻找游船售票点的二维码',
      reward: 200,
      type: 'fixed'
    },
    {
      title: '美团共享单车骑行券',
      description: '美团共享单车免费骑行券，畅游广州塔周边',
      hint: '寻找美团单车停车点，扫描车身二维码',
      reward: 50,
      type: 'mobile'
    },
    {
      title: '哈啰单车月卡',
      description: '哈啰单车30天骑行卡，绿色出行首选',
      hint: '寻找哈啰单车，扫描车把或车锁上的二维码',
      reward: 80,
      type: 'mobile'
    },
    {
      title: '广州博物馆门票',
      description: '广州博物馆免费参观券，了解广州历史文化',
      hint: '在博物馆入口处寻找展览介绍二维码',
      reward: 120,
      type: 'fixed'
    },
    {
      title: '腾讯视频会员',
      description: '腾讯视频7天会员权益，畅享海量影视内容',
      hint: '寻找附近商场的热点二维码',
      reward: 100,
      type: 'fixed'
    },
    {
      title: '滴滴出行优惠券',
      description: '滴滴出行10元优惠券，便捷出行',
      hint: '在滴滴车站寻找司机或车辆的二维码',
      reward: 60,
      type: 'mobile'
    },
    {
      title: '星巴克咖啡券',
      description: '星巴克中杯咖啡兑换券，品味生活',
      hint: '在星巴克门店寻找产品介绍的二维码',
      reward: 90,
      type: 'fixed'
    }
  ];

  const userId = await getRandomUserId();
  const createdTreasures = [];

  for (const template of treasureTemplates) {
    const location = randomOffset();
    const qrContent = generateQRContent(template.type);
    const qrHash = hashQRContent(qrContent);

    // 生成宝藏ID
    const treasureId = template.type === 'mobile'
      ? `treasure_m_${qrHash.substring(0, 20)}`
      : `treasure_f_${qrHash.substring(0, 20)}`;

    // 计算网格坐标（固定宝藏）
    const gridLat = template.type === 'fixed' ? Math.round(location.lat * 100) / 100 : null;
    const gridLng = template.type === 'fixed' ? Math.round(location.lng * 100) / 100 : null;

    // 设置过期时间（7天后）
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    try {
      const [treasure] = await db('qr_treasures').insert({
        treasure_id: treasureId,
        qr_code_hash: qrHash,
        qr_code_type: template.type === 'mobile' ? 'moving' : 'fixed',
        qr_pattern_type: 'qr_code',
        qr_preview: qrContent.substring(0, 50) + (qrContent.length > 50 ? '...' : ''),
        hide_lat: template.type === 'fixed' ? location.lat : null,
        hide_lng: template.type === 'fixed' ? location.lng : null,
        location_grid_lat: gridLat,
        location_grid_lng: gridLng,
        location_radius: template.type === 'fixed' ? 50 : null,
        city: '广州市',
        country: '中国',
        hider_id: userId,
        hider_name: '测试用户',
        title: template.title,
        description: template.description,
        hint: template.hint,
        reward_type: 'points',
        reward_value: JSON.stringify({ amount: template.reward }),
        image_url: null,
        expires_at: expiresAt,
        status: 'active',
        treasure_type: template.type,
        move_count: 0,
        first_hide_lat: template.type === 'fixed' ? location.lat : null,
        first_hide_lng: template.type === 'fixed' ? location.lng : null,
        qr_content: qrContent,
        hidden_at: new Date(),
        view_count: 0,
        attempt_count: 0
      }).returning('*');

      createdTreasures.push(treasure);
      console.log(`✅ 创建${template.type === 'mobile' ? '移动' : '固定'}宝藏: ${template.title} (${location.lat.toFixed(6)}, ${location.lng.toFixed(6)})`);

      // 为移动宝藏添加一些移动历史
      if (template.type === 'mobile' && Math.random() > 0.5) {
        const moveCount = Math.floor(Math.random() * 3) + 1;
        for (let i = 0; i < moveCount; i++) {
          const newLocation = randomOffset();
          await db('qr_treasures')
            .where({ treasure_id: treasureId })
            .update({
              hide_lat: newLocation.lat,
              hide_lng: newLocation.lng,
              move_count: i + 1
            });

          // 记录移动日志
          await db('qr_treasure_logs').insert({
            treasure_id: treasureId,
            user_id: userId,
            action: 'move',
            lat: newLocation.lat,
            lng: newLocation.lng,
            details: JSON.stringify({
              move_number: i + 1,
              location: { lat: newLocation.lat, lng: newLocation.lng }
            })
          });
        }
        console.log(`📱 移动宝藏已移动 ${moveCount} 次`);
      }

    } catch (error) {
      console.error(`❌ 创建宝藏失败: ${template.title}`, error.message);
    }
  }

  console.log(`🎉 成功创建 ${createdTreasures.length} 个QR宝藏测试数据`);
  return createdTreasures;
}

// 创建漂流瓶数据
async function createDriftBottles() {
  console.log('🍾 开始创建漂流瓶测试数据...');

  const bottleTemplates = [
    {
      message: '站在广州塔顶，俯瞰这座城市的繁华，每一盏灯火都是一个故事。愿你也能在人生的旅途中找到属于自己的那片光。',
      color: '#FF6B6B',
      creator_name: '浪漫的旅行者'
    },
    {
      message: '第一次来广州，被这里的美食深深吸引。从早茶到夜宵，每一口都是幸福的味道。希望你也能品尝到生活的甘甜。',
      color: '#4ECDC4',
      creator_name: '美食爱好者'
    },
    {
      message: '珠江的夜景真的太美了！游船缓缓行驶，两岸灯火辉煌，仿佛置身于星光之中。愿你的人生也能如此璀璨夺目。',
      color: '#45B7D1',
      creator_name: '夜游者'
    },
    {
      message: '广州是一个包容的城市，这里的人们热情友善。无论你来自哪里，都能找到归属感。愿你也能被这个世界温柔以待。',
      color: '#96CEB4',
      creator_name: '新广州人'
    },
    {
      message: '在广州塔许下的愿望，听说都会实现。我希望能遇见更多有趣的人，也祝愿看到这个瓶子的你心想事成！',
      color: '#FFEAA7',
      creator_name: '许愿者'
    },
    {
      message: '从北京来到广州工作，虽然离家很远，但这里的机遇让我成长了许多。坚持就是胜利，与所有在外打拼的朋友共勉！',
      color: '#DDA0DD',
      creator_name: '北漂青年'
    },
    {
      message: '雨后的广州格外清新，空气里弥漫着花香。生活中的美好往往就在这些不经意的瞬间，愿你也能发现身边的美好。',
      color: '#98D8C8',
      creator_name: '文艺青年'
    },
    {
      message: '广州塔下的广场上，看着孩子们嬉戏打闹，老人们悠闲散步。这就是生活最美好的样子，简单而快乐。',
      color: '#FFB6C1',
      creator_name: '观察者'
    }
  ];

  const userId = await getRandomUserId();
  const createdBottles = [];

  for (const template of bottleTemplates) {
    const location = randomOffset();
    const bottleId = `bottle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 计算流向（大致向东南方向流动）
    const flowLat = location.lat - (Math.random() * 0.002);
    const flowLng = location.lng + (Math.random() * 0.003);

    try {
      const [bottle] = await db('drift_bottles').insert({
        bottle_id: bottleId,
        owner_id: userId,
        original_owner_id: userId,
        title: template.creator_name.substring(0, 10) + '的瓶子',
        content: template.message,
        image_url: null,
        current_lat: location.lat,
        current_lng: location.lng,
        origin_lat: location.lat,
        origin_lng: location.lng,
        current_city: '广州市',
        current_country: '中国',
        origin_city: '广州市',
        origin_country: '中国',
        total_distance: 0,
        pickup_count: 0,
        message_count: Math.floor(Math.random() * 3), // 0-2条消息
        last_drift_time: new Date(),
        created_at: new Date(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30天后过期
        is_active: true
      }).returning('*');

      createdBottles.push(bottle);
      console.log(`✅ 创建漂流瓶: ${template.creator_name}的信息 (${location.lat.toFixed(6)}, ${location.lng.toFixed(6)})`);

      // 为部分瓶子添加回信消息
      if (bottle.message_count > 0) {
        for (let i = 0; i < bottle.message_count; i++) {
          const replyUserId = await getRandomUserId();
          const replies = [
            '你的话让我很感动，谢谢你的分享！',
            '美丽的文字，传递着温暖的力量。',
            '虽然不认识，但感觉我们是同类人。',
            '生活确实很美好，感谢你的提醒。'
          ];

          await db('drift_bottle_messages').insert({
            message_id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            bottle_id: bottleId,
            sender_id: replyUserId,
            sender_name: `路人${i + 1}`,
            message: replies[Math.floor(Math.random() * replies.length)],
            created_at: new Date()
          });
        }
      }

    } catch (error) {
      console.error(`❌ 创建漂流瓶失败: ${template.creator_name}`, error.message);
    }
  }

  console.log(`🎉 成功创建 ${createdBottles.length} 个漂流瓶测试数据`);
  return createdBottles;
}

// 主函数
async function main() {
  try {
    console.log('🚀 开始创建广州塔附近测试数据...');
    console.log(`📍 广州塔坐标: ${GUANGZHOU_TOWER.lat}, ${GUANGZHOU_TOWER.lng}`);

    // 检查数据库连接
    await db.raw('SELECT 1');
    console.log('✅ 数据库连接成功');

    // 创建QR宝藏
    const treasures = await createQRTreasures();

    // 创建漂流瓶
    const bottles = await createDriftBottles();

    console.log('\n📊 创建完成统计:');
    console.log(`🎯 QR宝藏: ${treasures.length} 个`);
    console.log(`🍾 漂流瓶: ${bottles.length} 个`);
    console.log(`📍 覆盖区域: 广州塔周围约3公里`);
    console.log('\n🎮 现在可以打开应用，前往广州塔附近测试功能了！');

    // 显示一些示例坐标
    if (treasures.length > 0) {
      console.log('\n🗺️ 部分宝藏坐标示例:');
      treasures.slice(0, 3).forEach((treasure, index) => {
        const type = treasure.treasure_type === 'mobile' ? '移动' : '固定';
        console.log(`${index + 1}. ${type}宝藏 "${treasure.title}": ${treasure.hide_lat || treasure.first_hide_lat}, ${treasure.hide_lng || treasure.first_hide_lng}`);
      });
    }

    if (bottles.length > 0) {
      console.log('\n🗺️ 部分漂流瓶坐标示例:');
      bottles.slice(0, 3).forEach((bottle, index) => {
        console.log(`${index + 1}. 漂流瓶: ${bottle.current_lat}, ${bottle.current_lng}`);
      });
    }

  } catch (error) {
    console.error('❌ 创建测试数据失败:', error);
    process.exit(1);
  } finally {
    await db.destroy();
    process.exit(0);
  }
}

// 运行脚本
main();