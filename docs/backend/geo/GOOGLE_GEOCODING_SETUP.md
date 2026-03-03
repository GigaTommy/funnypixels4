# Google Geocoding API 配置指南

## 📊 当前配置状态

### ✅ 高德地图API（中国境内）
```bash
AMAP_API_KEY=490fb8631cb2d380b9ec90b459ffda60  # ✅ 已配置
```
- **状态**: 正常工作
- **覆盖范围**: 中国境内（lat: 3-54, lng: 73-136）
- **使用场景**: 92.97%的像素（423/455）

### ❌ Google Maps API（海外）
```bash
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here  # ❌ 占位符，未配置
USE_GOOGLE_GEOCODING=true  # ✅ 已启用，但缺少API Key
```
- **状态**: 未配置，降级到 Regions DB
- **影响**: 32个海外像素无法获取精确geo信息
- **覆盖范围**: 中国境外所有地区

---

## 🌍 自动切换机制（已实现）

### 工作原理

系统已内置智能路由，**无需手动配置**：

```javascript
// asyncGeocodingService.js:350-409
const inChina = amapWebService.isInChina(latitude, longitude);

if (inChina) {
  // ── 中国境内路由 ──
  // 1️⃣ 高德地图Web服务API (优先)
  // 2️⃣ Regions数据库 (降级)
  // 3️⃣ 旧版高德API (兜底)
} else {
  // ── 海外路由 ──
  // 1️⃣ Google Geocoding API (优先) ← 需要API Key
  // 2️⃣ 高德地图Web服务 (降级，精度较低)
  // 3️⃣ Regions数据库 (兜底)
}
```

### 坐标判断逻辑

```javascript
// amapWebService.js
isInChina(lat, lng) {
  // 中国境内粗略边界（包含港澳台）
  return lat >= 3 && lat <= 54 && lng >= 73 && lng <= 136;
}
```

### 切换流程图

```
像素绘制 (lat, lng)
    ↓
判断坐标位置
    ↓
    ├─→ 中国境内？
    │   ├─→ ✅ 高德API → 成功返回
    │   └─→ ❌ 降级到 Regions DB
    │
    └─→ 海外？
        ├─→ Google API配置？
        │   ├─→ ✅ Google API → 成功返回
        │   └─→ ❌ 降级到高德API（精度低）→ Regions DB
```

---

## 🔑 Google Maps API 申请指南

### 步骤1: 创建Google Cloud项目

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 登录Google账号（需要有效信用卡，但有免费额度）
3. 点击顶部导航栏 **"选择项目"** → **"新建项目"**
4. 输入项目名称：`FunnyPixels`
5. 点击 **"创建"**

### 步骤2: 启用Geocoding API

1. 在项目中，导航到 **"API和服务"** → **"库"**
2. 搜索 `Geocoding API`
3. 点击 **"Geocoding API"**
4. 点击 **"启用"**

### 步骤3: 创建API凭据

1. 导航到 **"API和服务"** → **"凭据"**
2. 点击 **"创建凭据"** → **"API密钥"**
3. 复制生成的API密钥（格式：`AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`）
4. **重要**: 点击 **"限制密钥"**

### 步骤4: 配置API密钥限制（安全必备）

#### 应用限制
- 选择 **"IP地址（网络服务器）"**
- 添加你的服务器IP地址：
  ```
  # 开发环境
  127.0.0.1
  192.168.1.23

  # 生产环境
  your.production.server.ip
  ```

#### API限制
- 选择 **"限制密钥"**
- 勾选 **"Geocoding API"**
- 保存

### 步骤5: 配置到项目

编辑 `backend/.env`：

```bash
# Google Maps API配置（海外地理编码）
GOOGLE_MAPS_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX  # 替换为你的真实API Key
USE_GOOGLE_GEOCODING=true
```

### 步骤6: 重启后端服务

```bash
# 如果使用 nodemon（自动重启）
touch backend/src/server.js

# 或手动重启
pm2 restart funnypixels-backend
```

---

## 💰 费用说明

### Google Maps免费额度（2026年标准）

| 服务 | 每月免费额度 | 超出费用 |
|------|--------------|----------|
| **Geocoding API** | 前 $200 免费积分 | $5/1000次请求 |

#### 免费额度计算

```
每月免费积分: $200
每次请求费用: $5/1000 = $0.005
免费请求次数: $200 / $0.005 = 40,000次/月
```

**对于FunnyPixels项目**:
- 当前32个海外像素
- 即使每月新增1000个海外像素
- **完全在免费额度内** ✅

### 成本优化建议

1. **启用缓存**（已实现）
   ```javascript
   // 24小时缓存，同坐标复用
   this.cacheTTL = 24 * 60 * 60 * 1000;
   ```

2. **设置配额限制**
   - Google Cloud Console → API → Geocoding API → 配额
   - 设置每日上限：1000次（防止意外超支）

3. **监控使用情况**
   ```bash
   # 查看API使用统计
   Google Cloud Console → API和服务 → 信息中心
   ```

---

## 🧪 测试验证

### 1. 检查服务状态

```bash
node -e "
const googleGeocodingService = require('./src/services/googleGeocodingService');
console.log('Google Geocoding 状态:', googleGeocodingService.getServiceStatus());
"
```

**预期输出**:
```json
{
  "available": true,
  "apiKey": "configured",
  "baseUrl": "https://maps.googleapis.com/maps/api/geocode/json",
  "cache": {
    "size": 0,
    "maxSize": 5000,
    "ttl": 86400000
  }
}
```

### 2. 测试海外坐标逆地理编码

