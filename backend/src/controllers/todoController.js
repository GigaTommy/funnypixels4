const { db } = require('../config/database');
const logger = require('../utils/logger');

/**
 * 统一待办管理控制器
 * 聚合所有需要管理员审批的待办事项
 */
class TodoController {

  /**
   * 获取待办统计数据
   */
  static async getTodoStats(req, res) {
    try {
      // 并行查询各类待办数量
      const [
        pendingCustomFlags,
        pendingAds,
        pendingReports,
        processedCount
      ] = await Promise.all([
        // 待审核自定义旗帜
        db('custom_flag_orders')
          .where('status', 'pending')
          .count('* as count')
          .first(),

        // 待审核广告订单
        db('ad_orders')
          .where('status', 'pending')
          .count('* as count')
          .first(),

        // 待处理举报
        db('reports')
          .where('status', 'pending')
          .count('* as count')
          .first(),

        // 已处理总数（最近30天）
        db('admin_todo_history')
          .where('processed_at', '>=', db.raw("NOW() - INTERVAL '30 days'"))
          .count('* as count')
          .first()
          .catch(() => ({ count: 0 })) // 如果表不存在返回0
      ]);

      const stats = {
        pending_count:
          (parseInt(pendingCustomFlags?.count) || 0) +
          (parseInt(pendingAds?.count) || 0) +
          (parseInt(pendingReports?.count) || 0),
        processed_count: parseInt(processedCount?.count) || 0,
        ad_approval_pending: parseInt(pendingAds?.count) || 0,
        custom_flag_pending: parseInt(pendingCustomFlags?.count) || 0,
        report_pending: parseInt(pendingReports?.count) || 0
      };

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('获取待办统计失败:', error);
      res.status(500).json({
        success: false,
        message: '获取待办统计失败'
      });
    }
  }

