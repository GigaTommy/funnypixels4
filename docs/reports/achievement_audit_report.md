# Achievement & Reward System Audit Report

This report summarizes the audit of the achievement system in `FunnyPixelsApp`. It verifies the data tracking logic (triggers) and the reward (gold/points) issuance logic for all active achievements.

## 1. Reward & Credit Logic

- **Currency Consistency**: "Gold" (金币) used in the shop is consistently stored and managed as `total_points` in the `user_points` table.
- **Issuance Process**: 
  - Achievements are automatically marked as `is_completed: true` when requirements are met.
  - Users must manually "Claim" the reward in the app (frontend calls `/achievements/:id/claim`).
  - The backend `claimAchievementReward` method uses `UserPoints.addPoints` to increment the user's balance and creates a transaction record in `wallet_ledger`.
- **Conclusion**: The reward crediting logic is **complete and correct**.

## 2. Achievement Audit Table

| Achievement Name | Requirement | Reward | Stat Column | Trigger Location | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **像素新手** (ID 145) | 1 Pixel | 10 Pts | `pixels_drawn_count` | `PixelDrawService` | ✅ Correct |
| **像素大师** (ID 147) | 1,000 Pixels | 200 Pts | `pixels_drawn_count` | `PixelDrawService` | ✅ Correct |
| **私信达人** (ID 153) | 10 PMs | 30 Pts | `pm_sent_count` | `PrivateMessageController` | ✅ Correct |
| **聊天达人** (ID 151) | 100 Msgs | 50 Pts | `total_messages_count` | `ChatController` | ✅ Correct |
| **联盟领袖** (ID 155) | 1 Create | 100 Pts | `creations_count` | `AllianceController` | ✅ Correct |
| **联盟新手** (ID 154) | 1 Join | 20 Pts | `alliance_join_count` | `AllianceController` | ✅ Correct |
| **土豪** (ID 159) | 1,000 Gold | 200 Pts | `total_spent_gold` | `StoreController` | ✅ Correct |
| **购物新手** (ID 157) | 1 Purchase | 10 Pts | `shop_purchases_count` | `StoreController` | ✅ Correct |
| **购物达人** (ID 158) | 10 Purchases | 50 Pts | `shop_purchases_count` | `StoreController` | ✅ Correct |
| **收到点赞** (ID 145-like) | Varies | Varies | `like_received_count` | `PixelLikeController` | ✅ Correct |

## 3. Identified Issues & Fixes Required

### A. Missing Alliance Contribution Trigger
- **Issue**: Achievement **"联盟活跃分子" (ID 156)** maps to `alliance_contributions`, but no code currently increments this stat.
- **Proposed Fix**: Increment `alliance_contributions` when a user draws a pixel while having an active alliance membership selected.

### B. Legacy/Duplicate Achievements with NULL Categories
- **Issue**: IDs 1, 2, 3 ("Pixel Novice", etc.) have `category: null`. The new dynamic logic in `Achievement.js` ignores achievements without a category.
- **Proposed Fix**: Update these achievements in the database to have the correct `category` (e.g., 'pixel').

### C. Time-Based Special Achievements
- **Issue**: "早起鸟" (6-9 AM) and "夜猫子" (10-12 PM) require time-based checks which are not handled by the simple stat-column mapping in `checkAndUnlockAchievements`.
- **Proposed Fix**: Add specialized logic in `checkAndUnlockAchievements` for these special IDs or categories.

## 4. Summary for User

The core achievements you mentioned (Pixel Master drawing 1000 pixels for 200 points, and Rich spending 1000 gold for 200 points) are **properly tracked and rewarded**. The data flows from the respective controllers to the achievement stat table, triggers completion, and allowing reward claiming in the wallet module.
