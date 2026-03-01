const { db } = require('../config/database');
const UserPoints = require('./UserPoints');
const pixelsHistoryService = require('../services/pixelsHistoryService');
const logger = require('../utils/logger');
const productRouter = require('../services/productRouterService');
const productionMVTService = require('../services/productionMVTService');
const amapWebService = require('../services/amapWebService');

class Store {
  static tableName = 'store_items';

  // 获取所有商品（使用ProductRouterService）
  static async getAllItems(active = true) {
    return await productRouter.getAllItems(active);
  }

  // 根据类型获取商品（使用ProductRouterService）
  static async getItemsByType(type) {
    return await productRouter.getItemsByType(type, true);
  }

  // 根据ID获取商品（使用ProductRouterService）
  static async getItemById(id) {
    return await productRouter.getItem(id);
  }

  // 使用积分购买商品
  static async purchaseWithPoints(userId, itemId, quantity = 1, additionalData = {}) {
    return await db.transaction(async (trx) => {
      // 使用ProductRouterService确定商品类型
      const itemIdStr = String(itemId);
      const productType = productRouter.getProductType(itemIdStr);

      let item;
      // 提取去掉前缀后的原始ID（用于数据库查询）
      let rawId;

      switch (productType) {
        case 'ad': {
          // ad_products.id 是 UUID 类型，不能用 parseInt，直接去掉前缀
          rawId = itemIdStr.replace(/^ad_/, '');
          const adProductId = rawId;
          const product = await trx('ad_products')
            .where('id', adProductId)
            .where('active', true)
            .first();

          if (!product) {
            throw new Error('广告商品不存在或已下架');
          }

          item = {
            id: itemIdStr,
            name: product.name,
            description: product.description,
            price_points: product.price,
            item_type: 'advertisement',
            ad_product_id: product.id,
            size_type: product.size_type,
            width: product.width,
            height: product.height,
            active: product.active
          };
          break;
        }

        case 'flag': {
          // shop_skus.id 可能是 UUID，直接去掉前缀
          rawId = itemIdStr.replace(/^(custom_flag_|flag_)/, '');
          const flagSkuId = rawId;
          const sku = await trx('shop_skus')
            .where('id', flagSkuId)
            .where('active', true)
            .first();

          if (!sku) {
            throw new Error('自定义旗帜商品不存在或已下架');
          }

          item = {
            id: itemIdStr,
            name: sku.name,
            description: sku.description,
            price_points: sku.price,
            item_type: 'custom_flag',
            sku_id: sku.id,
            pattern_id: sku.pattern_id,
            currency: sku.currency || 'points',
            active: sku.active,
            metadata: sku.metadata
          };
          break;
        }

        default: {
          // 普通商品（store_items.id 是整数，用 extractNumericId）
          rawId = productRouter.extractNumericId(itemIdStr);
          item = await trx(this.tableName)
            .where('id', rawId)
            .where('active', true)
            .first();

          if (!item) {
            throw new Error('商品不存在或已下架');
          }
        }
      }

      const totalPrice = item.price_points * quantity;

      // 检查用户积分是否足够并扣除积分
      const userPoints = await UserPoints.deductPoints(userId, totalPrice, '购买商品', itemId, trx);

      // 处理不同类型的商品
      if (item.item_type === 'advertisement') {
        // 广告商品：创建订单
        const { adTitle, adDescription, imageData, imageUrl, targetLocation, scheduledTime } = additionalData;

        if (!adTitle || (!imageData && !imageUrl)) {
          throw new Error('广告商品需要提供标题和图片(或URL)');
        }

        // Parse targetLocation if string (iOS sends JSON string for JSONB column)
        let parsedTargetLocation = targetLocation;
        if (typeof targetLocation === 'string' && targetLocation.trim()) {
          try {
            parsedTargetLocation = JSON.parse(targetLocation);
          } catch (e) {
            console.warn('⚠️ targetLocation parse failed:', e.message);
            parsedTargetLocation = null;
          }
        }

        console.log(`📍 [ad-purchase] targetLocation input:`, typeof targetLocation, targetLocation);
        console.log(`📍 [ad-purchase] parsed for DB:`, typeof parsedTargetLocation, parsedTargetLocation);

        const [order] = await trx('ad_orders').insert({
          user_id: userId,
          ad_product_id: item.ad_product_id,
          ad_title: adTitle,
          ad_description: adDescription,
          original_image_url: imageUrl || imageData,
          target_location: parsedTargetLocation || null,
          scheduled_time: scheduledTime,
          status: 'pending',
          price: totalPrice
        }).returning('*');

        console.log(`📍 [ad-purchase] Stored order ${order.id}, target_location in DB:`, order.target_location, `type:`, typeof order.target_location);

        return {
          item: item,
          quantity: quantity,
          totalPrice: totalPrice,
          remainingPoints: userPoints.total_points,
          order: order,
          isAdOrder: true
        };
      } else if (item.item_type === 'custom_flag') {
        // 自定义旗帜商品：创建自定义旗帜订单
        const { adTitle, adDescription, imageData, imageUrl } = additionalData;

        if (!adTitle || (!imageData && !imageUrl)) {
          throw new Error('自定义旗帜商品需要提供标题和图片(或URL)');
        }

        const [order] = await trx('custom_flag_orders').insert({
          user_id: userId,
          pattern_name: adTitle,
          pattern_description: adDescription,
          original_image_url: imageUrl || imageData,
          status: 'pending',
          price: totalPrice
        }).returning('*');

        return {
          item: item,
          quantity: quantity,
          totalPrice: totalPrice,
          remainingPoints: userPoints.total_points,
          order: order,
          isCustomFlagOrder: true
        };
      } else {
        // 普通商品：添加到库存
        const existingInventory = await trx('user_inventory')
          .where({
            user_id: userId,
            item_id: rawId
          })
          .first();

        if (existingInventory) {
          await trx('user_inventory')
            .where({
              user_id: userId,
              item_id: rawId
            })
            .increment('quantity', quantity);
        } else {
          await trx('user_inventory').insert({
            user_id: userId,
            item_id: rawId,
            quantity: quantity,
            consumed: false
          });
        }
      }

      return {
        item: item,
        quantity: quantity,
        totalPrice: totalPrice,
        remainingPoints: userPoints.total_points,
        isAdOrder: false
      };
    });
  }

