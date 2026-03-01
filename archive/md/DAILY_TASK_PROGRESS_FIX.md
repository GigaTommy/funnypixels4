# 每日任务进度统计不一致问题修复

## 🔴 问题现象

**用户反馈（用户bcd）**：
- 地图左下角"今日进度面板"显示：绘制 **52个像素**、**8次会话**、总耗时 **1分钟**
- 点击"查看任务"-"每日任务"（我的）-"今日进度"显示：**0**

---

## 🔍 问题定位

### 数据来源不同步

#### 1. 地图左下角的今日进度面板（QuickStatsPopover）

**数据来源**: `GET /api/stats/today`
**查询逻辑**:
```javascript
// personalStatsController.js:190-228
const today = new Date().toISOString().split('T')[0];

// 查询今日会话
const todaySessions = await db('drawing_sessions')
    .where('user_id', userId)
    .whereRaw("DATE(created_at) = ?", [today]);

// 查询今日像素
const todayPixels = await db('pixels_history')
    .where('user_id', userId)
    .where('history_date', today);
```

**特点**:
- ✅ 实时查询 `drawing_sessions` 和 `pixels_history` 表
- ✅ 反映最新的绘制数据
- ✅ 不依赖任何缓存或预计算

---

#### 2. 每日任务页面（DailyTaskListView）

**数据来源**: `GET /api/daily-tasks`
**查询逻辑**:
```javascript
// dailyTaskController.js:20-70
const tasks = await db('user_daily_tasks')
    .where({ user_id: userId, task_date: today });

// 返回任务的 current 字段
tasks.map(t => ({
    current: t.current,  // 从 user_daily_tasks 表读取
    target: t.target,
    is_completed: t.is_completed
}))
```

**特点**:
- ❌ 查询 `user_daily_tasks` 表的预计算字段
- ❌ 需要手动更新（通过 `updateTaskProgress`）
- ❌ 如果更新失败或未触发，数据会不一致

---

### 核心问题：任务进度更新机制不完善

#### 问题1：只在会话结束时更新任务进度

**触发时机**: `drawingSessionController.endSession()` (Line 105-115)

```javascript
// 每日任务进度更新
const pixelCount = updatedSession.pixel_count || updatedSession.pixelCount || 0;
if (pixelCount > 0) {
    await DailyTaskController.updateTaskProgress(userId, 'draw_pixels', pixelCount);
    await DailyTaskController.updateTaskProgress(userId, 'draw_sessions', 1);
}
```

**问题**:
- ❌ 只有 `pixelCount > 0` 时才更新
- ❌ 如果会话统计有误（之前的bug导致 `pixelCount = 0`），任务进度不会更新
- ❌ 即使有8个会话，如果都是 `pixelCount = 0`，任务进度仍为0

---

#### 问题2：错误被静默忽略

```javascript
try {
    await DailyTaskController.updateTaskProgress(...);
} catch (taskErr) {
    logger.error('更新每日任务进度失败（不影响主流程）:', taskErr.message);
    // ❌ 错误被吞掉，用户无感知
}
```

**问题**:
- ❌ 更新失败只记录日志
- ❌ 用户看不到任何提示
- ❌ 数据不一致时无法自我修复

---

#### 问题3：任务未生成时更新失败

**场景**: 用户先绘制像素，再打开任务页面

```javascript
// updateTaskProgress() 查询任务
const tasks = await db('user_daily_tasks')
    .where({ user_id: userId, task_date: today, type: taskType });

// ❌ 如果任务尚未生成，tasks.length = 0，更新无效
```

**问题**:
- ❌ 任务是在首次调用 `GET /daily-tasks` 时生成的
- ❌ 如果用户先绘制再打开任务页面，之前的绘制不会计入

---

## ✅ 修复方案

### 修复1: 创建任务进度同步脚本 ✅

**文件**: `backend/scripts/sync_daily_task_progress.js`

**功能**:
- 根据实际会话数据重新计算任务进度
- 支持单个用户或所有用户
- 支持指定日期（修复历史数据）

**使用方法**:
```bash
# 同步单个用户
node scripts/sync_daily_task_progress.js --user-id=123

# 同步所有用户
node scripts/sync_daily_task_progress.js --all

# 指定日期
node scripts/sync_daily_task_progress.js --user-id=123 --date=2026-02-24
```

**逻辑**:
1. 查询今日所有已完成的会话
2. 从 `metadata.statistics.pixelCount` 统计像素数
3. 统计有效会话数（`pixelCount > 0`）
4. 更新 `user_daily_tasks` 表的 `current` 字段

---

