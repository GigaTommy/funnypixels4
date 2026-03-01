# 每日任务自动完成与奖励通知实现文档

## 📋 功能概述

本文档记录了每日任务系统的自动完成检测、奖励兑付、推送通知和定时重置功能的完整实现。

---

## ✅ 已实现功能（P0 - 最高优先级）

### 1. 任务进度自动计算 ✅

**状态**: 已完善

**实现位置**: `backend/src/controllers/dailyTaskController.js:226-330`

**核心功能**:
```javascript
static async updateTaskProgress(userId, taskType, increment = 1) {
  // 1. 查询用户今日任务
  // 2. 如果任务未生成，自动创建
  // 3. 更新任务进度
  // 4. 判断是否完成
  // 5. 发送完成通知
  // 6. 检查全勤奖励
}
```

**调用时机**:
- 绘制像素后 (`drawingSessionController.js:105-126`)
- 完成会话后
- 联盟签到后
- 发送私信后
- 完成其他任务类型时

**改进内容**:
- ✅ 添加了缺失的 `ensureTodayTasks()` 方法（自动生成任务）
- ✅ 增强了错误日志记录
- ✅ 完善了重试机制

---

### 2. 任务完成推送通知 🆕

**状态**: 新增实现

**实现位置**: `backend/src/controllers/dailyTaskController.js:299-332`

**功能说明**:
当用户完成单个任务时，自动发送推送通知。

**通知内容**:
```javascript
{
  title: '🎉 任务完成！',
  body: '恭喜！你完成了任务「像素画家」，获得10积分奖励！',
  type: 'daily_task_completed',
  data: {
    taskId: 123,
    taskType: 'draw_pixels',
    reward: 10
  }
}
```

**触发条件**:
- 任务进度达到100%
- 任务状态从未完成变为已完成
- 用户有活跃的设备token

**错误处理**:
- 推送失败不影响主流程
- 详细日志记录便于排查

---

### 3. 全勤奖励通知 🆕

**状态**: 新增实现

**实现位置**: `backend/src/controllers/dailyTaskController.js:318-332`

**功能说明**:
当用户完成当日所有任务时，额外发送全勤奖励通知。

**通知内容**:
```javascript
{
  title: '🏆 全勤奖励！',
  body: '太棒了！今日所有任务已完成，获得全勤奖励！记得明天继续保持哦～',
  type: 'daily_task_all_completed',
  data: {
    completedCount: 5,
    bonusReward: 50
  }
}
```

**检测逻辑**:
```javascript
const allTasksToday = await db('user_daily_tasks')
  .where({ user_id: userId, task_date: today });

const allCompleted = allTasksToday.every(t => t.is_completed);
```

---

### 4. 每日任务自动重置定时任务 🆕

**状态**: 新增实现

**文件**: `backend/src/tasks/resetDailyTasks.js`

**执行时间**: 每天 00:00 (Asia/Shanghai 时区)

**核心功能**:

#### 4.1 清理旧任务记录
```javascript
// 删除7天前的旧任务（节省存储空间）
const deleted = await db('user_daily_tasks')
  .where('task_date', '<', sevenDaysAgo)
  .del();
```

#### 4.2 统计昨日任务完成情况
```javascript
const yesterdayStats = await db('user_daily_tasks')
  .where('task_date', yesterday)
  .groupBy('user_id')
  .select(
    db.raw('COUNT(*) as total_tasks'),
    db.raw('SUM(CASE WHEN is_completed THEN 1 ELSE 0 END) as completed_tasks')
  );
```

#### 4.3 发送连续完成奖励通知（P1功能）
```javascript
// 为连续3天以上全勤的用户发送奖励通知
if (streakDays >= 3) {
  await pushNotificationService.sendToUser(
    userId,
    `🔥 连续${streakDays}天全勤！`,
    `你已连续${streakDays}天完成所有每日任务！继续保持，奖励会越来越丰厚～`,
    'daily_task_streak',
    { streakDays, bonusReward: streakDays * 10 }
  );
}
```

#### 4.4 预生成活跃用户的今日任务
```javascript
// 为昨天有绘制或登录记录的用户预生成今日任务
const activeUsers = await db('pixels_history')
  .distinct('user_id')
  .where('history_date', yesterday);

for (const user of activeUsers) {
  await DailyTaskController.generateDailyTasks(user.user_id, today);
}
```

**性能优化**:
- ✅ 只为活跃用户预生成任务
- ✅ 异步处理，不阻塞主流程
- ✅ 错误隔离，单个用户失败不影响其他用户