  // 获取用户库存
  static async getUserInventory(userId) {
    // 获取普通商品库存
    const regularInventory = await db('user_inventory')
      .join('store_items', 'user_inventory.item_id', 'store_items.id')
      .where('user_inventory.user_id', userId)
      .where('user_inventory.quantity', '>', 0)
      .select(
        'user_inventory.id',
        'user_inventory.quantity',
        'user_inventory.acquired_at',
        'user_inventory.consumed',
        'store_items.id as item_id',
        'store_items.name',
        'store_items.description',
        'store_items.item_type',
        'store_items.metadata',
        'store_items.price_points'
      )
      .orderBy('store_items.item_type', 'asc')
      .orderBy('store_items.name', 'asc');

    // 获取广告库存
    const adInventory = await db('user_ad_inventory')
      .join('ad_products', 'user_ad_inventory.ad_product_id', 'ad_products.id')
      .where('user_ad_inventory.user_id', userId)
      .where('user_ad_inventory.is_used', false)
      .select(
        'user_ad_inventory.id',
        'user_ad_inventory.ad_title as name',
        'user_ad_inventory.ad_title as description',
        'user_ad_inventory.created_at as acquired_at',
        'user_ad_inventory.is_used as consumed',
        'user_ad_inventory.ad_product_id as item_id',
        'ad_products.name as ad_product_name',
        'ad_products.width',
        'ad_products.height',
        'ad_products.price as price_points',
        'user_ad_inventory.processed_image_data'
      )
      .orderBy('user_ad_inventory.created_at', 'desc');

    // 转换广告库存格式以匹配普通库存格式
    const formattedAdInventory = adInventory.map(ad => ({
      id: ad.id,
      quantity: 1, // 每个广告库存记录数量为1
      acquired_at: ad.acquired_at,
      consumed: ad.consumed,
      item_id: ad.item_id,
      name: ad.name || ad.ad_product_name,
      description: ad.description || `广告尺寸: ${ad.width}x${ad.height}`,
      item_type: 'advertisement',
      metadata: {
        width: ad.width,
        height: ad.height,
        processed_image_data: ad.processed_image_data
      },
      price_points: ad.price_points
    }));

    // 合并两种库存
    const allInventory = [...regularInventory, ...formattedAdInventory];

    // 按类型和名称排序
    return allInventory.sort((a, b) => {
      if (a.item_type !== b.item_type) {
        return a.item_type.localeCompare(b.item_type);
      }
      return a.name.localeCompare(b.name);
    });
  }

