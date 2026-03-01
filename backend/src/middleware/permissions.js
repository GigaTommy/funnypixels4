/**
 * 基于角色的权限控制中间件
 * 角色层级：user < admin < super_admin
 */

// 角色层级定义
const ROLE_HIERARCHY = {
  user: 0,
  admin: 1,
  super_admin: 2
};

/**
 * 检查用户是否具有指定角色或更高权限
 * @param {string} requiredRole - 所需的最低角色
 * @returns {Function} Express中间件函数
 */
const checkPermission = (requiredRole) => {
  return (req, res, next) => {
    // 确保用户已认证
    if (!req.user) {
      return res.status(401).json({ error: '需要认证' });
    }

    const userRole = req.user.role || 'user';
    
    // 检查角色层级
    if (ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole]) {
      next();
    } else {
      res.status(403).json({ 
        error: '权限不足',
        message: `需要 ${requiredRole} 或更高权限，当前权限: ${userRole}`
      });
    }
  };
};

/**
 * 检查用户是否为超级管理员
 */
const requireSuperAdmin = checkPermission('super_admin');

/**
 * 检查用户是否为管理员或更高权限
 */
const requireAdmin = checkPermission('admin');

/**
 * 检查用户是否为普通用户或更高权限（实际上所有认证用户都可以）
 */
const requireUser = checkPermission('user');

/**
 * 检查用户是否具有特定权限（用于更细粒度的权限控制）
 * @param {string} permission - 权限名称
 * @returns {Function} Express中间件函数
 */
const checkSpecificPermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: '需要认证' });
    }

    const userRole = req.user.role || 'user';
    
    // 权限映射表
    const permissionMap = {
      // 公告权限
      'announcements.create_global': ['admin', 'super_admin'],
      'announcements.create_system': ['super_admin'],
      'announcements.create_alliance': ['user', 'admin', 'super_admin'],
      
      // 用户管理权限
      'users.manage': ['admin', 'super_admin'],
      'users.delete': ['super_admin'],
      
      // 联盟管理权限
      'alliances.manage': ['admin', 'super_admin'],
      'alliances.delete': ['super_admin'],
      
      // 系统设置权限
      'system.settings': ['super_admin'],
      'system.maintenance': ['super_admin']
    };

    const allowedRoles = permissionMap[permission] || ['super_admin'];
    
    if (allowedRoles.includes(userRole) || ROLE_HIERARCHY[userRole] >= Math.max(...allowedRoles.map(role => ROLE_HIERARCHY[role]))) {
      next();
    } else {
      res.status(403).json({ 
        error: '权限不足',
        message: `需要权限: ${permission}`
      });
    }
  };
};

module.exports = {
  checkPermission,
  requireSuperAdmin,
  requireAdmin,
  requireUser,
  checkSpecificPermission,
  ROLE_HIERARCHY
};
