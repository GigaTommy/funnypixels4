const { db } = require('../backend/src/config/database');
const AdProduct = require('../backend/src/models/AdProduct');
const UserAdInventory = require('../backend/src/models/UserAdInventory');
const AdPlacement = require('../backend/src/models/AdPlacement');
const ImageProcessor = require('../backend/src/services/imageProcessor');
const AdPixelRenderer = require('../backend/src/services/AdPixelRenderer');
const AdOrder = require('../backend/src/models/AdOrder');

async function ensurePatternExists(color) {
    const key = `color_256_${color.toLowerCase()}`;
    const existing = await db('pattern_assets').where('key', key).first();

    if (!existing) {
        console.log(`➕ 添加缺失的Pattern: ${key}`);
        await db('pattern_assets').insert({
            key: key,
            category: 'base256color',
            render_type: 'color',
            payload: color,
            name: `Color ${color}`,
            description: 'Auto-generated missing 256 color pattern',
            is_public: true,
        });
    }
}

async function renderAd(adId) {
    try {
        console.log(`🔍 查找广告 ID: ${adId}`);

        let ad = null;
        let isLegacyAd = false;

        // Check if adId is an integer (for legacy advertisements table)
        const isIntegerId = /^\d+$/.test(adId);

        if (isIntegerId) {
            // 尝试在 advertisements 表中查找
            ad = await db('advertisements').where('id', adId).first();
            if (ad) {
                isLegacyAd = true;
                console.log('✅ 在 advertisements 表中找到广告');
            }
        } else {
            console.log('ℹ️ ID 不是整数，跳过 advertisements 表查询');
        }

        // 如果没找到，尝试在 ad_orders 表中查找
        if (!ad) {
            console.log('🔍 尝试在 ad_orders 表中查找...');
            // ad_orders uses UUID, which matches the provided ID format
            ad = await AdOrder.findById(adId);
            if (ad) {
                console.log('✅ 在 ad_orders 表中找到广告订单');
                isLegacyAd = false;
            }
        }

        if (!ad) {
            console.error('❌ 广告/订单不存在');
            return;
        }

        console.log(`📝 广告详情:`, isLegacyAd ? ad : { id: ad.id, title: ad.adTitle, type: 'AdOrder' });

        let pixelData;
        let pixelCount;
        let width, height;
        let matchedProductId;

        if (isLegacyAd) {
            // --- Legacy Ad Process ---
            // 1. 查找匹配的广告商品
            const allProducts = await AdProduct.getActiveProducts();
            let matchedProduct = allProducts.find(p => p.width === ad.width && p.height === ad.height);

            if (!matchedProduct) {
                console.warn(`⚠️ 无法找到尺寸为 ${ad.width}x${ad.height} 的广告商品，使用默认商品`);
                matchedProduct = allProducts[0];
            }

            if (!matchedProduct) {
                throw new Error('系统未配置广告商品');
            }
            matchedProductId = matchedProduct.id;
            width = ad.width;
            height = ad.height;

            console.log(`✅以此商品为模板: ${matchedProduct.name} (${matchedProduct.width}x${matchedProduct.height})`);

            // 2. 处理广告图片
            console.log(`🎨 开始处理广告图片: ${ad.title}`);
            const processedResult = await ImageProcessor.processAdImage(
                ad.icon_url,
                ad.width,
                ad.height
            );
            pixelData = processedResult.pixelData;
            pixelCount = processedResult.pixelCount;

            console.log(`🖼️ 图片处理完成，像素点数: ${pixelCount}`);
        } else {
            // --- AdOrder Process ---
            const adOrder = ad; // aliases for clarity
            const adProduct = await AdProduct.findById(adOrder.adProductId);
            if (!adProduct) {
                throw new Error(`广告商品不存在: ${adOrder.adProductId}`);
            }
            matchedProductId = adProduct.id;
            width = adProduct.width;
            height = adProduct.height;

            console.log(`🎨 开始处理广告图片: ${adOrder.adTitle} (${width}x${height})`);

            // 如果已经有处理过的图，直接用；否则重新处理
            if (adOrder.processedImageData) {
                console.log('✅ 使用已存在的处理后图像数据');
                pixelData = JSON.parse(adOrder.processedImageData);
                pixelCount = pixelData.length;
            } else {
                console.log('🔄 重新处理图片...');
                const processedResult = await ImageProcessor.processAdImage(
                    adOrder.originalImageUrl,
                    width,
                    height
                );
                pixelData = processedResult.pixelData;
                pixelCount = processedResult.pixelCount;

                // 更新订单的处理后数据
                await db('ad_orders').where('id', adOrder.id).update({
                    processed_image_data: JSON.stringify(pixelData),
                    updated_at: new Date()
                });
            }
        }

        // --- CHECK FOR MISSING PATTERNS FOR ALL COLORS ---
        console.log('🔍 检查并修复缺失的 Pattern...');

        // Extract unique colors from pixelData
        // pixelData: [{ color: '#xxxxxx', ... }]
        const uniqueColors = new Set();
        if (Array.isArray(pixelData)) {
            pixelData.forEach(p => {
                if (p.color) uniqueColors.add(p.color);
            });
        }

        console.log(`🎨 发现 ${uniqueColors.size} 种唯一颜色，开始验证 Pattern...`);

        // Check and create patterns for each unique color's quantized version
        for (const color of uniqueColors) {
            try {
                // Use AdPixelRenderer logic to find what the quantized color would be
                const quantizedColor = AdPixelRenderer.quantizeColorTo256FromHex(color);
                await ensurePatternExists(quantizedColor);
            } catch (e) {
                console.error(`❌ 无法处理颜色 ${color}:`, e);
            }
        }

        // 3. 创建用户广告库存记录
        console.log('📦 创建库存记录...');
        const inventory = await UserAdInventory.create({
            userId: isLegacyAd ? ad.user_id : ad.userId,
            adOrderId: isLegacyAd ? null : ad.id,
            adProductId: matchedProductId,
            adTitle: isLegacyAd ? ad.title : ad.adTitle,
            processedImageData: JSON.stringify(pixelData),
            width: width,
            height: height
        });
        await inventory.markAsUsed();
        console.log(`✅ 库存记录创建成功: ${inventory.id}`);

        // 4. 创建广告放置记录
        let centerLat, centerLng;
        if (isLegacyAd) {
            centerLat = ad.lat;
            centerLng = ad.lng;
        } else {
            // 对于 AdOrder，如果 targetLocation 存在则使用，否则可能需要手动指定或失败
            if (ad.targetLocation && typeof ad.targetLocation === 'object') {
                centerLat = ad.targetLocation.lat;
                centerLng = ad.targetLocation.lng;
            } else if (ad.targetLocation && typeof ad.targetLocation === 'string') {
                try {
                    const loc = JSON.parse(ad.targetLocation);
                    centerLat = loc.lat;
                    centerLng = loc.lng;
                } catch (e) {
                    console.warn('解析 targetLocation 失败');
                }
            }

            if (!centerLat || !centerLng) {
                console.warn('⚠️ AdOrder 没有有效的 targetLocation，尝试使用默认测试位置 (东方明珠 approx)');
                centerLat = 31.2397;
                centerLng = 121.4998;
            }
        }

        console.log('📍 创建放置记录...', { centerLat, centerLng });
        const placement = await AdPlacement.create({
            userId: isLegacyAd ? ad.user_id : ad.userId,
            adInventoryId: inventory.id,
            centerLat: centerLat,
            centerLng: centerLng,
            width: width,
            height: height,
            pixelData: JSON.stringify(pixelData),
            pixelCount: pixelCount,
            isActive: true, // 确保激活
            expiresAt: isLegacyAd ? ad.end_time : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 默认30天
        });
        console.log(`✅ 放置记录创建成功: ${placement.id}`);

        // 5. 触发像素渲染
        console.log(`🎨 开始渲染像素...`);
        await AdPixelRenderer.processAdPlacement(placement.id);
        console.log(`🎉 广告渲染成功！`);

    } catch (error) {
        console.error('❌ 渲染失败:', error);
    } finally {
        process.exit();
    }
}

// 获取命令行参数中的广告ID
const adId = process.argv[2];
if (!adId) {
    console.error('请提供广告ID作为参数');
    process.exit(1);
}

renderAd(adId);