  // 使用道具
  static async useItem(userId, itemId, quantity = 1, targetId = null) {
    console.log(`🔍 使用道具请求: userId=${userId}, itemId=${itemId}, quantity=${quantity}, targetId=${targetId}`);

    // 检查是否为广告或旗帜商品（需要走专门的使用流程）
    const itemIdStr = String(itemId);
    const productType = productRouter.getProductType(itemIdStr);

    if (productType === 'ad') {
      throw new Error('广告道具请在地图上选择位置后使用');
    }
    if (productType === 'flag') {
      throw new Error('自定义旗帜请在地图上选择位置后使用');
    }

    // 普通商品使用流程
    const numericId = productRouter.extractNumericId(itemIdStr);

    return await db.transaction(async (trx) => {
      // 检查库存
      const inventory = await trx('user_inventory')
        .where({
          user_id: userId,
          item_id: numericId
        })
        .first();

      console.log('🔍 库存检查结果:', inventory);

      if (!inventory || inventory.quantity < quantity) {
        logger.error('道具数量不足', { required: quantity, owned: inventory?.quantity || 0, itemId });
        throw new Error('道具数量不足');
      }

      // 获取道具信息
      const item = await trx('store_items')
        .where('id', numericId)
        .first();

      console.log('🔍 道具信息:', item);

      if (!item) {
        logger.error('道具不存在', { itemId });
        throw new Error('道具不存在');
      }

      // 检查冷却时间（仅对炸弹类道具）- 使用统一冷却时间服务
      if (item.metadata?.cooldown_minutes && item.metadata?.bomb_type) {
        const BombCooldownService = require('../services/bombCooldownService');
        const validation = await BombCooldownService.validateBombUsage(userId, item.metadata.bomb_type);

        if (!validation.canUse) {
          console.log(`🔍 炸弹冷却时间检查: 道具=${item.name}, ${validation.error}`);
          throw new Error(validation.error);
        }
      }

      // 减少库存
      await trx('user_inventory')
        .where({
          user_id: userId,
          item_id: numericId
        })
        .update({
          quantity: trx.raw('quantity - ?', [quantity])
        });

      // 如果库存为0，标记为已消费
      const remainingQuantity = inventory.quantity - quantity;
      if (remainingQuantity <= 0) {
        await trx('user_inventory')
          .where({
            user_id: userId,
            item_id: numericId
          })
          .update({ consumed: true });
      }

      // 根据道具类型执行不同效果
      const effects = await this.executeItemEffects(trx, userId, item, quantity, targetId);

      // 如果是炸弹类道具，设置统一冷却时间
      if (item.metadata?.cooldown_minutes && item.metadata?.bomb_type) {
        const BombCooldownService = require('../services/bombCooldownService');
        await BombCooldownService.setCooldown(userId, item.metadata.cooldown_minutes, item.metadata.bomb_type);
      }

      // 如果是炸弹类道具且有目标坐标，清理MVT瓦片缓存使像素立即可见
      if (item.metadata?.bomb_type && targetId) {
        const [rawLat, rawLng] = targetId.split(',').map(Number);
        // iOS BombLocationPickerView uses Apple MapKit which returns GCJ-02 coordinates in China
        // Convert to WGS-84 to match the main MapLibre map coordinate system
        const wgs84 = amapWebService.gcj02ToWgs84(rawLat, rawLng);
        const cacheLat = wgs84.lat;
        const cacheLng = wgs84.lng;
        if (Number.isFinite(cacheLat) && Number.isFinite(cacheLng)) {
          productionMVTService.invalidatePixelTiles(cacheLat, cacheLng).catch(error => {
            logger.error('清理炸弹区域MVT瓦片缓存失败（非阻塞）:', error);
          });
        }
      }

      return {
        effects: effects,
        remainingQuantity: Math.max(0, remainingQuantity)
      };
    });
  }