**注册位置**: `backend/src/server.js:1371-1381`

---

## 📊 数据流程图

```
用户绘制像素
   ↓
会话结束 (drawingSessionController.endSession)
   ↓
updateTaskProgress(userId, 'draw_pixels', pixelCount)
   ↓
┌─────────────────────────────────────┐
│ 1. 检查任务是否存在                  │
│    - 不存在则自动生成                │
└─────────────────────────────────────┘
   ↓
┌─────────────────────────────────────┐
│ 2. 更新任务进度                      │
│    current += increment              │
│    is_completed = (current >= target)│
└─────────────────────────────────────┘
   ↓
┌─────────────────────────────────────┐
│ 3. 任务刚完成？                      │
│    if (isCompleted && wasNotBefore)  │
└─────────────────────────────────────┘
   ↓ YES
┌─────────────────────────────────────┐
│ 4. 发送任务完成通知                  │
│    📲 "恭喜完成任务「xxx」"          │
└─────────────────────────────────────┘
   ↓
┌─────────────────────────────────────┐
│ 5. 检查是否所有任务都完成            │
│    allCompleted = allTasks.every...  │
└─────────────────────────────────────┘
   ↓ YES
┌─────────────────────────────────────┐
│ 6. 发送全勤奖励通知                  │
│    📲 "今日所有任务已完成！"         │
└─────────────────────────────────────┘
```

---

## 🕐 定时任务流程

```
每天 00:00 (Asia/Shanghai)
   ↓
startDailyTaskResetJob()
   ↓
┌─────────────────────────────────────┐
│ 1. 统计昨日任务完成情况              │
│    - 查询每个用户的完成数            │
└─────────────────────────────────────┘
   ↓
┌─────────────────────────────────────┐
│ 2. 计算连续完成天数                  │
│    - 最近30天的完成记录              │
│    - 计算连续完成streak              │
└─────────────────────────────────────┘
   ↓
┌─────────────────────────────────────┐
│ 3. 发送连续完成奖励通知              │
│    - 连续3天以上发送奖励             │
│    📲 "连续X天全勤！"                │
└─────────────────────────────────────┘
   ↓
┌─────────────────────────────────────┐
│ 4. 清理旧任务记录                    │
│    - 删除7天前的记录                 │
│    - 节省数据库空间                  │
└─────────────────────────────────────┘
   ↓
┌─────────────────────────────────────┐
│ 5. 预生成今日任务                    │
│    - 识别活跃用户                    │
│    - 为每个用户生成5个任务           │
└─────────────────────────────────────┘
```

---

## 📝 修改的文件清单

### 新增文件

1. **`backend/src/tasks/resetDailyTasks.js`** 🆕
   - 每日任务重置定时任务
   - 连续完成天数计算
   - 活跃用户任务预生成

2. **`backend/src/locales/daily_tasks.json`** 🆕
   - 多语言本地化字符串定义
   - 支持5种语言: zh, en, ja, ko, es

3. **`backend/src/utils/notificationI18n.js`** 🆕
   - 推送通知国际化工具
   - 自动根据用户语言偏好生成通知内容

4. **`backend/scripts/import_daily_tasks_localization.js`** 🆕
   - 本地化字符串导入脚本

5. **`backend/src/database/migrations/20260224000001_add_preferred_language_to_users.js`** 🆕
   - 添加用户语言偏好字段

### 修改文件

1. **`backend/src/controllers/dailyTaskController.js`**
   - 新增 `ensureTodayTasks()` 方法 (Line 226-239)
   - 添加推送通知依赖导入 (Line 3)
   - 任务完成时发送推送通知 (Line 299-317)
   - 全勤奖励检测和通知 (Line 318-332)

2. **`backend/src/server.js`**
   - 注册每日任务重置定时任务 (Line 1371-1381)

---

## 🔔 推送通知类型

### 1. 单个任务完成通知
```json
{
  "type": "daily_task_completed",
  "title": "🎉 任务完成！",
  "body": "恭喜！你完成了任务「像素画家」，获得10积分奖励！",
  "data": {
    "taskId": 123,
    "taskType": "draw_pixels",
    "reward": 10
  }
}
```

### 2. 全勤奖励通知
```json
{
  "type": "daily_task_all_completed",
  "title": "🏆 全勤奖励！",
  "body": "太棒了！今日所有任务已完成，获得全勤奖励！记得明天继续保持哦～",
  "data": {
    "completedCount": 5,
    "bonusReward": 50
  }
}
```