  /**
   * 获取待办列表（聚合所有类型）
   */
  static async getTodos(req, res) {
    try {
      const {
        current = 1,
        pageSize = 10,
        status = 'pending',
        type,
        priority
      } = req.query;

      logger.info('获取待办列表请求', { current, pageSize, status, type, priority });

      let todos = [];

      // 如果状态是已处理，从历史记录表中查询
      if (status === 'approved' || status === 'rejected' || status === 'processed') {
        const processedTodos = await TodoController.getProcessedTodos({
          current,
          pageSize,
          type,
          priority
        });
        return res.json({
          success: true,
          data: processedTodos
        });
      }

      // 查询待处理的待办事项
      // 1. 自定义旗帜审批
      if (!type || type === 'all' || type === 'custom_flag_approval') {
        const customFlagOrders = await db('custom_flag_orders')
          .join('users', 'custom_flag_orders.user_id', 'users.id')
          .where('custom_flag_orders.status', 'pending')
          .select(
            'custom_flag_orders.id',
            'custom_flag_orders.pattern_name',
            'custom_flag_orders.pattern_description',
            'custom_flag_orders.original_image_url',
            'custom_flag_orders.status',
            'custom_flag_orders.created_at',
            'custom_flag_orders.updated_at',
            'custom_flag_orders.user_id',
            'users.username',
            'users.display_name',
            'users.avatar_url'
          )
          .orderBy('custom_flag_orders.created_at', 'asc');

        customFlagOrders.forEach(order => {
          todos.push({
            id: order.id,
            type: 'custom_flag_approval',
            title: `自定义旗帜申请：${order.pattern_name}`,
            description: order.pattern_description || '无描述',
            status: 'pending',
            priority: 'medium',
            submitter: {
              id: order.user_id,
              username: order.username,
              nickname: order.display_name || order.username
            },
            created_at: order.created_at,
            updated_at: order.updated_at,
            flag_data: {
              id: order.id,
              pattern_name: order.pattern_name,
              rle_payload: null,
              preview_url: order.original_image_url,
              original_image_url: order.original_image_url,
              width: 100,
              height: 100,
              grid_x: 0,
              grid_y: 0
            }
          });
        });
      }

      // 2. 广告订单审批
      if (!type || type === 'all' || type === 'ad_approval') {
        const adOrders = await db('ad_orders')
          .join('users', 'ad_orders.user_id', 'users.id')
          .join('ad_products', 'ad_orders.ad_product_id', 'ad_products.id')
          .where('ad_orders.status', 'pending')
          .select(
            'ad_orders.id',
            'ad_orders.ad_title',
            'ad_orders.ad_description',
            'ad_orders.original_image_url',
            'ad_orders.status',
            'ad_orders.created_at',
            'ad_orders.updated_at',
            'ad_orders.user_id',
            'users.username',
            'users.display_name',
            'users.avatar_url',
            'ad_products.name as product_name',
            'ad_products.width',
            'ad_products.height'
          )
          .orderBy('ad_orders.created_at', 'asc');

        adOrders.forEach(order => {
          todos.push({
            id: order.id,
            type: 'ad_approval',
            title: `广告申请：${order.ad_title}`,
            description: order.ad_description || '无描述',
            status: 'pending',
            priority: 'high',
            submitter: {
              id: order.user_id,
              username: order.username,
              nickname: order.display_name || order.username
            },
            created_at: order.created_at,
            updated_at: order.updated_at,
            ad_data: {
              id: order.id,
              title: order.ad_title,
              content: order.ad_description,
              image_url: order.original_image_url,
              original_image_url: order.original_image_url,
              ad_data: null,
              product_name: order.product_name,
              width: order.width,
              height: order.height
            }
          });
        });
      }

      // 3. 举报审核
      if (!type || type === 'all' || type === 'report_review') {
        const reports = await db('reports')
          .join('users as reporter', 'reports.reporter_id', 'reporter.id')
          .where('reports.status', 'pending')
          .select(
            'reports.id',
            'reports.target_type',
            'reports.target_id',
            'reports.reason',
            'reports.description',
            'reports.metadata',
            'reports.status',
            'reports.created_at',
            'reports.updated_at',
            'reports.reporter_id',
            'reporter.username',
            'reporter.display_name',
            'reporter.avatar_url'
          )
          .orderBy('reports.created_at', 'asc');

        reports.forEach(report => {
          const reportTypeMap = {
            'pixel': '像素',
            'user': '用户',
            'message': '消息'
          };
          const reportedTypeName = reportTypeMap[report.target_type] || report.target_type;

          // 解析reason字段，转换为中文描述
          const reasonMap = {
            'porn': '色情内容',
            'violence': '暴力内容',
            'political': '政治内容',
            'spam': '垃圾信息',
            'abuse': '辱骂',
            'hate_speech': '仇恨言论',
            'inappropriate': '不当内容',
            'other': '其他'
          };
          const reasonText = reasonMap[report.reason] || report.reason;

          todos.push({
            id: report.id,
            type: 'report_review',
            title: `${reportedTypeName}举报：${reasonText}`,
            description: report.description || '无描述',
            status: 'pending',
            priority: 'high',
            submitter: {
              id: report.reporter_id,
              username: report.username,
              nickname: report.display_name || report.username
            },
            created_at: report.created_at,
            updated_at: report.updated_at,
            report_data: {
              id: report.id,
              target_type: reportedTypeName,
              target_id: report.target_id,
              reason: reasonText,
              description: report.description,
              metadata: report.metadata
            }
          });
        });
      }

      // 应用优先级筛选
      if (priority && priority !== 'all') {
        todos = todos.filter(todo => todo.priority === priority);
      }

      // 按创建时间排序
      todos.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

      // 分页
      const total = todos.length;
      const startIndex = (current - 1) * pageSize;
      const endIndex = startIndex + parseInt(pageSize);
      const paginatedTodos = todos.slice(startIndex, endIndex);

      logger.info('待办列表查询结果', { total, paginatedCount: paginatedTodos.length });

      res.json({
        success: true,
        data: {
          list: paginatedTodos,
          total: total,
          current: parseInt(current),
          pageSize: parseInt(pageSize)
        }
      });
    } catch (error) {
      logger.error('获取待办列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取待办列表失败'
      });
    }
  }

  /**
   * 获取已处理的待办列表
   */
  static async getProcessedTodos(params) {
    const { current = 1, pageSize = 10, type, priority } = params;

    try {
      // 构建基础查询条件
      let baseQuery = db('admin_todo_history');

      if (type && type !== 'all') {
        baseQuery = baseQuery.where('admin_todo_history.todo_type', type);
      }

      if (priority && priority !== 'all') {
        baseQuery = baseQuery.where('admin_todo_history.priority', priority);
      }

      // 获取总数（不需要 join 和 select）
      const totalResult = await baseQuery.clone().count('* as count').first();
      const total = parseInt(totalResult?.count) || 0;

      // 获取分页数据（添加 join 和 select）
      const histories = await baseQuery.clone()
        .join('users as submitter', 'admin_todo_history.submitter_id', 'submitter.id')
        .join('users as processor', 'admin_todo_history.processor_id', 'processor.id')
        .select(
          'admin_todo_history.*',
          'submitter.username as submitter_username',
          'submitter.display_name as submitter_nickname',
          'processor.username as processor_username',
          'processor.display_name as processor_nickname'
        )
        .orderBy('admin_todo_history.processed_at', 'desc')
        .limit(pageSize)
        .offset((current - 1) * pageSize);

      const processedTodos = histories.map(history => ({
        id: history.todo_id,
        type: history.todo_type,
        title: history.title,
        description: history.description,
        status: history.result_status,
        priority: history.priority,
        submitter: {
          id: history.submitter_id,
          username: history.submitter_username,
          nickname: history.submitter_nickname || history.submitter_username
        },
        created_at: history.created_at,
        updated_at: history.processed_at,
        processed_at: history.processed_at,
        processor: {
          id: history.processor_id,
          username: history.processor_username,
          nickname: history.processor_nickname || history.processor_username
        },
        process_notes: history.process_notes
      }));

      return {
        list: processedTodos,
        total: total,
        current: parseInt(current),
        pageSize: parseInt(pageSize)
      };
    } catch (error) {
      logger.error('获取已处理待办列表失败:', error);
      return {
        list: [],
        total: 0,
        current: 1,
        pageSize: 10
      };
    }
  }

  /**
   * 处理待办事项
   */
  static async processTodo(req, res) {
    try {
      const { id, type, action, reason } = req.body;

      logger.info('📋 处理待办事项请求', {
        id,
        type,
        action,
        reason,
        user: req.user ? {
          id: req.user.id,
          username: req.user.username,
          role: req.user.role
        } : null
      });

      // 检查用户身份
      if (!req.user || !req.user.id) {
        logger.error('未找到用户身份信息');
        return res.status(401).json({
          success: false,
          message: '未授权：缺少用户身份信息'
        });
      }

      const processorId = req.user.id;

      if (!id || !type || !action) {
        return res.status(400).json({
          success: false,
          message: '缺少必要参数'
        });
      }

      if (!['approve', 'reject', 'process'].includes(action)) {
        return res.status(400).json({
          success: false,
          message: '无效的操作类型'
        });
      }

      // 根据类型调用对应的处理逻辑
      let result;
      let todoData;

      switch (type) {
        case 'custom_flag_approval':
          // ✅ 修复：统一使用CustomFlagProcessor处理审批流程，确保Material系统正确集成
          try {
            const CustomFlagProcessor = require('../services/customFlagProcessor');

            if (action === 'approve') {
              await CustomFlagProcessor.approveCustomFlag(id, processorId, reason);
              result = {
                success: true,
                message: '自定义旗帜已批准'
              };
            } else if (action === 'reject') {
              await CustomFlagProcessor.rejectCustomFlag(id, processorId, reason);
              result = {
                success: true,
                message: '自定义旗帜已拒绝'
              };
            } else {
              result = {
                success: false,
                message: '无效的操作'
              };
            }
          } catch (error) {
            console.error('❌ 处理自定义旗帜失败:', error);
            result = {
              success: false,
              message: `处理失败: ${error.message}`
            };
          }
          todoData = await db('custom_flag_orders').where('id', id).first();
          break;

        case 'ad_approval':
          result = await TodoController.processAdOrder(id, action, reason, processorId);
          todoData = await db('ad_orders').where('id', id).first();
          break;

        case 'report_review':
          result = await TodoController.processReport(id, action, reason, processorId);
          todoData = await db('reports').where('id', id).first();
          break;

        default:
          return res.status(400).json({
            success: false,
            message: '不支持的待办类型'
          });
      }

      // 记录到处理历史（使用try-catch避免历史表问题影响主流程）
      if (result.success && todoData) {
        try {
          await TodoController.recordProcessHistory({
            todo_id: id,
            todo_type: type,
            submitter_id: todoData.user_id || todoData.reporter_id,
            processor_id: processorId,
            action: action,
            result_status: action === 'approve' ? 'approved' : (action === 'reject' ? 'rejected' : 'processed'),
            process_notes: reason,
            todo_data: todoData
          });
        } catch (historyError) {
          logger.warn('记录处理历史失败（不影响主流程）:', historyError);
        }
      }

      res.json(result);
    } catch (error) {
      logger.error('处理待办失败:', error);
      logger.error('错误堆栈:', error.stack);
      res.status(500).json({
        success: false,
        message: '处理失败',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * 处理自定义旗帜订单
   */
  static async processCustomFlagOrder(orderId, action, notes, processorId) {
    try {
      // 先检查订单当前状态
      const order = await db('custom_flag_orders').where('id', orderId).first();

      if (!order) {
        return {
          success: false,
          message: '自定义旗帜订单不存在'
        };
      }

      // 如果订单已经处理过，返回错误
      if (order.status !== 'pending') {
        return {
          success: false,
          message: `订单已处理，当前状态：${order.status}`
        };
      }

      const CustomFlagProcessor = require('../services/customFlagProcessor');

      if (action === 'approve') {
        await CustomFlagProcessor.approveCustomFlag(orderId, processorId, notes);
        return { success: true, message: '自定义旗帜已批准' };
      } else if (action === 'reject') {
        await CustomFlagProcessor.rejectCustomFlag(orderId, processorId, notes);
        return { success: true, message: '自定义旗帜已拒绝' };
      }

      return { success: false, message: '无效的操作' };
    } catch (error) {
      logger.error('处理自定义旗帜订单失败:', error);
      throw error;
    }
  }

  /**
   * 处理广告订单
   */
  static async processAdOrder(orderId, action, notes, processorId) {
    try {
      logger.info('📢 处理广告订单', {
        orderId,
        action,
        processorId,
        notes: notes ? notes.substring(0, 50) : null
      });

      // 先检查订单当前状态
      const order = await db('ad_orders').where('id', orderId).first();

      if (!order) {
        logger.warn('广告订单不存在', { orderId });
        return {
          success: false,
          message: '广告订单不存在'
        };
      }

      logger.info('订单当前状态', {
        orderId,
        currentStatus: order.status,
        userId: order.user_id,
        price: order.price
      });

      // 如果订单已经处理过，返回错误
      if (order.status !== 'pending') {
        logger.warn('订单已处理', {
          orderId,
          currentStatus: order.status
        });
        return {
          success: false,
          message: `订单已处理，当前状态：${order.status}`
        };
      }

      // 如果批准，需要处理广告图片
      if (action === 'approve') {
        try {
          // 获取广告商品信息
          const adProduct = await db('ad_products')
            .where('id', order.ad_product_id)
            .first();

          if (!adProduct) {
            logger.error('广告商品不存在', { adProductId: order.ad_product_id });
            return {
              success: false,
              message: '广告商品不存在'
            };
          }

          logger.info('开始处理广告图片', {
            productName: adProduct.name,
            width: adProduct.width,
            height: adProduct.height
          });

          // 处理用户上传的图片
          const ImageProcessor = require('../services/imageProcessor');
          const processedResult = await ImageProcessor.processAdImage(
            order.original_image_url,
            adProduct.width,
            adProduct.height
          );

          logger.info('广告图片处理完成', {
            width: processedResult.width,
            height: processedResult.height,
            pixelCount: processedResult.pixelCount
          });

          // 使用事务确保数据一致性
          await db.transaction(async (trx) => {
            // 更新订单状态并保存处理后的图像数据
            await trx('ad_orders')
              .where('id', orderId)
              .update({
                status: 'approved',
                processed_image_data: JSON.stringify(processedResult.pixelData),
                admin_notes: notes,
                processed_by: processorId,
                processed_at: new Date(),
                updated_at: new Date()
              });

            // 创建用户库存记录
            await trx('user_ad_inventory').insert({
              user_id: order.user_id,
              ad_order_id: order.id,
              ad_product_id: order.ad_product_id,
              ad_title: order.ad_title,
              processed_image_data: JSON.stringify(processedResult.pixelData),
              width: processedResult.width,
              height: processedResult.height,
              is_used: false,
              created_at: new Date()
            });
          });

          logger.info('广告订单批准成功', { orderId });
        } catch (processError) {
          logger.error('广告图片处理失败', {
            orderId,
            error: processError.message,
            stack: processError.stack
          });

          // 处理失败，退还积分
          const UserPoints = require('../models/UserPoints');
          await UserPoints.addPoints(order.user_id, order.price, '广告处理失败，退还积分', order.id);

          return {
            success: false,
            message: `广告处理失败: ${processError.message}`
          };
        }
      } else {
        // 如果拒绝，只更新订单状态
        await db('ad_orders')
          .where('id', orderId)
          .update({
            status: 'rejected',
            admin_notes: notes,
            processed_by: processorId,
            processed_at: new Date(),
            updated_at: new Date()
          });

        // 退还积分
        const UserPoints = require('../models/UserPoints');
        await UserPoints.addPoints(order.user_id, order.price, '广告订单被拒绝，退还积分', order.id);
        logger.info(`用户 ${order.user_id} 积分已退还${order.price}点`);
      }

      return {
        success: true,
        message: `广告订单已${action === 'approve' ? '批准' : '拒绝'}`
      };
    } catch (error) {
      logger.error('处理广告订单失败:', error);
      throw error;
    }
  }

  /**
   * 处理举报
   */
  static async processReport(reportId, action, notes, processorId) {
    try {
      // 先检查举报当前状态
      const report = await db('reports').where('id', reportId).first();

      if (!report) {
        return {
          success: false,
          message: '举报不存在'
        };
      }

      // 如果举报已经处理过，返回错误
      if (report.status !== 'pending') {
        return {
          success: false,
          message: `举报已处理，当前状态：${report.status}`
        };
      }

      const statusMap = {
        'approve': 'resolved',
        'reject': 'rejected'
      };

      const status = statusMap[action];

      if (!status) {
        return {
          success: false,
          message: '无效的处理操作'
        };
      }

      // 更新举报状态，使用正确的字段名
      await db('reports')
        .where('id', reportId)
        .update({
          status: status,
          assigned_admin_id: processorId, // 使用assigned_admin_id字段
          admin_note: notes, // 使用admin_note字段
          resolved_at: new Date(),
          updated_at: new Date()
        });

      return {
        success: true,
        message: `举报已${action === 'approve' ? '解决' : '驳回'}`
      };
    } catch (error) {
      logger.error('处理举报失败:', error);
      throw error;
    }
  }

  /**
   * 记录处理历史
   */
  static async recordProcessHistory(data) {
    try {
      const {
        todo_id,
        todo_type,
        submitter_id,
        processor_id,
        action,
        result_status,
        process_notes,
        todo_data
      } = data;

      // 生成标题和描述
      let title = '';
      let description = '';
      let priority = 'medium';

      switch (todo_type) {
        case 'custom_flag_approval':
          title = `自定义旗帜申请：${todo_data.pattern_name}`;
          description = todo_data.pattern_description || '无描述';
          priority = 'medium';
          break;
        case 'ad_approval':
          title = `广告申请：${todo_data.ad_title}`;
          description = todo_data.ad_description || '无描述';
          priority = 'high';
          break;
        case 'report_review':
          title = `举报：${todo_data.reason}`;
          description = todo_data.description || '无描述';
          priority = 'high';
          break;
      }

      await db('admin_todo_history').insert({
        todo_id: todo_id,
        todo_type: todo_type,
        title: title,
        description: description,
        priority: priority,
        submitter_id: submitter_id,
        processor_id: processor_id,
        action: action,
        result_status: result_status,
        process_notes: process_notes,
        created_at: todo_data.created_at,
        processed_at: new Date()
      });

      logger.info(`已记录处理历史: ${todo_type} - ${todo_id}`);
    } catch (error) {
      // 如果历史表不存在，不影响主流程
      logger.warn('记录处理历史失败:', error);
    }
  }

  /**
   * 处理单个待办事项的辅助方法（避免req/res参数）
   */
  static async processTodoById(id, type, action, reason, processorId) {
    try {
      if (!id || !type || !action) {
        return {
          success: false,
          message: '缺少必要参数'
        };
      }

      if (!['approve', 'reject', 'process'].includes(action)) {
        return {
          success: false,
          message: '无效的操作类型'
        };
      }

      // 根据类型调用对应的处理逻辑
      let result;
      let todoData;

      switch (type) {
        case 'custom_flag_approval':
          // ✅ 修复：统一使用CustomFlagProcessor处理审批流程，确保Material系统正确集成
          try {
            const CustomFlagProcessor = require('../services/customFlagProcessor');

            if (action === 'approve') {
              await CustomFlagProcessor.approveCustomFlag(id, processorId, reason);
              result = {
                success: true,
                message: '自定义旗帜已批准'
              };
            } else if (action === 'reject') {
              await CustomFlagProcessor.rejectCustomFlag(id, processorId, reason);
              result = {
                success: true,
                message: '自定义旗帜已拒绝'
              };
            } else {
              result = {
                success: false,
                message: '无效的操作'
              };
            }
          } catch (error) {
            console.error('❌ 处理自定义旗帜失败:', error);
            result = {
              success: false,
              message: `处理失败: ${error.message}`
            };
          }
          todoData = await db('custom_flag_orders').where('id', id).first();
          break;

        case 'ad_approval':
          result = await TodoController.processAdOrder(id, action, reason, processorId);
          todoData = await db('ad_orders').where('id', id).first();
          break;

        case 'report_review':
          result = await TodoController.processReport(id, action, reason, processorId);
          todoData = await db('reports').where('id', id).first();
          break;

        default:
          return {
            success: false,
            message: '不支持的待办类型'
          };
      }

      // 记录到处理历史（使用try-catch避免历史表问题影响主流程）
      if (result.success && todoData) {
        try {
          await TodoController.recordProcessHistory({
            todo_id: id,
            todo_type: type,
            submitter_id: todoData.user_id || todoData.reporter_id,
            processor_id: processorId,
            action: action,
            result_status: action === 'approve' ? 'approved' : (action === 'reject' ? 'rejected' : 'processed'),
            process_notes: reason,
            todo_data: todoData
          });
        } catch (historyError) {
          logger.warn('记录处理历史失败（不影响主流程）:', historyError);
        }
      }

      return result;
    } catch (error) {
      logger.error('处理待办失败:', error);
      return {
        success: false,
        message: '处理失败'
      };
    }
  }

  /**
   * 批量处理待办事项
   */
  static async batchProcess(req, res) {
    try {
      const { ids, action, reason } = req.body;
      const processorId = req.user.id;

      logger.info('批量处理请求', { ids, action, processorId });

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: '请选择要处理的待办事项'
        });
      }

      const results = {
        success: 0,
        failed: 0,
        errors: []
      };

      for (const id of ids) {
        try {
          // 首先获取待办事项类型
          let todoType = null;
          let todoData = null;

          // 从各个表中查找待办事项
          const [customFlag, adOrder, report] = await Promise.all([
            db('custom_flag_orders').where('id', id).first().catch(() => null),
            db('ad_orders').where('id', id).first().catch(() => null),
            db('reports').where('id', id).first().catch(() => null)
          ]);

          if (customFlag) {
            todoType = 'custom_flag_approval';
            todoData = customFlag;
          } else if (adOrder) {
            todoType = 'ad_approval';
            todoData = adOrder;
          } else if (report) {
            todoType = 'report_review';
            todoData = report;
          }

          if (!todoType) {
            results.failed++;
            results.errors.push({ id, message: '未找到待办事项' });
            continue;
          }

          const result = await TodoController.processTodoById(id, todoType, action, reason, processorId);
          if (result.success) {
            results.success++;
          } else {
            results.failed++;
            results.errors.push({ id, message: result.message });
          }
        } catch (error) {
          logger.error(`处理待办事项 ${id} 失败:`, error);
          results.failed++;
          results.errors.push({ id, message: error.message });
        }
      }

      res.json({
        success: true,
        data: results,
        message: `批量处理完成：成功 ${results.success} 个，失败 ${results.failed} 个`
      });
    } catch (error) {
      logger.error('批量处理失败:', error);
      res.status(500).json({
        success: false,
        message: '批量处理失败'
      });
    }
  }
}

module.exports = TodoController;