  // 执行道具效果
  static async executeItemEffects(trx, userId, item, quantity, targetId) {
    console.log(`🔍 执行道具效果: itemType=${item.item_type}, itemName=${item.name}, targetId=${targetId}`);
    const effects = {};

    switch (item.item_type) {
      case 'pixel_boost':
      case 'consumable':
        // 恢复像素点数 - 支持pixel_boost和consumable类型

        // 1. Calculate boost amount
        let boostAmount = 16; // Default

        if (item.metadata?.boost_amount) {
          boostAmount = item.metadata.boost_amount;
        } else if (item.name === '超级恢复剂') {
          boostAmount = 32;
        } else if (item.name === '快速恢复剂') {
          boostAmount = 16;
        } else if (item.name === '无限恢复剂') {
          boostAmount = 64;
        }

        boostAmount *= quantity;

        const userPixelState = await trx('user_pixel_states')
          .where('user_id', userId)
          .first();

        if (userPixelState) {
          // 只增加道具恢复的像素点数，不影响自然累计
          await trx('user_pixel_states')
            .where('user_id', userId)
            .increment('item_pixel_points', boostAmount);

          // 同时更新总像素点数（道具点数 + 自然累计点数）
          await trx('user_pixel_states')
            .where('user_id', userId)
            .update({
              pixel_points: userPixelState.item_pixel_points + boostAmount + userPixelState.natural_pixel_points
            });

          effects.pixelPointsRestored = boostAmount;
          effects.message = `成功恢复 ${boostAmount} 个像素点数（道具恢复）`;
          effects.totalPixelPoints = userPixelState.item_pixel_points + boostAmount + userPixelState.natural_pixel_points;
          effects.itemPixelPoints = userPixelState.item_pixel_points + boostAmount;
          effects.naturalPixelPoints = userPixelState.natural_pixel_points;
        } else {
          // 如果用户没有像素状态记录，创建一个
          // Use calculated boostAmount instead of hardcoded 16
          await trx('user_pixel_states').insert({
            user_id: userId,
            pixel_points: boostAmount + 64, // 道具点数 + 默认自然累计点数
            item_pixel_points: boostAmount,
            natural_pixel_points: 64,
            max_natural_pixel_points: 64,
            last_accum_time: Math.floor(Date.now() / 1000)
          });
          effects.pixelPointsRestored = boostAmount;
          effects.message = `成功恢复 ${boostAmount} 个像素点数（道具恢复）`;
          effects.totalPixelPoints = boostAmount + 64;
          effects.itemPixelPoints = boostAmount;
          effects.naturalPixelPoints = 64;
        }
        break;

      case 'pattern':
        // 图案道具，用于联盟旗帜
        effects.patternUnlocked = true;
        effects.patternId = item.metadata?.pattern_id;
        break;

      case 'frame':
        // 头像框道具
        effects.frameUnlocked = true;
        effects.frameId = item.metadata?.frame_id;
        break;

      case 'special':
        // 特殊道具，包括颜色炸弹等
        console.log(`🔍 处理特殊道具: name=${item.name}, metadata=`, item.metadata);

        if (item.name.includes('炸弹') || item.metadata?.bomb_type) {
          // 炸弹道具，用于区域染色
          console.log(`💣 检测到炸弹道具: name=${item.name}, bombType=${item.metadata?.bomb_type}`);
          effects.bombUsed = true;
          effects.targetArea = targetId;

          // 根据炸弹类型执行不同的效果
          const bombType = item.metadata?.bomb_type || 'color_bomb'; // 默认颜色炸弹
          const areaSize = item.metadata?.area_size || 6;

          console.log(`💣 炸弹参数: bombType=${bombType}, areaSize=${areaSize}, targetId=${targetId}`);

          if (targetId) {
            // 解析目标区域坐标（使用经纬度格式）
            console.log(`💣 解析目标坐标: targetId=${targetId}`);
            const [rawLat, rawLng] = targetId.split(',').map(Number);
            // iOS BombLocationPickerView uses Apple MapKit which returns GCJ-02 coordinates in China
            // Convert to WGS-84 to match the main MapLibre map (OpenFreeMap) coordinate system
            const wgs84Coords = amapWebService.gcj02ToWgs84(rawLat, rawLng);
            const lat = wgs84Coords.lat;
            const lng = wgs84Coords.lng;
            console.log(`💣 解析结果: rawLat=${rawLat}, rawLng=${rawLng} -> WGS84: lat=${lat}, lng=${lng}`);

            switch (bombType) {
              case 'color_bomb':
                // 颜色炸弹：将区域染成随机颜色
                // 从pattern_assets中随机选择一个颜色
                const colorPatterns = await trx('pattern_assets')
                  .whereNotNull('color')
                  .where('color', '!=', '')
                  .select('id', 'key', 'color', 'name');

                if (colorPatterns.length === 0) {
                  // 如果没有找到颜色图案，使用预定义的基础颜色
                  const fallbackColors = [
                    { id: 'fallback_red', color: '#FF0000', name: '红色' },
                    { id: 'fallback_blue', color: '#0000FF', name: '蓝色' },
                    { id: 'fallback_green', color: '#00FF00', name: '绿色' },
                    { id: 'fallback_yellow', color: '#FFFF00', name: '黄色' },
                    { id: 'fallback_purple', color: '#800080', name: '紫色' },
                    { id: 'fallback_orange', color: '#FFA500', name: '橙色' }
                  ];
                  console.log('⚠️ 数据库中没有颜色图案，使用备用颜色');
                  const randomPattern = fallbackColors[Math.floor(Math.random() * fallbackColors.length)];
                  await this.applyColorBomb(trx, userId, lat, lng, areaSize, randomPattern.color, randomPattern.key || randomPattern.id);
                  effects.bombType = 'color_bomb';
                  effects.areaSize = areaSize;
                  effects.centerLat = lat;
                  effects.centerLng = lng;
                  effects.color = randomPattern.color;
                  effects.patternId = randomPattern.key || randomPattern.id;
                  return effects;
                }

                // 随机选择一个颜色
                const randomPattern = colorPatterns[Math.floor(Math.random() * colorPatterns.length)];
                const randomColor = randomPattern.color;

                await this.applyColorBomb(trx, userId, lat, lng, areaSize, randomColor, randomPattern.key);
                effects.bombType = 'color_bomb';
                effects.areaSize = areaSize;
                effects.centerLat = lat;
                effects.centerLng = lng;
                effects.randomColor = randomColor;
                effects.patternId = randomPattern.key;
                effects.message = `颜色炸弹使用成功！已将 ${areaSize}x${areaSize} 区域染成随机颜色 ${randomColor}`;
                break;

              case 'emoji_bomb':
                // Emoji炸弹：随机选择emoji表情
                const emojiPatterns = await trx('pattern_assets')
                  .where('render_type', 'emoji')
                  .whereNotNull('unicode_char')
                  .select('id', 'name', 'key', 'unicode_char');

                if (emojiPatterns.length === 0) {
                  // 如果没有找到emoji图案，使用预定义的基础emoji
                  const fallbackEmojis = [
                    { id: 'fallback_smile', key: 'fallback_smile', name: '笑脸', unicode_char: '😊', color: '#FFD700' },
                    { id: 'fallback_heart', key: 'fallback_heart', name: '爱心', unicode_char: '❤️', color: '#FF4444' },
                    { id: 'fallback_star', key: 'fallback_star', name: '星星', unicode_char: '⭐', color: '#FFD700' },
                    { id: 'fallback_fire', key: 'fallback_fire', name: '火焰', unicode_char: '🔥', color: '#FF6600' },
                    { id: 'fallback_thumbs', key: 'fallback_thumbs', name: '点赞', unicode_char: '👍', color: '#4488FF' },
                    { id: 'fallback_rocket', key: 'fallback_rocket', name: '火箭', unicode_char: '🚀', color: '#FF4500' }
                  ];
                  console.log('⚠️ 数据库中没有Emoji图案，使用备用Emoji');
                  const randomEmoji = fallbackEmojis[Math.floor(Math.random() * fallbackEmojis.length)];
                  await this.applyEmojiBomb(trx, userId, lat, lng, areaSize, randomEmoji.key, randomEmoji.color);
                  effects.bombType = 'emoji_bomb';
                  effects.areaSize = areaSize;
                  effects.centerLat = lat;
                  effects.centerLng = lng;
                  effects.patternId = randomEmoji.key;
                  effects.emojiName = randomEmoji.name;
                  effects.unicodeChar = randomEmoji.unicode_char;
                  effects.message = `Emoji炸弹使用成功！已将 ${areaSize}x${areaSize} 区域染成随机Emoji ${randomEmoji.unicode_char}`;
                  return effects;
                }

                // 随机选择一个Emoji
                const randomEmoji = emojiPatterns[Math.floor(Math.random() * emojiPatterns.length)];

                await this.applyEmojiBomb(trx, userId, lat, lng, areaSize, randomEmoji.key);
                effects.bombType = 'emoji_bomb';
                effects.areaSize = areaSize;
                effects.centerLat = lat;
                effects.centerLng = lng;
                effects.patternId = randomEmoji.key;
                effects.emojiName = randomEmoji.name;
                effects.unicodeChar = randomEmoji.unicode_char;
                effects.message = `Emoji炸弹使用成功！已将 ${areaSize}x${areaSize} 区域染成随机表情 ${randomEmoji.unicode_char}`;
                break;

              case 'alliance_bomb':
                // 联盟炸弹：使用用户所属联盟的旗帜图案
                const userAlliance = await trx('alliance_members')
                  .join('alliances', 'alliance_members.alliance_id', 'alliances.id')
                  .where('alliance_members.user_id', userId)
                  .select('alliances.id as alliance_id', 'alliances.name as alliance_name', 'alliances.flag_pattern_id')
                  .first();

                if (!userAlliance || !userAlliance.flag_pattern_id) {
                  throw new Error('您还没有加入联盟或联盟没有设置旗帜图案');
                }

                await this.applyAllianceBomb(trx, userId, lat, lng, areaSize, userAlliance.flag_pattern_id, userAlliance.alliance_id);
                effects.bombType = 'alliance_bomb';
                effects.areaSize = areaSize;
                effects.centerLat = lat;
                effects.centerLng = lng;
                effects.patternId = userAlliance.flag_pattern_id;
                effects.allianceId = userAlliance.alliance_id;
                effects.allianceName = userAlliance.alliance_name;
                effects.message = `联盟炸弹使用成功！已将 ${areaSize}x${areaSize} 区域染成联盟旗帜`;
                break;

              case 'pattern_bomb':
                // 图案炸弹：应用指定图案
                await this.applyPatternBomb(trx, userId, lat, lng, areaSize, item.metadata?.pattern_id);
                effects.bombType = 'pattern_bomb';
                effects.areaSize = areaSize;
                effects.centerLat = lat;
                effects.centerLng = lng;
                break;

              case 'clear_bomb':
                // 清除炸弹：清除区域所有像素
                await this.applyClearBomb(trx, userId, lat, lng, areaSize);
                effects.bombType = 'clear_bomb';
                effects.areaSize = areaSize;
                effects.centerLat = lat;
                effects.centerLng = lng;
                break;

              default:
                effects.message = '炸弹使用成功';
            }
          } else {
            effects.message = '炸弹使用失败：缺少目标位置';
          }
        } else {
          effects.message = '特殊道具使用成功';
        }
        break;

      case 'ad':
        // 广告投放额度
        effects.adCreditsAdded = quantity;
        // 添加到用户广告额度
        await this.addAdCredits(trx, userId, quantity);
        break;

      default:
        effects.message = '道具使用成功';
    }

    return effects;
  }

