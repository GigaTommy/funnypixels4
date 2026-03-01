# FunnyPixels 前端

## 项目概述

这是一个基于高德地图JS API 2.0的像素战争游戏前端项目。项目使用 React + TypeScript + Vite 构建，专门针对中国用户优化。

## 地图模式

项目现在**只支持高德地图模式**，已移除其他地图服务以简化架构：

- ✅ **高德地图 JS API 2.0** - 使用最新版本的高德地图API，支持中文，针对中国用户优化
- ❌ ~~OpenStreetMap~~ - 已移除
- ❌ ~~CartoDB~~ - 已移除
- ❌ ~~离线模式~~ - 已移除

## 技术栈

- **React 18** - 前端框架
- **TypeScript** - 类型安全
- **Vite** - 构建工具
- **高德地图 JS API 2.0** - 最新版本地图服务
- **Socket.IO** - 实时通信
- **Tailwind CSS** - 样式框架

## 环境配置

### 必需的环境变量

在 `.env` 文件中配置：

```env
VITE_AMAP_API_KEY=your_amap_api_key
VITE_AMAP_API_VERSION=2.0
```

### 获取高德地图API密钥

1. 访问 [高德开放平台](https://lbs.amap.com/)
2. 注册账号并创建应用
3. 获取 JavaScript API 密钥
4. 配置到环境变量中

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产版本
npm run preview

# 修复高德地图配置问题
npm run fix-amap
```

## 项目结构

```
src/
├── components/
│   └── map/
│       └── AmapCanvas.tsx          # 高德地图组件 (JS API 2.0)
├── config/
│   └── mapConfig.ts               # 地图配置
├── utils/
│   ├── grid.ts                    # 网格工具
│   ├── pixelPoints.ts             # 像素点工具
│   ├── performanceMonitor.ts      # 性能监控
│   └── test-integration.ts        # 集成测试
├── services/
│   ├── api.ts                     # API服务
│   └── socket.ts                  # Socket服务
└── app.tsx                        # 主应用组件
```

## 功能特性

- 🗺️ **高德地图JS API 2.0** - 最新版本地图API，性能更优
- 🎨 **像素绘制** - 使用Rectangle绘制方形像素，更精确
- 🔄 **实时同步** - Socket.IO实时数据同步
- 📱 **响应式设计** - 支持移动端和桌面端
- ⚡ **性能优化** - 虚拟化渲染和缓存机制
- 🎛️ **交互控制** - 颜色选择、绘制模式切换、像素管理

## 像素绘制实现

### 技术细节

- **绘制方式**: 使用 `AMap.Rectangle` 绘制方形像素
- **像素大小**: 0.0001度约等于11米
- **边界计算**: 以点击点为中心，计算矩形边界
- **重复检测**: 防止在同一位置重复绘制像素

### 绘制流程

1. 用户点击地图
2. 检查绘制模式是否开启
3. 计算像素边界
4. 创建Rectangle覆盖物
5. 添加到地图并存储引用
6. 更新状态和计数

## 故障排除

### INVALID_USER_DOMAIN 错误

如果您遇到 `INVALID_USER_DOMAIN` 错误，请按照以下步骤解决：

1. **运行修复脚本**：
   ```bash
   npm run fix-amap
   ```

2. **在高德开放平台配置域名白名单**：
   - 访问 [高德开放平台控制台](https://console.amap.com/)
   - 找到您的应用
   - 在"应用设置"中添加以下域名：
     ```
     localhost
     127.0.0.1
     localhost:5173
     localhost:5174
     localhost:3000
     localhost:8080
     ```

3. **重启开发服务器**：
   ```bash
   npm run dev
   ```

### 其他常见问题

#### 地图不显示
- 检查API密钥是否正确配置
- 确认网络连接正常
- 查看浏览器控制台错误信息

#### 像素绘制失败
- 检查后端服务是否正常运行
- 确认Socket连接状态
- 验证用户权限和点数

#### API版本问题
- 确保使用JS API 2.0版本
- 检查插件加载是否正确

## 注意事项

1. **API密钥** - 必须配置有效的高德地图API密钥
2. **网络访问** - 需要访问高德地图服务器
3. **浏览器兼容** - 支持现代浏览器（Chrome、Firefox、Safari、Edge）
4. **API版本** - 使用JS API 2.0，确保最佳性能
5. **域名白名单** - 必须在高德控制台配置允许的域名

## 更新日志

### v2.0.0
- 升级到高德地图JS API 2.0
- 使用Rectangle绘制方形像素
- 添加交互控制面板
- 优化像素管理机制
- 添加错误处理和修复工具
- 移除多地图模式，专注高德地图
- 简化项目架构
- 优化性能和用户体验