### 3. 连续完成奖励通知（每日0点发送）
```json
{
  "type": "daily_task_streak",
  "title": "🔥 连续7天全勤！",
  "body": "你已连续7天完成所有每日任务！继续保持，奖励会越来越丰厚～",
  "data": {
    "streakDays": 7,
    "bonusReward": 70
  }
}
```

---

## 🌍 多语言支持（i18n）

### 概述

所有推送通知都支持多语言，根据用户的 `preferred_language` 设置自动发送对应语言的通知。

### 支持的语言

- 🇨🇳 **简体中文** (zh-Hans) - 默认语言
- 🇺🇸 **English** (en)
- 🇯🇵 **日本語** (ja)
- 🇰🇷 **한국어** (ko)
- 🇪🇸 **Español** (es)
- 🇧🇷 **Português (Brasil)** (pt-BR)

### 实现方式

```javascript
// 1. 获取用户语言偏好
const langCode = await getUserLanguage(userId);  // 从 users.preferred_language

// 2. 获取本地化的通知内容
const notification = await getTaskCompletedNotification(userId, {
  title: task.title,
  reward: task.reward_points
});

// 3. 发送本地化的推送通知
await pushNotificationService.sendToUser(
  userId,
  notification.title,  // 根据用户语言返回
  notification.body,   // 支持模板参数替换
  'daily_task_completed'
);
```

### 本地化字符串示例

**中文 (zh)**:
```
标题: 🎉 任务完成！
内容: 恭喜！你完成了任务「像素画家」，获得10积分奖励！
```

**English (en)**:
```
Title: 🎉 Task Completed!
Body: Congratulations! You completed the task "Pixel Painter" and earned 10 points!
```

**日本語 (ja)**:
```
タイトル: 🎉 タスク完了！
内容: おめでとうございます！タスク「ピクセルペインター」を完了し、10ポイント獲得しました！
```

### 添加新语言

1. 编辑 `backend/src/locales/daily_tasks.json`，添加新语言
2. 运行导入脚本: `node scripts/import_daily_tasks_localization.js`
3. 重启服务: `pm2 restart backend`

详细文档参见: [DAILY_TASKS_I18N_IMPLEMENTATION.md](./DAILY_TASKS_I18N_IMPLEMENTATION.md)

---

## 📱 iOS 客户端处理

### 现有支持

iOS 客户端已实现以下动画和反馈：

1. **Toast消息** (`DailyTaskListView.swift:236`)
   ```swift
   ToastView(message: message, type: .success)
   ```

2. **Haptic反馈** (`DailyTaskListView.swift:235`)
   ```swift
   HapticManager.shared.notification(type: .success)
   ```

3. **声音反馈** (`DailyTaskListView.swift:237`)
   ```swift
   SoundManager.shared.playSound(.taskComplete)
   ```

4. **进度动画** (`DailyTaskCardView.swift`)
   - 进度条动画
   - 完成徽章显示
   - 奖励积分动画

### 需要添加的功能

iOS 客户端需要在 `AppDelegate.swift` 或 `NotificationService.swift` 中处理新的推送通知类型：

```swift
// 处理推送通知
func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
) {
    let userInfo = response.notification.request.content.userInfo

    if let type = userInfo["type"] as? String {
        switch type {
        case "daily_task_completed":
            // 导航到每日任务页面
            navigateToTaskDetail(userInfo["taskId"])

        case "daily_task_all_completed":
            // 显示全勤奖励动画
            showBonusRewardAnimation()

        case "daily_task_streak":
            // 显示连续完成奖励
            showStreakRewardAnimation(userInfo["streakDays"])

        default:
            break
        }
    }

    completionHandler()
}
```

---

## 🧪 测试验证

### 1. 任务完成通知测试

```bash
# 1. 启动后端服务
npm start

# 2. 模拟用户绘制像素
curl -X POST http://localhost:3000/api/pixel-draw/gps \
  -H "Authorization: Bearer <token>" \
  -d '{
    "coordinates": [116.397428, 39.90923],
    "color": "#FF0000"
  }'

# 3. 查看日志确认通知发送
# 预期日志：
# ✅ 更新任务进度: userId=xxx, type=draw_pixels, 49→50/50 ✓已完成
# 📲 已发送任务完成通知: userId=xxx, taskId=123
```

### 2. 全勤奖励通知测试

```bash
# 1. 完成最后一个任务
curl -X POST http://localhost:3000/api/daily-tasks/123/claim \
  -H "Authorization: Bearer <token>"

# 2. 查看日志确认全勤通知
# 预期日志：
# 📲 已发送全勤奖励通知: userId=xxx
```

