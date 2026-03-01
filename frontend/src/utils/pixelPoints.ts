// 用户点数与冷却机制
// 适用于MVP阶段的内存存储实现

// 核心配置
export const PIXEL_POINTS_CONFIG = {
  MAX_POINTS: 64,           // 最大点数
  ACCUM_INTERVAL: 10,       // 累计间隔（秒）
  FREEZE_SECONDS: 10,       // 冻结时间（秒）
  INIT_POINTS: 64          // 初始点数
};

// 用户像素状态数据结构
export type UserPixelState = {
  userId: string;
  pixelPoints: number;        // 当前可绘制点数
  lastAccumTime: number;      // 上次累计时间戳（秒）
  freezeUntil: number;        // 如果处于冻结，解冻的时间戳（秒），否则为0
};

// MVP用内存存储
const userPixelState = new Map<string, UserPixelState>();

// 确保用户状态存在
export function ensureUserState(userId: string): UserPixelState {
  if (!userPixelState.has(userId)) {
    const now = Math.floor(Date.now() / 1000);
    const initialState: UserPixelState = {
      userId,
      pixelPoints: PIXEL_POINTS_CONFIG.INIT_POINTS,
      lastAccumTime: now,
      freezeUntil: 0
    };
    userPixelState.set(userId, initialState);
  }
  return userPixelState.get(userId)!;
}

// 更新用户点数状态（累计点数）
export function updateUserPoints(userId: string): UserPixelState {
  const userState = ensureUserState(userId);
  const now = Math.floor(Date.now() / 1000);
  
  // 如果处于冻结状态，检查是否解冻
  if (userState.freezeUntil > 0) {
    if (now >= userState.freezeUntil) {
      // 解冻，恢复1点
      userState.freezeUntil = 0;
      userState.pixelPoints = 1;
      userState.lastAccumTime = now;
    } else {
      // 仍在冻结中，不累计点数
      return userState;
    }
  }
  
  // 计算应该累计的点数
  const timeDiff = now - userState.lastAccumTime;
  const accumCount = Math.floor(timeDiff / PIXEL_POINTS_CONFIG.ACCUM_INTERVAL);
  
  if (accumCount > 0) {
    userState.pixelPoints = Math.min(
      PIXEL_POINTS_CONFIG.MAX_POINTS,
      userState.pixelPoints + accumCount
    );
    userState.lastAccumTime = now;
  }
  
  return userState;
}

// 消耗点数
export function consumePoint(userId: string): { success: boolean; message: string; state?: UserPixelState } {
  const userState = updateUserPoints(userId);
  
  // 检查是否处于冻结状态
  if (userState.freezeUntil > 0) {
    const now = Math.floor(Date.now() / 1000);
    const remainingFreeze = userState.freezeUntil - now;
    return {
      success: false,
      message: `点数不足，冷却中，剩余${remainingFreeze}秒`
    };
  }
  
  // 检查是否有足够点数
  if (userState.pixelPoints <= 0) {
    // 进入冻结状态
    const now = Math.floor(Date.now() / 1000);
    userState.freezeUntil = now + PIXEL_POINTS_CONFIG.FREEZE_SECONDS;
    userState.pixelPoints = 0;
    
    return {
      success: false,
      message: `点数不足，进入${PIXEL_POINTS_CONFIG.FREEZE_SECONDS}秒冷却期`
    };
  }
  
  // 消耗1点
  userState.pixelPoints--;
  
  // 如果点数归零，进入冻结状态
  if (userState.pixelPoints === 0) {
    const now = Math.floor(Date.now() / 1000);
    userState.freezeUntil = now + PIXEL_POINTS_CONFIG.FREEZE_SECONDS;
  }
  
  return {
    success: true,
    message: `成功消耗1点，剩余${userState.pixelPoints}点`,
    state: userState
  };
}

// 获取用户状态
export function getUserPixelStatus(userId: string): UserPixelState {
  return updateUserPoints(userId);
}

// 重置用户状态（用于测试或特殊情况）
export function resetUserState(userId: string): UserPixelState {
  const now = Math.floor(Date.now() / 1000);
  const resetState: UserPixelState = {
    userId,
    pixelPoints: PIXEL_POINTS_CONFIG.INIT_POINTS,
    lastAccumTime: now,
    freezeUntil: 0
  };
  userPixelState.set(userId, resetState);
  return resetState;
}

// 获取所有用户状态（用于调试）
export function getAllUserStates(): Map<string, UserPixelState> {
  return new Map(userPixelState);
}

// 清理过期用户状态（可选，用于内存管理）
export function cleanupInactiveUsers(maxInactiveSeconds: number = 3600): number {
  const now = Math.floor(Date.now() / 1000);
  let cleanedCount = 0;
  
  for (const [userId, state] of userPixelState.entries()) {
    const timeSinceLastActivity = now - state.lastAccumTime;
    if (timeSinceLastActivity > maxInactiveSeconds) {
      userPixelState.delete(userId);
      cleanedCount++;
    }
  }
  
  return cleanedCount;
}
