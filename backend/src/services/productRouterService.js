/**
 * ProductRouterService - 统一商品路由服务
 * 
 * 功能：
 * 1. 根据ID前缀路由到正确的数据表
 * 2. 提供统一的商品查询和购买接口
 * 3. 内置LRU缓存提升性能
 */

const { db } = require('../config/database');

// 简单的LRU缓存实现
class LRUCache {
    constructor(maxSize = 500, ttlMs = 5 * 60 * 1000) {
        this.maxSize = maxSize;
        this.ttlMs = ttlMs;
        this.cache = new Map();
    }

    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;

        // 检查是否过期
        if (Date.now() > item.expiry) {
            this.cache.delete(key);
            return null;
        }

        // 移到末尾（最近使用）
        this.cache.delete(key);
        this.cache.set(key, item);
        return item.value;
    }

    set(key, value) {
        // 如果超过最大容量，删除最旧的
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        this.cache.set(key, {
            value,
            expiry: Date.now() + this.ttlMs
        });
    }

    invalidate(key) {
        this.cache.delete(key);
    }

    clear() {
        this.cache.clear();
    }
}

// 商品类型处理器注册表
const productHandlers = {
    // 广告商品处理器
    ad: {
        prefix: 'ad_',
        tableName: 'ad_products',

        async getById(id, trx = db) {
            const numericId = id.replace('ad_', '');
            const product = await trx('ad_products')
                .where('id', numericId)
                .where('active', true)
                .first();

            if (!product) return null;

            return this.normalize(product);
        },

        async getAll(activeOnly = true, trx = db) {
            const query = trx('ad_products').orderBy('price', 'asc');
            if (activeOnly) query.where('active', true);

            const products = await query;
            return products.map(p => this.normalize(p));
        },

        normalize(product) {
            return {
                id: `ad_${product.id}`,
                originalId: product.id,
                name: product.name,
                description: product.description,
                price_points: product.price,
                item_type: 'advertisement',
                category: 'advertisement',
                icon: '📢',
                active: product.active,
                created_at: product.created_at,
                updated_at: product.updated_at,
                // 广告商品特有属性
                ad_product_id: product.id,
                size_type: product.size_type,
                width: product.width,
                height: product.height
            };
        }
    },

    // 旗帜商品处理器
    flag: {
        prefix: 'flag_',
        alternatePrefix: 'custom_flag_',
        tableName: 'shop_skus',

        async getById(id, trx = db) {
            const numericId = id.replace('custom_flag_', '').replace('flag_', '');
            const sku = await trx('shop_skus')
                .where('id', numericId)
                .where('active', true)
                .first();

            if (!sku) return null;

            return this.normalize(sku, id);
        },

        async getAll(activeOnly = true, trx = db) {
            const query = trx('shop_skus').orderBy('price', 'asc');
            if (activeOnly) query.where('active', true);

            const skus = await query;
            return skus.map(s => this.normalize(s));
        },

        normalize(sku, originalId = null) {
            return {
                id: originalId || `flag_${sku.id}`,
                originalId: sku.id,
                name: sku.name,
                description: sku.description,
                price_points: sku.price,
                price: sku.price, // 兼容字段
                item_type: sku.item_type || 'custom_flag',
                type: sku.item_type, // 兼容字段
                category: sku.category,
                icon: sku.item_type === 'flag_color' ? '🏳️' : '🏴',
                active: sku.active,
                created_at: sku.created_at,
                updated_at: sku.updated_at,
                // 旗帜商品特有属性
                sku_id: sku.id,
                pattern_id: sku.pattern_id,
                currency: sku.currency || 'coins',
                metadata: sku.metadata
            };
        }
    },

    // 普通商品处理器
    regular: {
        prefix: 'item_',
        tableName: 'store_items',

        async getById(id, trx = db) {
            // 支持纯数字ID和item_前缀
            let numericId = id;
            if (typeof id === 'string' && id.startsWith('item_')) {
                numericId = id.replace('item_', '');
            }

            const item = await trx('store_items')
                .where('id', numericId)
                .where('active', true)
                .first();

            return item || null;
        },

        async getAll(activeOnly = true, trx = db) {
            const query = trx('store_items').orderBy('price_points', 'asc');
            if (activeOnly) query.where('active', true);

            return await query;
        },

        normalize(item) {
            return item; // 普通商品已经是标准格式
        }
    }
};

