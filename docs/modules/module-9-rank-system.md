# Module 9: 段位系统 - 技术方案

> **模块代号**: Module 9
> **模块名称**: 段位系统 (Rank/Tier System)
> **依赖模块**: 无
> **预计工作量**: 1周 (约40小时)
> **优先级**: 高 (游戏化核心)

---

## 一、产品需求

### 1.1 核心功能

#### FR1: 段位等级定义
- **10个段位**: 青铜、白银、黄金、铂金、钻石、大师、宗师、王者、传奇、神话
- **晋升阈值**: 基于累计像素数或赛季像素数
- **段位特权**: 颜色解锁、专属头像框、个性称号、排行榜可见性

#### FR2: 段位晋升机制
- **实时计算**: 用户绘画后立即检查是否晋升
- **晋升通知**: Push通知 + 应用内庆祝动画
- **全服公告**: 达到钻石及以上段位时全服广播

#### FR3: 赛季段位系统
- **赛季周期**: 每3个月一个赛季
- **赛季重置**: 赛季结束时段位软重置（下降1-2个段位）
- **赛季奖励**: 根据赛季最高段位发放奖励（皮肤、称号、道具）

---

## 二、数据库设计

### 2.1 段位配置表

#### rank_tiers 表（静态配置）
```sql
CREATE TABLE rank_tiers (
  id SERIAL PRIMARY KEY,
  tier_name VARCHAR(50) NOT NULL,               -- 段位名称（青铜、白银...）
  tier_level INTEGER UNIQUE NOT NULL,           -- 段位等级（1-10）
  pixels_required INTEGER NOT NULL,             -- 所需累计像素数

  -- 特权配置
  unlocked_colors JSONB,                        -- 解锁的颜色列表
  avatar_frame_url VARCHAR(500),                -- 专属头像框URL
  title VARCHAR(100),                           -- 专属称号
  leaderboard_visible BOOLEAN DEFAULT TRUE,     -- 是否在排行榜可见

  badge_icon_url VARCHAR(500),                  -- 段位徽章图标URL
  badge_color VARCHAR(7),                       -- 段位徽章颜色（Hex）

  created_at TIMESTAMP DEFAULT NOW()
);

-- Seed data
INSERT INTO rank_tiers (tier_name, tier_level, pixels_required, badge_color) VALUES
  ('青铜', 1, 0, '#CD7F32'),
  ('白银', 2, 500, '#C0C0C0'),
  ('黄金', 3, 2000, '#FFD700'),
  ('铂金', 4, 5000, '#E5E4E2'),
  ('钻石', 5, 10000, '#B9F2FF'),
  ('大师', 6, 20000, '#9370DB'),
  ('宗师', 7, 50000, '#FF4500'),
  ('王者', 8, 100000, '#FF1493'),
  ('传奇', 9, 200000, '#00CED1'),
  ('神话', 10, 500000, '#FFD700');
```

### 2.2 扩展users表

```sql
ALTER TABLE users
  ADD COLUMN current_rank INTEGER DEFAULT 1 REFERENCES rank_tiers(tier_level),
  ADD COLUMN season_rank INTEGER DEFAULT 1,
  ADD COLUMN season_pixels INTEGER DEFAULT 0,
  ADD COLUMN highest_rank_ever INTEGER DEFAULT 1,
  ADD COLUMN rank_updated_at TIMESTAMP;
```

### 2.3 赛季记录表

#### seasons 表
```sql
CREATE TABLE seasons (
  id SERIAL PRIMARY KEY,
  season_number INTEGER UNIQUE NOT NULL,
  season_name VARCHAR(100),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### user_season_ranks 表（赛季段位快照）
```sql
CREATE TABLE user_season_ranks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  season_id INTEGER REFERENCES seasons(id) ON DELETE CASCADE,
  final_rank INTEGER,
  final_pixels INTEGER,
  rewards_claimed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE (user_id, season_id)
);
```

---

## 三、Backend API 设计

### 3.1 获取用户段位信息

**Endpoint**: `GET /api/rank/me`

**Response**:
```json
{
  "success": true,
  "data": {
    "current_rank": {
      "tier_name": "黄金",
      "tier_level": 3,
      "badge_icon_url": "https://cdn.example.com/badges/gold.png",
      "badge_color": "#FFD700"
    },
    "total_pixels": 3500,
    "next_rank": {
      "tier_name": "铂金",
      "tier_level": 4,
      "pixels_required": 5000,
      "pixels_to_next": 1500,
      "progress_percentage": 70
    },
    "season_rank": {
      "tier_name": "白银",
      "tier_level": 2,
      "season_pixels": 1200
    },
    "highest_rank_ever": 4
  }
}
```

### 3.2 段位排行榜

**Endpoint**: `GET /api/rank/leaderboard?limit=100`

**Response**:
```json
{
  "success": true,
  "data": {
    "leaderboard": [
      {
        "user_id": 123,
        "username": "玩家A",
        "avatar_url": "https://...",
        "rank": {
          "tier_name": "传奇",
          "tier_level": 9,
          "badge_icon_url": "https://..."
        },
        "total_pixels": 250000,
        "position": 1
      }
      // ... top 100
    ]
  }
}
```

---

## 四、段位计算服务

### backend/src/services/rankService.js

```javascript
const db = require('../config/database');
const redisUtils = require('../utils/redis');

