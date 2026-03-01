# Admin Frontend Documentation

Admin Frontend 模块的文档中心，包含管理界面文档、功能说明、开发指南等。

## 📁 目录结构

### `/reports/`
开发和维护报告
- `FEATURE_ANALYSIS.md` - 功能分析文档

### `/scripts/`
开发和维护脚本
- `temp_div_fix.cjs` - 临时DIV修复脚本
- `temp_fix.cjs` - 临时修复脚本

## 📖 使用说明

### 开发环境
```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

### 构建配置
```bash
# TypeScript 配置
tsconfig.json          # 主TypeScript配置
tsconfig.node.json     # Node.js TypeScript配置

# ESLint 配置
.eslintrc.js          # ESLint规则配置
```

## 🏗️ 技术架构
- **React 18** - 主框架
- **TypeScript** - 类型系统
- **Vite** - 构建工具
- **Ant Design** - UI组件库
- **React Router** - 路由管理

## 🔧 管理功能
- **用户管理** - 用户信息管理和权限控制
- **内容审核** - 像素内容和图案审核
- **系统监控** - 系统状态和性能监控
- **数据统计** - 用户数据和业务统计
- **配置管理** - 系统配置和参数管理

## 🚀 部署说明
管理前端通常部署在独立的子域名或路径：
- 开发环境: `http://localhost:3001`
- 生产环境: `https://admin.funnypixels.com`

## ⚠️ 注意事项
- 管理界面需要管理员权限访问
- 临时脚本文件仅用于开发调试
- 生产环境部署前请清理临时文件
- 配置文件中的敏感信息应使用环境变量

## 📊 功能模块
1. **仪表盘** - 系统概览和关键指标
2. **用户管理** - 用户列表、权限管理
3. **内容管理** - 像素审核、图案管理
4. **系统设置** - 配置管理、系统维护
5. **数据报表** - 统计分析、导出功能