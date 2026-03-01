const express = require('express');
const router = express.Router();
const ReportController = require('../controllers/reportController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// 测试路由 - 验证后端是否运行修改后的代码（不需要认证）
router.get('/admin/test', (req, res) => {
  console.log('🔍 测试路由被调用，后端代码已更新');
  
  res.json({ 
    success: true, 
    message: '后端代码已更新',
    timestamp: new Date().toISOString()
  });
});

// 测试路由 - 验证JWT token传递（需要认证）
router.get('/admin/test-auth', (req, res) => {
  console.log('🔍 认证测试路由被调用，用户信息:', {
    hasUser: !!req.user,
    userId: req.user?.id,
    role: req.user?.role,
    is_admin: req.user?.is_admin,
    headers: req.headers
  });
  
  res.json({ 
    success: true, 
    message: '认证测试成功',
    user: req.user ? {
      id: req.user.id,
      role: req.user.role,
      is_admin: req.user.is_admin
    } : null,
    timestamp: new Date().toISOString()
  });
});

// 测试路由 - 手动验证JWT token（不需要认证）
router.get('/admin/test-jwt', (req, res) => {
  const jwt = require('jsonwebtoken');
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  console.log('🔍 JWT测试路由被调用:', {
    hasAuthHeader: !!authHeader,
    authHeader: authHeader,
    hasToken: !!token,
    tokenStart: token ? token.substring(0, 20) + '...' : 'null'
  });
  
  if (!token) {
    return res.json({ success: false, message: '无token' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    console.log('🔍 JWT解析成功:', decoded);
    
    res.json({ 
      success: true, 
      message: 'JWT解析成功',
      decoded: decoded,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.log('🔍 JWT解析失败:', error.message);
    res.json({ 
      success: false, 
      message: 'JWT解析失败',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 测试路由 - 验证JWT token传递（不需要认证）
router.get('/admin/test-jwt-pass', (req, res) => {
  const jwt = require('jsonwebtoken');
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  console.log('🔍 JWT传递测试路由被调用:', {
    hasAuthHeader: !!authHeader,
    authHeader: authHeader,
    hasToken: !!token,
    tokenStart: token ? token.substring(0, 20) + '...' : 'null'
  });
  
  if (!token) {
    return res.json({ success: false, message: '无token' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    console.log('🔍 JWT解析成功:', decoded);
    
    res.json({ 
      success: true, 
      message: 'JWT解析成功',
      decoded: decoded,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.log('🔍 JWT解析失败:', error.message);
    res.json({ 
      success: false, 
      message: 'JWT解析失败',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 所有其他路由都需要认证
router.use(authenticateToken);

// 测试路由 - 验证认证中间件（需要认证）
router.get('/admin/test-auth-middleware', (req, res) => {
  console.log('🔍 认证中间件测试路由被调用，用户信息:', {
    hasUser: !!req.user,
    userId: req.user?.id,
    role: req.user?.role,
    is_admin: req.user?.is_admin
  });

  res.json({
    success: true,
    message: '认证中间件测试成功',
    user: req.user ? {
      id: req.user.id,
      role: req.user.role,
      is_admin: req.user.is_admin
    } : null,
    timestamp: new Date().toISOString()
  });
});

// 用户举报相关路由
router.post('/', ReportController.createReport);
router.get('/my/history', ReportController.getUserReports);
router.get('/my/limit-status', ReportController.getReportLimitStatus);

// 管理员路由 - 需要管理员权限
router.get('/admin/dashboard', requireAdmin, ReportController.getAdminDashboard);
router.get('/admin/list', requireAdmin, ReportController.getReports);
router.get('/admin/statistics', requireAdmin, ReportController.getReportStatistics);
router.get('/admin/:reportId', requireAdmin, ReportController.getReportById);
router.put('/admin/:reportId/assign', requireAdmin, ReportController.assignReport);
router.put('/admin/:reportId/resolve', requireAdmin, ReportController.resolveReport);

module.exports = router;