class ProductRouterService {
    constructor() {
        this.cache = new LRUCache(500, 5 * 60 * 1000); // 500 items, 5min TTL
        this.handlers = productHandlers;
    }

    /**
     * 根据ID前缀确定商品类型
     */
    getProductType(id) {
        const idStr = String(id);

        if (idStr.startsWith('ad_')) return 'ad';
        if (idStr.startsWith('flag_') || idStr.startsWith('custom_flag_')) return 'flag';
        if (idStr.startsWith('item_') || /^\d+$/.test(idStr)) return 'regular';

        return 'regular'; // 默认
    }

    /**
     * 根据ID获取商品（带缓存）
     */
    async getItem(id, trx = db) {
        const idStr = String(id);
        const cacheKey = `item:${idStr}`;

        // 尝试从缓存获取
        const cached = this.cache.get(cacheKey);
        if (cached) {
            return cached;
        }

        // 确定商品类型并获取
        const productType = this.getProductType(idStr);
        const handler = this.handlers[productType];

        if (!handler) {
            return null;
        }

        const item = await handler.getById(idStr, trx);

        // 存入缓存
        if (item) {
            this.cache.set(cacheKey, item);
        }

        return item;
    }

    /**
     * 获取所有商品（并行查询所有类型）
     */
    async getAllItems(activeOnly = true) {
        const cacheKey = `all_items:${activeOnly}`;

        // 尝试从缓存获取
        const cached = this.cache.get(cacheKey);
        if (cached) {
            return cached;
        }

        // 并行查询所有类型
        const [regularItems, adItems, flagItems] = await Promise.all([
            this.handlers.regular.getAll(activeOnly),
            this.handlers.ad.getAll(activeOnly),
            this.handlers.flag.getAll(activeOnly)
        ]);

        const allItems = [...regularItems, ...adItems, ...flagItems];

        // 存入缓存
        this.cache.set(cacheKey, allItems);

        return allItems;
    }

    /**
     * 根据类型获取商品
     */
    async getItemsByType(type, activeOnly = true) {
        const cacheKey = `items_by_type:${type}:${activeOnly}`;

        const cached = this.cache.get(cacheKey);
        if (cached) {
            return cached;
        }

        let items;

        if (type === 'advertisement') {
            items = await this.handlers.ad.getAll(activeOnly);
        } else if (type === 'custom_flag' || type === 'flag') {
            items = await this.handlers.flag.getAll(activeOnly);
        } else {
            // 从普通商品中过滤
            const allRegular = await this.handlers.regular.getAll(activeOnly);
            items = allRegular.filter(item => item.item_type === type);
        }

        this.cache.set(cacheKey, items);
        return items;
    }

    /**
     * 购买商品（不带缓存，直接使用事务）
     */
    async purchaseItem(userId, itemId, quantity, additionalData, trx) {
        const idStr = String(itemId);
        const productType = this.getProductType(idStr);

        // 获取商品信息
        const item = await this.getItem(idStr, trx);

        if (!item) {
            throw new Error('商品不存在或已下架');
        }

        // 购买后清除相关缓存
        this.invalidateItemCache(idStr);

        return {
            item,
            productType,
            originalId: this.extractNumericId(idStr)
        };
    }

    /**
     * 提取纯数字ID
     */
    extractNumericId(id) {
        const idStr = String(id);
        return parseInt(idStr.replace(/^(ad_|flag_|custom_flag_|item_)/, '')) || id;
    }

    /**
     * 清除商品缓存
     */
    invalidateItemCache(id) {
        const idStr = String(id);
        this.cache.invalidate(`item:${idStr}`);
        this.cache.invalidate('all_items:true');
        this.cache.invalidate('all_items:false');
    }

    /**
     * 清除所有缓存
     */
    clearAllCache() {
        this.cache.clear();
    }
}

// 导出单例
module.exports = new ProductRouterService();
