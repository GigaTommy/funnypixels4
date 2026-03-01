/**
 * 联盟等级定义
 * 每级所需总经验 = baseExp * level^1.5
 */
const ALLIANCE_LEVELS = [
  { level: 1,  name: '新建联盟',   nameEn: 'Newcomer',    minExp: 0,      maxMembers: 20,  icon: 'shield' },
  { level: 2,  name: '成长联盟',   nameEn: 'Growing',     minExp: 1000,   maxMembers: 30,  icon: 'shield.fill' },
  { level: 3,  name: '活跃联盟',   nameEn: 'Active',      minExp: 3000,   maxMembers: 40,  icon: 'shield.lefthalf.filled' },
  { level: 4,  name: '强力联盟',   nameEn: 'Strong',      minExp: 7000,   maxMembers: 50,  icon: 'shield.checkered' },
  { level: 5,  name: '精英联盟',   nameEn: 'Elite',       minExp: 15000,  maxMembers: 60,  icon: 'star.shield' },
  { level: 6,  name: '王牌联盟',   nameEn: 'Ace',         minExp: 30000,  maxMembers: 75,  icon: 'star.shield.fill' },
  { level: 7,  name: '传奇联盟',   nameEn: 'Legendary',   minExp: 60000,  maxMembers: 100, icon: 'crown' },
  { level: 8,  name: '神话联盟',   nameEn: 'Mythic',      minExp: 120000, maxMembers: 150, icon: 'crown.fill' },
  { level: 9,  name: '至尊联盟',   nameEn: 'Supreme',     minExp: 250000, maxMembers: 200, icon: 'sparkles' },
  { level: 10, name: '永恒联盟',   nameEn: 'Eternal',     minExp: 500000, maxMembers: 300, icon: 'sun.max.fill' },
];

/**
 * 根据经验值获取联盟等级信息
 */
function getLevelForExp(experience) {
  let currentLevel = ALLIANCE_LEVELS[0];
  for (let i = ALLIANCE_LEVELS.length - 1; i >= 0; i--) {
    if (experience >= ALLIANCE_LEVELS[i].minExp) {
      currentLevel = ALLIANCE_LEVELS[i];
      break;
    }
  }

  const nextLevel = ALLIANCE_LEVELS.find(l => l.level === currentLevel.level + 1);
  const nextLevelExp = nextLevel ? nextLevel.minExp : currentLevel.minExp;
  const currentLevelExp = currentLevel.minExp;
  const expInLevel = experience - currentLevelExp;
  const expNeeded = nextLevelExp - currentLevelExp;
  const progress = expNeeded > 0 ? Math.min(expInLevel / expNeeded, 1.0) : 1.0;

  return {
    level: currentLevel.level,
    name: currentLevel.name,
    nameEn: currentLevel.nameEn,
    icon: currentLevel.icon,
    maxMembers: currentLevel.maxMembers,
    experience,
    nextLevelExp,
    progress,
    isMaxLevel: !nextLevel
  };
}

module.exports = { ALLIANCE_LEVELS, getLevelForExp };