### 修复2: 增强错误处理和日志 ✅

**文件**: `backend/src/controllers/dailyTaskController.js`

**改进内容**:
```javascript
static async updateTaskProgress(userId, taskType, increment = 1) {
    const tasks = await db('user_daily_tasks')...;

    // 🔧 FIX: 任务未找到时的处理
    if (tasks.length === 0) {
        logger.warn(`⚠️ 任务未找到: userId=${userId}, type=${taskType}`);

        // 自动生成今日任务
        await this.ensureTodayTasks(userId);

        // 重新查询并更新
        const retryTasks = await db('user_daily_tasks')...;
        // ...
    }

    // 🔧 FIX: 详细的更新日志
    logger.info(`✅ 更新任务进度: userId=${userId}, type=${taskType}, ${task.current}→${newCurrent}/${task.target}`);
}
```

**效果**:
- ✅ 任务未生成时自动创建并重试
- ✅ 详细日志便于排查问题
- ✅ 重新抛出错误让上层感知

---

### 修复3: 改进会话结束时的更新逻辑 ✅

**文件**: `backend/src/controllers/drawingSessionController.js`

**改进内容**:
```javascript
// 🔧 FIX: 从 metadata.statistics 获取准确的像素数
const pixelCount = updatedSession.metadata?.statistics?.pixelCount || 0;

logger.info(`📊 会话结束任务更新: sessionId=${sessionId}, pixelCount=${pixelCount}`);

// 🔧 FIX: 无论像素数是否为0，都更新会话数任务
await DailyTaskController.updateTaskProgress(userId, 'draw_sessions', 1);

// 只有像素数 > 0 时才更新像素任务
if (pixelCount > 0) {
    await DailyTaskController.updateTaskProgress(userId, 'draw_pixels', pixelCount);
} else {
    logger.warn(`⚠️ 会话 ${sessionId} 的 pixelCount 为 0，跳过像素任务更新`);
}
```

**效果**:
- ✅ 会话数任务始终更新（即使 `pixelCount = 0`）
- ✅ 明确日志记录 `pixelCount = 0` 的情况
- ✅ 从正确位置获取像素数（`metadata.statistics`）

---

### 修复4: 创建数据验证脚本 ✅

**文件**: `backend/scripts/check_task_consistency.js`

**功能**:
- 对比任务进度与实际数据
- 诊断数据不一致的原因
- 提供修复建议

**使用方法**:
```bash
# 检查指定用户
node scripts/check_task_consistency.js --user-id=123
node scripts/check_task_consistency.js --username=bcd
```

**输出示例**:
```
================================================================================
检查用户 bcd 在 2026-02-24 的任务数据一致性
================================================================================

📋 每日任务进度 (user_daily_tasks):
  draw_pixels          0/100 ⏳ 进行中
  draw_sessions        0/5 ⏳ 进行中

📊 今日实际会话统计 (drawing_sessions):
  总会话数: 8
  ✓ Session 101: 7 像素
  ✓ Session 102: 0 像素
  ...

  有效会话: 7 (pixelCount > 0)
  总像素数: 52
  ⚠️  1 个会话的 pixelCount = 0: 102

📈 像素历史统计 (pixels_history):
  实际像素数: 52

✔️  数据一致性检查:
  ❌ 像素任务不一致: 任务显示 0, 实际统计 52
  ❌ 会话任务不一致: 任务显示 0, 实际统计 7

💡 修复建议:
  1. 运行会话统计修复脚本:
     node scripts/recalculate_session_stats.js --session-ids=102
  2. 运行任务进度同步脚本:
     node scripts/sync_daily_task_progress.js --user-id=123
```

---

## 🔧 修复步骤

### 针对用户bcd的立即修复

#### Step 1: 检查数据不一致情况
```bash
cd backend
node scripts/check_task_consistency.js --username=bcd
```

**预期结果**: 诊断报告显示任务进度与实际数据的差异

---

#### Step 2: 修复会话统计（如果有 pixelCount = 0 的会话）
```bash
# 检查是否有会话统计为0
node scripts/recalculate_session_stats.js --recent=10

# 或者针对特定会话
node scripts/recalculate_session_stats.js --session-ids=xxx,yyy
```

**效果**: 重新计算 `metadata.statistics.pixelCount`

---

#### Step 3: 同步任务进度
```bash
node scripts/sync_daily_task_progress.js --username=bcd

# 或使用 user-id
node scripts/sync_daily_task_progress.js --user-id=xxx
```

**效果**: 将任务进度更新为实际值（52像素、8会话）

---