  // 应用颜色炸弹效果
  static async applyColorBomb(trx, userId, centerLat, centerLng, areaSize, color, patternId) {
    console.log(`💣 颜色炸弹效果: 中心(${centerLat}, ${centerLng}), 范围${areaSize}x${areaSize}, 颜色${color}`);

    // 计算每个像素的间距（以经纬度为单位）
    // 1度约等于111km，所以0.0001度约等于11.1m
    // 对于6x6区域，我们使用0.0001度作为每个像素的间距
    const pixelSpacing = 0.0001; // 每个像素约11.1米间距

    // 计算起始位置（左上角）
    const startLat = centerLat + (areaSize / 2 - 0.5) * pixelSpacing;
    const startLng = centerLng - (areaSize / 2 - 0.5) * pixelSpacing;

    const pixelsToInsert = [];

    // 创建6x6=36个像素点
    for (let row = 0; row < areaSize; row++) {
      for (let col = 0; col < areaSize; col++) {
        const pixelLat = startLat - row * pixelSpacing;
        const pixelLng = startLng + col * pixelSpacing;

        pixelsToInsert.push({
          latitude: pixelLat,
          longitude: pixelLng,
          userId: userId,
          color: color,
          patternId: patternId,
          pixelType: 'bomb', // 炸弹像素类型
          relatedId: null, // 炸弹暂时没有关联ID
          drawType: 'color_bomb'
        });
      }
    }

    console.log(`💣 颜色炸弹准备创建 ${pixelsToInsert.length} 个像素点`);

    // 使用PixelBatchService进行批量绘制
    if (pixelsToInsert.length > 0) {
      try {
        const PixelBatchService = require('../services/pixelBatchService');
        const result = await PixelBatchService.batchDrawPixels(pixelsToInsert, {
          drawType: 'color_bomb',
          skipUserValidation: true, // 炸弹不需要用户验证
          skipPointConsumption: true // 炸弹不需要消耗点数
        });

        console.log(`💣 颜色炸弹处理完成: 成功${result.successCount}个, 失败${result.failureCount}个`);

        return { color, pixelCount: result.successCount };
      } catch (error) {
        logger.error('颜色炸弹处理像素失败', { error: error.message, userId });
        throw error;
      }
    }

    return { color, pixelCount: 0 };
  }

