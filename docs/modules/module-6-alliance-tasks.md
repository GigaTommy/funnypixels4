# Module 6: 联盟任务系统 - 技术方案

> **模块代号**: Module 6
> **模块名称**: 联盟任务系统 (Alliance Task System)
> **依赖模块**: Module 5 (联盟等级系统)
> **预计工作量**: 2周 (约60小时)
> **优先级**: 中 (联盟增强)

---

## 一、产品需求概要

### 核心功能
1. **每日联盟任务**: 每天0点自动生成（如"全体成员绘制10000像素"）
2. **周常挑战**: 每周一生成高难度任务
3. **协作机制**: 所有成员贡献进度，共同完成
4. **任务奖励**: 联盟经验 + 成员个人奖励

---

## 二、数据库设计

### alliance_tasks 表

```sql
CREATE TABLE alliance_tasks (
  id SERIAL PRIMARY KEY,
  alliance_id INTEGER REFERENCES alliances(id) ON DELETE CASCADE,
  task_type VARCHAR(50) NOT NULL,          -- 'daily', 'weekly'
  name VARCHAR(100) NOT NULL,
  description TEXT,
  target_value INTEGER NOT NULL,           -- 目标值（如10000像素）
  current_progress INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',     -- 'active', 'completed', 'expired'

  reward_alliance_exp INTEGER DEFAULT 0,
  reward_member_points INTEGER DEFAULT 0,  -- 每个参与成员获得积分

  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  completed_at TIMESTAMP
);
```

### alliance_task_progress 表（成员贡献记录）

```sql
CREATE TABLE alliance_task_progress (
  id SERIAL PRIMARY KEY,
  task_id INTEGER REFERENCES alliance_tasks(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  contribution INTEGER DEFAULT 0,           -- 个人贡献值
  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE (task_id, user_id)
);
```

---

## 三、Backend API

### 3.1 获取联盟任务列表

**Endpoint**: `GET /api/alliances/:id/tasks`

**Response**:
```json
{
  "tasks": [
    {
      "id": 456,
      "name": "全体绘画10000像素",
      "description": "所有成员今日绘画总像素达到10000",
      "target_value": 10000,
      "current_progress": 5200,
      "progress_percentage": 52,
      "status": "active",
      "reward": {
        "alliance_exp": 500,
        "member_points": 50
      },
      "top_contributors": [
        { "user_id": 1, "username": "玩家A", "contribution": 1500 },
        { "user_id": 2, "username": "玩家B", "contribution": 1200 }
      ],
      "expires_at": "2026-02-29T00:00:00Z"
    }
  ]
}
```

### 3.2 任务进度更新服务

```javascript
// backend/src/services/allianceTaskService.js
async function updateTaskProgress(allianceId, userId, taskType, value) {
  // 查询联盟今日活跃任务
  const tasks = await db('alliance_tasks')
    .where({ alliance_id: allianceId, task_type: taskType, status: 'active' })
    .select('*');

  for (const task of tasks) {
    // 更新个人贡献
    await db('alliance_task_progress')
      .insert({ task_id: task.id, user_id: userId, contribution: value })
      .onConflict(['task_id', 'user_id'])
      .merge({ contribution: db.raw('alliance_task_progress.contribution + ?', [value]) });

    // 更新任务总进度
    const totalProgress = await db('alliance_task_progress')
      .where({ task_id: task.id })
      .sum('contribution as total')
      .first();

    await db('alliance_tasks')
      .where({ id: task.id })
      .update({ current_progress: totalProgress.total || 0 });

    // 检查完成
    if (totalProgress.total >= task.target_value) {
      await completeAllianceTask(task.id);
    }
  }
}

async function completeAllianceTask(taskId) {
  // 标记完成
  await db('alliance_tasks').where({ id: taskId }).update({
    status: 'completed',
    completed_at: new Date()
  });

  // 发放奖励
  const task = await db('alliance_tasks').where({ id: taskId }).first();
  await require('./allianceExpService').addAllianceExp(task.alliance_id, task.reward_alliance_exp, 'task_complete');

  // TODO: 发放成员奖励
  console.log(`Alliance task ${taskId} completed`);
}
```

---

## 四、iOS Frontend

### AllianceTaskListView.swift

```swift
struct AllianceTaskCard: View {
    let task: AllianceTask

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(task.name)
                .font(.headline)

            ProgressView(value: Double(task.currentProgress), total: Double(task.targetValue))
                .progressViewStyle(LinearProgressViewStyle(tint: .blue))

            HStack {
                Text("\(task.currentProgress)/\(task.targetValue)")
                    .font(.caption)
                Spacer()
                Text("\(task.progressPercentage)%")
                    .font(.caption)
                    .foregroundColor(.blue)
            }

            if task.status == "completed" {
                Text("已完成")
                    .font(.subheadline)
                    .foregroundColor(.green)
            } else {
                Text("剩余时间: \(formatExpiry(task.expiresAt))")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }

    func formatExpiry(_ date: Date) -> String {
        let interval = date.timeIntervalSince(Date())
        let hours = Int(interval / 3600)
        let minutes = Int((interval.truncatingRemainder(dividingBy: 3600)) / 60)
        return "\(hours)小时\(minutes)分"
    }
}
```

---

## 五、实施步骤

| 任务 | 时间 |
|------|------|
| 数据库设计 | 4h |
| 任务生成服务 | 6h |
| 任务进度追踪服务 | 8h |
| 任务API（列表/详情） | 5h |
| iOS TaskService + ViewModel | 5h |
| iOS AllianceTaskListView | 8h |
| 测试 | 6h |

**总计**: 约42小时

---

**文档版本**: v1.0
**最后更新**: 2026-02-28
