/**
 * Seed file generated from database dump
 * Table: store_items
 * Date: 2026-02-12T11:57:27.559Z
 */

exports.seed = async function(knex) {
  // Deletion policy
  await knex('store_items').del();
  
  if ([{"id":25,"name":"快速恢复剂","description":"立即恢复16个绘制点数，每日限用3次","price":100,"currency_type":"points","item_type":"consumable","is_available":true,"created_at":"2026-01-25T12:02:13.566Z","updated_at":"2026-02-01T03:42:38.652Z","image_url":null,"category":"consumable","price_points":100,"require_cash":false,"metadata":{"daily_limit":3,"pixel_points_restored":16},"active":true,"price_cny":null},{"id":26,"name":"超级恢复剂","description":"立即恢复32个绘制点数，每日限用1次","price":200,"currency_type":"points","item_type":"consumable","is_available":true,"created_at":"2026-01-25T12:02:13.566Z","updated_at":"2026-01-25T12:02:13.566Z","image_url":null,"category":"consumable","price_points":200,"require_cash":false,"metadata":{"daily_limit":1,"pixel_points_restored":32},"active":true,"price_cny":null},{"id":27,"name":"颜色炸弹","description":"一次性将6x6区域染成随机颜色，冷却时间30分钟","price":500,"currency_type":"points","item_type":"special","is_available":true,"created_at":"2026-01-25T12:02:13.566Z","updated_at":"2026-01-25T12:02:13.566Z","image_url":null,"category":"special","price_points":500,"require_cash":false,"metadata":{"radius":6,"area_size":6,"bomb_type":"color_bomb","cooldown_minutes":30},"active":true,"price_cny":null},{"id":28,"name":"Emoji炸弹","description":"一次性在6x6区域放置随机表情符号，冷却时间30分钟","price":800,"currency_type":"points","item_type":"special","is_available":true,"created_at":"2026-01-25T12:02:13.566Z","updated_at":"2026-01-25T12:02:13.566Z","image_url":null,"category":"special","price_points":800,"require_cash":false,"metadata":{"radius":6,"area_size":6,"bomb_type":"emoji_bomb","cooldown_minutes":30},"active":true,"price_cny":null},{"id":29,"name":"联盟炸弹","description":"一次性将6x6区域染成联盟颜色，冷却时间30分钟","price":1000,"currency_type":"points","item_type":"special","is_available":true,"created_at":"2026-01-25T12:02:13.566Z","updated_at":"2026-01-25T12:02:13.566Z","image_url":null,"category":"special","price_points":1000,"require_cash":false,"metadata":{"radius":6,"area_size":6,"bomb_type":"alliance_bomb","cooldown_minutes":30},"active":true,"price_cny":null},{"id":30,"name":"金色头像框","description":"炫酷的金色头像框，彰显你的尊贵身份","price":1000,"currency_type":"points","item_type":"cosmetic","is_available":true,"created_at":"2026-01-25T12:02:13.566Z","updated_at":"2026-01-25T12:02:13.566Z","image_url":null,"category":"cosmetic","price_points":1000,"require_cash":false,"metadata":null,"active":true,"price_cny":null},{"id":31,"name":"彩虹聊天气泡","description":"独特的彩虹色聊天气泡，让你的消息更显眼","price":800,"currency_type":"points","item_type":"cosmetic","is_available":true,"created_at":"2026-01-25T12:02:13.566Z","updated_at":"2026-01-25T12:02:13.566Z","image_url":null,"category":"cosmetic","price_points":800,"require_cash":false,"metadata":null,"active":true,"price_cny":null},{"id":32,"name":"像素大师徽章","description":"证明你是像素绘制大师的荣誉徽章","price":2000,"currency_type":"points","item_type":"cosmetic","is_available":true,"created_at":"2026-01-25T12:02:13.566Z","updated_at":"2026-01-25T12:02:13.566Z","image_url":null,"category":"cosmetic","price_points":2000,"require_cash":false,"metadata":null,"active":true,"price_cny":null}].length === 0) return;

  // Insert data in chunks to avoid query size limits
  const chunk = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));
  const data = [
  {
    "id": 25,
    "name": "快速恢复剂",
    "description": "立即恢复16个绘制点数，每日限用3次",
    "price": 30,
    "currency_type": "points",
    "item_type": "consumable",
    "is_available": true,
    "created_at": "2026-01-25T12:02:13.566Z",
    "updated_at": "2026-03-08T00:00:00.000Z",
    "image_url": null,
    "category": "consumable",
    "price_points": 30,
    "require_cash": false,
    "metadata": {
      "daily_limit": 3,
      "pixel_points_restored": 16
    },
    "active": true,
    "price_cny": null
  },
  {
    "id": 26,
    "name": "超级恢复剂",
    "description": "立即恢复32个绘制点数，每日限用1次",
    "price": 60,
    "currency_type": "points",
    "item_type": "consumable",
    "is_available": true,
    "created_at": "2026-01-25T12:02:13.566Z",
    "updated_at": "2026-03-08T00:00:00.000Z",
    "image_url": null,
    "category": "consumable",
    "price_points": 60,
    "require_cash": false,
    "metadata": {
      "daily_limit": 1,
      "pixel_points_restored": 32
    },
    "active": true,
    "price_cny": null
  },
  {
    "id": 27,
    "name": "颜色炸弹",
    "description": "一次性将6x6区域染成随机颜色，冷却时间30分钟",
    "price": 250,
    "currency_type": "points",
    "item_type": "special",
    "is_available": true,
    "created_at": "2026-01-25T12:02:13.566Z",
    "updated_at": "2026-03-08T00:00:00.000Z",
    "image_url": null,
    "category": "special",
    "price_points": 250,
    "require_cash": false,
    "metadata": {
      "radius": 6,
      "area_size": 6,
      "bomb_type": "color_bomb",
      "cooldown_minutes": 30
    },
    "active": true,
    "price_cny": null
  },
  {
    "id": 28,
    "name": "Emoji炸弹",
    "description": "一次性在6x6区域放置随机表情符号，冷却时间30分钟",
    "price": 400,
    "currency_type": "points",
    "item_type": "special",
    "is_available": true,
    "created_at": "2026-01-25T12:02:13.566Z",
    "updated_at": "2026-03-08T00:00:00.000Z",
    "image_url": null,
    "category": "special",
    "price_points": 400,
    "require_cash": false,
    "metadata": {
      "radius": 6,
      "area_size": 6,
      "bomb_type": "emoji_bomb",
      "cooldown_minutes": 30
    },
    "active": true,
    "price_cny": null
  },
  {
    "id": 29,
    "name": "联盟炸弹",
    "description": "一次性将6x6区域染成联盟颜色，冷却时间30分钟",
    "price": 600,
    "currency_type": "points",
    "item_type": "special",
    "is_available": true,
    "created_at": "2026-01-25T12:02:13.566Z",
    "updated_at": "2026-03-08T00:00:00.000Z",
    "image_url": null,
    "category": "special",
    "price_points": 600,
    "require_cash": false,
    "metadata": {
      "radius": 6,
      "area_size": 6,
      "bomb_type": "alliance_bomb",
      "cooldown_minutes": 30
    },
    "active": true,
    "price_cny": null
  },
  {
    "id": 30,
    "name": "金色头像框",
    "description": "炫酷的金色头像框，彰显你的尊贵身份",
    "price": 800,
    "currency_type": "points",
    "item_type": "cosmetic",
    "is_available": true,
    "created_at": "2026-01-25T12:02:13.566Z",
    "updated_at": "2026-03-08T00:00:00.000Z",
    "image_url": null,
    "category": "cosmetic",
    "price_points": 800,
    "require_cash": false,
    "metadata": null,
    "active": true,
    "price_cny": null
  },
  {
    "id": 31,
    "name": "彩虹聊天气泡",
    "description": "独特的彩虹色聊天气泡，让你的消息更显眼",
    "price": 500,
    "currency_type": "points",
    "item_type": "cosmetic",
    "is_available": false,
    "created_at": "2026-01-25T12:02:13.566Z",
    "updated_at": "2026-03-08T00:00:00.000Z",
    "image_url": null,
    "category": "cosmetic",
    "price_points": 500,
    "require_cash": false,
    "metadata": null,
    "active": false,
    "price_cny": null
  },
  {
    "id": 32,
    "name": "像素大师徽章",
    "description": "证明你是像素绘制大师的荣誉徽章",
    "price": 1500,
    "currency_type": "points",
    "item_type": "cosmetic",
    "is_available": true,
    "created_at": "2026-01-25T12:02:13.566Z",
    "updated_at": "2026-03-08T00:00:00.000Z",
    "image_url": null,
    "category": "cosmetic",
    "price_points": 1500,
    "require_cash": false,
    "metadata": null,
    "active": true,
    "price_cny": null
  }
];
  
  for (const batch of chunk(data, 50)) {
    await knex('store_items').insert(batch);
  }
};