  // 计算网格ID的辅助方法
  static calculateGridId(lat, lng) {
    // 使用与前端完全一致的网格计算逻辑
    const GRID_SIZE = 0.0001; // 与前端GRID_CONFIG.GRID_SIZE一致
    const gridX = Math.floor((lng + 180) / GRID_SIZE);
    const gridY = Math.floor((lat + 90) / GRID_SIZE);
    return `grid_${gridX}_${gridY}`;
  }

  // 从gridId解析经纬度坐标
  static parseGridId(gridId) {
    try {
      const match = gridId.match(/grid_(-?\d+)_(-?\d+)/);
      if (!match) {
        throw new Error('无效的gridId格式');
      }

      const gridX = parseInt(match[1]);
      const gridY = parseInt(match[2]);
      const GRID_SIZE = 0.0001; // 与前端GRID_CONFIG.GRID_SIZE一致

      // 计算网格中心坐标
      const lng = (gridX * GRID_SIZE) - 180 + (GRID_SIZE / 2);
      const lat = (gridY * GRID_SIZE) - 90 + (GRID_SIZE / 2);

      return { lat, lng };
    } catch (error) {
      logger.error('解析gridId失败', { gridId, error: error.message });
      throw new Error('无效的gridId格式');
    }
  }

  // 应用图案炸弹效果
  static async applyPatternBomb(trx, userId, centerLat, centerLng, areaSize, patternId) {
    // 这里需要根据patternId获取图案数据并应用
    // 暂时使用默认颜色
    await this.applyColorBomb(trx, userId, centerLat, centerLng, areaSize);
  }

