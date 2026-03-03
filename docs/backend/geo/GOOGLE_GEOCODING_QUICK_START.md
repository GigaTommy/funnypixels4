# Google Geocoding API 快速配置

## 📊 当前状态

### ✅ 已完成
- **高德API**: 已配置，覆盖中国境内（92.97%像素）
- **自动路由**: 已实现，中国境内用高德，海外用Google
- **缓存机制**: 已启用，24小时缓存减少API调用

### ❌ 待完成
- **Google API**: 未配置（占位符 `your_google_maps_api_key_here`）
- **影响**: 32个海外像素无法获取精确geo信息

---

## 🚀 5分钟快速配置

### 1️⃣ 申请Google API Key（免费）

1. 访问 https://console.cloud.google.com/
2. 创建项目 → 启用"Geocoding API" → 创建API密钥
3. 限制密钥（必须）：
   - IP限制：添加服务器IP
   - API限制：仅"Geocoding API"

**费用**: 每月$200免费额度 = 40,000次请求（远超项目需求）

### 2️⃣ 配置到项目

编辑 `backend/.env`：

```bash
# 将占位符替换为真实API Key
GOOGLE_MAPS_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
USE_GOOGLE_GEOCODING=true
```

### 3️⃣ 重启后端

```bash
# nodemon会自动重启，或手动：
touch backend/src/server.js
```

### 4️⃣ 测试验证

```bash
cd backend
node scripts/test-google-geocoding.js
```

**预期输出**:
```
✅ 纽约时代广场: United States, New York
✅ 伦敦大本钟: United Kingdom, London
✅ 东京塔: Japan, Tokyo
🎉 所有测试通过！
```

### 5️⃣ 回填海外像素

```bash
node scripts/batch-geocode-pixels.js
```

---

## 🌍 自动切换机制（已实现，无需配置）

```
像素绘制 → 判断坐标
    ↓
┌─────────────┬─────────────┐
│  中国境内   │   海外      │
│  (92.97%)   │   (7.03%)   │
├─────────────┼─────────────┤
│ ✅ 高德API  │ Google API  │
│             │  ↓ 未配置   │
│             │ ⚠️ 降级高德 │
│             │  (精度低)   │
└─────────────┴─────────────┘
```

**坐标判断逻辑**:
```javascript
中国境内: lat: 3-54, lng: 73-136
其他: 海外
```

---

## 📚 详细文档

- **完整配置指南**: `docs/backend/geo/GOOGLE_GEOCODING_SETUP.md`
- **费用说明**: 每月$200免费 = 40,000次请求
- **API限制配置**: IP地址 + API范围（安全必备）
- **故障排查**: 常见问题和解决方案

---

## ✅ 配置检查清单

- [ ] Google Cloud项目已创建
- [ ] Geocoding API已启用
- [ ] API密钥已创建并限制
- [ ] `.env`已更新（GOOGLE_MAPS_API_KEY）
- [ ] 后端已重启
- [ ] 测试脚本通过（`test-google-geocoding.js`）
- [ ] 海外像素已回填

---

**不配置也不影响核心功能**，只是海外像素的geo信息精度较低。配置后可获得100%精确覆盖。