### 3. 定时任务测试

```bash
# 手动触发定时任务
cd backend
node -e "require('./src/tasks/resetDailyTasks').resetDailyTasks().then(console.log)"

# 预期输出：
# 🔄 开始重置每日任务...
# 📊 昨日任务统计: 10个用户
# 📲 已发送3个连续完成通知
# 🗑️ 已清理50条7天前的旧任务记录
# 👥 检测到8个活跃用户，开始预生成今日任务...
# ✅ 已为8个用户预生成今日任务
# ✅ 每日任务重置完成
```

---

## 🚀 部署清单

### 服务端部署

1. ✅ 拉取最新代码
2. ✅ 安装依赖 `npm install`
3. ✅ 运行数据库迁移（添加 preferred_language 字段）
   ```bash
   cd backend
   npm run migrate
   # 或
   npx knex migrate:latest
   ```
4. 🆕 导入多语言本地化字符串
   ```bash
   node scripts/import_daily_tasks_localization.js
   ```
   **预期输出**: 成功导入 zh, en, ja, ko, es 5种语言的本地化字符串
5. ✅ 重启服务 `pm2 restart backend`
6. ✅ 验证定时任务启动成功
   ```bash
   pm2 logs backend | grep "每日任务重置定时任务已启动"
   ```
7. 🆕 验证多语言支持
   ```bash
   # 检查本地化字符串是否导入成功
   psql -d funnypixels -c "
     SELECT lang_code, COUNT(*) as count
     FROM localization_strings
     WHERE key LIKE 'notification.%'
     GROUP BY lang_code;
   "
   # 预期输出: zh, en, ja, ko, es 各4条记录
   ```

### iOS 客户端部署

1. ⏳ 添加推送通知处理逻辑（参考上述代码）
2. ⏳ 测试推送通知接收和显示
3. ⏳ 提交 TestFlight 版本
4. ⏳ 内部测试验证

---

## 📈 监控指标

### 关键指标

1. **任务完成率**
   ```sql
   SELECT
     task_date,
     COUNT(*) as total_tasks,
     SUM(CASE WHEN is_completed THEN 1 ELSE 0 END) as completed_tasks,
     ROUND(SUM(CASE WHEN is_completed THEN 1 ELSE 0 END)::float / COUNT(*) * 100, 2) as completion_rate
   FROM user_daily_tasks
   WHERE task_date >= NOW() - INTERVAL '7 days'
   GROUP BY task_date
   ORDER BY task_date DESC;
   ```

2. **推送通知发送成功率**
   ```sql
   SELECT
     DATE(sent_at) as date,
     type,
     COUNT(*) as total_sent
   FROM push_notifications
   WHERE type IN ('daily_task_completed', 'daily_task_all_completed', 'daily_task_streak')
   GROUP BY date, type
   ORDER BY date DESC;
   ```

3. **连续完成天数分布**
   ```javascript
   // 运行streak计算脚本
   const { calculateUserStreak } = require('./src/tasks/resetDailyTasks');

   const users = await db('users').select('id');
   const streaks = await Promise.all(
     users.map(u => calculateUserStreak(u.id))
   );

   console.log('Streak分布:', {
     '0天': streaks.filter(s => s === 0).length,
     '1-2天': streaks.filter(s => s >= 1 && s <= 2).length,
     '3-6天': streaks.filter(s => s >= 3 && s <= 6).length,
     '7天以上': streaks.filter(s => s >= 7).length
   });
   ```

4. **定时任务执行日志**
   ```bash
   # 查看最近的定时任务执行情况
   pm2 logs backend | grep "每日任务重置"

   # 预期看到：
   # ✅ 每日任务重置完成 { activeUsers: 100, preGenerated: 95, streakNotifications: 20, deletedOldRecords: 500 }
   ```

---

## 🎯 后续优化建议（P1/P2）

### P1 - 次高优先级

#### 1. 连续完成奖励倍增机制
**当前**: 固定50积分全勤奖励
**改进**: 连续完成天数越多，奖励倍增

```javascript
const bonusMultiplier = Math.min(streakDays / 7, 3); // 最高3倍
const bonusReward = 50 * bonusMultiplier;
```

#### 2. 任务未完成提醒通知
**当前**: 只在完成时通知
**改进**: 每天晚上20:00提醒未完成任务的用户