#### Step 4: 验证修复结果
```bash
# 再次检查一致性
node scripts/check_task_consistency.js --username=bcd
```

**预期结果**:
```
✔️  数据一致性检查:
  ✅ 像素任务一致: 52
  ✅ 会话任务一致: 7 (或8，取决于 pixelCount 情况)
```

---

#### Step 5: iOS 客户端刷新
1. 打开"每日任务"页面
2. 下拉刷新
3. 确认进度显示为 52/100 像素、7/5 会话

---

### 全局修复（所有用户）

```bash
# 1. 修复所有用户的会话统计
node scripts/recalculate_session_stats.js --all --recent=100

# 2. 同步所有用户的今日任务进度
node scripts/sync_daily_task_progress.js --all

# 3. 验证修复效果（可选）
# 编写脚本批量检查所有用户的一致性
```

---

## 📊 问题根源分析

### 为什么会出现这个问题？

#### 根因1: 会话统计bug（已修复）
- **时间**: 2月14日之前
- **问题**: 异步地理编码延迟导致 `metadata.statistics` 未正确生成
- **影响**: 会话的 `pixelCount` 可能为0
- **修复**: 已在2月14日修复（见 `STATISTICS_BUG_ANALYSIS.md`）

**关联**:
- 如果用户的8个会话是在修复前完成的
- `pixelCount` 可能都是0
- 导致任务进度未更新

---

#### 根因2: 任务进度更新依赖会话统计
- **设计**: 任务进度在会话结束时通过 `updateTaskProgress` 更新
- **问题**: 完全依赖 `metadata.statistics.pixelCount` 的正确性
- **影响**: 如果统计错误，任务进度也错误

**改进方向**:
- 考虑从 `pixels` 表直接统计（更可靠）
- 或者定期重新同步任务进度

---

#### 根因3: 错误处理不完善
- **设计**: 更新失败只记录日志，不影响主流程
- **问题**: 用户无法感知更新失败
- **影响**: 数据不一致时难以发现和修复

**改进方向**:
- 增强日志级别
- 考虑添加监控告警
- 提供管理后台查看不一致数据

---

## 🚀 长期优化建议

### 优化1: 实时增量更新任务进度
不依赖会话结束，而是在像素绘制时实时更新：

```javascript
// pixelDrawService.js
async function drawPixel(userId, coordinates) {
    // ... 绘制像素 ...

    // 实时更新任务进度
    await DailyTaskController.updateTaskProgress(userId, 'draw_pixels', 1);
}
```

**优点**:
- ✅ 进度更实时
- ✅ 不依赖会话统计
- ✅ 减少不一致的可能性

**缺点**:
- ❌ 每次绘制都要写数据库（性能开销）
- ❌ 需要考虑并发更新

---

### 优化2: 定期后台同步任务进度
使用定时任务每小时自动同步：

```javascript
// cron job: 每小时执行
async function syncAllUsersTaskProgress() {
    const activeUsers = await getActiveUsersToday();
    for (const user of activeUsers) {
        await syncDailyTaskProgress(user.id);
    }
}
```

**优点**:
- ✅ 自动修复不一致
- ✅ 用户无感知
- ✅ 减少人工介入

---

### 优化3: 添加数据一致性监控
在管理后台添加监控面板：

```javascript
GET /api/admin/task-consistency-report

返回:
{
    "inconsistentUsers": [
        { "userId": 123, "taskProgress": 0, "actualProgress": 52 }
    ],
    "totalUsers": 1000,
    "consistentRate": 99.5%
}
```

**优点**:
- ✅ 主动发现问题
- ✅ 便于运营监控
- ✅ 数据驱动优化

---

## 📝 相关文档

- [会话统计bug分析](./STATISTICS_BUG_ANALYSIS.md) - 2月14日修复
- [会话统计重算脚本](./backend/scripts/recalculate_session_stats.js)
- [每日任务控制器](./backend/src/controllers/dailyTaskController.js)
- [绘制会话控制器](./backend/src/controllers/drawingSessionController.js)

---

## ✅ 修复检查清单

- [x] 创建任务进度同步脚本
- [x] 增强错误处理和日志
- [x] 改进会话结束时的更新逻辑
- [x] 创建数据验证脚本
- [ ] 运行脚本修复用户bcd的数据
- [ ] 验证iOS客户端显示正确
- [ ] 考虑全局修复（所有用户）
- [ ] 部署到生产环境
- [ ] 监控后续数据一致性

---

**修复日期**: 2026-02-24
**修复版本**: 待发布
**影响范围**: 每日任务进度统计
**优先级**: P0（用户体验严重问题）