  // 应用清除炸弹效果
  static async applyClearBomb(trx, userId, centerLat, centerLng, areaSize) {
    // 计算影响范围（以经纬度为单位）
    const latRadius = (areaSize / 2) * 0.0005;
    const lngRadius = (areaSize / 2) * 0.0005;

    const minLat = centerLat - latRadius;
    const maxLat = centerLat + latRadius;
    const minLng = centerLng - lngRadius;
    const maxLng = centerLng + lngRadius;

    console.log(`💣 清除炸弹效果: 中心(${centerLat}, ${centerLng}), 范围${areaSize}x${areaSize}`);

    // 清除区域内的所有像素
    const deletedPixels = await trx('pixels')
      .where('latitude', '>=', minLat)
      .where('latitude', '<=', maxLat)
      .where('longitude', '>=', minLng)
      .where('longitude', '<=', maxLng)
      .del();

    console.log(`💣 清除炸弹删除了 ${deletedPixels} 个像素`);
  }


  // 添加广告额度
  static async addAdCredits(trx, userId, quantity) {
    // 检查用户是否已有广告额度记录
    const existingCredits = await trx('user_ad_credits')
      .where('user_id', userId)
      .first();

    if (existingCredits) {
      await trx('user_ad_credits')
        .where('user_id', userId)
        .increment('credits', quantity);
    } else {
      await trx('user_ad_credits').insert({
        user_id: userId,
        credits: quantity,
        created_at: new Date()
      });
    }
  }

  // 获取用户积分
  static async getUserPoints(userId) {
    const userPoints = await UserPoints.getUserPoints(userId);
    return userPoints.total_points;
  }

  // 获取用户拥有的旗帜图案
  static async getUserFlagPatterns(userId) {
    const patterns = await db('user_inventory')
      .join('store_items', 'user_inventory.item_id', 'store_items.id')
      .where('user_inventory.user_id', userId)
      .where('store_items.item_type', 'pattern')
      .where('user_inventory.quantity', '>', 0)
      .select(
        'store_items.id as item_id',
        'store_items.name',
        'store_items.description',
        'store_items.metadata',
        'user_inventory.quantity'
      );

    return patterns.map(pattern => ({
      id: pattern.item_id,
      name: pattern.name,
      description: pattern.description,
      pattern_id: pattern.metadata?.pattern_id,
      quantity: pattern.quantity
    }));
  }

  // 获取用户装饰品
  static async getUserCosmetics(userId) {
    const cosmetics = await db('user_inventory')
      .join('store_items', 'user_inventory.item_id', 'store_items.id')
      .where('user_inventory.user_id', userId)
      .whereIn('store_items.item_type', ['frame', 'bubble', 'badge'])
      .where('user_inventory.quantity', '>', 0)
      .select(
        'store_items.id as item_id',
        'store_items.name',
        'store_items.description',
        'store_items.item_type',
        'store_items.metadata',
        'user_inventory.quantity'
      );

    return cosmetics.map(cosmetic => ({
      id: cosmetic.item_id,
      name: cosmetic.name,
      description: cosmetic.description,
      type: cosmetic.item_type,
      metadata: cosmetic.metadata,
      quantity: cosmetic.quantity
    }));
  }

  // 检查用户是否拥有特定道具
  static async hasItem(userId, itemId, quantity = 1) {
    const inventory = await db('user_inventory')
      .where({
        user_id: userId,
        item_id: itemId
      })
      .first();

    return inventory && inventory.quantity >= quantity;
  }

  // 获取道具使用统计
  static async getItemUsageStats(userId, itemId) {
    const inventory = await db('user_inventory')
      .where({
        user_id: userId,
        item_id: itemId
      })
      .first();

    if (!inventory) {
      return {
        owned: 0,
        used: 0,
        remaining: 0
      };
    }

    return {
      owned: inventory.quantity,
      used: inventory.consumed ? 1 : 0,
      remaining: inventory.quantity
    };
  }

