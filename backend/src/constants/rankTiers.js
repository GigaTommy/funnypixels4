/**
 * 段位/军衔系统常量定义
 * 基于累计总像素数的段位体系
 */

const RANK_TIERS = [
  { id: 'recruit',    name: '新兵',   nameEn: 'Recruit',    minPixels: 0,       icon: 'star.fill',    color: '#9E9E9E' },
  { id: 'private',    name: '列兵',   nameEn: 'Private',    minPixels: 100,     icon: 'star.fill',    color: '#8D6E63' },
  { id: 'corporal',   name: '下士',   nameEn: 'Corporal',   minPixels: 500,     icon: 'shield.fill',  color: '#CD7F32' },
  { id: 'sergeant',   name: '中士',   nameEn: 'Sergeant',   minPixels: 2000,    icon: 'shield.fill',  color: '#C0C0C0' },
  { id: 'lieutenant', name: '少尉',   nameEn: 'Lieutenant', minPixels: 5000,    icon: 'shield.fill',  color: '#FFD700' },
  { id: 'captain',    name: '上尉',   nameEn: 'Captain',    minPixels: 15000,   icon: 'crown.fill',   color: '#CD7F32' },
  { id: 'major',      name: '少校',   nameEn: 'Major',      minPixels: 40000,   icon: 'crown.fill',   color: '#C0C0C0' },
  { id: 'colonel',    name: '上校',   nameEn: 'Colonel',    minPixels: 100000,  icon: 'crown.fill',   color: '#FFD700' },
  { id: 'general',    name: '将军',   nameEn: 'General',    minPixels: 250000,  icon: 'crown.fill',   color: '#00BCD4' },
  { id: 'marshal',    name: '元帅',   nameEn: 'Marshal',    minPixels: 1000000, icon: 'crown.fill',   color: '#E91E63' },
];

module.exports = { RANK_TIERS };