/**
 * 检查并更新用户段位
 */
async function checkAndUpdateRank(userId) {
  try {
    const user = await db('users').where({ id: userId }).first('total_pixels', 'current_rank');
    if (!user) return;

    // 查询段位配置
    const ranks = await db('rank_tiers').orderBy('tier_level', 'asc').select('*');

    // 计算应有段位
    let newRank = 1;
    for (const rank of ranks) {
      if (user.total_pixels >= rank.pixels_required) {
        newRank = rank.tier_level;
      } else {
        break;
      }
    }

    // 段位变化
    if (newRank !== user.current_rank) {
      await db('users').where({ id: userId }).update({
        current_rank: newRank,
        highest_rank_ever: db.raw('GREATEST(highest_rank_ever, ?)', [newRank]),
        rank_updated_at: new Date()
      });

      console.log(`[Rank] User ${userId} promoted to rank ${newRank}`);

      // 触发晋升通知
      if (newRank > user.current_rank) {
        await notifyRankPromotion(userId, newRank);
      }
    }
  } catch (error) {
    console.error('[Rank] Error:', error);
  }
}

async function notifyRankPromotion(userId, newRank) {
  // TODO: 发送Push通知
  // TODO: 如果newRank >= 5（钻石），发送全服公告
}

module.exports = { checkAndUpdateRank };
```

---

## 五、iOS Frontend 设计

### FunnyPixelsApp/Views/Rank/RankBadgeView.swift

```swift
import SwiftUI

struct RankBadgeView: View {
    let rank: UserRank

    var body: some View {
        HStack(spacing: 8) {
            // 段位图标
            AsyncImage(url: URL(string: rank.badgeIconUrl ?? "")) { image in
                image.resizable()
            } placeholder: {
                Circle()
                    .fill(Color(hex: rank.badgeColor))
            }
            .frame(width: 40, height: 40)
            .clipShape(Circle())

            VStack(alignment: .leading, spacing: 2) {
                Text(rank.tierName)
                    .font(.headline)
                    .foregroundColor(Color(hex: rank.badgeColor))

                if let nextRank = rank.nextRank {
                    Text("\(rank.totalPixels)/\(nextRank.pixelsRequired)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}

struct UserRank: Codable {
    let tierName: String
    let tierLevel: Int
    let badgeIconUrl: String?
    let badgeColor: String
    let totalPixels: Int
    let nextRank: NextRank?
}

struct NextRank: Codable {
    let tierName: String
    let pixelsRequired: Int
    let pixelsToNext: Int
    let progressPercentage: Int
}
```

---

## 六、实施步骤

| 序号 | 任务 | 预计时间 |
|-----|------|---------|
| 1 | 数据库设计（3张表） | 3h |
| 2 | Seed段位配置数据 | 2h |
| 3 | 实现rankService（段位计算） | 5h |
| 4 | 实现rankController（API） | 4h |
| 5 | iOS RankService + ViewModel | 4h |
| 6 | iOS RankBadgeView + UI | 6h |
| 7 | 晋升动画实现 | 4h |
| 8 | 赛季系统实现 | 6h |
| 9 | 测试与优化 | 6h |

**总计**: 约40小时（5个工作日）

---

## 七、验收标准

- [ ] 用户绘画后段位实时计算并更新
- [ ] 晋升时显示庆祝动画
- [ ] 段位排行榜正确显示前100名
- [ ] 赛季结束时段位正确重置
- [ ] 段位徽章在个人资料、排行榜正确显示

---

**文档版本**: v1.0
**最后更新**: 2026-02-28