  // 应用Emoji炸弹效果
  static async applyEmojiBomb(trx, userId, centerLat, centerLng, areaSize, patternKey, displayColor = '#FFFFFF') {
    console.log(`💣 Emoji炸弹效果: 中心(${centerLat}, ${centerLng}), 范围${areaSize}x${areaSize}, 图案Key=${patternKey}, 颜色=${displayColor}`);

    // 计算每个像素的间距（以经纬度为单位）
    const pixelSpacing = 0.0001; // 每个像素约11.1米间距

    // 计算起始位置（左上角）
    const startLat = centerLat + (areaSize / 2 - 0.5) * pixelSpacing;
    const startLng = centerLng - (areaSize / 2 - 0.5) * pixelSpacing;

    const pixelsToInsert = [];

    // 创建6x6=36个像素点
    for (let row = 0; row < areaSize; row++) {
      for (let col = 0; col < areaSize; col++) {
        const pixelLat = startLat - row * pixelSpacing;
        const pixelLng = startLng + col * pixelSpacing;

        pixelsToInsert.push({
          latitude: pixelLat,
          longitude: pixelLng,
          userId: userId,
          color: displayColor,
          patternId: patternKey,
          pixelType: 'bomb',
          relatedId: null,
          drawType: 'emoji_bomb'
        });
      }
    }

    console.log(`💣 Emoji炸弹准备创建 ${pixelsToInsert.length} 个像素点`);

    // 使用PixelBatchService进行批量绘制（独立事务，自动触发WebSocket广播和MVT缓存失效）
    if (pixelsToInsert.length > 0) {
      try {
        const PixelBatchService = require('../services/pixelBatchService');
        const result = await PixelBatchService.batchDrawPixels(pixelsToInsert, {
          drawType: 'emoji_bomb',
          skipUserValidation: true,
          skipPointConsumption: true
        });

        console.log(`💣 Emoji炸弹处理完成: 成功${result.successCount}个, 失败${result.failureCount}个`);

        return { patternKey, pixelCount: result.successCount };
      } catch (error) {
        logger.error('Emoji炸弹处理像素失败', { error: error.message, userId });
        throw error;
      }
    }

    return { patternKey, pixelCount: 0 };
  }

  // 应用联盟炸弹效果
  static async applyAllianceBomb(trx, userId, centerLat, centerLng, areaSize, flagPatternKey, allianceId) {
    console.log(`💣 联盟炸弹效果: 中心(${centerLat}, ${centerLng}), 范围${areaSize}x${areaSize}, 旗帜图案Key=${flagPatternKey}, 联盟ID=${allianceId}`);

    // 计算每个像素的间距（以经纬度为单位）
    const pixelSpacing = 0.0001; // 每个像素约11.1米间距

    // 计算起始位置（左上角）
    const startLat = centerLat + (areaSize / 2 - 0.5) * pixelSpacing;
    const startLng = centerLng - (areaSize / 2 - 0.5) * pixelSpacing;

    const pixelsToInsert = [];

    // 创建6x6=36个像素点
    for (let row = 0; row < areaSize; row++) {
      for (let col = 0; col < areaSize; col++) {
        const pixelLat = startLat - row * pixelSpacing;
        const pixelLng = startLng + col * pixelSpacing;

        pixelsToInsert.push({
          latitude: pixelLat,
          longitude: pixelLng,
          userId: userId,
          color: '#FFFFFF', // 联盟旗帜使用白色背景
          patternId: flagPatternKey,
          pixelType: 'bomb', // 炸弹像素类型
          relatedId: null, // 炸弹暂时没有关联ID
          allianceId: allianceId || null,
          drawType: 'alliance_bomb'
        });
      }
    }

    console.log(`💣 联盟炸弹准备创建 ${pixelsToInsert.length} 个像素点`);

    // 使用PixelBatchService进行批量绘制
    if (pixelsToInsert.length > 0) {
      try {
        const PixelBatchService = require('../services/pixelBatchService');
        const result = await PixelBatchService.batchDrawPixels(pixelsToInsert, {
          drawType: 'alliance_bomb',
          skipUserValidation: true, // 炸弹不需要用户验证
          skipPointConsumption: true // 炸弹不需要消耗点数
        });

        console.log(`💣 联盟炸弹处理完成: 成功${result.successCount}个, 失败${result.failureCount}个`);

        return { flagPatternKey, pixelCount: result.successCount };
      } catch (error) {
        logger.error('联盟炸弹处理像素失败', { error: error.message, userId });
        throw error;
      }
    }

    return { flagPatternKey, pixelCount: 0 };
  }
}

module.exports = Store;
