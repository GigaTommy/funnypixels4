# 共享模块 (Shared)

前后端共享的类型定义、工具函数、常量和数据模式。

## 目录结构

```
shared/
├── types/                   # TypeScript类型定义
├── utils/                   # 工具函数
├── constants/               # 常量定义
├── schemas/                 # 数据验证模式
├── package.json             # 依赖配置
└── README.md                # 说明文档
```

## 类型定义 (types/)

### 核心数据类型

```typescript
// 用户相关类型
export interface User {
  id: string;
  username: string;
  email: string;
  points: number;
  lastActivity: Date;
  createdAt: Date;
  updatedAt: Date;
}

// 像素相关类型
export interface Pixel {
  id: string;
  gridId: string;
  lat: number;
  lng: number;
  color: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

// 网格相关类型
export interface Grid {
  id: string;
  centerLat: number;
  centerLng: number;
  boundsLatMin: number;
  boundsLatMax: number;
  boundsLngMin: number;
  boundsLngMax: number;
  pixelCount: number;
  lastUpdated: Date;
}

// API响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// WebSocket消息类型
export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: number;
}
```

### 枚举类型

```typescript
// 用户状态
export enum UserStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  AWAY = 'away',
}

// 像素操作类型
export enum PixelOperation {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
}

// 地图模式
export enum MapMode {
  MANUAL = 'manual',
  TEST = 'test',
  REAL = 'real',
}
```

## 工具函数 (utils/)

### 网格计算工具

```typescript
// 网格ID生成
export function getGridId(lat: number, lng: number): string {
  const gridX = Math.floor((lng + 180) / GRID_RESOLUTION);
  const gridY = Math.floor((lat + 90) / GRID_RESOLUTION);
  return `grid_${gridX}_${gridY}`;
}

// 网格边界计算
export function getGridBounds(gridId: string): GridBounds {
  // 实现网格边界计算逻辑
}

// 坐标验证
export function isValidCoordinate(lat: number, lng: number): boolean {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}
```

### 颜色工具

```typescript
// 颜色验证
export function isValidColor(color: string): boolean {
  return /^#[0-9A-F]{6}$/i.test(color);
}

// 随机颜色生成
export function generateRandomColor(): string {
  return '#' + Math.floor(Math.random() * 16777215).toString(16);
}
```

### 时间工具

```typescript
// 时间戳转换
export function toUnixTimestamp(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

// 时间格式化
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString();
}
```

## 常量定义 (constants/)

### 系统常量

```typescript
// 网格分辨率
export const GRID_RESOLUTION = 0.0001; // 约120平方米

// 用户点数配置
export const PIXEL_POINTS_CONFIG = {
  INIT_POINTS: 64,
  MAX_POINTS: 64,
  ACCUM_INTERVAL: 10, // 秒
  FREEZE_SECONDS: 10,
} as const;

// 地图配置
export const MAP_CONFIG = {
  MIN_ZOOM: 1,
  MAX_ZOOM: 17.5, // 按照高德地图API 2.0规范调整最大缩放级别
  MIN_DRAW_ZOOM: 10, // 调整为10级开始渲染，按照高德地图API 2.0规范
  DEFAULT_CENTER: [30, 120] as [number, number],
  DEFAULT_ZOOM: 12, // 调整为12级，确保在10级以上可以显示像素
} as const;

// API配置
export const API_CONFIG = {
  TIMEOUT: 10000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
} as const;
```

### 错误码定义

```typescript
export const ERROR_CODES = {
  INVALID_COORDINATES: 'INVALID_COORDINATES',
  INSUFFICIENT_POINTS: 'INSUFFICIENT_POINTS',
  GRID_NOT_FOUND: 'GRID_NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
} as const;
```

## 数据验证模式 (schemas/)

### Zod验证模式

```typescript
import { z } from 'zod';

// 用户创建模式
export const UserCreateSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(8),
});

// 像素创建模式
export const PixelCreateSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  color: z.string().regex(/^#[0-9A-F]{6}$/i),
  userId: z.string().uuid(),
});

// API请求模式
export const ApiRequestSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE']),
  path: z.string(),
  headers: z.record(z.string()).optional(),
  body: z.any().optional(),
});
```

## 使用指南

### 前端使用

```typescript
// 安装共享包
npm install ../shared

// 导入类型和工具
import { Pixel, getGridId, PIXEL_POINTS_CONFIG } from '@gpmvp/shared';

// 使用类型
const pixel: Pixel = {
  id: 'uuid',
  gridId: getGridId(30.1, 120.1),
  lat: 30.1,
  lng: 120.1,
  color: '#ff0000',
  userId: 'user-uuid',
  createdAt: new Date(),
  updatedAt: new Date(),
};
```

### 后端使用

```typescript
// 安装共享包
npm install ../shared

// 导入验证模式
import { PixelCreateSchema } from '@gpmvp/shared/schemas';

// 验证请求数据
const validatedData = PixelCreateSchema.parse(request.body);
```

## 开发规范

1. **类型定义**: 使用TypeScript接口和类型别名
2. **工具函数**: 保持纯函数，无副作用
3. **常量**: 使用const断言确保类型安全
4. **验证模式**: 使用Zod进行运行时验证
5. **文档**: 为所有公共API添加JSDoc注释

## 版本管理

- 遵循语义化版本控制
- 重大变更需要更新主版本号
- 保持向后兼容性
- 提供迁移指南