```javascript
// cron: 每天20:00执行
async function sendTaskReminderNotifications() {
  const today = new Date().toISOString().split('T')[0];

  const usersWithIncompleteTasks = await db('user_daily_tasks')
    .where('task_date', today)
    .where('is_completed', false)
    .distinct('user_id');

  for (const user of usersWithIncompleteTasks) {
    await pushNotificationService.sendToUser(
      user.user_id,
      '⏰ 还有任务未完成',
      '今天的每日任务还没完成哦，完成所有任务可以获得额外奖励！',
      'daily_task_reminder'
    );
  }
}
```

#### 3. 周任务和月任务系统
**当前**: 只有每日任务
**改进**: 添加周任务和月任务，长期目标

```javascript
// 新表：user_weekly_tasks, user_monthly_tasks
// 新端点：GET /api/weekly-tasks, GET /api/monthly-tasks
```

### P2 - 低优先级

#### 1. 管理后台任务监控
- 实时查看所有用户的任务完成情况
- 手动发送任务奖励
- 调整任务难度和奖励

#### 2. 任务历史记录
- 用户可以查看历史任务完成记录
- 统计图表展示任务完成趋势

#### 3. 动态任务难度调整
- 根据用户活跃度自动调整任务难度
- 新用户任务更简单，老用户任务更有挑战

---

## 🐛 已知问题

### 1. 推送通知可能的Mock模式

**问题**: 如果未配置 APN 证书，推送通知运行在 mock 模式

**影响**: 通知只会记录日志，不会真实发送到设备

**解决方案**:
```bash
# 配置环境变量
export APN_KEY_ID=<your_key_id>
export APN_TEAM_ID=<your_team_id>
export APN_KEY_PATH=/path/to/AuthKey.p8
export APN_BUNDLE_ID=com.funnypixels.app
```

### 2. 时区问题

**问题**: 定时任务使用 Asia/Shanghai 时区，但服务器可能在其他时区

**影响**: 任务重置时间可能不是用户的本地午夜

**解决方案**:
- 确保服务器时区设置正确
- 或在定时任务中根据用户时区动态调整

---

## 📚 相关文档

- [每日任务API文档](./API_DAILY_TASKS.md)
- [推送通知集成指南](./PUSH_NOTIFICATION_GUIDE.md)
- [定时任务管理](./CRON_JOBS.md)
- [今日统计性能优化](./TODAY_STATS_PERFORMANCE_OPTIMIZATION.md)
- [每日任务进度修复](./DAILY_TASK_PROGRESS_FIX.md)

---

**实现日期**: 2026-02-24
**实现版本**: 待发布
**影响范围**: 每日任务系统完整功能
**优先级**: P0（核心功能）

---

## ✅ 功能完成度总结

| 功能 | 优先级 | 状态 | 说明 |
|------|--------|------|------|
| 任务进度自动计算 | P0 | ✅ 完成 | 绘制、会话、签到等自动更新 |
| 任务完成推送通知 | P0 | ✅ 完成 | 单个任务完成时通知 |
| 全勤奖励通知 | P0 | ✅ 完成 | 当日所有任务完成时通知 |
| 每日任务自动重置 | P0 | ✅ 完成 | 每天0点自动重置 |
| 连续完成奖励通知 | P1 | ✅ 完成 | 定时任务中已实现 |
| 活跃用户任务预生成 | P0 | ✅ 完成 | 提升首次打开速度 |
| 旧任务记录清理 | P0 | ✅ 完成 | 节省数据库空间 |
| iOS 推送通知处理 | P0 | ⏳ 待实现 | 需要iOS客户端配合 |
| 任务未完成提醒 | P1 | ⏳ 待实现 | 每天晚上20:00提醒 |
| 周任务/月任务 | P1 | ⏳ 待实现 | 长期目标系统 |
| 管理后台监控 | P2 | ⏳ 待实现 | 运营工具 |
| 任务历史记录 | P2 | ⏳ 待实现 | 用户体验优化 |
| 动态难度调整 | P2 | ⏳ 待实现 | 智能推荐 |

**当前完成度**: 7/13 = **54%**
**P0功能完成度**: 6/7 = **86%** (待iOS客户端配合)
**P1功能完成度**: 1/3 = **33%**
**P2功能完成度**: 0/3 = **0%**

---

## 🎉 总结

本次实现完成了每日任务系统的核心功能（P0优先级），包括：

1. ✅ **自动进度计算** - 用户行为自动更新任务进度
2. ✅ **即时推送通知** - 任务完成和全勤奖励实时通知
3. ✅ **定时任务重置** - 每日自动重置和预生成任务
4. ✅ **连续完成奖励** - 激励用户持续参与

这些功能将显著提升用户参与度和留存率，为产品的日活和用户粘性打下坚实基础。