```bash
node -e "
const googleGeocodingService = require('./src/services/googleGeocodingService');

(async () => {
  // 测试纽约时代广场
  const result = await googleGeocodingService.reverseGeocode(40.758896, -73.985130);
  console.log('纽约测试:', result);

  // 测试伦敦
  const result2 = await googleGeocodingService.reverseGeocode(51.5074, -0.1278);
  console.log('伦敦测试:', result2);

  process.exit(0);
})();
"
```

**预期输出**:
```javascript
纽约测试: {
  country: 'United States',
  province: 'New York',
  city: 'New York',
  district: 'Manhattan',
  formatted_address: 'Times Square, New York, NY 10036, USA',
  geocoded: true
}

伦敦测试: {
  country: 'United Kingdom',
  province: 'England',
  city: 'London',
  district: 'Westminster',
  formatted_address: 'London SW1A 1AA, UK',
  geocoded: true
}
```

### 3. 回填海外像素

配置完成后，运行回填脚本更新32个海外像素：

```bash
node scripts/batch-geocode-pixels.js
```

---

## 🔧 高级配置

### 1. 调整海外路由优先级

如果Google API费用过高，可以优先使用免费的Regions DB：

编辑 `backend/src/services/asyncGeocodingService.js:370-409`：

```javascript
// 海外路由调整
if (!inChina) {
  // 方案A: Google优先（精度高，有费用）
  // 1. Google Geocoding API
  // 2. 高德降级
  // 3. Regions DB

  // 方案B: Regions DB优先（免费，精度中等）
  // 1. Regions DB
  // 2. Google Geocoding API（仅Regions失败时）
  // 3. 高德降级
}
```

### 2. 语言本地化

Google API支持多语言响应：

```javascript
// googleGeocodingService.js:55
const url = `${this.baseUrl}?latlng=${latitude},${longitude}&key=${this.apiKey}&language=zh-CN`;  // 改为中文
```

支持语言：
- `en` - 英语（默认）
- `zh-CN` - 简体中文
- `ja` - 日语
- `ko` - 韩语
- 等...

### 3. 结果类型过滤

只获取特定类型的地址：

```javascript
const url = `${this.baseUrl}?latlng=${latitude},${longitude}&key=${this.apiKey}&result_type=locality|administrative_area_level_1`;
```

---

## 📊 监控和告警

### 1. 每日API使用报告

创建脚本 `scripts/google-api-usage.js`：

```javascript
const googleGeocodingService = require('../src/services/googleGeocodingService');
const { db } = require('../src/config/database');

async function reportUsage() {
  // 统计使用Google API编码的像素（海外像素）
  const result = await db('pixels')
    .where('geocoded', true)
    .whereNotNull('country')
    .where('country', '!=', '中国')
    .where('country', '!=', 'Unknown')
    .count('* as count')
    .first();

  console.log(`📊 海外像素统计: ${result.count}`);
  console.log(`💰 预估费用: $${(result.count * 0.005).toFixed(2)}`);
}

reportUsage();
```

### 2. 配额告警

在 `asyncGeocodingService.js` 中添加：

```javascript
// 每日配额限制（防止超支）
const DAILY_GOOGLE_QUOTA = 1000;
let dailyGoogleCount = 0;

async processSingleTask(task) {
  // ...
  if (!inChina && googleGeocodingService.isAvailable()) {
    if (dailyGoogleCount >= DAILY_GOOGLE_QUOTA) {
      logger.warn('⚠️ Google API 每日配额已达上限，降级到其他服务');
      // 使用降级方案
    } else {
      const result = await googleGeocodingService.reverseGeocode(...);
      dailyGoogleCount++;
    }
  }
}
```

---

## 🚨 故障排查

### 问题1: API Key无效

**症状**: 日志显示 `API 返回非 OK 状态: REQUEST_DENIED`

**解决**:
1. 检查API Key是否正确复制（无空格、完整）
2. 确认Geocoding API已启用
3. 检查API密钥限制（IP地址是否匹配）

### 问题2: 超出免费额度

**症状**: `OVER_QUERY_LIMIT`

**解决**:
1. 检查Google Cloud Console使用量
2. 启用计费账号或等待下月重置
3. 临时禁用Google API：
   ```bash
   USE_GOOGLE_GEOCODING=false
   ```

### 问题3: 响应速度慢

**症状**: 海外像素编码超过5秒

**解决**:
1. 检查网络连接（国内访问Google可能较慢）
2. 调整超时时间：
   ```javascript
   // googleGeocodingService.js:60
   https.get(url, { timeout: 15000 }, ...)  // 增加到15秒
   ```
3. 启用CDN加速（如Cloudflare Workers）

---

## 📚 参考资源

- [Google Geocoding API官方文档](https://developers.google.com/maps/documentation/geocoding/overview)
- [API密钥最佳实践](https://developers.google.com/maps/api-security-best-practices)
- [定价和配额](https://developers.google.com/maps/billing-and-pricing/pricing)
- [逆地理编码请求示例](https://developers.google.com/maps/documentation/geocoding/requests-reverse-geocoding)

---

## ✅ 配置检查清单

配置完成后，逐项检查：

- [ ] Google Cloud项目已创建
- [ ] Geocoding API已启用
- [ ] API密钥已创建
- [ ] API密钥已限制（IP地址 + API范围）
- [ ] `.env`文件已更新（GOOGLE_MAPS_API_KEY）
- [ ] 后端服务已重启
- [ ] 服务状态测试通过（`getServiceStatus()`）
- [ ] 海外坐标测试通过（纽约、伦敦等）
- [ ] 32个海外像素已回填
- [ ] 监控告警已设置（可选）

---

**配置完成后，系统将自动为海外像素提供精确的地理编码信息！** 🌍
