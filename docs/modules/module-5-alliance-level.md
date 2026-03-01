# Module 5: 联盟等级与成长系统 - 技术方案

> **模块代号**: Module 5
> **模块名称**: 联盟等级与成长系统 (Alliance Level & Growth System)
> **依赖模块**: 无
> **预计工作量**: 1周 (约40小时)
> **优先级**: 中 (联盟增强)

---

## 一、产品需求概要

### 核心功能
1. **联盟经验值系统**: 成员绘画、任务完成、战争胜利获得经验
2. **联盟等级体系**: 1-50级，每级解锁不同特权
3. **等级特权**: 成员上限提升、专属功能解锁（聊天室、任务系统等）
4. **升级奖励**: 金币、道具、专属称号

---

## 二、数据库设计

### 2.1 扩展alliances表

```sql
ALTER TABLE alliances
  ADD COLUMN level INTEGER DEFAULT 1,
  ADD COLUMN exp INTEGER DEFAULT 0,
  ADD COLUMN total_exp INTEGER DEFAULT 0;
```

### 2.2 联盟等级配置表

```sql
CREATE TABLE alliance_levels (
  level INTEGER PRIMARY KEY,
  exp_required INTEGER NOT NULL,           -- 所需累计经验值
  member_limit INTEGER DEFAULT 20,         -- 成员上限
  features JSONB,                          -- 解锁功能 {"chat": true, "tasks": true}
  created_at TIMESTAMP DEFAULT NOW()
);

-- Seed 数据 (示例)
INSERT INTO alliance_levels (level, exp_required, member_limit, features) VALUES
  (1, 0, 20, '{"chat": false, "tasks": false}'),
  (2, 500, 30, '{"chat": true, "tasks": false}'),
  (3, 1500, 40, '{"chat": true, "tasks": false}'),
  (5, 5000, 50, '{"chat": true, "tasks": true}'),
  (10, 20000, 80, '{"chat": true, "tasks": true, "war": true}'),
  (50, 500000, 200, '{"chat": true, "tasks": true, "war": true, "custom_flag": true}');
```

---

## 三、Backend API

### 3.1 获取联盟详情（包含等级信息）

**Endpoint**: `GET /api/alliances/:id`

**Response**:
```json
{
  "id": 123,
  "name": "示例联盟",
  "level": 5,
  "exp": 5200,
  "total_exp": 5200,
  "next_level": {
    "level": 6,
    "exp_required": 8000,
    "exp_to_next": 2800,
    "progress_percentage": 65
  },
  "features": {
    "chat": true,
    "tasks": true,
    "war": false
  },
  "member_limit": 50,
  "member_count": 38
}
```

### 3.2 联盟经验值增加逻辑

```javascript
// backend/src/services/allianceExpService.js
async function addAllianceExp(allianceId, exp, reason) {
  const trx = await db.transaction();

  try {
    // 增加经验
    await trx('alliances')
      .where({ id: allianceId })
      .increment('exp', exp)
      .increment('total_exp', exp);

    const alliance = await trx('alliances').where({ id: allianceId }).first();

    // 检查是否升级
    const nextLevel = await trx('alliance_levels')
      .where('exp_required', '>', alliance.total_exp)
      .orderBy('level', 'asc')
      .first();

    if (nextLevel && alliance.level < nextLevel.level - 1) {
      await trx('alliances').where({ id: allianceId }).update({ level: nextLevel.level - 1 });
      console.log(`Alliance ${allianceId} leveled up to ${nextLevel.level - 1}`);
      // TODO: 发送升级通知
    }

    await trx.commit();
  } catch (error) {
    await trx.rollback();
    console.error('addAllianceExp error:', error);
  }
}

module.exports = { addAllianceExp };
```

---

## 四、iOS Frontend

### AllianceLevelView.swift

```swift
struct AllianceLevelBadge: View {
    let alliance: Alliance

    var body: some View {
        HStack {
            Text("Lv.\(alliance.level)")
                .font(.headline)
                .foregroundColor(.white)
                .padding(8)
                .background(Color.blue)
                .clipShape(Circle())

            VStack(alignment: .leading) {
                ProgressView(value: Double(alliance.exp), total: Double(alliance.nextLevel?.expRequired ?? 1))
                    .progressViewStyle(LinearProgressViewStyle())

                Text("\(alliance.exp)/\(alliance.nextLevel?.expRequired ?? 0) EXP")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}
```

---

## 五、实施步骤

| 任务 | 时间 |
|------|------|
| 数据库设计 + Seed数据 | 3h |
| 后端经验值服务 | 5h |
| API扩展（联盟详情含等级） | 3h |
| iOS等级UI组件 | 4h |
| 升级通知实现 | 3h |
| 测试 | 4h |

**总计**: 约22小时

---

**文档版本**: v1.0
**最后更新**: 2026-02-28
