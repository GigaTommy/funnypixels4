const { db } = require('../config/database');
const logger = require('../utils/logger');

/**
 * 商品管理控制器
 * 管理所有类型的商品：shop_skus（普通商品）、store_items（消耗品/装饰品/特殊道具）、ad_products（广告商品）
 */
class ProductController {

  /**
   * 获取所有商品列表（shop_skus）
   */
  static async getAllProducts(req, res) {
    try {
      const {
        current = 1,
        pageSize = 10,
        category,
        type,
        currency,
        active,
        keyword
      } = req.query;

      // 构建基础查询
      let query = db('shop_skus');

      // 应用筛选条件
      if (category) {
        query = query.where('category', category);
      }

      if (type) {
        query = query.where('type', type);
      }

      if (currency) {
        query = query.where('currency', currency);
      }

      if (active !== undefined) {
        query = query.where('active', active === 'true');
      }

      if (keyword) {
        query = query.where(function() {
          this.where('name', 'ilike', `%${keyword}%`)
              .orWhere('description', 'ilike', `%${keyword}%`);
        });
      }

      // 获取总数
      const countQuery = query.clone();
      const totalResult = await countQuery.count('* as count').first();
      const total = parseInt(totalResult?.count) || 0;

      // 获取分页数据
      const products = await query
        .select('*')
        .orderBy('sort_order', 'asc')
        .orderBy('id', 'desc')
        .limit(pageSize)
        .offset((current - 1) * pageSize);

      // 处理数据格式
      const processedProducts = products.map(product => ({
        ...product,
        metadata: product.metadata ?
          (typeof product.metadata === 'string' ? JSON.parse(product.metadata) : product.metadata) :
          null
      }));

      res.json({
        success: true,
        data: {
          list: processedProducts,
          total: total,
          current: parseInt(current),
          pageSize: parseInt(pageSize)
        }
      });

    } catch (error) {
      logger.error('获取商品列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取商品列表失败'
      });
    }
  }

  /**
   * 获取单个商品详情
   */
  static async getProductById(req, res) {
    try {
      const { id } = req.params;

      const product = await db('shop_skus')
        .where('id', id)
        .first();

      if (!product) {
        return res.status(404).json({
          success: false,
          message: '商品不存在'
        });
      }

      // 处理metadata
      if (product.metadata && typeof product.metadata === 'string') {
        product.metadata = JSON.parse(product.metadata);
      }

      res.json({
        success: true,
        data: product
      });

    } catch (error) {
      logger.error('获取商品详情失败:', error);
      res.status(500).json({
        success: false,
        message: '获取商品详情失败'
      });
    }
  }

  /**
   * 创建新商品
   */
  static async createProduct(req, res) {
    try {
      const {
        name,
        description,
        price,
        currency,
        item_type,
        item_id,
        image_url,
        category,
        type,
        pattern_id,
        active,
        verified,
        sort_order,
        metadata
      } = req.body;

      // 验证必填字段
      if (!name || !price || !currency) {
        return res.status(400).json({
          success: false,
          message: '商品名称、价格和货币类型不能为空'
        });
      }

      // 验证货币类型
      if (!['coins', 'gems', 'points'].includes(currency)) {
        return res.status(400).json({
          success: false,
          message: '货币类型必须是 coins、gems 或 points'
        });
      }

      // 处理metadata
      let metadataJson = null;
      if (metadata) {
        if (typeof metadata === 'object') {
          metadataJson = JSON.stringify(metadata);
        } else if (typeof metadata === 'string') {
          // 验证是否是合法的JSON
          try {
            JSON.parse(metadata);
            metadataJson = metadata;
          } catch (e) {
            return res.status(400).json({
              success: false,
              message: 'metadata必须是合法的JSON格式'
            });
          }
        }
      }

      // 插入商品
      const [newProduct] = await db('shop_skus')
        .insert({
          name,
          description,
          price,
          currency,
          item_type: item_type || null,
          item_id: item_id || null,
          image_url: image_url || null,
          category: category || 'other',
          type: type || null,
          pattern_id: pattern_id || null,
          active: active !== undefined ? active : true,
          verified: verified !== undefined ? verified : false,
          sort_order: sort_order || 0,
          metadata: metadataJson,
          is_available: true,
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning('*');

      // 处理返回数据
      if (newProduct.metadata && typeof newProduct.metadata === 'string') {
        newProduct.metadata = JSON.parse(newProduct.metadata);
      }

      logger.info(`商品创建成功: ${newProduct.id} - ${newProduct.name}`);

      res.status(201).json({
        success: true,
        message: '商品创建成功',
        data: newProduct
      });

    } catch (error) {
      logger.error('创建商品失败:', error);
      res.status(500).json({
        success: false,
        message: '创建商品失败'
      });
    }
  }

  /**
   * 更新商品信息
   */
  static async updateProduct(req, res) {
    try {
      const { id } = req.params;
      const {
        name,
        description,
        price,
        currency,
        item_type,
        item_id,
        image_url,
        category,
        type,
        pattern_id,
        active,
        verified,
        is_available,
        sort_order,
        metadata
      } = req.body;

      // 检查商品是否存在
      const existingProduct = await db('shop_skus')
        .where('id', id)
        .first();

      if (!existingProduct) {
        return res.status(404).json({
          success: false,
          message: '商品不存在'
        });
      }

      // 构建更新数据
      const updateData = {
        updated_at: new Date()
      };

      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (price !== undefined) updateData.price = price;
      if (currency !== undefined) {
        if (!['coins', 'gems', 'points'].includes(currency)) {
          return res.status(400).json({
            success: false,
            message: '货币类型必须是 coins、gems 或 points'
          });
        }
        updateData.currency = currency;
      }
      if (item_type !== undefined) updateData.item_type = item_type;
      if (item_id !== undefined) updateData.item_id = item_id;
      if (image_url !== undefined) updateData.image_url = image_url;
      if (category !== undefined) updateData.category = category;
      if (type !== undefined) updateData.type = type;
      if (pattern_id !== undefined) updateData.pattern_id = pattern_id;
      if (active !== undefined) updateData.active = active;
      if (verified !== undefined) updateData.verified = verified;
      if (is_available !== undefined) updateData.is_available = is_available;
      if (sort_order !== undefined) updateData.sort_order = sort_order;

      // 处理metadata
      if (metadata !== undefined) {
        if (metadata === null) {
          updateData.metadata = null;
        } else if (typeof metadata === 'object') {
          updateData.metadata = JSON.stringify(metadata);
        } else if (typeof metadata === 'string') {
          try {
            JSON.parse(metadata);
            updateData.metadata = metadata;
          } catch (e) {
            return res.status(400).json({
              success: false,
              message: 'metadata必须是合法的JSON格式'
            });
          }
        }
      }

      // 更新商品
      const [updatedProduct] = await db('shop_skus')
        .where('id', id)
        .update(updateData)
        .returning('*');

      // 处理返回数据
      if (updatedProduct.metadata && typeof updatedProduct.metadata === 'string') {
        updatedProduct.metadata = JSON.parse(updatedProduct.metadata);
      }

      logger.info(`商品更新成功: ${id} - ${updatedProduct.name}`);

      res.json({
        success: true,
        message: '商品更新成功',
        data: updatedProduct
      });

    } catch (error) {
      logger.error('更新商品失败:', error);
      res.status(500).json({
        success: false,
        message: '更新商品失败'
      });
    }
  }

  /**
   * 删除商品
   */
  static async deleteProduct(req, res) {
    try {
      const { id } = req.params;

      // 检查商品是否存在
      const product = await db('shop_skus')
        .where('id', id)
        .first();

      if (!product) {
        return res.status(404).json({
          success: false,
          message: '商品不存在'
        });
      }

      // 检查是否有关联的订单
      const hasOrders = await db('store_orders')
        .where('sku_id', id)
        .first();

      if (hasOrders) {
        // 如果有订单，只是标记为不可用，而不是删除
        await db('shop_skus')
          .where('id', id)
          .update({
            active: false,
            is_available: false,
            updated_at: new Date()
          });

        logger.info(`商品已标记为不可用: ${id} - ${product.name}`);

        return res.json({
          success: true,
          message: '商品已标记为不可用（因存在关联订单）'
        });
      }

      // 如果没有关联订单，可以安全删除
      await db('shop_skus')
        .where('id', id)
        .delete();

      logger.info(`商品已删除: ${id} - ${product.name}`);

      res.json({
        success: true,
        message: '商品删除成功'
      });

    } catch (error) {
      logger.error('删除商品失败:', error);
      res.status(500).json({
        success: false,
        message: '删除商品失败'
      });
    }
  }

  /**
   * 批量更新商品状态
   */
  static async batchUpdateStatus(req, res) {
    try {
      const { ids, active } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: '请选择要操作的商品'
        });
      }

      if (active === undefined) {
        return res.status(400).json({
          success: false,
          message: '请指定要设置的状态'
        });
      }

      await db('shop_skus')
        .whereIn('id', ids)
        .update({
          active: active,
          updated_at: new Date()
        });

      logger.info(`批量更新商品状态: ${ids.length} 个商品设置为 ${active ? '启用' : '禁用'}`);

      res.json({
        success: true,
        message: `已${active ? '启用' : '禁用'} ${ids.length} 个商品`
      });

    } catch (error) {
      logger.error('批量更新商品状态失败:', error);
      res.status(500).json({
        success: false,
        message: '批量更新失败'
      });
    }
  }

  /**
   * 获取商品分类列表
   */
  static async getCategories(req, res) {
    try {
      const categories = await db('shop_skus')
        .select('category')
        .groupBy('category')
        .orderBy('category');

      const categoryList = categories
        .map(c => c.category)
        .filter(c => c); // 过滤null值

      res.json({
        success: true,
        data: categoryList
      });

    } catch (error) {
      logger.error('获取商品分类失败:', error);
      res.status(500).json({
        success: false,
        message: '获取商品分类失败'
      });
    }
  }

  /**
   * 获取广告商品列表（ad_products）
   */
  static async getAdProducts(req, res) {
    try {
      const {
        current = 1,
        pageSize = 10,
        active,
        keyword
      } = req.query;

      // 构建基础查询
      let query = db('ad_products');

      // 应用筛选条件
      if (active !== undefined) {
        query = query.where('active', active === 'true');
      }

      if (keyword) {
        query = query.where(function() {
          this.where('name', 'ilike', `%${keyword}%`)
              .orWhere('description', 'ilike', `%${keyword}%`);
        });
      }

      // 获取总数
      const countQuery = query.clone();
      const totalResult = await countQuery.count('* as count').first();
      const total = parseInt(totalResult?.count) || 0;

      // 获取分页数据
      const products = await query
        .select('*')
        .orderBy('created_at', 'desc')
        .limit(pageSize)
        .offset((current - 1) * pageSize);

      res.json({
        success: true,
        data: {
          list: products,
          total: total,
          current: parseInt(current),
          pageSize: parseInt(pageSize)
        }
      });

    } catch (error) {
      logger.error('获取广告商品列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取广告商品列表失败'
      });
    }
  }

  /**
   * 创建广告商品
   */
  static async createAdProduct(req, res) {
    try {
      const {
        name,
        description,
        price,
        width,
        height,
        duration,
        active
      } = req.body;

      // 验证必填字段
      if (!name || !price || !width || !height || !duration) {
        return res.status(400).json({
          success: false,
          message: '名称、价格、宽度、高度和时长不能为空'
        });
      }

      // 插入广告商品
      const [newProduct] = await db('ad_products')
        .insert({
          name,
          description,
          price,
          width,
          height,
          duration,
          active: active !== undefined ? active : true,
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning('*');

      logger.info(`广告商品创建成功: ${newProduct.id} - ${newProduct.name}`);

      res.status(201).json({
        success: true,
        message: '广告商品创建成功',
        data: newProduct
      });

    } catch (error) {
      logger.error('创建广告商品失败:', error);
      res.status(500).json({
        success: false,
        message: '创建广告商品失败'
      });
    }
  }

  /**
   * 更新广告商品
   */
  static async updateAdProduct(req, res) {
    try {
      const { id } = req.params;
      const {
        name,
        description,
        price,
        width,
        height,
        duration,
        active
      } = req.body;

      // 检查商品是否存在
      const existingProduct = await db('ad_products')
        .where('id', id)
        .first();

      if (!existingProduct) {
        return res.status(404).json({
          success: false,
          message: '广告商品不存在'
        });
      }

      // 构建更新数据
      const updateData = {
        updated_at: new Date()
      };

      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (price !== undefined) updateData.price = price;
      if (width !== undefined) updateData.width = width;
      if (height !== undefined) updateData.height = height;
      if (duration !== undefined) updateData.duration = duration;
      if (active !== undefined) updateData.active = active;

      // 更新商品
      const [updatedProduct] = await db('ad_products')
        .where('id', id)
        .update(updateData)
        .returning('*');

      logger.info(`广告商品更新成功: ${id} - ${updatedProduct.name}`);

      res.json({
        success: true,
        message: '广告商品更新成功',
        data: updatedProduct
      });

    } catch (error) {
      logger.error('更新广告商品失败:', error);
      res.status(500).json({
        success: false,
        message: '更新广告商品失败'
      });
    }
  }

  /**
   * 删除广告商品
   */
  static async deleteAdProduct(req, res) {
    try {
      const { id } = req.params;

      // 检查商品是否存在
      const product = await db('ad_products')
        .where('id', id)
        .first();

      if (!product) {
        return res.status(404).json({
          success: false,
          message: '广告商品不存在'
        });
      }

      // 检查是否有关联的订单
      const hasOrders = await db('ad_orders')
        .where('ad_product_id', id)
        .first();

      if (hasOrders) {
        // 如果有订单，只是标记为不可用
        await db('ad_products')
          .where('id', id)
          .update({
            active: false,
            updated_at: new Date()
          });

        logger.info(`广告商品已标记为不可用: ${id} - ${product.name}`);

        return res.json({
          success: true,
          message: '广告商品已标记为不可用（因存在关联订单）'
        });
      }

      // 如果没有关联订单，可以安全删除
      await db('ad_products')
        .where('id', id)
        .delete();

      logger.info(`广告商品已删除: ${id} - ${product.name}`);

      res.json({
        success: true,
        message: '广告商品删除成功'
      });

    } catch (error) {
      logger.error('删除广告商品失败:', error);
      res.status(500).json({
        success: false,
        message: '删除广告商品失败'
      });
    }
  }

  // ==================== store_items 商品管理 ====================

  /**
   * 获取 store_items 商品列表
   */
  static async getStoreItems(req, res) {
    try {
      const {
        current = 1,
        pageSize = 10,
        item_type,
        category,
        active,
        keyword
      } = req.query;

      // 构建基础查询
      let query = db('store_items');

      // 应用筛选条件
      if (item_type) {
        query = query.where('item_type', item_type);
      }

      if (category) {
        query = query.where('category', category);
      }

      if (active !== undefined) {
        query = query.where('active', active === 'true');
      }

      if (keyword) {
        query = query.where(function() {
          this.where('name', 'ilike', `%${keyword}%`)
              .orWhere('description', 'ilike', `%${keyword}%`);
        });
      }

      // 获取总数
      const countQuery = query.clone();
      const totalResult = await countQuery.count('* as count').first();
      const total = parseInt(totalResult?.count) || 0;

      // 获取分页数据
      const items = await query
        .select('*')
        .orderBy('item_type', 'asc')
        .orderBy('name', 'asc')
        .limit(pageSize)
        .offset((current - 1) * pageSize);

      // 处理数据格式
      const processedItems = items.map(item => ({
        ...item,
        metadata: item.metadata ?
          (typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata) :
          null
      }));

      res.json({
        success: true,
        data: {
          list: processedItems,
          total: total,
          current: parseInt(current),
          pageSize: parseInt(pageSize)
        }
      });

    } catch (error) {
      logger.error('获取商店商品列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取商店商品列表失败'
      });
    }
  }

  /**
   * 获取单个 store_items 商品详情
   */
  static async getStoreItemById(req, res) {
    try {
      const { id } = req.params;

      const item = await db('store_items')
        .where('id', id)
        .first();

      if (!item) {
        return res.status(404).json({
          success: false,
          message: '商品不存在'
        });
      }

      // 处理metadata
      if (item.metadata && typeof item.metadata === 'string') {
        item.metadata = JSON.parse(item.metadata);
      }

      res.json({
        success: true,
        data: item
      });

    } catch (error) {
      logger.error('获取商店商品详情失败:', error);
      res.status(500).json({
        success: false,
        message: '获取商店商品详情失败'
      });
    }
  }

  /**
   * 创建 store_items 商品
   */
  static async createStoreItem(req, res) {
    try {
      const {
        name,
        description,
        price_points,
        item_type,
        category,
        icon,
        metadata,
        active = true
      } = req.body;

      // 验证必填字段
      if (!name || !price_points || !item_type) {
        return res.status(400).json({
          success: false,
          message: '商品名称、价格和类型不能为空'
        });
      }

      // 验证商品类型
      const validItemTypes = ['consumable', 'cosmetic', 'special', 'pattern', 'frame', 'bubble', 'badge', 'ad'];
      if (!validItemTypes.includes(item_type)) {
        return res.status(400).json({
          success: false,
          message: `商品类型必须是: ${validItemTypes.join(', ')}`
        });
      }

      // 处理metadata
      let metadataJson = null;
      if (metadata) {
        if (typeof metadata === 'object') {
          metadataJson = JSON.stringify(metadata);
        } else if (typeof metadata === 'string') {
          try {
            JSON.parse(metadata);
            metadataJson = metadata;
          } catch (e) {
            return res.status(400).json({
              success: false,
              message: 'metadata必须是合法的JSON格式'
            });
          }
        }
      }

      // 插入商品
      const [newItem] = await db('store_items')
        .insert({
          name,
          description,
          price_points,
          item_type,
          category: category || item_type,
          icon: icon || getDefaultIcon(item_type),
          metadata: metadataJson,
          active,
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning('*');

      // 处理返回数据
      if (newItem.metadata && typeof newItem.metadata === 'string') {
        newItem.metadata = JSON.parse(newItem.metadata);
      }

      logger.info(`商店商品创建成功: ${newItem.id} - ${newItem.name}`);

      res.status(201).json({
        success: true,
        message: '商店商品创建成功',
        data: newItem
      });

    } catch (error) {
      logger.error('创建商店商品失败:', error);
      res.status(500).json({
        success: false,
        message: '创建商店商品失败'
      });
    }
  }

  /**
   * 更新 store_items 商品
   */
  static async updateStoreItem(req, res) {
    try {
      const { id } = req.params;
      const {
        name,
        description,
        price_points,
        item_type,
        category,
        icon,
        metadata,
        active
      } = req.body;

      // 检查商品是否存在
      const existingItem = await db('store_items')
        .where('id', id)
        .first();

      if (!existingItem) {
        return res.status(404).json({
          success: false,
          message: '商品不存在'
        });
      }

      // 构建更新数据
      const updateData = {
        updated_at: new Date()
      };

      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (price_points !== undefined) updateData.price_points = price_points;
      if (item_type !== undefined) {
        const validItemTypes = ['consumable', 'cosmetic', 'special', 'pattern', 'frame', 'bubble', 'badge', 'ad'];
        if (!validItemTypes.includes(item_type)) {
          return res.status(400).json({
            success: false,
            message: `商品类型必须是: ${validItemTypes.join(', ')}`
          });
        }
        updateData.item_type = item_type;
      }
      if (category !== undefined) updateData.category = category;
      if (icon !== undefined) updateData.icon = icon;
      if (active !== undefined) updateData.active = active;

      // 处理metadata
      if (metadata !== undefined) {
        if (metadata === null) {
          updateData.metadata = null;
        } else if (typeof metadata === 'object') {
          updateData.metadata = JSON.stringify(metadata);
        } else if (typeof metadata === 'string') {
          try {
            JSON.parse(metadata);
            updateData.metadata = metadata;
          } catch (e) {
            return res.status(400).json({
              success: false,
              message: 'metadata必须是合法的JSON格式'
            });
          }
        }
      }

      // 更新商品
      const [updatedItem] = await db('store_items')
        .where('id', id)
        .update(updateData)
        .returning('*');

      // 处理返回数据
      if (updatedItem.metadata && typeof updatedItem.metadata === 'string') {
        updatedItem.metadata = JSON.parse(updatedItem.metadata);
      }

      logger.info(`商店商品更新成功: ${id} - ${updatedItem.name}`);

      res.json({
        success: true,
        message: '商店商品更新成功',
        data: updatedItem
      });

    } catch (error) {
      logger.error('更新商店商品失败:', error);
      res.status(500).json({
        success: false,
        message: '更新商店商品失败'
      });
    }
  }

  /**
   * 删除 store_items 商品
   */
  static async deleteStoreItem(req, res) {
    try {
      const { id } = req.params;

      // 检查商品是否存在
      const item = await db('store_items')
        .where('id', id)
        .first();

      if (!item) {
        return res.status(404).json({
          success: false,
          message: '商品不存在'
        });
      }

      // 检查是否有关联的库存记录
      const hasInventory = await db('user_inventory')
        .where('item_id', id)
        .first();

      if (hasInventory) {
        // 如果有库存记录，只是标记为不可用
        await db('store_items')
          .where('id', id)
          .update({
            active: false,
            updated_at: new Date()
          });

        logger.info(`商店商品已标记为不可用: ${id} - ${item.name}`);

        return res.json({
          success: true,
          message: '商品已标记为不可用（因存在用户库存）'
        });
      }

      // 如果没有关联库存，可以安全删除
      await db('store_items')
        .where('id', id)
        .delete();

      logger.info(`商店商品已删除: ${id} - ${item.name}`);

      res.json({
        success: true,
        message: '商店商品删除成功'
      });

    } catch (error) {
      logger.error('删除商店商品失败:', error);
      res.status(500).json({
        success: false,
        message: '删除商店商品失败'
      });
    }
  }

  /**
   * 批量更新 store_items 商品状态
   */
  static async batchUpdateStoreItemStatus(req, res) {
    try {
      const { ids, active } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: '请选择要操作的商品'
        });
      }

      if (active === undefined) {
        return res.status(400).json({
          success: false,
          message: '请指定要设置的状态'
        });
      }

      await db('store_items')
        .whereIn('id', ids)
        .update({
          active: active,
          updated_at: new Date()
        });

      logger.info(`批量更新商店商品状态: ${ids.length} 个商品设置为 ${active ? '启用' : '禁用'}`);

      res.json({
        success: true,
        message: `已${active ? '启用' : '禁用'} ${ids.length} 个商店商品`
      });

    } catch (error) {
      logger.error('批量更新商店商品状态失败:', error);
      res.status(500).json({
        success: false,
        message: '批量更新失败'
      });
    }
  }

  /**
   * 获取 store_items 商品类型列表
   */
  static async getStoreItemTypes(req, res) {
    try {
      const itemTypes = await db('store_items')
        .select('item_type')
        .groupBy('item_type')
        .orderBy('item_type');

      const typeList = itemTypes
        .map(t => t.item_type)
        .filter(t => t); // 过滤null值

      res.json({
        success: true,
        data: typeList
      });

    } catch (error) {
      logger.error('获取商店商品类型失败:', error);
      res.status(500).json({
        success: false,
        message: '获取商店商品类型失败'
      });
    }
  }
}

// 获取默认图标的辅助函数
function getDefaultIcon(itemType) {
  const iconMap = {
    consumable: '🧪',
    cosmetic: '✨',
    special: '💣',
    pattern: '🎨',
    frame: '🖼️',
    bubble: '💭',
    badge: '🏆',
    ad: '📢'
  };
  return iconMap[itemType] || '📦';
}

module.exports = ProductController;
